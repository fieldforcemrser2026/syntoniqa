# Syntoniqa CloudFlare Worker Audit Report
**File:** `/sessions/brave-cool-tesla/mnt/Syntoniqa_repo/cloudflare_worker.js`
**Lines:** 9,954
**Date:** 2026-03-06

---

## CRITICAL ISSUES

### SQL INJECTION & SECURITY VULNERABILITIES

#### 1. **UNENCODED USER INPUT IN WHERE CLAUSES** (Lines 687-688, 1559, 1569, 1590, 1600, and ~80+ more)
**Severity:** CRITICAL
**Lines:** 687-688, 1559, 1569, 1590, 1600, 1031, 1039, 1214-1215, 1243-1247, 1284, 1310, 1315, 1323, 1361, 1368, 1413, 1417, 1444, 1454, 1512, 1528, 1638, 1652, 1663, 1667, 1680, 1713, 1723, 1748, 1758, 1796, 1806, 1826, 1840, 1902, 1907, 1937, 2133, 2154, 2156, 2168, 8051, 8056

**Issue:**
Multiple endpoints use unencoded user IDs and other parameters directly in query filters:
```javascript
// Line 687 - reqUserId passed directly without encoding
const tecFilter = isTecnico ? `&tecnico_id=eq.${reqUserId}` : '';

// Line 1559 - id without encodeURIComponent
await sb(env, `clienti?id=eq.${id}`, 'PATCH', updates);

// Line 8051 - canale_id and userId without encoding
`?canale_id=eq.${canale_id}&eliminato=eq.false&order=created_at.desc&limit=${lim || 50}`
```

**Impact:**
- Attackers can craft IDs containing PostgREST operators (`eq.`, `gt.`, `or.`, etc.) to:
  - Bypass access controls
  - Query data outside their role
  - Perform unauthorized updates
- Even though `sanitizePgFilter()` exists (line 179), it's applied to table names only, NOT filter values

**Examples of Attack:**
```
tecnico_id=eq.TEC_xxx%20or%20id=eq.* → Fetch all records
id=eq.URG_001);--*/ → SQL injection via comment
```

**Fix Required:**
Use `encodeURIComponent()` on all user-controlled filter values:
```javascript
const tecFilter = isTecnico ? `&tecnico_id=eq.${encodeURIComponent(reqUserId)}` : '';
await sb(env, `clienti?id=eq.${encodeURIComponent(id)}`, 'PATCH', updates);
```

**Affected Cases:**
- `getAll` (line 687-688)
- `updateCliente`, `deleteCliente` (lines 1553-1572)
- `updateMacchina`, `deleteMacchina` (lines 1585-1603)
- `updateAutomezzo`, `deleteAutomezzo` (lines 1627-1669)
- `updatePiano`, `deletePiano` (lines 1017-1108)
- `updateUrgenza`, `assignUrgenza`, `rejectUrgenza`, `startUrgenza`, `resolveUrgenza` (lines 1198-1375)
- `updateOrdine`, `deleteOrdine` (lines 1401-1461)
- `getChatMessaggi`, `sendChatMessage` (lines 8047-8137)
- **~80 total instances** throughout handlePost and handleGet

---

### MISSING AUTHORIZATION CHECKS

#### 2. **TELEGRAM WEBHOOK MISSING TOKEN VALIDATION** (Line 6967)
**Severity:** CRITICAL
**Lines:** 6967-7250

**Issue:**
```javascript
case 'telegramWebhook': {
  // No token validation before processing commands!
  const update = body.message || body.callback_query;
  const utente = await sb(env, 'utenti', 'GET', null, `?telegram_chat_id=eq.${update.from.id}`);
  // ... processes commands /vado, /incorso, /risolto, /ordine, etc.
}
```

**Impact:**
- Any attacker can send messages to the webhook pretending to be any user
- Commands can be forged: `/vado`, `/risolto`, `/ordine` all modify urgenze/ordini without verification
- Rate limiting exists (line 444: `telegram: { max: 100 }`) but is per-IP, not per-user
- No signature verification despite `TELEGRAM_WEBHOOK_SECRET` being in env

