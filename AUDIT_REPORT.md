# AUDIT APPROFONDITO - cloudflare_worker.js
## Syntoniqa v1.0 FSM PWA

**Data audit:** 2026-03-04  
**File:** `/sessions/brave-cool-tesla/mnt/Syntoniqa_repo/cloudflare_worker.js`  
**Dimensione:** 7296 linee (vs 3042 dichiarate)

---

## STATISTICHE GENERALI

| Metrica | Valore |
|---------|--------|
| Linee totali | 7296 |
| Case statements (GET + POST actions) | 134 |
| Funzioni async | 22 |
| Funzioni sync | 36+ |
| Try/catch blocks | ~100+ |
| Supabase sb() calls | 250+ |
| Promise.all() calls | 13 |
| Telegram sendTelegram() calls | 15+ |
| TODO/FIXME comments | 0 (clean) |

---

## 1. TUTTE LE AZIONI (134 case statements)

### GET Actions (8)
- `getAll` → Carica tutte le tabelle (role-based filtering)
- `getKPI` → KPI mensili per tecnico
- `getKPITecnici` → KPI per ruolo tecnico
- `getBackupHistory` → Cronologia backup
- `getAuditLog` → Workflow log
- `getChecklistTemplates` → Checklist
- `getPagellini` → Valutazioni tecnici
- `exportPowerBI` → Esport Power BI

### POST Actions (126 - PRINCIPALI)

**AUTH (4):**
- `login` → JWT + SQ_TOKEN (con legacy SHA-256 → PBKDF2 migration)
- `resetPassword` → Password reset via email
- `changePassword` → Cambio password
- `requestPasswordReset` → Richiesta reset

**INTERVENTI (8):**
- `createPiano` → Piano fisso
- `updatePiano` → Modifica intervento
- `createUrgenza` → Urgenza/emergenza
- `updateUrgenza` → Modifica urgenza
- `assignUrgenza` → Assegna urgenza a tecnico
- `rejectUrgenza` → Tecnico rifiuta urgenza
- `startUrgenza` → Tecnico inizia lavoro
- `resolveUrgenza` → Tecnico termina intervento

**ORDINI (4):**
- `createOrdine` → Crea ordine ricambi
- `updateOrdine` → Modifica ordine
- `updateOrdineStato` → Cambia stato ordine
- `deleteOrdine` → Cancella ordine (soft delete)

**MASTER DATA (11):**
- `createUtente` / `updateUtente` / `deleteUtente`
- `createCliente` / `updateCliente` / `deleteCliente`
- `createMacchina` / `updateMacchina` / `deleteMacchina`
- `createAutomezzo` / `updateAutomezzo` / `deleteAutomezzo`

**CONFIGURAZIONI (14):**
- `createReperibilita` / `updateReperibilita` / `deleteReperibilita` (turni reperibilità)
- `createTrasferta` / `updateTrasferta` / `deleteTrasferta` (trasferte)
- `createInstallazione` / `updateInstallazione` / `deleteInstallazione` (nuove installazioni)
- `createChecklistTemplate` / `updateChecklistTemplate` / `deleteChecklistTemplate`
- `compileChecklist`

**NOTIFICHE (6):**
- `createNotifica` → Crea notifica in-app
- `markNotifica` → Leggi notifica
- `markAllRead` → Leggi tutte
- `deleteNotifica` → Cancella
- `deleteAllNotifiche` → Cancella tutte

**DOCUMENTI & ALLEGATI (6):**
- `createDocumento` / `updateDocumento` / `deleteDocumento`
- `createAllegato` / `deleteAllegato`
- `uploadFile` → Upload S3 (base64)
- `uploadFotoProfilo` → Foto profilo utente

**COMUNICAZIONI (5):**
- `sendEmail` → Invia email via Resend
- `testEmail` → Test connessione email
- `sendTelegramMsg` → Invia messaggio TG
- `testTelegram` → Test bot Telegram
- `sendPush` → Web push notification

**AI & PLANNING (5):**
- `generatePlanSmart` → AI planner (Gemini/Cerebras/Groq/Mistral/DeepSeek/Workers AI)
- `previewAIPlan` → Preview piano prima applicazione
- `generateAIPlan` → Applica piano AI generato
- `analyzeImage` → AI vision su foto (LLaVA)
- `testAI` → Testa tutti gli engine AI

