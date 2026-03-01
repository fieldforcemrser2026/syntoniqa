# Syntoniqa — Piano di Refactoring Completo

> Audit eseguito il 1 marzo 2026 su 15.997 righe di codice
> admin_v1.html (7543) · index_v2.html (2806) · cloudflare_worker.js (5648)

---

## FASE 1 — Fix Critici (Funziona → Non Crasha)

### 1.1 Funzioni JS undefined nell'admin
| Funzione chiamata | Dove | Fix |
|---|---|---|
| `showToast()` | Upload foto, azioni rapide | Rinominare in `toast()` (che esiste) |
| `reloadData()` | Post-salvataggio | Rinominare in `refreshData(true)` |
| `showDetail()` | Dashboard, calendario | Implementare dispatcher per tipo entità |
| `_getSelectedTecnici()` | Filtro mappa | Implementare lettura checkbox tecnici |

### 1.2 Memory Leak nel tecnico (index_v2)
- **Chat polling**: `setInterval` mai pulito → clearInterval su `goPage()` quando si esce da pgChat
- **Auto-refresh timer**: si duplica dopo logout/login → clear prima di reassign in `enterApp()`
- **Pull-to-refresh listeners**: si accumulano → flag `_pullInitialized` per evitare duplicati

### 1.3 CRUD mancanti (solo admin)
Entità che hanno solo "+Nuovo" ma non Edit/Delete:

| Entità | Create | Read | Update | Delete | Da aggiungere |
|---|---|---|---|---|---|
| Ordini | ✅ | ✅ | ❌ | ❌ | Edit modale + Delete con conferma |
| Installazioni | ✅ | ✅ | ❌ | ❌ | Edit modale + Delete |
| Notifiche | ✅ | ✅ | ❌ | ❌ | Delete singola + bulk |
| Checklist | ✅ | ✅ | ❌ | ✅ | Edit template |
| Documenti | ✅ | ✅ | ❌ | ❌ | Edit + Delete |
| Allegati | ✅ | ✅ | ❌ | ❌ | Delete |
| Clienti | ✅ | ✅ | ✅ | ❌ | Soft delete (obsoleto) |
| Macchine | ✅ | ✅ | ✅ | ❌ | Soft delete |
| Automezzi | ✅ | ✅ | ✅ | ❌ | Soft delete |

### 1.4 Bug backend (worker)
- Typo `tecnici_i_ds` → `tecnici_ids` in `createTrasferta`
- Error handling in loop auto-resolve urgenze (try/catch mancante dentro il for)
- Paginazione `getAnagraficaAssets` senza limite max iterazioni (aggiungere max 10 cicli)

---

## FASE 2 — Modello Dati Coerente

### 2.1 Gerarchia Interventi
**Problema**: Interventi, urgenze, tagliandi, installazioni sono entità separate sconnesse.

**Soluzione proposta**: Un intervento ha un `tipo` che determina comportamento e campi:

| Tipo | Tabella attuale | Flusso | Durata default |
|---|---|---|---|
| `ordinario` | piano | pianificato → in_corso → completato | variabile |
| `urgenza` | urgenze | aperta → assegnata → in_corso → risolta → chiusa | variabile |
| `tagliando` | piano (tipo=PM) | da PM scheduling, sempre 6h | 6h fisso |
| `installazione` | installazioni | pianificata → in_corso → completata | multi-giorno |

**Non tocchiamo le tabelle DB** — creiamo una vista logica nel frontend che unifica. Il campo `TipoInterventoID` nel piano diventa il discriminatore.

### 2.2 Priorità Urgenze → Date coerenti
| Priorità | Label | SLA | Data assegnazione |
|---|---|---|---|
| 1 | Urgente - Subito | 4h | Oggi, ora corrente |
| 2 | Oggi | 8h | Oggi, prossimo slot |
| 3 | 24 ore | 24h | Domani mattina |
| 4 | Entro settimana | 72h | Prossimo giorno libero |
| 5 | Programmabile | nessuno | A discrezione planner |

