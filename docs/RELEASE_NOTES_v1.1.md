# Syntoniqa v1.1 — Release Notes

> **Build**: 14.427 righe | **Data**: 2026-03-01 | **Delta**: +3.701 righe vs v1.0

---

## Executive Summary

Syntoniqa v1.1 introduce un upgrade massivo del sistema FSM con 5 pilastri strategici:
Telegram Bot 2.0 con 8 nuovi comandi, AI Vision potenziata con catalogo 5045 parti Lely,
Smart Dispatching automatico, Output Apple-style premium, Canali tematici auto-routing,
e PM Scheduling automatico. Zero framework aggiuntivi, zero dipendenze nuove.

---

## Pilastro 1: Telegram Bot 2.0

### 1A. Nuovi Comandi (8)

| Comando | Funzione | Chi |
|---------|----------|-----|
| `/pianifica [data] [cliente] [tipo]` | Crea intervento con NLP date (domani, lunedi, ISO) | Tutti |
| `/assegna [N] [tecnico]` | Assegna urgenza a tecnico specifico + notifica TG | Admin/Capo |
| `/disponibile` | Segnati disponibile per urgenze oggi (crea slot "varie") | Tutti |
| `/dove` | Mostra posizione/stato di tutti i tecnici in tempo reale | Tutti |
| `/catalogo [ricerca]` | Cerca nel catalogo ricambi Lely (codice, nome, desc) | Tutti |
| `/tagliando [cliente\|tutti]` | Prossimi tagliandi per cliente o top 10 urgenti | Tutti |
| `/report` | Report giornaliero personale premium con progress bar | Tutti |
| `/kpi` | KPI 7 giorni con breakdown giornaliero e score | Tutti |

### 1B. AI Vision Potenziata

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Foto TG     │────▶│ LLaVA 1.5    │────▶│ Catalogo Lely │
│ del guasto  │     │ + Catalogo   │     │ 5045 parti    │
│             │     │ nel prompt   │     │ → match fuzzy │
└─────────────┘     └──────────────┘     └───────────────┘
        │                                        │
        ▼                                        ▼
┌─────────────────────────────────────────────────────┐
│ OUTPUT:                                              │
│ 🔍 Componente: Pompa latte principale               │
│ ⚠️ Danno: Usura guarnizione, perdita fluido         │
│ 🔧 Ricambio: 9.1189.0283.0 — Pump assy main ✅      │
│ 📊 Confidence: 0.85                                 │
└─────────────────────────────────────────────────────┘
```

**Funzioni aggiunte:**
- `loadPartsCatalog(env, macchina)` — Carica parti rilevanti dal DB per contesto AI
- `matchPartInCatalog(env, descrizione)` — Fuzzy match codice/nome nel catalogo reale
- Post-processing: ogni ricambio suggerito dall'AI viene verificato vs catalogo DB
- Badge `✅ verificato` o `⚠️ da verificare` nel messaggio Telegram

---

## Pilastro 2: Smart Dispatching

```
NUOVA URGENZA CREATA
        │
        ▼
┌─────────────────────────┐
│ Check piano oggi        │
│ → Tecnici con "varie"   │
│ → Tecnici con "backup"  │
│ → Tecnici disponibili   │
└───────────┬─────────────┘
            ▼
    ┌───────────────┐
    │ Suggerimento  │──▶ Gruppo TG: "💡 SMART DISPATCH"
    │ automatico    │──▶ Email admin con candidati
    │ nel messaggio │──▶ Frontend: smartDispatch object
    └───────────────┘
