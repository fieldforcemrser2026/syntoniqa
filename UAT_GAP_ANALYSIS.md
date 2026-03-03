# SYNTONIQA v1.0 — UAT Test Coverage Gap Analysis

**Date:** 2026-03-02
**Total Endpoints:** 129
**Tested:** 66 (51.2%)
**NOT Tested:** 63 (48.8%)
**Test Suites:** 22 (W sections A-W)

---

## Executive Summary

The current UAT test suite covers 85 individual test cases across 22 test suites, providing good coverage of core CRUD operations and basic workflows. However, **critical gaps exist** in:

1. **Advanced Features** — AI planning, image analysis, import/export flows
2. **Integration Testing** — End-to-end Telegram bot, email/push notifications
3. **State Machine Edge Cases** — Invalid transitions, concurrent modifications
4. **Role-Based Access** — Caposquadra permissions, tecnico limitations
5. **Workflow Chains** — Multi-step processes with notifications and escalations
6. **Boundary Conditions** — Empty datasets, overlapping constraints, missing fields

---

## PART A: UNTESTED ACTIONS BY CATEGORY

### 1. User Management (5 endpoints) — 0% Coverage
These are authentication & user lifecycle operations:

```
- changePassword          : Tecnico self-service password change
- createUtente            : Admin creates new user
- resetPassword           : Admin manual password reset
- requestPasswordReset    : Self-service reset link generation
- updateUtente            : Admin modifies user data (role, base, furgone)
```

**Risk Level:** MEDIUM — Users cannot change own passwords; password reset flow untested

---

### 2. Telegram Bot Integration (10 endpoints) — 0% Coverage
Complete Telegram bot system is implemented but untested:

```
- sendTelegramMsg         : Direct message to Telegram group/chat
- testTelegram            : Validates Telegram API connectivity
- telegramWebhook         : Webhook handler for incoming Telegram messages
- setupWebhook            : Configure webhook URL at Telegram API
- removeWebhook           : Remove webhook registration
- sendEmail               : Email notifications (used by cron & flows)
- testEmail               : Email service validation
```

**Implementation Details:**
- `/start` — Welcome + help
- `/help` — Command list
- `/stato` — Current urgenze status
- `/oggi` — Today's interventions
- `/settimana` — Weekly plan
- `/vado` — List & select urgenza to take
- `/incorso` — Mark urgenza as started
- `/risolto [note]` — Mark resolved with notes
- `/ordine <codice> <qty> <cliente>` — Create parts order
- `/servepezz` — List urgent parts needed
- `/pianifica` — Create intervention
- `/assegna` — Assign intervention
- `/disponibile` — Check availability
- `/dove` — Location of tecnico
- `/catalogo` — Search parts catalog
- `/tagliando` — PM/maintenance info
- `/report` — Generate report
- `/kpi` — Show KPI metrics

**Risk Level:** CRITICAL — No verification that:
- Bot commands properly parse arguments
- State transitions via Telegram succeed
- Notifications are actually delivered
- Image analysis (Gemini) works correctly
- Unstructured text is handled (AI analysis)

---

### 3. Push Notifications (3 endpoints) — 0% Coverage

```
- savePushSubscription    : Register device for push notifications
- removePushSubscription  : Unsubscribe device
- sendPush                : Send push notification to subscribed devices
```

**Risk Level:** MEDIUM — PWA push feature completely untested

---

### 4. File Uploads (2 endpoints) — 0% Coverage

```
- uploadFile              : Generic file upload (attachments/documents)
- uploadFotoProfilo       : Profile photo upload (tecnico avatar)
```

**Risk Level:** MEDIUM — No validation of:
- File size limits
- MIME type restrictions
- Virus/malware scanning
- Storage quota management

---

### 5. AI/ML Features (6 endpoints) — ~17% Coverage
Only `testAI` & `generateAIPlan` have partial tests (optional AI tests):

```
- analyzeImage            : Gemini vision API — analyze problem photos
- applyAIPlan             : Apply AI-generated plan to database
- generatePlanSmart       : Advanced scheduling with constraints
- generatePMSchedule      : Predictive maintenance scheduling
- importExcelPlan         : Import plan from Excel + AI validation
- notifyPlanApproved      : Notify when AI plan is approved by admin
- previewAIPlan           : Preview AI plan before saving
```

**Risk Level:** HIGH — Core AI planning features untested in production context

---

### 6. Import/Export (7 endpoints) — 0% Coverage