Quando si crea un'urgenza con priorità 1-2, la data/ora si auto-compilano. Per 3-5, proposta automatica con override manuale.

### 2.3 Tipi Servizio Robot (da rendere configurabili)
- Robot: ASTRONAUT (A1, A2, A3, A4 modelli, non 101-104)
- Servizio: Tipo A, B, C, D (cicli diversi di manutenzione)
- **Questi valori vanno in `config` su Supabase**, non hardcoded

### 2.4 "Tecnici Oggi" nella dashboard
Rinominare in **"Attività Tecnici"** — mostra per ogni tecnico:
- 🟢 Attivo (ha interventi oggi) / 🔵 Reperibile / ⚪ Libero / 🔴 Assente
- Conteggio interventi: totali / completati / in corso
- Furgone assegnato
- Progress bar giornata

---

## FASE 3 — Configurazione Parametrica

### 3.1 Automezzi: codici F1-F12
- Rinominare tutti gli automezzi da FURG_1, AUT_xxx → F1, F2, ... F12
- Il display mostra solo "F1", "F2" etc.
- Descrizione opzionale (targa, modello) nel dettaglio
- **Config DB**: numero max furgoni configurabile

### 3.2 Picklist dinamiche da config
Tutte queste vanno lette da Supabase `config` e NON hardcoded:
- Tipi intervento (ordinario, urgenza, tagliando A/B/C/D, installazione)
- Priorità (1-5 con label e SLA)
- Stati (piano, urgenza)
- Ruoli utente
- Turni reperibilità
- Tipi richiesta (ferie, permesso, malattia, cambio turno, generico)
- Modelli macchine (ASTRONAUT, VECTOR, JUNO, DISCOVERY, etc.)
- Canali chat

### 3.3 Campo "Attivo" tecnici
- Rendere modificabile dall'admin nel modale utente
- Toggle on/off con conferma ("Disattivare il tecnico? Non verrà più assegnato")
- Tecnico disattivato: non appare nei dropdown, non nel planner, badge 🔴

### 3.4 Vincoli Piano generici
Rimuovere qualsiasi riferimento specifico a Lely Center:
- Categorie vincoli: configurabili da admin (non hardcoded)
- Template vincoli: caricati da config, non da white_label_config.js
- Nessun nome tecnico hardcoded
- Regole generiche: "junior deve lavorare con senior", non "Emanuele deve lavorare con Jacopo"

### 3.5 Foto prodotti
- Rimuovere foto/link Lely hardcoded
- Aggiungere campo `foto_url` nella tabella macchine
- Upload foto tramite admin → salva URL in DB
- Se non c'è foto → icona generica per tipo macchina

### 3.6 Pagina Configurazione admin
Ristrutturare la sezione config con tab/accordion:
- **Generale**: nome azienda, logo, colori, timezone
- **Interventi**: tipi, priorità, durate default, stati
- **Tecnici**: ruoli, squadre, regole affiancamento
- **Automezzi**: lista furgoni, numero max
- **SLA**: soglie warning/critical/breach per priorità
- **Notifiche**: Telegram (bot token, group ID), Email (SMTP), Push
- **PM Scheduling**: cicli manutenzione, modelli robot, tipi servizio
- **Mappa**: centro default, zoom, provider tile
- **Chat**: canali, nomi, icone

---

## FASE 4 — Funzionalità Complesse

### 4.1 Mappa
**Problemi attuali:**
- Routing OSRM lento (server remoto, spesso timeout)
- Fallback a linee rette (vettoriale) quando OSRM fallisce
- Aggiungere/togliere tecnici ritarda perché ricalcola tutto

**Fix:**
- Cache route OSRM per coppia di waypoint (sessionStorage)
- Debounce filtro tecnici (300ms prima di ricalcolare)
- Indicatore "Calcolando percorso..." visibile
- Fallback più chiaro: "⚠️ Percorso approssimato (servizio routing non disponibile)"
- Opzione: Google Directions API come alternativa OSRM (richiede API key in config)