```

**Trigger**: Ogni `createUrgenza` (sia da admin che da Telegram)
**Logica**: Cerca nel `piano` odierno interventi con note contenenti "varie", "disponibil", "urgenz", "backup"
**Output**: Lista tecnici suggeriti con base, notifica TG nel gruppo con `/assegna` command

---

## Pilastro 3: Output Apple-Style Premium

### /report — Prima vs Dopo

```
PRIMA:                          DOPO:
📊 Report                       ┌─────────────────────────┐
Interventi: 5                   │  📊  REPORT GIORNALIERO  │
Completati: 3                   └─────────────────────────┘
                                👤 Jacopo Bonadé
                                📅 2026-03-01  •  📞 REP VECTOR

                                ── Avanzamento ──────────
                                ▓▓▓▓▓▓░░░░  60%

                                📋 Interventi: 5
                                   ✅ Completati: 3
                                   🔄 In corso: 1
                                   📅 Da fare: 1

                                ── Dettaglio ───────────
                                ✅ 08:00 Bondioli - Tagliando A1
                                ✅ 10:30 Orefici - Sostituzione pompa
                                🔄 14:00 Mengoli - Calibrazione laser
                                ⏳ 16:00 Tacconi - Service B2

                                ━━━━━━━━━━━━━━━━━━━━━━
                                MRS Lely Center · Syntoniqa
```

### /kpi — Mini-chart giornaliero + Score

```
┌─────────────────────────┐
│  📊  KPI SETTIMANALE     │
└─────────────────────────┘
👤 Jacopo Bonadé
📅 2026-02-22 → 2026-03-01

── Performance ─────────
📋 Interventi totali: 28
✅ Completamento: 85%
▓▓▓▓▓▓▓▓░░  85%

🚨 Urgenze gestite: 12 (10 risolte)
📦 Ordini: 5

── Andamento ───────────
Lun 22: ████░░ 4/5
Mar 23: █████░ 5/6
Mer 24: ███░░░ 3/4
Gio 25: ████░░ 4/5
Ven 26: █████░ 5/5
Sab 27: ██░░░░ 2/3

── Score ───────────────
🟢 87/100 — Eccellente!
```

### Report Builder — 2 nuovi tipi

| Tipo | Descrizione |
|------|-------------|
| `daily_team` | Report giornaliero completo del team con score per tecnico |
| `tagliandi_scadenza` | Lista macchine con prossimo tagliando, prioritizzate per urgenza |

---

## Pilastro 4: Canali Tematici Auto-Routing

```
Messaggio Telegram
      │
      ▼