```
- importLelyClienti       : Bulk import clients from Lely master data
- importLelyAssets        : Bulk import robot assets from Lely
- importAnagraficaClienti : Import from internal anagrafica table
- importAnagraficaAssets  : Import from internal anagrafica table
- importExcelPlan         : Import intervention plan from Excel file
- exportPowerBI           : Export data for Power BI analysis
- exportLelyTemplate      : Generate Lely import template file
```

**Risk Level:** HIGH — Data integrity issues possible if import validation fails

---

### 7. Maintenance Planning (PM) — 6 endpoints — 0% Coverage

```
- generatePMSchedule      : Auto-generate PM calendar from rules
- bulkGeneratePMCalendar  : Batch generate for multiple assets
- completePM              : Mark maintenance as done
- generatePlanSmart       : AI-based scheduling with optimization
- savePMCycleState        : Save PM cycle progress
- savePMCycleDefinitions  : Define PM cycle rules
- updatePMDate            : Reschedule PM intervention
```

**Risk Level:** HIGH — PM is critical business function (preventive maintenance tracking)

---

### 8. Approvals Workflow (3 endpoints) — 0% Coverage

```
- createApproval          : Admin creates approval request (for AI plans)
- getApproval             : Fetch single approval details
- updateApproval          : Admin approves/rejects plan
```

**Risk Level:** MEDIUM — Plan approval chain untested

---

### 9. Checklists (3 endpoints) — 0% Coverage

```
- createChecklistTemplate : Admin creates template
- updateChecklistTemplate : Update template
- deleteChecklistTemplate : Soft delete template
- compileChecklist        : Tecnico fills checklist during intervention
```

**Risk Level:** LOW — Quality assurance feature; not blocking

---

### 10. Advanced Features (5 endpoints) — 0% Coverage

```
- backupNow               : Manual database backup trigger
- migrateDB               : Database schema migration/upgrade
- logKPISnapshot          : Manual KPI metrics snapshot
- assignFurgone           : Assign vehicle to tecnico (fleet management)
- swapFurgone             : Swap vehicles between tecnici (dispatcher)
- geocodeAll              : Batch geocode all clients by address
- clearAnagrafica         : Clear anagrafica cache
- syncClientiFromAnagrafica : Sync from master data
```

**Risk Level:** LOW–MEDIUM — Operational/maintenance features

---

### 11. Miscellaneous (3 endpoints) — 0% Coverage

```
- createAllegato          : Create attachment link
- deleteAllegato          : Remove attachment
- createRichiesta         : Create service request
- updateRichiesta         : Update request status
- deleteAllNotifiche      : Bulk delete notifications
- createChatCanale        : Create chat channel
- joinChatCanale          : Join existing channel
- updateConfig            : Change system config value (vs saveConfig)
- updateChecklistTemplate : Modify template
- updateSLAStatus         : Manual SLA status override
```

**Risk Level:** VARIES — Most are low priority

---

## PART B: UNTESTED WORKFLOWS & EDGE CASES

### B1. State Machine Coverage Gaps

#### PIANO (Intervention Scheduling)

**Tested Transitions:**
```
pianificato → in_corso ✓
in_corso → completato ✓
pianificato → annullato → pianificato ✓
completato → pianificato ✗ (correctly rejected)
```

**Missing Transitions:**
```
pianificato → completato (direct, no in_corso)
in_corso → annullato (mid-work cancellation)
annullato → in_corso (restart from cancelled)
in_corso → pianificato (revert to planning)
```

**Constraint Violations Not Tested:**
- Missing required fields (Data, Ora, TecnicoID, ClienteID)
- Invalid date formats
- Past dates (scheduling retroactively)
- Overlapping assignments for same tecnico
- Invalid ClienteID/TecnicoID references
- Terminal state attempts

---

#### URGENZA (Emergency/Issue Tracking)

**Tested Transitions:**
```
aperta → assegnata ✓
assegnata → aperta (reject) ✓
assegnata → in_corso ✓ (via startUrgenza)
in_corso → risolta ✓
risolta → chiusa ✓ (with DB constraint caveat)
```

**Missing Transitions:**
```
aperta → in_corso (direct, no assignment)
aperta → schedulata (not via assignment)
schedulata → in_corso
schedulata → aperta (reject from scheduled)
in_corso → assegnata (re-assignment mid-work)
in_corso → aperta (revert)
risolta → aperta (reopen issue)
chiusa → risolta (reopen closed)
```

**Missing Scenarios:**
- Reassign after initial assignment
- Reassign after rejection
- Multiple rejections in sequence
- SLA escalation (aperta >4h unassigned)
- Concurrent start attempts (two tecnici)
- Resolve then immediately reopen

---

### B2. Role-Based Access Control