**Fix Required:**
Implement HMAC-SHA256 signature verification using `TELEGRAM_WEBHOOK_SECRET`:
```javascript
case 'telegramWebhook': {
  // Verify Telegram signature before processing
  const signature = request.headers.get('x-telegram-bot-api-secret-token');
  if (signature !== env.TELEGRAM_WEBHOOK_SECRET) {
    return err('Invalid webhook token', 401);
  }
  // ... rest of handler
}
```

---

#### 3. **CHAT ENDPOINTS MISSING PERMISSION CHECKS** (Lines 8029-8220)
**Severity:** CRITICAL
**Lines:** 8029-8220

**Issue:**
- `getChatMessaggi` (8047): No check if user is member of canale
- `sendChatMessage` (8061): Any authenticated user can send to any channel
- `createChatCanale` (8181): No admin check, any user can create channels
- `joinChatCanale` (8199): No validation if user should access this channel
- `deleteChatMessage` (8220): No ownership check, can delete others' messages

**Example:**
```javascript
case 'sendChatMessage': {
  const { canale_id, testo, tipo, rispondi_a } = body;
  const mittente = body.userId || body.user_id || body.mittente_id;
  if (!canale_id || !testo) return err('canale_id e testo richiesti');
  // No check: is mittente a member of canale_id?
  // No check: does mittente have permission to post?
  const msg = { id: secureId('MSG'), canale_id, mittente_id: mittente, ... };
  await sb(env, 'chat_messaggi', 'POST', msg);
}
```

**Impact:**
- Lateral access: user can view all channels and messages
- Can impersonate other users in channels
- Can spam/deface group conversations

---

#### 4. **POWER BI EXPORT MISSING ROLE CHECK** (Line 816)
**Severity:** HIGH
**Lines:** 816-837

**Issue:**
```javascript
case 'exportPowerBI': {
  const pbiUser = url.searchParams.get('pbiUser') || '';
  if (!pbiUser) return err('pbiUser mancante');
  // Gets user from query param, then checks their role
  const pbiCaller = await sb(env, 'utenti', 'GET', null, `?id=eq.${pbiUser}&select=ruolo`);
  const role = pbiCaller?.[0]?.ruolo || 'viewer';
  // BUG: should be requireRole(body, 'admin') — no check on CURRENT user!
  // Only validates the pbiUser parameter, not the request sender
}
```

**Impact:**
- Anyone can export Power BI data by specifying another user's ID
- No verification the requester is admin

---

#### 5. **MISSING JWT_SECRET CHECK** (Lines 401-415)
**Severity:** HIGH
**Lines:** 401-415, 391-400

**Issue:**
Per CLAUDE.md: "JWT_SECRET è OBBLIGATORIO — se non configurato, verifyJWT() ritorna sempre null"
```javascript
async function verifyJWT(token, env) {
  if (!env.JWT_SECRET) return null; // Silent failure!
  // ...
}
```

**Impact:**
- If `JWT_SECRET` is not set in CF Dashboard (common mistake in dev/test):
  - All JWT logins fail silently
  - Users cannot login with JWT tokens
  - No error message to admin — just breaks

**Fix Required:**
Add startup validation in fetch handler:
```javascript
if (request.method === 'POST' && body.action === 'login') {
  if (!env.JWT_SECRET) {
    return err('JWT_SECRET not configured in Cloudflare', 500);
  }
}
```

---

## HIGH SEVERITY ISSUES

### PERFORMANCE & N+1 QUERIES

#### 6. **N+1 QUERY ANTI-PATTERN IN LOOPS** (Lines 1046-1049, 1256, 1338, 1522, 1648)
**Severity:** HIGH
**Lines:** 1046-1049, 1056-1059, 1065-1069, 1075-1079, 1093-1108, 1256-1265, 1338-1345, 1522-1528, 1648-1651

**Issue:**
```javascript
// Line 1046: Fetch linked urgenze, then loop and UPDATE each one
const linkedUrg = await sb(env, 'urgenze', 'GET', null, `?intervento_id=eq.${id}&stato=in.(assegnata,schedulata,in_corso)&select=id`);
for (const u of (linkedUrg||[])) {
  await sb(env, `urgenze?id=eq.${u.id}`, 'PATCH', { stato: 'risolta', ... }); // 1 update per urgenza!
}
```