**ALTRO (13):**
- `createPagellino` / `approvaPagellino` → Valutazione tecnici
- `createRichiesta` / `updateRichiesta` → Richieste intervento
- `getVapidPublicKey` → Web push VAPID
- `savePushSubscription` → Registra device per push
- `removePushSubscription` → Rimuovi notifiche push
- `importExcelPlan` → Importa piano da Excel
- `applyAIPlan` → Applica piano generato
- `bulkCycleChange` → Cambio ciclo collettivo

---

## 2. AI ENGINES - CONFIGURAZIONE CRITICA

### Engine Supportati
| Engine | Env Key | Status | Modello |
|--------|---------|--------|---------|
| Gemini | `GEMINI_KEY` | ✓ Configurato | gemini-2.0-flash |
| Cerebras | `CEREBRAS_KEY` | ✓ Configurato | llama-3.3-70b |
| Groq | `GROQ_KEY` | ✓ Configurato | llama-3.3-70b-versatile |
| Mistral | `MISTRAL_KEY` | ✓ Configurato | mistral-small-latest |
| DeepSeek | `DEEPSEEK_KEY` | ✓ Configurato | deepseek-chat |
| Workers AI | `AI` binding | ✓ Configurato | llama-3.3-70b-instruct-fp8 + llava-1.5-7b-hf |

### Ranking & Fallback
**Ranking configurabile da DB** (chiave: `ai_engine_ranking`)
- Default: `gemini → cerebras → groq → mistral → deepseek → workersai`
- Engine disabilitati via config DB (chiave: `ai_engine_disabled`)
- **LastWorking cache:** ripro primo engine che ha funzionato

### Vision (Foto Interventi)
- **LLaVA 1.5 7B** (Workers AI) per analisi foto
- Input: `image_base64` (Uint8Array)
- Output: JSON con `diagnosi`, `componente_identificato`, `ricambio_suggerito`

### Timeout & Rate Limiting
- AI calls: **max 10 req/min** (rate limit bucket: `ai`)
- Promise.race() con 10s timeout per Workers AI
- Cerebras/Gemini: nessun limite esplicito (dipende API)

---

## 3. VARIABILI D'AMBIENTE USATE (24)

```javascript
// AI & Engines
env.GEMINI_KEY
env.CEREBRAS_KEY
env.GROQ_KEY
env.MISTRAL_KEY
env.DEEPSEEK_KEY
env.AI (binding)

// Database
env.SUPABASE_URL
env.SUPABASE_SERVICE_KEY
env.TENANT_ID (default: 785d94d0-b947-4a00-9c4e-3b67833e7045)

// Auth & Security
env.SQ_TOKEN (legacy token check)
env.JWT_SECRET (HMAC SHA-256)
env.JWT_EXPIRY_SECONDS (default: 28800 = 8h)
env.JWT_REMEMBER_ME_SECONDS (default: 2592000 = 30d)

// Comunicazioni
env.RESEND_API_KEY (email)
env.TELEGRAM_BOT_TOKEN (bot TG)
env.TELEGRAM_CHAT_ID (gruppo TG default: -5236723213)
env.TELEGRAM_WEBHOOK_SECRET (webhook auth)

// Push Notifications
env.VAPID_PUBLIC_KEY
env.VAPID_PRIVATE_KEY
env.VAPID_SUBJECT

// Branding (white-label)
env.BRAND_NAME
env.BRAND_SHORT
env.BRAND_COLOR
env.BRAND_EMAIL
env.BRAND_EMAIL_FROM
env.BRAND_ADMIN_URL
env.BRAND_TECH_URL
env.CORS_EXTRA (aggiunge origins personalizzati)
```

---

## 4. CRON JOBS (Scheduled - ogni 15 min)

### Handler: `scheduled(event, env, ctx)`
```javascript
ctx.waitUntil(Promise.all([
  checkInterventoReminders(env),    // Interventi in ritardo + ordini scaduti
  checkSLAUrgenze(env),              // SLA monitoring + escalation
  checkPMExpiry(env)                 // Tagliandi in scadenza + PM alerts
]));
```

**checkInterventoReminders()** (linea 6985)
- Interventi domani senza tecnico → alert admin
- Interventi passati non completati → alert admin + tecnico
- Ordini richiesti da >7gg → reminder