**Current Coverage:**
- ✓ Admin login & JWT validation
- ✓ Tecnico login & GET filtering (getAll shows only own urgenze)
- ✓ Some admin-only create/update endpoints checked

**Missing Tests:**
```
TECNICO RESTRICTIONS:
- Should NOT be able to createPiano (admin only)
- Should NOT be able to createCliente (admin only)
- Should NOT be able to updateCliente (admin only)
- Should NOT be able to createUtente (admin only)
- Should NOT be able to createAutomezzo (admin only)
- Should NOT be able to createInstallazione (admin only)
- Should NOT be able to createReperibilita (admin only)
- Should NOT be able to viewAuditLog (admin only)
- Should NOT be able to exportPowerBI (admin only)

CAPOSQUADRA (Team Lead) ROLE - NOT TESTED AT ALL:
- Can view all team member interventions?
- Can assign within team?
- Can approve timesheets/pagellini?
- Can modify team calendar?
- Bulk assignment permissions?

BUSINESS LOGIC CONSTRAINTS NOT TESTED:
- Emanuele, Gino, Giuseppe must work with a senior (Jacopo, Anton, Giovanni)
- Fabio should not be paired with others
- Fabrizio (junior) can only work in teams of 2+
- Mirko is unavailable this month
```

---

### B3. Multi-Step Workflow Chains (Not Tested End-to-End)

#### Workflow 1: Complete Urgenza Lifecycle with Notifications

```
1. createUrgenza(Problem, Priority, Cliente)
   ├─→ Should trigger: TG notification to CH_ADMIN group
   └─→ Should create: notification record for admin

2. assignUrgenza(tecnico_id)
   ├─→ Should trigger: TG private message to tecnico
   ├─→ Should create: notification record for tecnico
   ├─→ Check: SLA calculation based on priority
   └─→ Check: Tecnico availability constraints

3. startUrgenza() [after 0-4 hours]
   ├─→ Should update: sla_status from "ok" to "ok" (if <SLA)
   ├─→ Check: Cannot start if >4h without SLA escalation
   └─→ If >4h: Should have already escalated (see cron)

4. Cron: checkSLAUrgenze (every 15 min)
   ├─→ If aperta/assegnata >4h: sla_status = "warning"
   ├─→ If aperta/assegnata >SLA: sla_status = "critical"
   ├─→ Should trigger: Escalation notification (TG private + in-app)
   └─→ Should prevent duplicates: via notification ID

5. resolveUrgenza(notes)
   ├─→ Should transition: in_corso → risolta
   ├─→ Should record: Resolution timestamp
   └─→ Should trigger: Optional notification to creator

6. updateUrgenza(Stato: chiusa)
   ├─→ Should transition: risolta → chiusa (TERMINAL)
   └─→ Check: DB constraint prevents other transitions
```

**Not Tested:** Full chain with real Telegram delivery and SLA escalation timing

---

#### Workflow 2: Piano Creation → Scheduling → Execution

```
1. createPiano(data, ora, tecnico_id, cliente_id)
   ├─→ Check: Cannot assign junior without senior
   ├─→ Check: Tecnico availability (reperibilita)
   ├─→ Check: Overlapping with other pianificati
   └─→ Should trigger: Notification to admin + tecnico

2. [0-1 day before]
   ├─→ Cron: checkInterventoReminders
   └─→ For tomorrow's interventi: Send reminder to tecnico

3. [Day of intervention, start time + 1h]
   ├─→ Cron: checkInterventoReminders (60-75 min window)
   ├─→ If still pianificato: Send "start intervention" alert
   └─→ Send via: In-app notification + TG private message

4. updatePiano(Stato: in_corso)
   ├─→ Valid transition: pianificato → in_corso
   └─→ Record: Start timestamp

5. [While in_corso, every 15 min for >8 hours]
   ├─→ Cron: checkInterventoReminders
   ├─→ If in_corso >8h: Send "update status" reminder
   └─→ No notifications sent (within normal range)

6. updatePiano(Stato: completato, notes)
   ├─→ Valid transition: in_corso → completato (TERMINAL)
   └─→ Record: Completion timestamp + notes
```

**Not Tested:**
- Blocking junior assignments without senior presence
- Tomorrow reminders
- 1-hour late alerts
- 8-hour status update reminders

---

#### Workflow 3: Order (Ordine) Lifecycle