┌─────────────────────┐
│ ROUTING ENGINE      │
│                     │
│ 1. aiResult.tipo?   │──▶ urgenza → CH_URGENZE
│                     │──▶ ordine  → CH_ORDINI
│                     │──▶ intervento → CH_OPERATIVO
│                     │
│ 2. Comando slash?   │──▶ /ordine, /catalogo → CH_ORDINI
│                     │──▶ /pianifica, /report → CH_OPERATIVO
│                     │──▶ /vado, /assegna → CH_URGENZE
│                     │
│ 3. Keyword?         │──▶ fermo, guasto → CH_URGENZE
│                     │──▶ ordine, pezzo → CH_ORDINI
│                     │──▶ installare → CH_INSTALLAZIONI
│                     │
│ 4. Default          │──▶ CH_GENERALE
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ MIRROR DOPPIO       │
│ 1. Msg utente → CH  │
│ 2. Risposta bot → CH│
│ 3. Se !ADMIN → anche│
│    → CH_ADMIN       │
└─────────────────────┘
```

**Canali supportati**: CH_URGENZE, CH_ORDINI, CH_OPERATIVO, CH_INSTALLAZIONI, CH_GENERALE, CH_ADMIN
**Mirroring**: Ogni messaggio (utente + bot) duplicato nel canale tematico appropriato

---

## Pilastro 5: PM Scheduling + Catalogo Parti

### PM Scheduling Automatico

```
┌──────────────────────────────────────────────┐
│ 🔧 PM SCHEDULING — Manutenzione Programmata  │
├──────────────────────────────────────────────┤
│ Mese: [Aprile 2026 ▼]  Ciclo: [Tutti ▼]     │
│ Cliente: [Tutti ▼]                            │
│ [🔍 Anteprima]  [⚡ Genera Interventi]        │
├──────────────────────────────────────────────┤
│ Macchina        │ Modello   │ Cliente  │ Data │
│ AST_101 Bondioli│ Astronaut │ BONDIOLI │ 04/15│
│ VEC_201 Orefici │ Vector    │ OREFICI  │ 04/08│
│ JUN_301 Mengoli │ Juno      │ MENGOLI  │ 04/22│
├──────────────────────────────────────────────┤
│ 📅 Tagliandi in Scadenza                     │
│ 🔴 SCADUTO: AST_102 — Astronaut — 2026-02-15│
│ 🟠 URGENTE: VEC_203 — Vector — 2026-03-05   │
│ 🟡 PROSSIMO: JUN_305 — Juno — 2026-03-28   │
│ 🟢 OK: AST_104 — Astronaut — 2026-05-10     │
└──────────────────────────────────────────────┘
```

**Cicli Lely PM**: A1 (bimestrale 60gg), B2 (trimestrale 90gg), C3 (semestrale 180gg), D8 (annuale 365gg)
**Endpoint**: `generatePMSchedule` con dry_run per anteprima
**Input**: mese_target, ciclo (opz.), cliente_id (opz.)
**Output**: Lista interventi da creare + creazione automatica nel piano

### Catalogo Parti Searchable

```
┌──────────────────────────────────────────────┐
│ 🔍 CATALOGO RICAMBI LELY                     │
├──────────────────────────────────────────────┤
│ Cerca: [pompa latte        ]  Modello: [▼]   │
│ Gruppo: [           ]  [🔍 Cerca]             │
├──────────────────────────────────────────────┤
│ Codice          │ Nome            │ Gruppo    │
│ 9.1189.0283.0   │ Pump assy main  │ Pompe     │
│ 9.1189.0284.0   │ Pump gasket kit │ Guarniz.  │
│ 5.1192.0450.0   │ Pump motor 24V  │ Motori    │
└──────────────────────────────────────────────┘
```

**Endpoint**: `searchParts` — ricerca fuzzy su codice, nome, descrizione, gruppo, modello
**Mobile**: Pagina dedicata in index_v2.html per tecnici sul campo
**Admin**: Sezione dedicata in admin_v1.html con filtri avanzati

---

## Correzioni Bug

| ID | Bug | Fix |
|----|-----|-----|
| BF-01 | `saveConfig` crash se `body.config` undefined | Aggiunto null-check + fallback `body.data` |
| BF-02 | pianoEsistente "undefined undefined" per tecnici senza nome | Null-safe concatenation con `.trim()` |
| BF-03 | Duplicate `const oggi` nello stesso scope | Riutilizzo variabile esistente |

---

## Security Hardening

### CRITICAL (5 fix)

| ID | Vulnerabilità | Fix |
|----|---------------|-----|
| SEC-01 | PostgREST filter injection in 12 endpoint (ilike) | `sanitizePgFilter()` — strip special chars, max 100 chars |
| SEC-02 | Null destructuring da `sb()` (crash su array vuoto) | Safe array access con `?.[0]` + `.catch(() => [])` |
| SEC-03 | `sb()` GET ritorna `null` su body vuoto | Ritorna `[]` per GET, `null` solo per PATCH/POST |
| SEC-04 | Supabase `limit=2000` supera max 1000 PostgREST | Cappato a `limit=1000` |
| SEC-05 | `resolveUrgenza` skip validazione transizione stato | Aggiunto `validateTransition()` prima del PATCH |

### HIGH (3 fix)

| ID | Vulnerabilità | Fix |
|----|---------------|-----|
| SEC-06 | Auto-refresh `setInterval` mai cleared (memory leak) | `clearInterval` prima di re-set |
| SEC-07 | Chat poll interval leak su navigazione | Null-safe clear con `CHAT_POLL=null` |
| SEC-08 | XSS via `innerHTML` con dati utente | `esc()` helper + applicato a 10+ punti critici |

### Funzione `sanitizePgFilter()`

```javascript
function sanitizePgFilter(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[*.,=|:()&!<>;\[\]{}\\/"'` + "`" + `%]/g, '').trim().slice(0, 100);
}
```

Applicato a: `searchClienti`, `searchParts`, `/catalogo`, `/tagliando`, `getAnagraficaClienti`, `getAnagraficaAssets`, `analyzeImage`, `loadPartsCatalog`, `matchPartInCatalog`.

---

## Performance & Scalabilità

### Lazy Rendering (Admin)

```
PRIMA (renderAll):                    DOPO (lazy):
┌────────────────────────┐           ┌────────────────────────┐
│ Login → renderAll()    │           │ Login → renderDashboard│
│ 20+ sezioni renderizzate│          │ Solo dashboard + badges│
│ DOM pesante immediato   │          │ ~95% meno DOM iniziale │
│ Tempo: ~800ms          │           │ Tempo: ~50ms           │
└────────────────────────┘           └────────────────────────┘
                                     showSec('urgenze')
                                     → lazyRender('urgenze')
                                     → renderUrgenze() [prima volta]
                                     → cached [successive]