**checkSLAUrgenze()** (linea 7075)
- Calcola SLA scadenza per ogni urgenza aperta/assegnata/schedulata/in_corso
- Stati SLA: `ok → warning (6h) → critical (2h) → breach (scaduto)`
- Escalation: urgenze assegnate >4h senza inizio → notifica privata + group TG
- Anti-duplicato: 1 notifica per urgenza per giorno

**checkPMExpiry()** (linea 7185)
- Tagliandi scaduti o entro 7gg → notifiche admin
- Riepilogo TG giornaliero (solo finestra 7-8 AM Europe/Rome)
- Carica anagrafica clienti per `nome_interno` user-friendly

---

## 5. TENANT_ID HARDCODED - CRITICITÀ

**Pattern:** Fallback con UUID hardcoded in 42+ righe

```javascript
tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
```

### Locazioni principali:
- Righe: 584, 585, 717, 773, 861, 958, 1055, 1089, 1171, 1211, 1252, 1513, 1591, 1637, 1678, 1729, 2399, 2898, 2908, 3620, 3670, 3692, 3757, 4138, 5031, 5040, 5081, 5140, 5422, 5724, 6158, 6451, 6470, 6561, 6605, 7127, 7161, 7201

### Impatto:
- Se non settato env.TENANT_ID, **tutti i dati vanno nel tenant MRS Lely Center**
- **Multi-tenant non può funzionare senza env.TENANT_ID**
- ⚠️ **RICHIESTO configurare in wrangler.toml (CF Dashboard)**

---

## 6. PASSWORD SECURITY

### Algoritmi Supportati:
1. **PBKDF2 SHA-256** (nuovo - preferito)
   - Formato: `pbkdf2:salt_hex:hash_hex`
   - 100.000 iterazioni
   - 32 byte salt (random)
   
2. **SHA-256 legacy** (fase-out)
   - Formato: hash plain `xxxxxx...`
   - **Auto-upgrade** al login se rilevato

### Implementazione:
```javascript
async function hashPasswordPBKDF2(password, salt) {
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']),
    { name: 'AES-GCM', length: 256 }, false, ['wrapKey']
  );
  return await crypto.subtle.exportKey('raw', key);
}
```

### Login Flow:
1. Lookup utente per username
2. Verifica password (PBKDF2 o legacy)
3. Se legacy, upgrada a PBKDF2 e re-salva
4. Issue JWT se `JWT_SECRET` configurato
5. Return token + user data (PascalCase)

---

## 7. SOFT DELETE PATTERN

**Usato in tutte le tabelle** tramite campo `obsoleto` (boolean)

### Query Pattern:
```javascript
?select=*&obsoleto=eq.false&order=...&limit=200
```

### Operazione Cancellazione:
```javascript
await sb(env, 'tabella?id=eq.ID', 'PATCH', { 
  obsoleto: true, 
  updated_at: new Date().toISOString() 
});
```

### Tabelle con soft delete:
- utenti, clienti, macchine, piano, urgenze, ordini, automezzi, reperibilita, trasferte, installazioni, notifiche, documenti, pagellini, allegati, chat_messaggi, kpi_log, workflow_log, ecc.

---

## 8. TELEGRAM BOT INTEGRATION

### Webhook Handler
**Endpoint:** POST `/` con `action=telegramWebhook`
**Rate limit:** 100 req/min (anti-spam)
**Auth:** `TELEGRAM_WEBHOOK_SECRET` (X-Telegram-Bot-Api-Secret-Token header)

### Comandi Principali

| Comando | Funzione |
|---------|----------|
| `/start` | Menu help |
| `/vado` | Mostra urgenze aperte (top 5) |
| `/vado N` | Prendi urgenza N dalla lista |
| `/incorso` | Segna urgenza assegnata come "sto lavorando" |
| `/risolto NOTE` | Chiudi urgenza (es: `/risolto sostituito laser`) |
| `/ordine CODICE QT CLIENTE` | Crea ordine (es: `/ordine 9.1189.0283.0 2 Bondioli`) |
| `/stato` | Mostra urgenze aperte (totale) |
| `/oggi` | Interventi di oggi |
| `/settimana` | Piano settimanale |
| Testo libero + foto | AI Gemini/Workers AI analizza |

### Chat Bot AI Mirror
**Canali:** `CH_URGENZE`, `CH_ORDINI`, `CH_RISORSE`
- Parsing di comandi strutturati
- Vision su foto (LLaVA)
- Generazione testo (Llama 3.1 70B)

