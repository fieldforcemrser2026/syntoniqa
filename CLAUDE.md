# Syntoniqa v1.0 — Claude Code Handoff

> FSM (Field Service Management) PWA per **MRS Lely Center Emilia Romagna**
> 20.889 righe di codice · 3 file principali + 1 config · Zero framework

---

## Quick Start

```bash
# Clona il repo
git clone https://github.com/fieldforcemrser2026/syntoniqa.git
cd syntoniqa

# Installa dipendenze (solo wrangler per deploy)
npm install

# Dev locale worker
CLOUDFLARE_API_TOKEN=<CF_API_TOKEN> npx wrangler dev

# Deploy produzione
CLOUDFLARE_API_TOKEN=<CF_API_TOKEN> npx wrangler deploy

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
│  (10465 righe)       │     │  cloudflare_worker.js     │
│  Dashboard Admin SPA │     │  (7296 righe)             │
├──────────────────────┤     │                            │
│  index_v2.html       │────▶│  8 GET + 126 POST handlers│
│  (3001 righe)        │     │  3 cron jobs (*/15 min)   │
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
| **CF API Token** | `<REDACTED - vedi .env locale>` |
| **Supabase URL** | `https://sajzbanhkehkkhhgztkq.supabase.co` |
| **Supabase Service Key** | `<REDACTED - vedi .env locale>` |
| **API Token (X-Token)** | `<REDACTED - vedi .env locale>` |
| **Tenant UUID** | `785d94d0-b947-4a00-9c4e-3b67833e7045` |
| **Telegram Bot Token** | `<REDACTED - vedi .env locale>` |
| **Telegram Group Chat** | `-5236723213` |
| **Admin Login** | `m.bozzarelli` / (password hashata nel DB) |

### Worker Environment Variables (CF Dashboard)

```
# ── DATABASE ──────────────────────────────────────────────────
SUPABASE_URL         = https://sajzbanhkehkkhhgztkq.supabase.co
SUPABASE_SERVICE_KEY = <REDACTED>   (service_role key - accesso completo)
TENANT_ID            = 785d94d0-b947-4a00-9c4e-3b67833e7045

# ── AUTH ──────────────────────────────────────────────────────
SQ_TOKEN             = <REDACTED>   (legacy token per Telegram/cron)
JWT_SECRET           = <REDACTED>   (⚠️ OBBLIGATORIO - firma JWT login)
JWT_EXPIRY_SECONDS   = 43200        (12h, opzionale)
JWT_REMEMBER_ME_SECONDS = 2592000   (30gg, opzionale)

# ── AI ENGINES (6 disponibili, cascata automatica) ─────────────
GEMINI_KEY           = <REDACTED>   (Google Gemini 2.0 Flash - priorità 1)
CEREBRAS_KEY         = <REDACTED>   (Cerebras Llama 3.3-70B - priorità 2)
GROQ_KEY             = <REDACTED>   (Groq Llama 3.3-70B - priorità 3)
MISTRAL_KEY          = <REDACTED>   (Mistral Small - priorità 4)
DEEPSEEK_KEY         = <REDACTED>   (DeepSeek Chat - priorità 5)
AI                   = [binding]    (Workers AI Llama+LLaVA - priorità 6, fallback)

# ── COMUNICAZIONI ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN      = <REDACTED>
TELEGRAM_CHAT_ID        = -5236723213
TELEGRAM_WEBHOOK_SECRET = <REDACTED>  (⚠️ OBBLIGATORIO per sicurezza webhook)
RESEND_API_KEY          = <REDACTED>

# ── PUSH NOTIFICATIONS ────────────────────────────────────────
VAPID_PUBLIC_KEY     = <REDACTED>
VAPID_PRIVATE_KEY    = <REDACTED>
VAPID_SUBJECT        = mailto:noreply@syntoniqa.app

# ── BRANDING (opzionali, override white_label_config.js) ───────
BRAND_NAME           = MRS Lely Center Emilia Romagna
BRAND_SHORT          = MRS Field
BRAND_COLOR          = #C30A14
BRAND_EMAIL          = noreply@syntoniqa.app
BRAND_ADMIN_URL      = https://fieldforcemrser2026.github.io/syntoniqa/admin_v1.html
BRAND_TECH_URL       = https://fieldforcemrser2026.github.io/syntoniqa/index_v2.html
CORS_EXTRA           =              (domini aggiuntivi separati da virgola)
```

---

## File Principali

### `cloudflare_worker.js` (7296 righe)
Backend completo. Zero dipendenze runtime.

**Struttura reale:**
```
Righe 1-115:    Brand helper, CORS, state machine, ROLE_MATRIX, requireRole/isCapoSq
Righe 115-460:  Auth helpers (JWT, PBKDF2 hash, checkToken), rate limiter
Righe 460-550:  Router (fetch + scheduled) — 3 cron jobs
Righe 550-700:  handleGet (8 azioni: getAll, getKPI, getKPITecnici, exportPowerBI…)
Righe 700-2700: handlePost (126 azioni: CRUD completo tutte le entità)
Righe 2700-3050: AI engines cascade (Gemini→Cerebras→Groq→Mistral→DeepSeek→Workers AI)
Righe 3050-4000: AI Plan generation (generateAIPlan, previewAIPlan, generatePlanSmart)
Righe 4000-4800: Telegram webhook handler + AI vision (LLaVA)
Righe 4800-5000: Chat bot commands (/stato, /vado, /incorso, /risolto, /ordine)
Righe 5000-5500: Notification helpers (email Resend, TG, Web Push VAPID)
Righe 5500-7296: Cron jobs (checkInterventoReminders, checkSLAUrgenze, checkPMExpiry)
```