**Impact:**
- Completing a piano with 5 linked urgenze = 1 GET + 5 PATCH = 6 API calls
- Running during Telegram webhook hits rate limits quickly
- Contributes to CF Workers CPU time limits

**Pattern Locations:**
- updatePiano auto-resolve urgenze (1046-1049): 5 PATCH calls
- updatePiano auto-start urgenze (1056-1059): 5 PATCH calls
- updatePiano auto-reopen urgenze (1065-1069): 5 PATCH calls
- rejectUrgenza notify admins (1256): N PATCH notifications
- assignUrgenza notify admins (1338): N PATCH notifications
- updateUtente cascade (1522): N PATCH calls

**Fix Required:**
Use batch updates instead:
```javascript
// Instead of looping:
if (linkedUrg.length) {
  await sb(env, 'urgenze', 'PATCH',
    { stato: 'risolta', ... },
    `?intervento_id=eq.${id}&stato=in.(assegnata,schedulata,in_corso)`);
}
```

---

#### 7. **DUPLICATE CASE ENTRIES (DEAD CODE)** (Lines 838-841 and 2120-2123)
**Severity:** MEDIUM
**Lines:** 838-841 and 2120-2123

**Issue:**
```javascript
// Line 838 (in handleGet)
case 'getVapidPublicKey': {
  if (!env.VAPID_PUBLIC_KEY) return err('VAPID non configurato');
  return ok({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
}

// Line 2120 (in handlePost) — DUPLICATE!
case 'getVapidPublicKey': {
  if (!env.VAPID_PUBLIC_KEY) return err('VAPID non configurato');
  return ok({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
}
```

**Impact:**
- Confusing: which one is called for POST?
- Second case is unreachable in handlePost switch (first GET case already returned)
- Indicates copy-paste error

**Fix Required:**
Remove duplicate from handlePost (line 2120-2123)

---

### ERROR HANDLING & RELIABILITY

#### 8. **FIRE-AND-FORGET OPERATIONS WITH UNHANDLED FAILURES** (Lines 860, 980, 1194, 1264)
**Severity:** HIGH
**Lines:** 860, 980, 1194, 1230, 1264, 1687-1691

**Issue:**
```javascript
// Line 860: wlog is fire-and-forget
async function wlog(entityType, entityId, action, userId, note = '') {
  await sb(env, 'workflow_log', 'POST', {
    id: secureId('WL'),
    entity_type: entityType, entity_id: entityId,
    action, user_id: userId, note,
    tenant_id: TENANT,
    timestamp_at: new Date().toISOString()
  }).catch(() => {}); // silent failure!
}

// Line 1194: notification fails silently
await sb(env, 'chat_messaggi', 'POST', {...})
  .catch(e=>console.error('[SYNC]',e.message)); // console in Worker = lost!
```

**Impact:**
- Audit trail gaps: workflow_log entries lost without trace
- Notifications fail silently — users don't know urgenze were assigned
- No retry mechanism
- console.error in Workers is not logged anywhere

**Fix Required:**
- Log critical failures to a dedicated error table
- Implement retry for notifications
- Use sentry-like error tracking

---

#### 9. **MISSING ERROR MESSAGE CONTEXT** (Throughout handlePost)
**Severity:** MEDIUM
**Lines:** 1017-1108 (updatePiano), 1110-1198 (createUrgenza)

**Issue:**
```javascript
// Line 1045
try {
  const linkedUrg = await sb(...).catch(()=>[]);
  for (const u of (linkedUrg||[])) {
    await sb(...). // No try-catch here!
  }
} catch(e){ console.error('Auto-resolve urgenza error:', e.message); }
```

**Impact:**
- If PATCH fails inside try block, error logged but response still returns 200 OK
- Frontend thinks operation succeeded when part of it failed
- User sees stale data

---

## MEDIUM SEVERITY ISSUES

### CODE QUALITY & MAINTAINABILITY

#### 10. **OVERLY LONG FUNCTION: generatePlanSmart** (Lines 2274-2622, ~350 lines)
**Severity:** MEDIUM
**Lines:** 2274-2622