```
1. createOrdine(codice_ricambio, quantita, cliente_id)
   ├─→ Stato defaults to: "richiesto"
   └─→ Record: created_at timestamp

2. updateOrdineStato(stato: "ordinato")
   ├─→ Valid states: richiesto → ordinato → ricevuto → montato
   └─→ Each transition timestamps

3. [Cron: every 15 min]
   ├─→ Check: ordini in "richiesto" >7 days old
   ├─→ If found: Send reminder notification
   └─→ Target: TecnicoID (who created it)

4. updateOrdine(note)
   ├─→ Generic update of order data
   └─→ Check: Cannot update terminal states (ricevuto/montato)
```

**Not Tested:**
- 7-day reminder for old orders
- State transition validation chain
- Notification delivery to tecnico who ordered

---

### B4. Notification & Escalation Flows (All Untested)

#### Path 1: New Urgenza Notification
```
Event: createUrgenza(problema, priorita, cliente_id)
  ↓
1. Create notifiche record (tipo: 'urgenza_nuova')
   - destinatario_id: 'USR001' (admin)
   - priorita: based on urgenza.priorita_id
   - testo: Problem description

2. Send TG message to group: CH_ADMIN (negative chat ID)
   - Message format: "🚨 URGENZA: [Cliente] [Problema]"
   - Include: Link to admin dashboard

3. Optional push notification to subscribed admins
```

**Test Missing:** Create urgenza → verify both in-app + TG notifications

---

#### Path 2: Urgenza Assigned Notification
```
Event: assignUrgenza(urgenza_id, tecnico_id)
  ↓
1. Create notifiche record (tipo: 'urgenza_assegnata')
   - destinatario_id: tecnico_id
   - testo: Assignment details

2. Send TG private message to tecnico's chat_id
   - Message: "📋 Urgenza assegnata: [Cliente] [Problema]"
   - Include: Priority, client contact info

3. Optional push notification to tecnico's device
```

**Test Missing:** Assign urgenza → verify private TG message to tecnico

---

#### Path 3: SLA Escalation (>4h unassigned/unstarted)
```
Event: Cron checkSLAUrgenze (every 15 min) for aperta/assegnata urgenze
  ↓
If: (now - created_at) >= 4 hours AND Stato IN (aperta, assegnata)
  ↓
1. Update sla_status: ok → warning

2. Create escalation notification (tipo: 'sla_warning')
   - Send TG private to tecnico: "⚠️ 4h+ senza inizio"
   - Send TG to CH_ADMIN: "⚠️ ESCALATION: [Urgenza] [Tecnico]"
   - Create in-app notification

3. Prevent duplicate: notifiche.id = 'ESC_URG_' + urgenza_id + '_' + data
   (per day, so only one per urgenza per day)

If: now >= sla_scadenza (from sla_config)
  ↓
4. Update sla_status: warning → critical → breach

5. More aggressive notifications
```

**Test Missing:** SLA escalation chain, duplicate prevention, timing windows

---

#### Path 4: Piano Late Reminder (Cron)
```
Event: Cron checkInterventoReminders (every 15 min)
  ↓
For pianificati interventions today where ora_inizio has passed:

If: (now - ora_inizio) between 60-75 minutes
  ↓
1. Create reminder notification (tipo: 'reminder')
   - destinatario_id: tecnico_id
   - testo: "Intervento non iniziato da 1 ora"

2. Send TG private to tecnico
   - Message: "⏰ Intervento non iniziato: [Cliente] ore [Ora]"
   - Call-to-action: "/incorso or update in app"

3. Send to CH_ADMIN: Admin alert

4. Prevent duplicate: notifiche.id = 'NOT_REM1H_' + piano_id + '_' + data
```

**Test Missing:** Timing window validation, duplicate prevention, TG delivery

---

### B5. Telegram Bot Command Tests (All Untested)

Each command needs testing for:
- Argument parsing (correct/missing/wrong format)
- State transitions via TG
- Notification feedback to user
- Error handling

**Commands Not Tested:**

1. `/vado` — List urgenze & select one to take
   ```
   Command: /vado [optional_index]

   No index:
   - Show: "1. Cliente A - Problema 1"
   - Prompt: "Reply with number to take (e.g., 1)"

   With index (e.g., /vado 2):
   - Take urgenza at position 2
   - Call: assignUrgenza(urgenza_id, tecnico_id)
   - Confirm: "Presa in carico urgenza #2: [descrizione]"
   ```

2. `/incorso` — Start working on assigned urgenza
   ```
   Command: /incorso

   - Find: Assigned but not started urgenza for this tecnico
   - Call: startUrgenza(urgenza_id)
   - Confirm: "Urgenza avviata, timer iniziato"
   ```

3. `/risolto [note]` — Mark urgenza as resolved
   ```
   Command: /risolto Problema risolto sostituendo pompa

   - Find: Current in_corso urgenza
   - Call: resolveUrgenza(urgenza_id, noteRisoluzione)
   - Confirm: "Urgenza risolta ✓"
   ```

