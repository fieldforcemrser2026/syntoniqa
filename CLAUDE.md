# Syntoniqa v1.0 — Claude Code Handoff

> FSM (Field Service Management) PWA per **MRS Lely Center Emilia Romagna**
> 10.726 righe di codice · 59 commit · 3 file principali · Zero framework

---

## Quick Start

```bash
# Clona il repo
git clone https://github.com/fieldforcemrser2026/syntoniqa.git
cd syntoniqa

# Installa dipendenze (solo wrangler per deploy)
npm install

# Dev locale worker
CLOUDFLARE_API_TOKEN=RJaqPOdGoM314VM41tNulvS97tMfgntSPu2juoCv npx wrangler dev

# Deploy produzione
CLOUDFLARE_API_TOKEN=RJaqPOdGoM314VM41tNulvS97tMfgntSPu2juoCv npx wrangler deploy

# Push frontend (GitHub Pages si aggiorna automaticamente)
git add cloudflare_worker.js admin_v1.html index_v2.html
git commit -m "feat: descrizione"
git push origin main
```

---

## Architettura

```
┌──────────────────────┐     ┌──────────────────────────┐
│  admin_v1.html       │────▶│  Cloudflare Worker        │
│  (5548 righe)        │     │  cloudflare_worker.js     │
│  Dashboard Admin SPA │     │  (3042 righe)             │
├──────────────────────┤     │                            │
│  index_v2.html       │────▶│  8 GET + 89 POST handlers │
│  (2071 righe)        │     │  2 cron jobs (*/15 min)   │
│  PWA Mobile Tecnico  │     │  Telegram webhook         │
└──────────────────────┘     └──────────┬───────────────┘
                                         │
                              ┌──────────▼───────────────┐
                              │  Supabase PostgreSQL      │
                              │  22 tabelle               │
                              │  sajzbanhkehkkhhgztkq     │
                              └──────────────────────────┘
```

---

## Credenziali & Endpoint

| Risorsa | Valore |
|---------|--------|
| **Worker URL** | `https://syntoniqa-mrs-api.fieldforcemrser.workers.dev` |
| **Frontend Admin** | `https://fieldforcemrser2026.github.io/syntoniqa/admin_v1.html` |
| **Frontend Tecnico** | `https://fieldforcemrser2026.github.io/syntoniqa/index_v2.html` |
| **GitHub Repo** | `https://github.com/fieldforcemrser2026/syntoniqa` |
| **CF API Token** | `RJaqPOdGoM314VM41tNulvS97tMfgntSPu2juoCv` |
| **Supabase URL** | `https://sajzbanhkehkkhhgztkq.supabase.co` |
| **Supabase Service Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhanpiYW5oa2Voa2toaGd6dGtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc5MDc3OCwiZXhwIjoyMDg3MzY2Nzc4fQ._fihqFYRQMaZXd1USNrbnqXnAVmBgBxFgtAD1krUmI8` |
| **API Token (X-Token)** | `SQ_2026_MRS_88FNJz0TFbdzHMikOeN2HQ` |
| **Tenant UUID** | `785d94d0-b947-4a00-9c4e-3b67833e7045` |
| **Telegram Bot Token** | `8411203312:AAGMlSkXRV0FUjCxWx1cGCSv6TyL2FYiOpo` |
| **Telegram Group Chat** | `-5236723213` |
| **Admin Login** | `m.bozzarelli` / (password hashata nel DB) |

### Worker Environment Variables (CF Dashboard)

```
SUPABASE_URL = https://sajzbanhkehkkhhgztkq.supabase.co
SUPABASE_SERVICE_KEY = eyJ... (service role)
SQ_TOKEN = SQ_2026_MRS_88FNJz0TFbdzHMikOeN2HQ
GEMINI_KEY = (Gemini API key per AI Planner)
TELEGRAM_BOT_TOKEN = 8411203312:AAGMlSkXRV0FUjCxWx1cGCSv6TyL2FYiOpo
RESEND_API_KEY = re_... (email via Resend)
TENANT_ID = 785d94d0-b947-4a00-9c4e-3b67833e7045
```

---

## File Principali

### `cloudflare_worker.js` (3042 righe)
Backend completo. Zero dipendenze runtime.

**Struttura:**
```
Righe 1-80:     CORS, state machine, helpers (json/ok/err)
Righe 80-200:   PascalCase/snake_case transform, normalizeBody, getFields
Righe 200-215:  hashPassword, checkToken
Righe 216-250:  Router (fetch + scheduled)
Righe 250-400:  handleGet (8 azioni)
Righe 400-1600: handlePost (89 azioni)
Righe 1600-1800: Telegram webhook handler + AI media analysis
Righe 1800-2100: Chat bot commands (/stato, /vado, /incorso, /risolto, /ordine)
Righe 2100-2300: In-app chat bot mirror
Righe 2300-2600: Notification helpers (email, TG, push)
Righe 2600-3042: Cron jobs (checkInterventoReminders, checkSLAUrgenze)
```

### `admin_v1.html` (5548 righe)
SPA admin completa. 33 sezioni, 17 modali.

**Librerie esterne (CDN):**
- Leaflet 1.9.4 (mappa)
- Chart.js 4.4.0 (grafici)
- SheetJS 0.18.5 (Excel, caricato on-demand)

### `index_v2.html` (2071 righe)
PWA mobile per tecnici. 17 pagine, bottom nav, sheets.

### `white_label_config.js` (65 righe)
Configurazione white-label: brand, colori, API, feature toggles, PWA.

---

## Convenzioni Critiche (LEGGERE PRIMA DI MODIFICARE)

### 1. normalizeBody()
Converte camelCase/PascalCase → snake_case. **TUTTI i body POST passano per normalizeBody.** Dopo la normalizzazione, le chiavi sono snake_case. Eccezioni preservate: `userId`, `operatoreId`.

```javascript
// SBAGLIATO: leggere PascalCase dal body
const tecnicoId = body.TecnicoID;