**AI Engine MoA Race (11 motori, ranking configurabile da DB):**
| Priorità | Engine | Modello | API Key | Tier |
|----------|--------|---------|---------|------|
| 1 | Anthropic | claude-sonnet-4.6 | ANTHROPIC_KEY | Premium |
| 2 | OpenAI | gpt-4o | OPENAI_KEY | Premium |
| 3 | Gemini | gemini-2.5-pro | GEMINI_KEY | Premium |
| 4 | Cerebras | llama-3.3-70b | CEREBRAS_KEY | Free |
| 5 | Groq | llama-3.3-70b-versatile | GROQ_KEY | Free |
| 6 | OpenRouter | llama-3.3-70b-instruct:free | OPENROUTER_KEY | Free |
| 7 | Fireworks | llama-v3p1-70b-instruct | FIREWORKS_KEY | Free |
| 8 | SambaNova | llama-4-maverick-17b | SAMBANOVA_KEY | Free |
| 9 | Mistral | mistral-small-latest | MISTRAL_KEY | Free |
| 10 | DeepSeek | deepseek-chat | DEEPSEEK_KEY | Free |
| 11 | Workers AI | llama-3.3-70b-fp8 + llava-1.5-7b | AI binding | Free |

**MoA Best-Of Race**: lancia fino a 7 motori in parallelo, aspetta tutte le risposte (max 25s), scoring con penalità per duplicati/junior soli/shortfall, sceglie il punteggio più alto.

Ranking override DB: `config.ai_engine_ranking = "anthropic,openai,gemini,cerebras,groq,..."`
Disabilitazione: `config.ai_engine_disabled = "anthropic,openai"` (se vuoi solo motori free)

### `admin_v1.html` (10465 righe)
SPA admin completa. 35+ sezioni, 17 modali.

**Librerie esterne (CDN):**
- Leaflet 1.9.4 (mappa)
- Chart.js 4.4.0 (grafici)
- SheetJS 0.18.5 (Excel, caricato on-demand)

### `index_v2.html` (3001 righe)
PWA mobile per tecnici. 19 pagine, bottom nav, sheets, dark mode, i18n, Service Worker.

**Funzionalità PWA:**
- Service Worker (sw.js): cache app shell, sync queue offline, push notifications
- Pull-to-refresh (touchstart/move/end)
- Dark mode toggle (localStorage `sq2_theme`)
- i18n it/en (localStorage `sq2_lang`)
- Push notifications VAPID (PushManager)

### `white_label_config.js` (127 righe)
Configurazione white-label: brand, colori, API, feature toggles, PWA, pmSync provider.

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
`requireAdmin(env, body)` — legacy, usare `requireRole(body, 'admin')`. Endpoint admin-only: CRUD di clienti, macchine, automezzi, installazioni, reperibilità, trasferte, utenti (tranne self-update).
`requireRole(body, ...roles)` — preferire questo. Se 'caposquadra' è incluso, admin è automaticamente autorizzato.

### 11. AI Engine Cascade
Il sistema AI usa 6 motori in cascata. Se un motore fallisce (429, timeout, errore) passa automaticamente al successivo. L'ordine è configurabile in DB (chiave `ai_engine_ranking`). Il ranking default è: `gemini → cerebras → groq → mistral → deepseek → workersai`. **Non specificare solo Gemini nel codice**: usare sempre la funzione `callAI(promptText)` che gestisce il cascade automaticamente.

### 12. Workers AI timeout
Workers AI (fallback finale) ha timeout di 30s via `Promise.race`. Gli altri motori non hanno timeout esplicito (dipendono dal CF Worker timeout globale di 30s CPU time).

### 13. JWT_SECRET è OBBLIGATORIO
Se `JWT_SECRET` non è configurato in CF Dashboard, `verifyJWT()` ritorna sempre null e tutti i login falliscono silenziosamente. **Impostarlo PRIMA del deploy.**

### 14. Cron jobs — 3 job attivi
- `checkInterventoReminders()` — interventi in ritardo, ordini vecchi
- `checkSLAUrgenze()` — SLA ok/warning/critical/breach, escalation
- `checkPMExpiry()` — PM scaduti, riepilogo TG alle 7-8 AM (Rome)

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
CLOUDFLARE_API_TOKEN=<CF_API_TOKEN> npx wrangler deploy

# Solo frontend (push to GitHub Pages)
git add admin_v1.html index_v2.html white_label_config.js
git commit -m "fix: descrizione"
git push origin main

# Entrambi
CLOUDFLARE_API_TOKEN=<CF_API_TOKEN> npx wrangler deploy && \
git add -A && git commit -m "feat: descrizione" && git push origin main

# Test API
curl -s "https://syntoniqa-mrs-api.fieldforcemrser.workers.dev?action=getAll&token=<SQ_TOKEN>" | python3 -m json.tool | head -20

# Test login
curl -s -X POST "https://syntoniqa-mrs-api.fieldforcemrser.workers.dev" \
  -H "Content-Type: application/json" \
  -H "X-Token: <SQ_TOKEN>" \
  -d '{"action":"login","username":"m.bozzarelli","password":"..."}'
```