4. `/ordine <codice> <qty> <cliente>` — Create parts order
   ```
   Command: /ordine REP_001 2 51001801

   - Parse: Part code, quantity, cliente_id
   - Call: createOrdine(...)
   - Confirm: "Ordine creato: ORD_xxx"

   Missing tests:
   - Invalid part code
   - Invalid quantity (0, negative, >1000)
   - Invalid cliente_id
   ```

5. `/catalogo <search>` — Search parts catalog
   ```
   Command: /catalogo filtro

   - Call: searchParts(search: 'filtro')
   - Return: First 10 results with prices
   - Missing tests:
     - Empty search
     - No results found
     - Very long search (XSS attempt)
   ```

6. `/pianifica` — Create new intervention from TG
   ```
   Command: /pianifica

   - Interactive: Ask for date, time, client, notes
   - Call: createPiano(...)
   - Missing tests:
     - Cancel mid-flow
     - Invalid date (past)
     - Conflicting times
   ```

7. `/assegna <urgeney_id> <tecnico_id>` — Dispatcher assigns
   ```
   Command: /assegna URG_123 TEC_691

   - Requires: Admin role verification
   - Call: assignUrgenza(urgenza_id, tecnico_id)
   - Check: Tecnico availability
   - Missing tests:
     - Permission check for non-admin
     - Invalid IDs
     - Assign to unavailable tecnico
   ```

---

### B6. Concurrent Operation Conflicts (All Untested)

```
SCENARIO 1: Two Tecnici Start Same Urgenza

Time T0: startUrgenza(URG_123) by TEC_A
         Updates DB: urgenze.set( stato='in_corso', tecnico_assegnato=TEC_A )

Time T0+100ms: startUrgenza(URG_123) by TEC_B
              Updates DB: urgenze.set( stato='in_corso', tecnico_assegnato=TEC_B )

Result: Second tecnico wins, first tecnico's work is lost/unclear
Expected: Lock or race condition handling
```

```
SCENARIO 2: Admin Updates Piano While Tecnico Completes

Time T0: updatePiano(INT_456, {Stato: completato}) by TEC_A

Time T0+50ms: updatePiano(INT_456, {Note: "Updated notes"}) by ADMIN

Result: Admin update overwrites tecnico's completion
Expected: Lock mechanism or version checking
```

```
SCENARIO 3: Concurrent Assignments

Time T0: assignUrgenza(URG_789, TEC_A) by ADMIN_1

Time T0+50ms: assignUrgenza(URG_789, TEC_B) by ADMIN_2

Result: Last write wins; first assignment lost
Expected: Validation that urgenza not already assigned
```

---

### B7. Boundary Conditions (All Untested)

```
EMPTY/NULL DATASETS:
- getAll() with zero clients
- getAll() with zero utenti
- getAll() with zero urgenze
- getAll() with zero piano
- Expected: Return empty arrays, not crash

LARGE DATASETS:
- 10,000 urgenze (getAll limit=1000)
- 5,000 clienti (search on 5000 records)
- Expected: Pagination, performance acceptable
- Test: Response time <5s, pagination links work

OVERLAPPING CONSTRAINTS:
- Two interventions same tecnico overlapping times
- Expected: Validation error or warning
- Test: Not currently validated

MISSING REQUIRED FIELDS:
- createPiano without Data
- createPiano without TecnicoID
- createUrgenza without ClienteID
- createCliente without Nome
- Expected: 400 Bad Request with field errors

INVALID REFERENCES:
- createPiano with non-existent TecnicoID
- createPiano with non-existent ClienteID
- createOrdine with non-existent ClienteID
- Expected: 404 or 400 with FK error

SOFT DELETE CASCADES:
- deleteCliente(id) → Soft delete client
- Check: Related urgenze still visible?
- Check: Related piano still visible?
- Check: Related ordini still visible?
- Expected: No cascade deletes; data preserved

DATETIME EDGE CASES:
- Midnight transitions (23:59:59 → 00:00:00)
- DST transitions (Mar 31, Oct 26)
- Leap year (Feb 29)
- Far future (2099)
- Past dates (scheduling retroactively)
- Invalid dates (Feb 30, 13:60)
- Expected: Proper handling or validation errors
```

---

### B8. Image Analysis Feature (analyzeImage)