### 4.2 AI Planner — Ripensamento Completo
**Stato**: Non ha mai funzionato bene. Timeout AI, risultati incoerenti, UX confusa.

**Architettura nuova — Planner REATTIVO (non batch):**

Il planner non è "genera tutto il piano della settimana" ma un **assistente che reagisce a eventi**:

1. **Evento: nuova urgenza** → planner propone tecnico (vicinanza + disponibilità + competenza) → admin conferma → crea intervento nel piano
2. **Evento: nuovo tagliando da PM** → planner suggerisce data/tecnico basato su carico → admin conferma
3. **Evento: cambio reperibilità** → planner verifica impatto sul piano corrente → segnala conflitti
4. **Evento: richiesta piano settimanale** → planner genera proposta combinando: piano esistente + tagliandi scaduti + urgenze pending + reperibilità → diff view

**Smart Assignment (rule-based, non AI):**
- Score tecnico = f(distanza_cliente, carico_giornata, competenza_macchina, anzianità, disponibilità)
- Vincoli hard: reperibilità bloccante, ferie, tecnico disattivato
- Vincoli soft: junior con senior, furgone assegnato, preferenza cliente
- **Tutto configurabile da admin** (pesi, regole, soglie)

**AI solo per piano settimanale (opzionale):**
- Chunking: 1 giorno per volta (no timeout)
- Fallback: se AI timeout → usa rule-based
- Cache: piano generato salvato in `piano_ai_draft` con stato draft/approvato/scartato
- UX wizard: Step 1 (periodo) → Step 2 (vincoli toggle) → Step 3 (genera) → Step 4 (review diff)
- Ogni riga: "aggiunto 🟢", "spostato 🟡", "rimosso 🔴", "invariato ⚪"
- Azioni: "Approva tutto" / "Approva singoli" / "Scarta"

**Timeout fix:**
- Workers AI: chunk da 1 giorno (max 5 interventi per prompt) → 15-20s per chunk
- Gemini API: fallback se Workers AI lento
- Progress bar: "Giorno 1/5... Giorno 2/5..."
- Abort: pulsante "Annulla" che ferma la generazione

### 4.3 PM Scheduling
**Problemi**: non si capisce come gestire aggiornamenti.

**Fix:**
- Tabella chiara: macchina | ultimo tagliando | prossimo | giorni mancanti | stato
- Azioni per riga: "Programma Tagliando" → crea intervento tipo=tagliando nel piano
- Import/Export Excel (SheetJS): scarica lista PM, modifica, ri-carica
- Filtri: scaduti | prossimi 30gg | tutti
- Link bidirezionale: dal PM vedi l'intervento creato, dall'intervento vedi il PM

### 4.4 Catalogo Ricambi
- Aggiungere Upload CSV/Excel per popolare catalogo
- Download catalogo completo come Excel
- CRUD completo (add/edit/delete ricambi)
- Ricerca con filtro modello/gruppo/codice

### 4.5 Chat & Telegram — Riallineamento allo scopo FSM
**Stato**: Entrambi rotti. Telegram non settabile, chat non funziona.

**Scopo originale Telegram:**
1. **Operativo tecnici**: comandi /vado, /incorso, /risolto, /ordine per aggiornare stato dal campo
2. **Notifiche push**: nuova urgenza, assegnazione, promemoria intervento, ordine aggiornato
3. **AI campo**: tecnico manda foto → Gemini analizza → suggerisce diagnosi

**Fix Telegram:**
- Pagina Config Admin → sezione Telegram con:
  - Input bot token + group chat ID
  - Pulsante "Test Connessione" → invia messaggio test nel gruppo
  - Pulsante "Imposta Webhook" → registra webhook automaticamente
  - Stato: 🟢 Connesso (ultimo msg ricevuto X min fa) / 🔴 Errore (dettaglio)
  - Toggle per ogni tipo notifica (urgenza, piano, ordini, promemoria)