// CORRETTO: leggere snake_case dopo normalizeBody
const tecnicoId = body.tecnico_id;
```

### 2. PascalCase nelle risposte
`pascalizeRecord()` e `pascalizeArrays()` convertono snake_case → PascalCase per il frontend. **Il frontend legge SEMPRE PascalCase** (es: `item.TecnicoID`, `item.ClienteID`).

### 3. State Machine
Transizioni stato definite in `VALID_PIANO_TRANSITIONS` e `VALID_URGENZA_TRANSITIONS`. Ogni cambio stato viene validato da `validateTransition()`.

**Piano:** pianificato → in_corso → completato (terminale) | annullato → pianificato
**Urgenza:** aperta → assegnata → schedulata → in_corso → risolta → chiusa (terminale)
Reject: assegnata/schedulata → aperta

### 4. CHECK Constraints nel DB
```sql
urgenze_stato_check: aperta, assegnata, schedulata, in_corso, risolta, chiusa
piano_stato_check: pianificato, in_corso, completato, annullato
```

### 5. getAll è GET
```javascript
// Frontend chiama così:
DATA = await apiCall('getAll', {userId: USER?.ID || ''});
// → GET ?action=getAll&token=...&userId=TEC_xxx
```

### 6. getFields()
Estrae campi dal body, gestisce `body.data` wrapper e body flat, converte PascalCase→snake_case.

### 7. CORS
Mutable global `corsHeaders` aggiornato da `setCorsForRequest(request)` a ogni richiesta. Origins allowed: `fieldforcemrser2026.github.io`, `app.syntoniqa.app`, `localhost:3000/8787`.

### 8. Supabase max 1000
`sb()` helper con limit max 1000 per query anche se chiedi limit=2000.

### 9. Timezone
Cron usa `Europe/Rome` via `Intl.DateTimeFormat`.

### 10. Authorization
`requireAdmin(env, body)` restituisce null se OK, stringa errore se no. Endpoint admin-only: tutti i create/update di clienti, macchine, automezzi, installazioni, reperibilità, trasferte, utenti (tranne self-update).

---

## Database Schema (Tabelle Principali)

| Tabella | Descrizione | Chiave |
|---------|-------------|--------|
| `utenti` | Tecnici + admin | `id` (TEC_xxx, USR001) |
| `clienti` | Clienti/allevamenti | `id` (CLI_xxx) |
| `macchine` | Robot Lely installati | `id` (MAC_xxx) |
| `piano` | Interventi pianificati | `id` (INT_xxx) |
| `urgenze` | Urgenze/emergenze | `id` (URG_xxx) |
| `ordini` | Ordini ricambi | `id` (ORD_xxx) |
| `automezzi` | Furgoni | `id` (FURG_x, AUT_xxx) |
| `reperibilita` | Turni reperibilità | `id` (REP_xxx) |
| `trasferte` | Trasferte | `id` (TRA_xxx) |
| `installazioni` | Installazioni nuove | `id` (INS_xxx) |
| `notifiche` | Notifiche in-app | `id` (NOT_xxx) |
| `chat_canali` | Canali chat | `id` (CH_xxx) |
| `chat_messaggi` | Messaggi chat | `id` (MSG_xxx) |
| `workflow_log` | Audit trail | `id` (auto) |
| `kpi_log` | KPI snapshots | `id` (auto) |
| `kpi_snapshot` | Backup snapshots | `id` (auto) |
| `sla_config` | Configurazione SLA | `id` |
| `config` | Config chiave/valore | `chiave` |
| `anagrafica_clienti` | Master data clienti | `codice_m3` |
| `anagrafica_assets` | Master data macchine | `id` |
| `checklist_template` | Template checklist | `id` |
| `documenti` | Documenti allegati | `id` |

Tutte le tabelle hanno: `tenant_id`, `obsoleto` (soft delete), `created_at`, `updated_at`.

---

## Telegram Bot Flow

```
Utente TG → /vado → Lista 5 urgenze aperte
         → /vado 2 → Prende urgenza #2
         → /incorso → Segna in corso
         → /risolto note → Chiude urgenza
         → /oggi → Interventi di oggi
         → /settimana → Piano settimanale
         → /ordine codice qt cliente → Crea ordine
         → Testo libero / Foto → AI Gemini analizza e crea azione