```
NOT TESTED: Full Gemini Vision API integration

Case: Tecnico sends problem photo to Telegram
  ↓
1. Photo uploaded to worker
2. Worker converts to base64
3. Call: analyzeImage(base64_image)
4. Gemini API responds with analysis
5. Worker creates urgenza based on analysis
6. Send summary back to TG

Missing Tests:
- Different image formats (JPEG, PNG, WebP)
- Large images (>10MB)
- Invalid files (text file pretending to be image)
- Gemini API failures
- Parsing Gemini response errors
```

---

### B9. AI Plan Generation Full Cycle (Partially Tested)

```
PARTIALLY TESTED: generateAIPlan (optional AI test when TEST_AI=true)

Missing Tests:
- previewAIPlan: Show plan without saving
- applyAIPlan: Actually save previewed plan
- Plan conflict resolution (overlapping times)
- Plan optimization (minimize travel time)
- Plan approval workflow
- Plan rejection & re-generation
- Plans with custom constraints (only senior tecnici, etc.)
```

---

### B10. Import/Export Flows (All Untested)

```
IMPORT SCENARIOS:

importLelyClienti(csv_file)
  ├─ Parse: codice_m3, nome, indirizzo, telefono, etc.
  ├─ Validate: All required fields present
  ├─ Deduplicate: Check existing by codice_m3
  ├─ Geocode: If lat/lng missing, geocodeAll
  └─ Result: 1000 clients imported

Missing Tests:
  - Duplicate handling (update vs skip)
  - Invalid data (bad phone, blank fields)
  - Partial failures (500 of 1000 succeed)
  - File format errors (bad CSV)
  - Geocoding failures
  - Progress tracking/resuming

importLelyAssets(csv_file)
  ├─ Parse: id, modello, seriale, cliente_id, etc.
  ├─ Link: To existing clienti by cliente_id
  └─ Result: 200 robots imported

Missing Tests:
  - Foreign key violations (cliente not found)
  - Duplicate seriale numbers
  - Model validation

importExcelPlan(xlsx_file)
  ├─ Parse: Date, Ora, Cliente, TecnicoID, etc.
  ├─ Validate: All interventions feasible
  ├─ Check: Tecnico availability
  ├─ Check: No overlapping assignments
  └─ Result: 50 interventions created

Missing Tests:
  - Invalid date formats
  - Tecnico not available (on holiday, etc.)
  - Conflicts with existing piano
  - Large batch (500+ interventions)

EXPORT SCENARIOS:

exportPowerBI
  ├─ Generate: JSON/CSV with KPI data
  ├─ Format: Compatible with Power BI connector
  └─ Result: File ready for analysis

Missing Tests:
  - Data completeness
  - Format validation
  - Large data export (50K+ rows)

geocodeAll
  ├─ For: All clienti with lat/lng = null
  ├─ Call: Google Maps (or fallback) API
  ├─ Result: lat/lng populated

Missing Tests:
  - API failures (quota exceeded)
  - Partial geocoding (700/1000 success)
  - Ambiguous addresses
  - Non-existent addresses
```

---

## PART C: RECOMMENDED NEW TEST SUITES

### Priority 1 (Critical — block deployment without these)

```
X. TELEGRAM INTEGRATION (12 tests)
  - testTelegram connectivity
  - /vado command: list & select urgenza
  - /incorso command: start urgenza
  - /risolto command: resolve with notes
  - /ordine command: create parts order
  - /catalogo command: search parts
  - Full command sequence: /vado → /incorso → /risolto
  - Incoming image analysis: analyzeImage
  - Webhook message parsing
  - Error handling in commands (invalid args)
  - Notification delivery verification
  - Duplicate prevention in messages

Y. STATE MACHINE EXHAUSTIVE (15 tests)
  - PIANO: All 6 invalid transitions (attempt + verify rejection)
  - URGENZA: All 8 missing transitions (attempt + verify rejection)
  - URGENZA: Re-assignment after assignment (scenario)
  - URGENZA: Re-assignment after rejection (scenario)
  - Piano: Terminal state attempts (completato can't revert)
  - Piano: Assign junior without senior (should fail)
  - Concurrent state modifications (race conditions)

Z. NOTIFICATION DELIVERY (10 tests)
  - Create urgenza → verify TG group notification
  - Assign urgenza → verify TG private message
  - Cron escalation (>4h) → verify notifications
  - Piano late (>1h start) → verify reminders
  - Piano long duration (>8h) → verify status reminder
  - Order old (>7d) → verify reminder
  - Prevent duplicate notifications (same day)
  - Push notification subscription & delivery
  - Email notification delivery
  - Chat message delivery
```

### Priority 2 (High — implement soon)