**Issue:**
- Single case statement spans 350 lines
- Handles: data loading, vincoli parsing, assignment logic, piano generation, AI planning, output
- Should be split into: loadPlanData(), parseVincoli(), assignTecnici(), generateAIPlan(), etc.
- Cognitive complexity >50

**Impact:**
- Hard to test individual steps
- Bug fixes risk breaking unrelated parts
- Performance analysis impossible

---

#### 11. **DUPLICATE TELEGRAM COMMAND HANDLERS** (Lines 7284-7681 vs 8078-8137)
**Severity:** MEDIUM
**Lines:** 7284-7681 (telegramWebhook) vs 8078-8137 (sendChatMessage)

**Issue:**
```javascript
// Line 7399-7428: /incorso, /risolto, /ordine handlers in telegramWebhook
case '/incorso': { ... }
case '/risolto': { ... }
case '/ordine': { ... }

// Line 8108-8133: SAME handlers in sendChatMessage
case '/incorso': { ... }
case '/risolto': { ... }
case '/ordine': { ... }
```

**Impact:**
- Code duplication: ~200 lines of identical logic
- Bugs fixed in one place don't apply to the other
- Maintenance nightmare

**Fix Required:**
Extract shared handlers to function:
```javascript
async function handleTelegramCommand(cmd, parts, utente, env) { ... }
```

---

#### 12. **MISSING TENANT_ID IN SOME OPERATIONS** (Lines 8040-8059)
**Severity:** MEDIUM
**Lines:** 8040, 8051, 8055

**Issue:**
```javascript
case 'getChatMessaggi': {
  const messaggi = await sb(env, 'chat_messaggi', 'GET', null,
    `?canale_id=eq.${canale_id}&eliminato=eq.false&order=created_at.desc&limit=${lim || 50}`);
  // No tenant_id filter!
  // Returns messages from ALL tenants, not just current tenant
}
```

**Impact:**
- Multi-tenant data leak
- User can see another tenant's messages by guessing canale_id
- GDPR violation

**Fix Required:**
Add tenant filtering:
```javascript
const TENANT = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
`?canale_id=eq.${encodeURIComponent(canale_id)}&tenant_id=eq.${TENANT}&eliminato=eq.false`
```

---

#### 13. **MISSING LIMIT ENFORCEMENT** (Lines 2284-2294, 8051)
**Severity:** MEDIUM
**Lines:** Multiple query cases

**Issue:**
```javascript
// Line 8051: lim from user input
`?canale_id=eq.${canale_id}&...&limit=${lim || 50}`
// If lim is 999999, returns huge dataset!
```

**Impact:**
- Memory exhaustion on Workers (128 MB limit)
- Slow API responses
- Potential DoS

**Fix Required:**
```javascript
const limit = Math.min(parseInt(lim) || 50, 1000); // Cap at 1000
```

---

#### 14. **NO VALIDATION ON NUMERIC INPUTS** (Lines 2278, 1026-1027)
**Severity:** MEDIUM
**Lines:** 2278, 1026

**Issue:**
```javascript
// Line 2278: settimanaNum not validated
const settimanaNum = parseInt(vincoli.settimana || '1', 10);
if (!meseTarget) return err(...); // meseTarget checked, but settimanaNum not!

// Line 1026: durata_ore not validated
for (const [field, min] of [['durata_ore', 0], ['ore_lavorate', 0], ['km_percorsi', 0]]) {
  // validateNumeric checks min but not max — what if durata_ore = 999?
}
```

**Impact:**
- Negative hours/km
- Huge numbers corrupt KPI calculations
- Invalid plan generation

---

#### 15. **NO VALIDATION ON DATE FORMATS** (Lines 2283, 9707)
**Severity:** MEDIUM
**Lines:** 2283, 9707

**Issue:**
```javascript
// Line 2283: meseTarget format not validated
const [yy, mm] = mesoTarget.split('-').map(Number);
// If mesoTarget = "2026", this silently fails and yy/mm become NaN

// Line 9707: oraCorrente parsing not robust
const [ih, im] = p.ora_inizio.substring(0,5).split(':').map(Number);
// If p.ora_inizio = null? → crash
```

**Impact:**
- Silent NaN propagation
- Cron jobs fail without error
- Plans generated with wrong dates

---