### Notifiche TG:
- **Nuova urgenza → gruppo** (`TELEGRAM_CHAT_ID`)
- **Urgenza assegnata → privato tecnico** (da `telegram_chat_id` in `utenti.telegram_chat_id`)
- **Escalation (>4h) → privato tecnico + admin**
- **SLA breach → gruppo** (emoji 🔴)
- **PM scaduto → riepilogo giornaliero (7-8 AM)**

---

## 9. NOTIFICHE IN-APP

### Tabella: `notifiche`

Campi principali:
- `id` (NOT_xxx)
- `tipo`: info, avviso, urgente, sla_alert, pm_scaduto, pm_urgente, escalation, ecc.
- `oggetto` (subject)
- `testo` (body)
- `mittente_id` (chi la invia, può essere 'SYSTEM' o 'TELEGRAM')
- `destinatario_id` (utente che riceve)
- `destinatari_ids` (array per broadcast)
- `priorita` (bassa, media, alta, urgente)
- `stato` (inviata, letta, archiviata)
- `riferimento_id` (urgenza_id, piano_id, ecc.)
- `riferimento_tipo` (urgenza, piano, ordine, ecc.)
- `data_invio` (timestamp)
- `obsoleto` (soft delete)

### Anti-duplicato:
**Pattern ID univoco per giorno:**
```javascript
const notifId = `PM_${type}_${id}_${today}`;
const existing = await sb(env, 'notifiche', 'GET', null, `?id=eq.${notifId}&limit=1`);
if (!existing?.length) {
  // Crea notifica
}
```

---

## 10. STATE MACHINE - TRANSIZIONI VALIDE

### PIANO (interventi)
```javascript
pianificato → [in_corso, annullato]
in_corso   → [completato, pianificato, annullato]
completato → [] (terminale)
annullato  → [pianificato] (ripianificabile)
```

### URGENZA (emergenze)
```javascript
aperta     → [assegnata, chiusa]
assegnata  → [schedulata, in_corso, aperta, chiusa]
schedulata → [in_corso, assegnata, chiusa]
in_corso   → [risolta, chiusa]
risolta    → [chiusa, in_corso] (riapertura possibile)
chiusa     → [] (terminale)
```

### Validazione:
```javascript
const err = validateTransition(VALID_PIANO_TRANSITIONS, currentStato, newStato, 'piano');
if (err) return err('Transizione non valida: ' + err);
```

---

## 11. MULTIPART & FILE UPLOAD

### Metodo: Base64 solo (no multipart)
**Endpoint:** `uploadFile`
**Input:**
- `base64_data` o `base64Data` (obbligatorio)

**Elaborazione:**
```javascript
const fileData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
```

**Storage:** Cloudflare R2 (bucket: `syntoniqa-allegati`)
**Salvataggio DB:** Tabella `allegati`

### Upload Foto Profilo:
**Endpoint:** `uploadFotoProfilo`
**Input:**
- `userId`
- `base64Data` (immagine)
- `mimeType` (facoltativo)

**Output:** URL pubblico salvato in `utenti.foto_url`

---

## 12. AUDIT LOG & WORKFLOW

### Tabella: `workflow_log`
**Campi:**
- `id` (auto-increment)
- `azione` (login, create_piano, update_urgenza, ecc.)
- `utente_id` (chi fa)
- `tabella` (utenti, urgenze, piano, ecc.)
- `record_id` (id del record modificato)
- `dati_prima` (JSON before)
- `dati_dopo` (JSON after)
- `ip_address` (da body._clientIP)
- `created_at`

**Registrazioni automatiche:**
- Tentativo login fallito (IP salvato)
- Login riuscito
- Create/Update/Delete di entità critiche
- Cambio stato urgenza/piano
- Override admin

---

## 13. AI VISION ANALYSIS (analyzeImage)

**Endpoint:** POST `analyzeImage`
**Input:**
```javascript
{
  "image_base64": "data:image/...",
  "urgenza_id": "URG_123",
  "contesto": "Problema con il laser scanner"
}
```

**Engine:** Workers AI LLaVA 1.5 7B Vision
**Output:**
```javascript
{
  "diagnosi": "Spiegazione del guasto rilevato",
  "componente_identificato": "Nome componente",
  "ricambio_suggerito": "Codice ricambio",
  "provvedimenti": "Azioni consigliate"
}
```