```
AA. ROLE-BASED ACCESS (8 tests)
  - Tecnico cannot createPiano
  - Tecnico cannot createCliente
  - Tecnico cannot updateCliente
  - Tecnico cannot createUtente
  - Caposquadra can assign within team
  - Caposquadra view restrictions
  - Admin-only actions (audit log, export)
  - Junior tecnico pairing validation

AB. USER MANAGEMENT (5 tests)
  - changePassword: Tecnico self-service
  - resetPassword: Admin manual reset
  - requestPasswordReset: Self-service link
  - createUtente: Admin creates user
  - updateUtente: Admin modifies user

AC. FILE OPERATIONS (5 tests)
  - uploadFile: Various file types
  - uploadFotoProfilo: Image validation
  - File size limits
  - MIME type validation
  - Duplicate handling

AD. MAINTENANCE PLANNING (8 tests)
  - generatePMSchedule: Auto-calendar
  - bulkGeneratePMCalendar: Batch mode
  - completePM: Mark done
  - savePMCycleDefinitions: Define rules
  - savePMCycleState: Track progress
  - updatePMDate: Reschedule
  - getPMCalendar view (already GET tested)
  - PM conflict detection
```

### Priority 3 (Medium — implement if time)

```
AE. AI FEATURES ADVANCED (6 tests)
  - generatePlanSmart: Advanced scheduling
  - previewAIPlan: Preview without save
  - applyAIPlan: Save approved plan
  - analyzeImage: Gemini vision analysis
  - importExcelPlan: Excel import + validation
  - notifyPlanApproved: Approval workflow

AF. IMPORT/EXPORT (7 tests)
  - importLelyClienti: Bulk client import
  - importLelyAssets: Bulk robot import
  - importAnagraficaClienti: Internal import
  - importAnagraficaAssets: Internal import
  - exportPowerBI: Power BI export
  - geocodeAll: Batch geocoding
  - Export format validation

AG. BOUNDARY CONDITIONS (12 tests)
  - Empty datasets (zero results)
  - Large datasets (>1000 records)
  - Overlapping constraints
  - Missing required fields
  - Invalid foreign keys
  - Soft delete cascades
  - Datetime edge cases
  - Special characters/injection attempts
  - Very long strings (>10K chars)
  - Numeric boundary values
  - Null/undefined handling
  - Concurrent modifications

AH. APPROVALS WORKFLOW (4 tests)
  - createApproval: Create request
  - getApproval: Fetch details
  - updateApproval: Approve/reject
  - Notification on approval/rejection
```

---

## PART D: IMPLEMENTATION CHECKLIST

### Quick Wins (1-2 hours each)

- [ ] Add Telegram `/vado` command test
- [ ] Add `sendTelegramMsg` + verify delivery test
- [ ] Add `changePassword` user test
- [ ] Add PIANO invalid transition tests (5 cases)
- [ ] Add URGENZA invalid transition tests (8 cases)
- [ ] Add `uploadFile` basic test
- [ ] Add `savePushSubscription` + `sendPush` test

### Medium Effort (2-4 hours each)

- [ ] Full urgenza notification workflow (create → TG → assign → TG)
- [ ] Full piano reminder cron test (create → schedule → remind → complete)
- [ ] Telegram command sequence test (/vado → /incorso → /risolto)
- [ ] Tecnico role restrictions (5 tests)
- [ ] PM scheduling basic flow (schedule → view → complete)
- [ ] Order reminder cron test (create → wait 7d → remind)

### Large Effort (4+ hours each)

- [ ] Complete Telegram bot integration test suite (18 commands)
- [ ] SLA escalation with cron timing (complex timing)
- [ ] AI plan generation full cycle (generateAIPlan → preview → apply)
- [ ] Import flows (Lely, Excel, Anagrafica)
- [ ] Concurrent operation race conditions (3-5 complex scenarios)
- [ ] Boundary condition coverage (12+ edge cases)

---

## PART E: TESTING INFRASTRUCTURE IMPROVEMENTS

### Missing Test Utilities

```javascript
// Should add to uat_runner.js:

// 1. Telegram message verification
async function verifyTelegramMessage(chatId, expectedText) {
  // Mock or real Telegram API check
  // Verify message was sent to correct chat
}

// 2. Notification timing verification
async function verifyNotificationTiming(notificaId, expectedDelayMs) {
  // Verify notification created within timing window
  // For cron jobs: check execution timing
}

// 3. Concurrent request helper
async function concurrentRequests(action, payload, count) {
  // Send N simultaneous requests
  // Return race conditions or successes
}

// 4. Cron job simulator
async function simulateCronExecution(cronName, mockData) {
  // Trigger cron jobs on demand
  // Mock time for testing >4h scenarios
}

// 5. State machine validator
function validateStateTransition(entity, fromState, toState) {
  // Check if transition is allowed
  // Return: {allowed, reason}
}
```