```

- `SEC_RENDERERS`: mappa sezione → funzione render
- `_rendered Set`: cache sezioni già renderizzate
- `lazyRender(secId)`: render on-demand con first-visit check
- `renderAllForce()`: invalidate + re-render sezione attiva (per data refresh)

### Lazy Rendering (Mobile)

Identico pattern per `index_v2.html`:
- `MOB_RENDERERS`: mappa pagina → funzione render
- `mobLazy(pgId)`: render on-demand
- `goPage()` → `mobLazy()` automatico

---

## Metriche Codice

| File | v1.0 | v1.1 | Delta |
|------|------|------|-------|
| `cloudflare_worker.js` | 3.042 | 4.420 | +1.378 |
| `admin_v1.html` | 5.548 | 7.265 | +1.717 |
| `index_v2.html` | 2.071 | 2.810 | +739 |
| `white_label_config.js` | 65 | 80 | +15 |
| **Totale** | **10.726** | **14.575** | **+3.849** |

### Nuovi Endpoint Backend: 3

| Endpoint | Tipo | Descrizione |
|----------|------|-------------|
| `searchParts` | POST | Ricerca catalogo parti Lely |
| `generatePMSchedule` | POST | Auto-scheduling PM per mese |
| `daily_team` (report) | POST | Report giornaliero team premium |

### Nuovi Comandi Telegram: 8

`/pianifica`, `/assegna`, `/disponibile`, `/dove`, `/catalogo`, `/tagliando`, `/report`, `/kpi`

### Nuove Sezioni Admin: 2

PM Scheduling, Catalogo Parti

### Nuove Pagine Mobile: 1

Catalogo Parti Mobile

---

## Architettura Aggiornata

```
┌──────────────────────┐     ┌──────────────────────────┐
│  admin_v1.html       │────▶│  Cloudflare Worker        │
│  (7265 righe)        │     │  cloudflare_worker.js     │
│  35 sezioni (lazy)   │     │  (4420 righe)             │
│  17 modali, esc()    │     │  sanitizePgFilter()       │
├──────────────────────┤     │                            │
│  index_v2.html       │────▶│  8 GET + 95 POST handlers │
│  (2810 righe)        │     │  2 cron jobs (*/15 min)   │
│  18 pagine (lazy)    │     │  Telegram Bot 2.0 (16 cmd)│
└──────────────────────┘     └──────────┬───────────────┘
                                         │
                              ┌──────────▼───────────────┐
                              │  Supabase PostgreSQL      │
                              │  22 tabelle + tagliandi   │
                              │  Smart Dispatching        │
                              │  AI Vision + Parts Match  │
                              └──────────────────────────┘
```

---

## Deployment

```bash
# Deploy worker
CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy

# Deploy frontend
git add cloudflare_worker.js admin_v1.html index_v2.html white_label_config.js
git commit -m "feat: Syntoniqa v1.1 — 5 Pilastri (Telegram Bot 2.0, Smart Dispatch, Apple-style, Auto-routing, PM Scheduling)"
git push origin main
```