**Integration:**
- Salva risultato in `urgenze.allegati_ids` (come referenza)
- Suggerisce ordinazione ricambio automatica
- Invia analisi al tecnico via notifica + TG

---

## 14. RATE LIMITING

```javascript
const RATE_LIMITS = {
  default:   { max: 120, windowSec: 60 },   // 120 req/min per IP
  login:     { max: 5,   windowSec: 60 },   // 5 login/min
  ai:        { max: 10,  windowSec: 60 },   // 10 AI calls/min
  telegram:  { max: 100, windowSec: 60 },   // 100 webhook/min
};
```

**Implementazione:**
- In-memory Map: `key: "ip:bucket" → [timestamps]`
- Finestra scorrevole (sliding window)
- Cleanup automatico ogni 1000 richieste

**Check:**
```javascript
const rl = rateLimit(clientIP, bucket);
if (rl.limited) return new Response('Too Many Requests', { status: 429 });
```

---

## 15. CORS HEADERS

### Default (Production)
```javascript
'Access-Control-Allow-Origin': 'https://app.syntoniqa.app'
'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Token'
```

### Allowed Origins:
- `fieldforcemrser2026.github.io` (GitHub Pages frontend)
- `app.syntoniqa.app` (white-label app)
- `localhost:3000` (dev)
- `localhost:8787` (wrangler dev)
- Custom via `env.CORS_EXTRA` (comma-separated)

### Setter:
```javascript
function setCorsForRequest(request, env) {
  const origin = new URL(request.url).origin;
  const allowed = origins.includes(origin) ? origin : 'https://app.syntoniqa.app';
  corsHeaders = { 'Access-Control-Allow-Origin': allowed, ... };
}
```

---

## 16. JWT AUTHENTICATION

### Sign:
```javascript
async function signJWT(payload, env) {
  const key = await crypto.subtle.importKey('raw', 
    enc.encode(env.JWT_SECRET), 
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(JSON.stringify(payload)));
  return base64url_encode(header) + '.' + base64url_encode(payload) + '.' + base64url_encode(sig);
}
```

### Verify:
```javascript
async function verifyJWT(token, env) {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  const key = await crypto.subtle.importKey('raw', enc.encode(env.JWT_SECRET), ...);
  const valid = await crypto.subtle.verify('HMAC', key, ...);
  if (!valid) return null;
  return JSON.parse(atob(payloadB64));
}
```

### Payload:
```javascript
{
  sub: userId,
  role: 'admin|caposquadra|tecnico',
  anche_caposquadra: boolean,
  squadra_id: string|null,
  nome: fullName,
  tenant_id: uuid,
  iat: Math.floor(Date.now()/1000),
  exp: iat + expiresIn
}
```

**Expires:**
- Default: 8 ore (28800 sec)
- "Remember me": 30 giorni (2592000 sec)

---

## 17. AUTHORIZATION MATRIX

### Role Levels:
```javascript
admin:       { level: 100, adminApp: true, canApprove: true, seeAll: true, canManageUsers: true }
caposquadra: { level: 70,  adminApp: true, canApprove: true, seeAll: false, canManageUsers: false }
tecnico:     { level: 30,  adminApp: false, ... }
```

**Check Pattern:**
```javascript
function requireRole(body, ...allowedRoles) {
  if (!allowedRoles.includes(body._authRole)) 
    return 'Permesso negato';
}

async function requireAdmin(env, body) {
  const caller = await sb(env, 'utenti', 'GET', null, `?id=eq.${body.operatoreId}`);
  if (caller[0].ruolo !== 'admin') return 'Solo admin';
  return null; // ok
}
```

---

## 18. NORMALIZZAZIONE DATI

### PascalCase ↔ snake_case Transform:

**Input (Frontend PascalCase):**
```javascript
{ TecnicoID: "TEC_691", ClienteID: "CLI_100", DataInizio: "2026-03-04" }
```

**Normalizzazione (normalizeBody):**
```javascript
{ tecnico_id: "TEC_691", cliente_id: "CLI_100", data_inizio: "2026-03-04" }
```

**Output (Backend Supabase snake_case):** ✓ Inviato al DB

**Risposta (Frontend-facing):**
```javascript
pascalizeRecord({ tecnico_id: "TEC_691" }) → { TecnicoID: "TEC_691" }
```

### Eccezioni (mantenute PascalCase):
- `userId`
- `operatoreId`

---