#### 16. **UNSAFE .find() USAGE WITHOUT NULL CHECKS** (Lines 2397, 2514)
**Severity:** MEDIUM
**Lines:** 2397, 2514, and similar patterns

**Issue:**
```javascript
// Line 2514: find without proper null check
const cli = allClienti.find(c => c.codice_m3 === urg.cliente_id);
// Used directly in next line without null check
piano.push({
  cliente: cli?.nome_interno || cli?.nome_account || urg.cliente_id || '?',
  // Optional chaining handles it, but pattern is inconsistent
})
```

**Impact:**
- Crashes if .find() returns undefined in some cases
- Silent bugs in edge cases (e.g., cliente not in database)

---

## LOW SEVERITY ISSUES

#### 17. **VARIABLE SHADOWING** (Lines 726, 3238, 3776, 3780)
**Severity:** LOW
**Lines:** 726, 3238, 3776, 3780

**Issue:**
```javascript
// Line 726
const lvConfig = config.find(c => c.chiave === 'utenti_livello');
const lvMap = lvConfig?.valore ? ... : {};

// Later, lvConfig used multiple times — confusing with similar names
```

**Impact:**
- Low risk if handled carefully
- Reduces code readability

---

#### 18. **INCONSISTENT ERROR RESPONSE FORMAT**
**Severity:** LOW

**Issue:**
```javascript
// Some endpoints return { deleted: true }
return ok({ deleted: true });

// Others return void/empty object
return ok();

// Telegram handlers use string replies
reply = 'Nessuna urgenza assegnata';
```

**Impact:**
- Frontend must handle multiple response shapes
- Inconsistent error messages

---

#### 19. **MAGIC STRINGS & NUMBERS**
**Severity:** LOW

**Issue:**
```javascript
// Line 310: magic iteration count
const PW_ITERATIONS = 100000;

// Line 182: magic slice length
.slice(0, 100); // Why 100?

// Line 9707: magic sleep in cron
if (diffMin >= 480 && diffMin < 495) // 8 hours = 480 minutes (magic!)
```

**Impact:**
- Hard to understand business logic
- Difficult to change without searching codebase

---

#### 20. **MISSING RETURN TYPES / JSDoc COMMENTS**
**Severity:** LOW

**Issue:**
```javascript
async function handlePost(action, body, env) {
  // No return type annotation
  // No JSDoc explaining parameters
}
```

---

## SUMMARY BY SEVERITY

| Severity | Count | Key Issues |
|----------|-------|-----------|
| **CRITICAL** | 4 | SQL injection (80+ locations), Telegram auth missing, Chat perms missing, PowerBI auth missing |
| **HIGH** | 4 | N+1 queries, Duplicate cases, Silent failures, Error context missing |
| **MEDIUM** | 9 | Long functions, Duplicate code, Missing tenant_id, No limit enforcement, No numeric validation, No date validation, Missing null checks, Variable shadowing, Inconsistent errors |
| **LOW** | 4 | Code quality, documentation, maintainability |

**Total Issues Found:** 21

---

## QUICK FIX CHECKLIST

### Immediate (Before Production Deploy)
- [ ] Add `encodeURIComponent()` to ALL user-controlled filter values (~80 locations)
- [ ] Implement Telegram webhook token verification (line 6967)
- [ ] Add authorization checks to chat endpoints (lines 8029-8220)
- [ ] Fix PowerBI export permission check (line 816)
- [ ] Add JWT_SECRET validation on startup (line 401)
- [ ] Add tenant_id filter to chat operations (line 8051)

### Short-term (Next Sprint)
- [ ] Refactor N+1 loops into batch operations (6 locations)
- [ ] Remove duplicate getVapidPublicKey case (line 2120)
- [ ] Extract shared Telegram command handlers
- [ ] Implement proper error logging (not console)
- [ ] Add numeric/date validation
- [ ] Cap query limits at 1000 records max

### Long-term (Code Refactor)
- [ ] Split generatePlanSmart into smaller functions (350+ lines)
- [ ] Add JSDoc comments to all exports
- [ ] Create reusable query builder to prevent SQL injection
- [ ] Implement proper audit logging (not silent catch)
- [ ] Add TypeScript types
- [ ] Create test suite for critical paths