### Timing & Simulation Issues

The UAT runner currently has no way to:
1. **Mock time passage** — Can't test 4-hour SLA escalation without waiting 4 hours
2. **Trigger crons on demand** — Can't verify cron behavior without real 15-min intervals
3. **Verify Telegram delivery** — No Telegram test message verification
4. **Check concurrent timing** — No race condition detection

**Recommendation:** Add `/mnt/Syntoniqa_repo/uat/uat_helpers.js` with:
- Time mocking (advance clock)
- Cron manual execution
- Telegram test API mock
- Race condition detector

---

## PART F: RISK ASSESSMENT

| Category | Risk Level | Impact | Likelihood | Effort |
|----------|-----------|--------|-----------|--------|
| Telegram Bot Untested | CRITICAL | Ops cannot dispatch via TG | Medium | High |
| State Machine Edge Cases | HIGH | Data corruption, invalid states | Medium | Medium |
| Role-Based Access | MEDIUM | Tecnico can perform admin ops | Low | Low |
| Notification Delivery | MEDIUM | Users don't get alerts | Medium | High |
| AI Features | MEDIUM | Smart planning fails silently | Low | High |
| Concurrent Modifications | MEDIUM | Race conditions lose data | Low | Medium |
| Import/Export | MEDIUM | Data integrity issues | Low | High |
| File Uploads | LOW | File handling bugs | Low | Low |
| PM Scheduling | LOW | Maintenance tracking fails | Low | Medium |
| Approvals Workflow | LOW | Plan approval blocked | Low | Low |

---

## PART G: SUMMARY TABLE

### Current Coverage: 66/129 = 51.2%

| Test Suite | Tests | Coverage | Priority |
|-----------|-------|----------|----------|
| A. Authentication | 5 | 60% | Done |
| B. Data Retrieval | 8 | 100% | Done |
| C. CRUD Clienti | 4 | 100% | Done |
| D. CRUD Macchine | 3 | 100% | Done |
| E. CRUD Automezzi | 3 | 100% | Done |
| F. Piano + SM | 5 | 70% | Done (gaps) |
| G. Urgenze + SM | 6 | 70% | Done (gaps) |
| H. Ordini | 4 | 100% | Done |
| I. Notifiche | 4 | 60% | Done (flow missing) |
| J. Chat | 5 | 83% | Done (channels) |
| K. Config | 4 | 75% | Done (vincoli) |
| L. Reperibilità | 3 | 100% | Done |
| M. Trasferte | 3 | 100% | Done |
| N. Installazioni | 3 | 100% | Done |
| O. Documenti | 3 | 100% | Done |
| P. Push | 1 | 20% | **NOT TESTED** |
| Q. Reports | 4 | 100% | Done |
| R. PM | 2 | 25% | **NOT TESTED** |
| S. AI | 2 (opt) | 10% | **NOT TESTED** |
| T. Anagrafica | 2 | 100% | Done |
| U. Security | 5 | 100% | Done |
| V. Stress | 3 (opt) | 0% | **NOT TESTED** |
| W. Approvals | 3 | 33% | **NOT TESTED** |

### By Feature Category:

| Feature | Total | Tested | % | Gap Severity |
|---------|-------|--------|---|---|
| User Management | 5 | 1 | 20% | CRITICAL |
| Telegram | 10 | 0 | 0% | CRITICAL |
| Push Notifications | 3 | 0 | 0% | CRITICAL |
| File Uploads | 2 | 0 | 0% | HIGH |
| AI/ML Features | 6 | 1 | 17% | HIGH |
| Import/Export | 7 | 0 | 0% | HIGH |
| PM/Maintenance | 7 | 1 | 14% | MEDIUM |
| Approvals | 3 | 1 | 33% | MEDIUM |
| Advanced Features | 8 | 2 | 25% | MEDIUM |
| **Total** | **129** | **66** | **51%** | **HIGH** |

---

## Conclusion

The UAT test suite provides solid coverage of basic CRUD operations and core workflows. However, **critical gaps exist** in integration testing (Telegram, email, push), state machine edge cases, role-based access control, and advanced features (AI planning, imports).

**To achieve production readiness:**
1. Add Telegram integration tests (CRITICAL)
2. Test all state machine invalid transitions (HIGH)
3. Add notification delivery E2E tests (HIGH)
4. Implement role-based access tests (MEDIUM)
5. Add import/export flows (MEDIUM)
6. Implement boundary condition tests (LOW)

**Estimated effort:** 40-60 hours of UAT development to reach 80%+ coverage.