## 19. PROBLEMI IDENTIFICATI

### SEVERITY ALTA

1. **TENANT_ID hardcoded in fallback**
   - 42+ occorrenze di `env.TENANT_ID || '785d94d0...'`
   - Multi-tenant non può funzionare se non configurato
   - **Fix:** Rendere env.TENANT_ID obbligatorio in wrangler.toml

2. **No Promise.allSettled() - Promise.all() può creare cascading failures**
   - Righe: 541, 574, 697, 2093, 4303, ecc.
   - Se 1 query Supabase fallisce, tutto crolla
   - **Fix:** Usare `Promise.allSettled()` oppure `.catch(() => [])`

3. **Rate limiting in-memory (Map) non persiste tra worker restarts**
   - `_rateStore` è locale al processo CF Worker
   - Utente brute-force può non essere bloccato tra deploy
   - **Fix:** Usare Durable Objects CF per rate limit persistente

4. **JWT_SECRET non obbligatorio**
   - Se non settato, login funziona lo stesso (token = null)
   - **Fix:** Rendere obbligatorio o fallback a SQ_TOKEN

5. **CORS origins hardcoded**
   - Solo 4 origins allow-listed
   - Se aggiungi white-label, modificare manualmente
   - **Fix:** Fare CSV dinamico in wrangler.toml

### SEVERITY MEDIA

6. **Supabase max 1000 limit non documentato in sb()**
   - Query con limit=2000 ritorna 1000
   - Risk di data loss silenzioso
   - **Fix:** Aggiungere console.warn() se limit > 1000

7. **Piano di 500+ interventi al mese non paginavvizzato**
   - `?limit=500` in getAll
   - Carica tutto in memoria frontend
   - **Fix:** Implement pagination server-side

8. **Email via Resend senza retry**
   - Se Resend è down, email perse
   - **Fix:** Aggiungere queue (Redis/Durable Objects)

9. **Foto base64 senza validazione MIME**
   - `uploadFile` accetta qualsiasi base64
   - Risk di malware
   - **Fix:** Validate MIME type + size limit

10. **Telegram webhook secret non obbligatorio**
    - `TELEGRAM_WEBHOOK_SECRET` può essere assente
    - Chiunque può fare webhook spoofing
    - **Fix:** Rendere obbligatorio

### SEVERITY BASSA

11. **AI engines timeout hardcoded 10s**
    - Workers AI: timeout 10s
    - Cerebras/Gemini: no timeout
    - **Fix:** Aggiungere timeout configurable per engine

12. **Serial number normalization complessa**
    - `normalizeSerial()` vs `padSerial10()` vs `normalizeM3()`
    - Tre algoritmi diversi per stesso scopo
    - **Fix:** Unificare in una funzione sola

13. **Anti-duplicato notifiche usa `today` hardcoded**
    - Timezone Italy fisso (Europe/Rome)
    - Multi-tenant con timezone diversi fallerebbe
    - **Fix:** Usare `env.TIMEZONE` configurable

14. **checkPMExpiry solo finestra 7-8 AM**
    - Riepilogo TG manda solo se ore 7-8 (Rome)
    - Skip weekend ma non holidays
    - **Fix:** Aggiungere config holidays DB

---

## 20. STATISTICHE FINALI

| Elemento | Conteggio |
|----------|-----------|
| Linee codice | 7,296 |
| Case actions | 134 |
| Async functions | 22 |
| Try/catch blocks | 100+ |
| Supabase calls | 250+ |
| AI engines supportati | 6 |
| State transitions | 10 |
| Cron jobs | 3 |
| Rate limit buckets | 4 |
| Soft delete tables | 15+ |
| Problemi severity ALTA | 5 |
| Problemi severity MEDIA | 5 |
| Problemi severity BASSA | 4 |

---

## RACCOMANDAZIONI PRIORITY

1. **IMMEDIATO:** Configurare env.TENANT_ID in wrangler.toml (obbligatorio)
2. **IMMEDIATO:** Aggiungere Promise.allSettled() a queries critiche
3. **URGENTE:** Implementare Durable Objects per rate limiting persistente
4. **URGENTE:** Aggiungere retry + queue per email/Telegram
5. **MEDIA:** Paginazione per getAll (> 500 items)
6. **MEDIA:** Validazione MIME per uploads
7. **BASSA:** Unificare serial normalization
8. **BASSA:** Config timezone per cron + multi-tenant