```

**Notifiche TG:**
- Nuova urgenza → gruppo TG
- Urgenza assegnata → messaggio privato al tecnico
- Escalation (>4h senza inizio) → sollecito privato + admin
- Ordine aggiornato → tecnico

---

## Cron Jobs (ogni 15 minuti)

### checkInterventoReminders()
- Interventi di domani senza tecnico → notifica admin
- Interventi in ritardo (data passata, non completati) → notifica admin + tecnico
- Ordini vecchi >7 giorni in stato "richiesto" → reminder

### checkSLAUrgenze()
- Calcola SLA scadenza per ogni urgenza con sla_config
- Aggiorna `sla_stato`: ok → warning → critical → breach
- Urgenze assegnate >4h senza inizio → escalation (TG privato tecnico + admin)
- Anti-duplicato via notification ID per giorno

---

## Errori Noti & Pitfall

| Problema | Causa | Fix |
|----------|-------|-----|
| `const today` duplicato | Due definizioni nello stesso scope | Rimosso il duplicato |
| `goSec()` non esiste | Funzione si chiama `showSec()` | Sostituito globalmente |
| CORS over-engineering | Passare dynCors in tutti i params | Usato mutable global |
| File Excel come base64 | `readFileAsText` leggeva DataURL | Aggiunto parser SheetJS |
| Mappa vuota | Clienti senza lat/lng | Aggiunto geocache 70+ città |
| getAll per tecnici | Vedeva tutti i dati | Aggiunto role-based filtering |

---

## Feature Toggle (white_label_config.js)

```javascript
features: {
  telegram: true,      // Bot Telegram
  ai_planner: true,    // AI con Gemini
  ordini: true,        // Ordini ricambi
  installazioni: true, // Installazioni
  reperibilita: true,  // Turni reperibilità
  trasferte: true,     // Trasferte
  power_bi: false,     // Export Power BI
  pagellini: true,     // Valutazioni tecnici
  mappa: true,         // Mappa Leaflet
  kpi: true,           // Dashboard KPI
  checklist: true,     // Checklist
  documenti: true,     // Documenti
}
```

---

## Tecnici MRS Lely Center

| ID | Nome | Ruolo | Base | Furgone |
|----|------|-------|------|---------|
| TEC_691 | Jacopo Bonadé | caposquadra | Piacenza | FURG_1 |
| TEC_xxx | Anton | tecnico senior | Pavullo | FURG_6 |
| TEC_xxx | Giovanni | tecnico senior | Bologna | FURG_3 |
| TEC_xxx | Fabio | tecnico | — | FURG_4 |
| TEC_MIR | Mirko Benduci | tecnico | — | FURG_5 |
| TEC_xxx | Fabrizio | tecnico junior | — | FURG_7 |
| TEC_GIU | Giuseppe Falcone | tecnico junior | Bologna | FURG_1 |
| TEC_xxx | Gino | tecnico junior | Reggio Emilia | FURG_2 |
| TEC_xxx | Emanuele | tecnico junior | Palagano | — |
| USR001 | Marcello Bozzarelli | admin | — | — |

**Regole team (da Marcello):**
- Emanuele, Gino, Giuseppe → devono lavorare affiancati a un senior (Jacopo, Anton, Giovanni)
- Mirko assente fino al prossimo mese
- Fabio meglio non accoppiarlo con nessuno
- Fabrizio ancora in apprendimento, ok per lavoro in due

---

## Prossimi Sviluppi Suggeriti

### Priorità Alta
1. **Service Worker offline** — Cache-first per app shell, network-first per API, IndexedDB sync queue per form offline
2. **KPI dashboard tecnico** — Pagina personale con interventi completati, ore lavorate, SLA compliance, grafici 7gg
3. **Rate limiting** — Throttle API calls per IP/token (CF Workers ha limiti built-in ma serve applicativo)

### Priorità Media
4. **Geocoding batch clienti** — Endpoint `geocodeAll` per popolare lat/lng di tutti i clienti da indirizzo
5. **Push notifications** — Web Push già implementato lato worker, serve UI per subscribe
6. **Foto intervento** — Upload foto da tecnico durante intervento, associata a piano_id
7. **Report PDF** — Generazione report mensile per management

### Priorità Bassa
8. **Multi-tenant** — Già predisposto con tenant_id ma serve UI gestione
9. **Dark/light mode toggle** — CSS già in variabili, serve switch
10. **i18n** — Tutto in italiano, predisporre per multi-lingua

---

## Comandi Deploy Rapidi

```bash
# Solo worker (backend)
CLOUDFLARE_API_TOKEN=RJaqPOdGoM314VM41tNulvS97tMfgntSPu2juoCv npx wrangler deploy

# Solo frontend (push to GitHub Pages)
git add admin_v1.html index_v2.html white_label_config.js
git commit -m "fix: descrizione"
git push origin main

# Entrambi
CLOUDFLARE_API_TOKEN=RJaqPOdGoM314VM41tNulvS97tMfgntSPu2juoCv npx wrangler deploy && \
git add -A && git commit -m "feat: descrizione" && git push origin main

# Test API
curl -s "https://syntoniqa-mrs-api.fieldforcemrser.workers.dev?action=getAll&token=SQ_2026_MRS_88FNJz0TFbdzHMikOeN2HQ" | python3 -m json.tool | head -20

# Test login
curl -s -X POST "https://syntoniqa-mrs-api.fieldforcemrser.workers.dev" \
  -H "Content-Type: application/json" \
  -H "X-Token: SQ_2026_MRS_88FNJz0TFbdzHMikOeN2HQ" \
  -d '{"action":"login","username":"m.bozzarelli","password":"..."}'
```