- Verifica e fix degli endpoint: `telegramWebhook`, `sendTelegramMessage`
- Fix crash se `update.message` è undefined (callback_query senza message)

**Fix Chat In-App:**
- Verifica `getChatMessaggi`, `sendChatMessage` nel worker
- Canali dinamici da config (non hardcoded CH_GENERALE, CH_URGENZE, CH_ADMIN)
- Fix memory leak polling: clearInterval quando si esce da pgChat
- Sync bidirezionale: messaggio inviato da Telegram appare in chat app e viceversa

### 4.6 Configurazione — Ristrutturazione Completa
**Stato**: Non rispecchia più lo scopo. Molte cose configurabili solo nel codice.

**Nuova struttura pagina Config (tab/accordion):**

| Tab | Contenuto | Salva su |
|---|---|---|
| Generale | Nome azienda, logo URL, colori brand, timezone, lingua default | `config` |
| Interventi | Tipi (CRUD), Priorità (CRUD con label+SLA+colore), Durate default, Stati | `config` + `tipi_intervento` |
| Tecnici | Ruoli (CRUD), Livelli esperienza, Regole affiancamento generiche | `config` |
| Automezzi | Lista F1-F12 (CRUD), Numero max, Tipo veicolo | `automezzi` |
| SLA | Soglie per priorità: warning/critical/breach (minuti), Escalation rules | `sla_config` |
| Notifiche | Telegram (token, group, webhook, toggle per tipo), Email (from, template), Push (VAPID) | `config` |
| PM Scheduling | Cicli manutenzione per modello, Tipi servizio A/B/C/D, Durata default (6h) | `config` |
| Mappa | Centro default (lat/lng), Zoom, Tile provider, OSRM server URL | `config` |
| Chat | Canali (CRUD con nome, icona, chi può scrivere) | `chat_canali` |
| AI Planner | Pesi scoring (distanza, carico, competenza), Provider AI (Workers/Gemini/Groq), Timeout | `config` |

**Ogni modifica salva su Supabase in real-time** → toast conferma → effetto immediato senza reload

---

## FASE 5 — UX Polish

### 5.1 Responsive
- Admin: sidebar collassabile su mobile (hamburger → overlay)
- Tabelle: scroll orizzontale con indicatore
- Modali: full-screen su mobile
- Touch: swipe per chiudere sheet nel tecnico

### 5.2 Accessibilità
- Stato urgenze: non solo colore ma anche icona/testo (daltonici)
- Font-size minimo 14px (ora 12px in molti punti)
- Focus ring visibili su tutti gli interattivi
- ARIA labels su bottoni icona

### 5.3 Performance
- Lazy load sezioni (già presente, verificare funzionamento)
- Debounce ricerche (300ms)
- Virtualizzazione liste lunghe (>100 item)
- Compressione immagini upload

### 5.4 Feedback utente
- Conferma dopo ogni azione (toast verde/rosso)
- Loading state su bottoni (disabilita + spinner)
- Empty state: illustrazioni quando non ci sono dati
- Error state: messaggi chiari con azione suggerita

---

## Ordine di Esecuzione Consigliato

```
Sessione 1: FASE 1.1 + 1.2 + 1.4 (fix JS critici + memory leak + bug worker)
Sessione 2: FASE 1.3 (CRUD mancanti)
Sessione 3: FASE 3.1 + 3.2 + 3.3 (automezzi + picklist + campo attivo)
Sessione 4: FASE 2 (modello dati coerente)
Sessione 5: FASE 3.4 + 3.5 + 3.6 (vincoli + foto + config page)
Sessione 6: FASE 4.1 + 4.2 (mappa + AI planner)
Sessione 7: FASE 4.3 + 4.4 + 4.5 (PM + catalogo + telegram)
Sessione 8: FASE 5 (UX polish)
```

Ogni sessione include: implementazione + test + commit.

---

*Piano creato da audit di 15.997 righe · 1 marzo 2026*
