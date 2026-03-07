# Piano UX/UI Miglioramenti — Admin + PWA Tecnico

## Problemi Identificati

### Admin (admin_v1.html)
1. **Piano/Urgenze/Richieste/Documenti**: Nessuna barra statistiche in cima — devi scorrere la tabella per capire la situazione
2. **Documenti**: Nessuna icona tipo file (PDF/immagine/Excel), link generico "Apri" senza contesto
3. **Piano tabella**: Km/Ore sono le ultime colonne a destra, spesso fuori schermo. Manca riga totale
4. **Calendario mensile**: Legenda colori migliorabile

### PWA Tecnico (index_v2.html)
5. **Liste interventi**: Nessun indicatore allegati (📎) — devi aprire il dettaglio per sapere se ci sono file
6. **Lista urgenze**: Bottoni azione nascosti nel sheet — serve un tap extra per azioni urgenti
7. **Pagina documenti**: Nessuna icona tipo file, nessuna categoria visibile, nessuna descrizione

## Cosa Faccio (6 fasi)

### Fase 1 — Stats Bar per tutte le sezioni admin
Aggiungo barra statistiche compatta sopra ogni tabella:
- **Piano**: `Totale: 47 | 📅 Pianificati: 12 | ⚡ In corso: 8 | ✅ Completati: 23 | 🚗 Km: 1.245 | ⏱️ Ore: 89.5`
- **Urgenze**: `Totale: 15 | 🔴 Aperte: 3 | 👤 Assegnate: 4 | ⚡ In corso: 2 | ⚠️ SLA Breach: 1`
- **Richieste**: `Totale: 8 | ⏳ In attesa: 3 | ✅ Approvate: 4 | ❌ Rifiutate: 1`
- **Documenti**: `Totale: 23 | 📄 PDF: 8 | 🖼️ Immagini: 5 | 📊 Excel: 3`

### Fase 2 — Icone tipo file nei Documenti (admin + tecnico)
Helper `fileIcon()` che rileva estensione e mostra: 📄 PDF | 🖼️ Immagine | 📊 Excel | 📝 Word | 📦 ZIP | 📎 Altro
+ Helper `formatFileSize()` per mostrare dimensione leggibile (es: 2.3 MB)

### Fase 3 — Indicatore allegati nelle liste tecnico
Badge `📎` nelle card interventi e urgenze della PWA quando ci sono documenti collegati

### Fase 4 — Bottoni azione rapida nelle urgenze tecnico
Bottoni inline `⚡ Inizia` / `✅ Risolvi` / `📞 Chiama` direttamente nella lista urgenze, senza dover aprire il sheet

### Fase 5 — Miglioramenti tabella Piano admin
- Riga totale Km/Ore in fondo alla tabella
- Colonne Km/Ore più compatte con allineamento a destra

### Fase 6 — Legenda calendario migliorata
Sostituzione legenda con versione più chiara con swatch colori + tutte le categorie

## File modificati
- `admin_v1.html` — CSS + HTML container + render functions (renderPiano, renderUrgenze, renderRichieste, renderDocumenti, renderMonthPlan)
- `index_v2.html` — CSS + intItem, renderUrg, renderDocMob

## NON tocco
- cloudflare_worker.js (nessuna modifica backend)
- Struttura navigazione/layout generale (già buona)
- Sheet headers tecnico (già sticky grazie al flex layout)
- KPI page tecnico (usa bar chart custom funzionante)
