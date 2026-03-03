#!/usr/bin/env node
/**
 * Syntoniqa v1.0 - Solution Architecture Document Generator
 * Output: 05_Solution_Architecture_Document.docx (30-40 pages, technical deep-dive)
 */

const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun,
        BorderStyle, WidthType, ShadingType, AlignmentType, PageBreak,
        HeadingLevel, UnderlineType, convertInchesToTwip } = require('docx');
const fs = require('fs');
const path = require('path');

// Color scheme
const BRAND_COLOR = 'C30A14'; // Syntoniqa red
const DARK_GRAY = '333333';
const LIGHT_GRAY = 'F5F5F5';
const WHITE = 'FFFFFF';

// Utilities
function createHeading(text, level = 1) {
  const sizes = { 1: 28, 2: 24, 3: 16, 4: 14 };
  return new Paragraph({
    text: text,
    heading: HeadingLevel[`HEADING_${level}`],
    bold: true,
    fontSize: sizes[level] * 2,
    spacing: { before: level === 1 ? 400 : 200, after: 200 },
    color: level === 1 ? BRAND_COLOR : DARK_GRAY,
  });
}

function createBodyText(text, bold = false, italic = false) {
  return new Paragraph({
    text: text,
    bold: bold,
    italic: italic,
    fontSize: 24,
    spacing: { line: 360 },
    color: DARK_GRAY,
  });
}

function createTable(headers, rows, columnWidths = null) {
  const totalWidth = 9360;
  const cols = headers.length;
  const colWidth = columnWidths || new Array(cols).fill(totalWidth / cols);

  const headerRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      children: [new Paragraph({
        text: h,
        bold: true,
        fontSize: 22,
        color: WHITE,
      })],
      width: { size: colWidth[i], type: WidthType.DXA },
      shading: { fill: BRAND_COLOR, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
    })),
    height: { value: 400, rule: 'atLeast' },
  });

  const dataRows = rows.map((row, rowIdx) => new TableRow({
    children: row.map((cell, colIdx) => new TableCell({
      children: Array.isArray(cell) ? cell : [new Paragraph({
        text: cell || '',
        fontSize: 22,
      })],
      width: { size: colWidth[colIdx], type: WidthType.DXA },
      shading: {
        fill: rowIdx % 2 === 0 ? WHITE : LIGHT_GRAY,
        type: ShadingType.CLEAR
      },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
    })),
    height: { value: 350, rule: 'atLeast' },
  }));

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: DARK_GRAY },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: DARK_GRAY },
      left: { style: BorderStyle.SINGLE, size: 1, color: DARK_GRAY },
      right: { style: BorderStyle.SINGLE, size: 1, color: DARK_GRAY },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_GRAY },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_GRAY },
    },
  });
}

// Document sections
const sections = [
  // Title page
  new Paragraph({
    text: '',
    spacing: { before: 1200 },
  }),
  new Paragraph({
    text: 'SYNTONIQA v1.0',
    fontSize: 56,
    bold: true,
    alignment: AlignmentType.CENTER,
    color: BRAND_COLOR,
    spacing: { after: 200 },
  }),
  new Paragraph({
    text: 'Solution Architecture Document',
    fontSize: 36,
    bold: true,
    alignment: AlignmentType.CENTER,
    color: DARK_GRAY,
    spacing: { after: 600 },
  }),
  new Paragraph({
    text: 'Technical Design & Implementation Guide\nMRS Lely Center Emilia Romagna',
    fontSize: 28,
    alignment: AlignmentType.CENTER,
    color: '666666',
    spacing: { after: 1200 },
  }),
  new Paragraph({
    text: 'Document Version: 1.0\nRelease Date: March 3, 2026\nStatus: Production Ready (UAT 155/155 PASS)',
    fontSize: 22,
    alignment: AlignmentType.CENTER,
    color: '666666',
    spacing: { after: 400 },
  }),
  new PageBreak(),

  // Table of Contents
  createHeading('Table of Contents', 1),
  new Paragraph({
    text: '1. Executive Summary\n2. System Architecture Overview\n3. Technology Stack\n4. Database Schema (22 Tables)\n5. API Reference\n6. State Machines (Piano & Urgenze)\n7. Authentication & Authorization (JWT + RBAC)\n8. Integrations (Telegram, Gemini, Resend, Web Push)\n9. Cron Jobs & SLA Engine\n10. White-Label System\n11. Security Architecture\n12. Deployment Architecture\n13. Scalability & Performance\n14. Disaster Recovery\nAppendix A: Entity Relationship Diagram (ERD)\nAppendix B: API Endpoint Summary\nAppendix C: Configuration Reference',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  new PageBreak(),

  // Section 1: Executive Summary
  createHeading('1. Executive Summary', 1),
  createBodyText('Syntoniqa is a production-grade Field Service Management (FSM) platform built for MRS Lely Center Emilia Romagna. It manages technician scheduling, urgent emergency response, equipment maintenance, spare parts ordering, and real-time communication.'),

  createHeading('1.1 Key Metrics', 2),
  createTable(
    ['Metric', 'Value'],
    [
      ['Total Lines of Code', '10,726'],
      ['Backend Endpoints', '97 (8 GET + 89 POST)'],
      ['Frontend Components', 'Admin SPA (5548 lines) + Tech PWA (2071 lines)'],
      ['Database Tables', '22 with soft-delete & audit trail'],
      ['Active Users', '10 technicians + 1 admin'],
      ['Integration Partners', 'Telegram Bot, Google Gemini, Resend Email, Web Push'],
      ['UAT Test Results', '155/155 PASS (100%)'],
      ['Uptime Target', '99.9% (SLA from Cloudflare)'],
    ],
    [2800, 6560]
  ),

  createHeading('1.2 Architecture Highlights', 2),
  new Paragraph({
    text: '• Serverless (Cloudflare Workers) - zero infrastructure management\n• PostgreSQL (Supabase) - fully managed database\n• Progressive Web App (PWA) - works offline with sync queue\n• JWT authentication - stateless, scalable\n• Real-time notifications (Telegram + Email + Push)\n• AI photo analysis (Google Gemini API)\n• Cron jobs every 15 min (SLA engine, reminders)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 2: Architecture
  createHeading('2. System Architecture Overview', 1),

  createHeading('2.1 3-Tier Model', 2),
  createBodyText('Syntoniqa uses a classic 3-tier architecture:'),
  createTable(
    ['Tier', 'Component', 'Technology', 'Responsibility'],
    [
      ['Presentation', 'Admin SPA + Tech PWA', 'HTML5, JavaScript, Leaflet, Chart.js', 'UI, forms, real-time display'],
      ['Application', 'Cloudflare Worker', 'JavaScript (serverless)', 'Business logic, routing, validation'],
      ['Data', 'Supabase PostgreSQL', 'PostgreSQL 14+', 'Persistence, transactions, audit trail'],
    ],
    [1400, 2000, 2300, 3660]
  ),

  createHeading('2.2 Data Flow', 2),
  createBodyText('User → Browser (Admin/PWA) → POST/GET request → Cloudflare Worker (CF-Ray header) → Supabase PostgreSQL → Response (PascalCase) → Browser renders.'),

  createBodyText('Async flows: Telegram Bot → Worker webhook → Business logic → Supabase + Notifications.'),

  new PageBreak(),

  // Section 3: Tech Stack
  createHeading('3. Technology Stack', 1),

  createHeading('3.1 Frontend', 2),
  createTable(
    ['Component', 'Technology', 'Purpose', 'Version'],
    [
      ['Admin Dashboard', 'HTML5 + Vanilla JS', 'SPA for admin operations', 'v1 (5548 lines)'],
      ['Tech PWA', 'HTML5 + Vanilla JS', 'Mobile app for technicians', 'v2 (2071 lines)'],
      ['Maps', 'Leaflet.js', 'Client location mapping', '1.9.4'],
      ['Charts', 'Chart.js', 'KPI visualization', '4.4.0'],
      ['Excel Import', 'SheetJS', 'Client bulk upload', '0.18.5'],
      ['Service Worker', 'IndexedDB', 'Offline sync queue', 'Native API'],
    ],
    [1560, 1560, 2600, 1640]
  ),

  createHeading('3.2 Backend', 2),
  createTable(
    ['Component', 'Technology', 'Purpose'],
    [
      ['Server', 'Cloudflare Workers', 'Serverless compute edge global'],
      ['Request Router', 'Native Fetch API', 'HTTP method + action param'],
      ['Business Logic', 'JavaScript ES6+', 'State machine, validations'],
      ['Database Client', 'Supabase JS SDK', 'PostgreSQL connector'],
      ['API Gateway', 'CF Workers Tail', 'Request logging & monitoring'],
    ],
    [1560, 2600, 5200]
  ),

  createHeading('3.3 Database', 2),
  createTable(
    ['Component', 'Technology', 'Purpose'],
    [
      ['Database Server', 'PostgreSQL 14+ (Supabase)', 'Primary data store'],
      ['Connection Pool', 'Supabase managed', 'Max 5 connections per JWT'],
      ['Replication', 'WAL (Write-Ahead Logging)', 'Point-in-time recovery'],
      ['Backup', 'Supabase daily backup', '7-day retention'],
      ['Audit Trail', 'workflow_log table', 'All mutations logged'],
    ],
    [1560, 2600, 5200]
  ),

  createHeading('3.4 External Services', 2),
  createTable(
    ['Service', 'Purpose', 'Auth Method'],
    [
      ['Google Gemini API', 'AI photo analysis', 'API Key (env var)'],
      ['Telegram Bot API', 'Push notifications + bot commands', 'Token (env var)'],
      ['Resend Email API', 'Transactional email', 'API Key (env var)'],
      ['Web Push Notifications', 'Browser notifications', 'Service Worker'],
    ],
    [2000, 3600, 3760]
  ),

  new PageBreak(),

  // Section 4: Database Schema
  createHeading('4. Database Schema (22 Tables)', 1),
  createBodyText('All tables have: tenant_id (multi-tenant support), obsoleto (soft delete), created_at, updated_at (audit).'),

  createHeading('4.1 Core Tables', 2),
  createTable(
    ['Table', 'Purpose', 'Key Fields', 'Relationships'],
    [
      ['utenti', 'System users (tech + admin)', 'id (TEC_xxx), email, role', 'Many Piano, Many Urgenza'],
      ['clienti', 'Customers', 'id (CLI_xxx), nome, lat, lng', 'One-to-Many Macchine'],
      ['macchine', 'Equipment installed', 'id (MAC_xxx), modello, serial', 'One-to-Many Piano/Urgenza'],
      ['piano', 'Scheduled interventions', 'id (INT_xxx), stato, data_prevista', 'Many-to-One Utenti/Macchine'],
      ['urgenze', 'Emergency work orders', 'id (URG_xxx), stato, priorita', 'Many-to-One Utenti/Clienti'],
      ['ordini', 'Spare parts requests', 'id (ORD_xxx), stato, codice_ricambio', 'One-to-One Macchine'],
    ],
    [1200, 1600, 2400, 2160]
  ),

  createHeading('4.2 Support Tables', 2),
  createTable(
    ['Table', 'Purpose'],
    [
      ['automezzi', 'Service vehicles (furgoni)'],
      ['reperibilita', 'On-call duty schedules'],
      ['trasferte', 'Travel logs & expenses'],
      ['installazioni', 'New equipment installation projects'],
      ['notifiche', 'Push notification queue'],
      ['chat_canali', 'Communication channels (#urgent, #general)'],
      ['chat_messaggi', 'Chat message history with timestamps'],
      ['workflow_log', 'Audit trail of all mutations'],
      ['kpi_log', 'KPI snapshots (daily aggregation)'],
      ['kpi_snapshot', 'Historical KPI backup'],
      ['sla_config', 'SLA rules per priority'],
      ['config', 'System configuration (key-value)'],
      ['anagrafica_clienti', 'Master data sync from M3'],
      ['anagrafica_assets', 'Master data equipment'],
      ['checklist_template', 'Reusable work checklists'],
      ['documenti', 'File attachments (procedural docs, photos)'],
    ],
    [2400, 6960]
  ),

  new PageBreak(),

  // Section 5: API Reference
  createHeading('5. API Reference Summary', 1),
  createBodyText('Complete API has 97 endpoints (8 GET + 89 POST). All requests include X-Token header (JWT). Base URL: https://syntoniqa-mrs-api.fieldforcemrser.workers.dev'),

  createHeading('5.1 GET Endpoints (8)', 2),
  createTable(
    ['Action', 'Description', 'Query Params'],
    [
      ['getAll', 'Fetch all records (paginated)', 'token, userId, limit=100'],
      ['getById', 'Fetch single record', 'token, id'],
      ['getByClient', 'Fetch all jobs for a client', 'token, clientId'],
      ['getKPIDashboard', 'Fetch KPI metrics', 'token, dateFrom, dateTo'],
      ['getInterventoReminders', 'Scheduled interventions (Cron)', 'token, days=1'],
      ['getSLAStatus', 'Urgence SLA status', 'token, urgenzaId'],
      ['getTecnicoSchedule', 'Tech weekly schedule', 'token, tecnicoId, week'],
      ['exportCSV', 'Export records to CSV', 'token, table, format=csv'],
    ],
    [1560, 3900, 3900]
  ),

  createHeading('5.2 POST Endpoints (89 Grouped by Domain)', 2),
  createTable(
    ['Domain', 'Action Count', 'Examples'],
    [
      ['Authentication', '2', 'login, changePassword'],
      ['Urgencies', '12', 'createUrgenza, updateStato, assignTecnico, reject, escalate'],
      ['Interventions', '14', 'createIntervento, updateStato, reassign, addNotes, completeWithPhotos'],
      ['Orders', '8', 'createOrdine, updateStato, expedite, cancel'],
      ['Clients', '6', 'createClient, updateClient, bulkGeocodeFromCSV'],
      ['Equipment', '5', 'createMacchina, updateFirmware, logMaintenance'],
      ['Users', '7', 'createUser, updateRole, deactivate'],
      ['Chat', '4', 'sendMessage, createChannel, uploadAttachment'],
      ['Notifications', '6', 'subscribeWebPush, unsubscribe, testEmail'],
      ['Admin', '25', 'configureSLA, toggleFeature, importM3Data, backupDatabase'],
    ],
    [1560, 1400, 6400]
  ),

  new PageBreak(),

  // Section 6: State Machines
  createHeading('6. State Machines', 1),

  createHeading('6.1 Piano (Intervention) States', 2),
  createBodyText('Finite state machine with 4 states and specific valid transitions:'),
  createTable(
    ['State', 'Entry Condition', 'Valid Next States', 'Terminal?'],
    [
      ['PIANIFICATO', 'On creation', 'IN_CORSO, ANNULLATO', 'No'],
      ['IN_CORSO', 'Tech starts work', 'COMPLETATO, PIANIFICATO (rollback)', 'No'],
      ['COMPLETATO', 'Tech finishes work', 'None', 'Yes'],
      ['ANNULLATO', 'Admin cancels', 'PIANIFICATO (rare)', 'Yes (usually)'],
    ],
    [1560, 2400, 2600, 1800]
  ),

  createHeading('6.2 Urgenza (Urgency) States', 2),
  createBodyText('More complex state machine reflecting escalation workflow:'),
  createTable(
    ['State', 'Meaning', 'SLA Clock Running?', 'Valid Transitions'],
    [
      ['APERTA', 'Unassigned', 'Yes (escalate at 4h)', 'ASSEGNATA, RIFIUTATA'],
      ['ASSEGNATA', 'Tech assigned', 'Yes', 'SCHEDULATA, APERTA (reject)'],
      ['SCHEDULATA', 'Date/time set', 'Yes', 'IN_CORSO, APERTA (reject)'],
      ['IN_CORSO', 'Work underway', 'Yes', 'RISOLTA'],
      ['RISOLTA', 'Work done pending approval', 'No', 'CHIUSA, IN_CORSO (revert)'],
      ['CHIUSA', 'Closed', 'No', 'None'],
    ],
    [1200, 1600, 2100, 2460]
  ),

  createHeading('6.3 State Validation', 2),
  createBodyText('Function validateTransition(currentState, newState, role) checks:'),
  new Paragraph({
    text: '1. Is transition in VALID_URGENZA_TRANSITIONS[current] list?\n2. Does user have required role (ADMIN can do any, TECH limited)?\n3. Are preconditions met (e.g., sla_config exists for SLA transitions)?\n4. Returns: { valid: true } or { valid: false, reason: "..." }',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 7: Authentication
  createHeading('7. Authentication & Authorization (JWT + RBAC)', 1),

  createHeading('7.1 JWT Flow', 2),
  createBodyText('Step 1: User calls POST login with email + password.'),
  createBodyText('Step 2: Worker hashes password and queries Supabase utenti table.'),
  createBodyText('Step 3: If match, worker generates JWT signed with HMAC-SHA256 (using SQ_TOKEN secret).'),
  createBodyText('JWT payload includes: userId, email, role, exp (7 days), iat (issued-at).'),
  createBodyText('Step 4: Frontend stores JWT in localStorage.'),
  createBodyText('Step 5: All subsequent requests include X-Token: <JWT> header.'),

  createHeading('7.2 Token Validation', 2),
  createBodyText('Worker validates every request:'),
  new Paragraph({
    text: '1. Extract X-Token from headers\n2. Verify signature using SQ_TOKEN secret\n3. Check exp (expiry) - if past, reject with 401\n4. Extract userId, role, email from payload\n5. Continue to business logic',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('7.3 Role-Based Access Control (RBAC)', 2),
  createTable(
    ['Role', 'Permissions', 'API Access'],
    [
      ['ADMIN', 'All endpoints + admin-only endpoints', '100%'],
      ['MANAGER', 'Create/edit interventions, assign techs, view KPI', '70%'],
      ['SENIOR_TECH', 'View/update own jobs, create orders', '40%'],
      ['TECH', 'View assigned jobs, submit updates', '30%'],
      ['READONLY', 'View dashboard only', '10%'],
    ],
    [1400, 3400, 2560]
  ),

  createHeading('7.4 Endpoint Authorization', 2),
  createBodyText('Function requireAdmin(env, body) checks if user role is ADMIN. If not, returns error object. Admin-only endpoints:'),
  new Paragraph({
    text: '• All client/machine/automezzo create/update/delete\n• User management (create, delete, change role)\n• SLA configuration\n• Feature toggles\n• Database backup/restore',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 8: Integrations
  createHeading('8. Integrations', 1),

  createHeading('8.1 Telegram Bot', 2),
  createBodyText('Bot receives updates via webhook URL: https://syntoniqa-mrs-api.fieldforcemrser.workers.dev/telegram/webhook'),
  createBodyText('Flow:'),
  new Paragraph({
    text: '1. Telegram sends JSON POST when user sends /command\n2. Worker parses command (action + args)\n3. Routes to command handler (handleTelegramCommand)\n4. Command performs DB query, returns response\n5. Worker sends reply via Telegram API sendMessage\n6. User sees response in Telegram chat',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Commands: /vado, /incorso, /risolto, /stato, /oggi, /settimana, /ordine CODE QTY CLIENT.'),

  createHeading('8.2 Google Gemini AI', 2),
  createBodyText('Photo Analysis Flow:'),
  new Paragraph({
    text: '1. Technician uploads photo + description via app or Telegram\n2. Worker extracts image (base64) and text description\n3. Calls Google Gemini API with vision prompt\n4. Gemini analyzes equipment condition, returns JSON\n5. Worker creates auto-urgency if CRITICAL detected\n6. Sends notification to admin with Gemini summary',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('8.3 Resend Email', 2),
  createBodyText('Transactional email service for notifications.'),
  new Paragraph({
    text: '• On urgency creation: Email admin + on-call tech\n• On SLA warning: Email admin\n• On order shipped: Email technician\n• API: https://api.resend.com/emails with Authorization: Bearer RESEND_API_KEY',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('8.4 Web Push Notifications', 2),
  createBodyText('Service Worker subscribes to push notifications. When event occurs:'),
  new Paragraph({
    text: '1. Worker calls CF push API\n2. Browser receives push event (even if PWA closed)\n3. Service Worker displays notification\n4. User clicks notification → App opens and navigates to relevant page',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 9: Cron & SLA
  createHeading('9. Cron Jobs & SLA Engine', 1),

  createHeading('9.1 Cron Configuration', 2),
  createBodyText('Cloudflare Workers Cron Triggers (wrangler.toml):'),
  new Paragraph({
    text: 'crons = ["*/15 * * * *"]  # Every 15 minutes\nTimezone: Europe/Rome',
    fontSize: 22,
    spacing: { line: 360, color: BRAND_COLOR, bold: true },
  }),

  createHeading('9.2 checkInterventoReminders()', 2),
  createBodyText('Runs every 15 min. Logic:'),
  new Paragraph({
    text: '1. Query piano table WHERE data_prevista = tomorrow AND stato = PIANIFICATO AND tecnico_id IS NULL\n2. For each: Create notification "Intervention INT_xxx scheduled tomorrow, assign technician"\n3. Email admin with summary\n4. Query piano WHERE data_prevista < today AND stato != COMPLETATO\n5. For each: Email admin "Overdue: INT_xxx, client CLI_xxx"\n6. Query ordini WHERE stato = RICHIESTO AND created_at < 7 days ago\n7. For each: Send reminder Telegram to requesting tech',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('9.3 checkSLAUrgenze()', 2),
  createBodyText('Runs every 15 min. SLA Engine logic:'),
  new Paragraph({
    text: '1. Query urgenze WHERE stato IN (APERTA, ASSEGNATA, SCHEDULATA, IN_CORSO)\n2. For each urgenza:\n   a. Fetch sla_config by urgenza.priorita\n   b. Calculate elapsed_time = now - created_at\n   c. Calculate % of SLA_target\n   d. Update sla_stato: OK → WARNING (75%) → CRITICAL (90%) → BREACH (100%+)\n   e. If threshold crossed: Send alert email\n3. Special: If stato=APERTA and elapsed_time > 4 hours and NOT escalated today:\n   a. Send Telegram to on-call tech: "Urgency URG_xxx > 4h, please respond"\n   b. Send email to admin: "Escalation: URG_xxx"\n   c. Set notification_id = day + urgenza_id (prevent duplicates)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 10: White-Label
  createHeading('10. White-Label System', 1),
  createBodyText('Syntoniqa is designed for multi-tenant deployment with white-label capabilities.'),

  createHeading('10.1 Multi-Tenant Design', 2),
  createBodyText('Every table has tenant_id column. Queries always filter: WHERE tenant_id = currentTenant.'),
  createBodyText('Tenant ID for MRS Lely Center: 785d94d0-b947-4a00-9c4e-3b67833e7045'),

  createHeading('10.2 White-Label Config', 2),
  createBodyText('File: white_label_config.js (65 lines)'),
  new Paragraph({
    text: 'Exports config object:\n{\n  brand: { name: "Syntoniqa MRS", color: "#C30A14" },\n  api: { baseURL: "https://syntoniqa-mrs-api...." },\n  features: { telegram: true, ai: true, ordini: true, ... },\n  pwa: { appName: "Syntoniqa", scope: "/syntoniqa/" }\n}',
    fontSize: 22,
    spacing: { line: 360, color: BRAND_COLOR },
  }),

  createHeading('10.3 Customization', 2),
  createBodyText('To deploy for a new customer:'),
  new Paragraph({
    text: '1. Create new tenant record in Supabase tenants table\n2. Update white_label_config.js with new branding/colors\n3. Deploy frontend to new domain\n4. Update worker env vars (TENANT_ID)\n5. Resend email templates auto-use brand colors',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 11: Security
  createHeading('11. Security Architecture', 1),

  createHeading('11.1 CORS Configuration', 2),
  createBodyText('CORS headers set per-request in setCorsForRequest():'),
  new Paragraph({
    text: 'Allowed origins:\n• https://fieldforcemrser2026.github.io (Admin/Tech frontend)\n• https://app.syntoniqa.app (Production domain)\n• http://localhost:3000 (Dev)\n• http://localhost:8787 (Local worker)\n\nMethods: GET, POST, OPTIONS\nCredentials: false (no cookies)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('11.2 Input Validation & Sanitization', 2),
  createBodyText('All POST bodies pass through normalizeBody() which:'),
  new Paragraph({
    text: '1. Strips extra whitespace\n2. Converts PascalCase/camelCase to snake_case\n3. Validates required fields\n4. Type-checks numeric fields\n5. Escapes SQL special chars (NOT used - parameterized queries)\n6. Rejects oversized payloads (max 10MB)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('11.3 Soft Delete & Audit Trail', 2),
  createBodyText('All mutations recorded in workflow_log table:'),
  new Paragraph({
    text: '• action: CREATE, UPDATE, DELETE, TRANSITION_STATE\n• table_name: Which table was modified\n• record_id: Primary key of affected record\n• old_values: Previous state (for UPDATE)\n• new_values: New state\n• user_id: Who made the change\n• timestamp: When it occurred',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Deleted records: obsoleto=true (soft delete), never hard-deleted from DB.'),

  createHeading('11.4 Rate Limiting', 2),
  createBodyText('Cloudflare Workers provide built-in rate limiting per IP. No custom implementation needed currently, but future consideration:'),
  new Paragraph({
    text: '• Implement sliding window rate limiter per IP/token\n• Block IPs exceeding 100 requests/min\n• Log attempts to workflow_log for audit',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 12: Deployment
  createHeading('12. Deployment Architecture', 1),

  createHeading('12.1 Frontend Deployment', 2),
  createBodyText('Admin & Tech PWA deployed via GitHub Pages (automatic on git push):'),
  new Paragraph({
    text: '1. Files in root: admin_v1.html, index_v2.html, white_label_config.js\n2. Push to GitHub main branch\n3. GitHub Actions auto-deploys to GitHub Pages\n4. URL: https://fieldforcemrser2026.github.io/syntoniqa/<filename>',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('12.2 Backend Deployment', 2),
  createBodyText('Cloudflare Worker deployed via wrangler CLI:'),
  new Paragraph({
    text: 'Command: CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy\n\nDeploys:\n• cloudflare_worker.js (main handler)\n• wrangler.toml (config, cron jobs, env vars)\n• Routes: syntoniqa-mrs-api.fieldforcemrser.workers.dev\n\nEnv vars stored in Cloudflare dashboard:\nSUPABASE_URL, SUPABASE_SERVICE_KEY, SQ_TOKEN, GEMINI_KEY, TELEGRAM_BOT_TOKEN, RESEND_API_KEY, TENANT_ID',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('12.3 Database Deployment', 2),
  createBodyText('Supabase PostgreSQL hosted at https://sajzbanhkehkkhhgztkq.supabase.co'),
  new Paragraph({
    text: '• Database ID: sajzbanhkehkkhhgztkq\n• Daily automated backups (7-day retention)\n• Service Key for Workers to authenticate\n• RLS (Row-Level Security) policies per table ensure tenant isolation',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 13: Scalability
  createHeading('13. Scalability & Performance', 1),

  createHeading('13.1 Horizontal Scaling', 2),
  createBodyText('Cloudflare Workers automatically scale globally across 300+ edge locations. No horizontal scaling code needed - infrastructure handles it.'),

  createHeading('13.2 Database Limits', 2),
  createBodyText('Supabase PostgreSQL limits:'),
  new Paragraph({
    text: '• Connections: 100 concurrent (worker connections pooled)\n• Query timeout: 30 sec\n• Max response size: 10MB\n• Storage: Scales with plan (currently ~10GB used)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('13.3 Caching Strategy', 2),
  createBodyText('• Cloudflare Cache Rules: Cache static assets (HTML, JS, CSS) for 24h'),
  createBodyText('• Browser Cache-Control headers: no-cache for API responses (always fresh)'),
  createBodyText('• IndexedDB (Service Worker): Cache intervention list locally for offline'),

  createHeading('13.4 Expected Growth', 2),
  createBodyText('Current: 10 technicians, 100 clients, ~50 urgencies/week.'),
  new Paragraph({
    text: 'Projected (3 years):\n• Technicians: 100+\n• Clients: 1000+\n• Urgencies/week: 500+\n• Database size: 100GB+\n\nAt this scale, consider: sharding by region, read replicas, Redis caching layer.',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 14: Disaster Recovery
  createHeading('14. Disaster Recovery', 1),

  createHeading('14.1 Backup Strategy', 2),
  createBodyText('• Supabase: Automated daily backups, 7-day retention'),
  createBodyText('• Manual: Export full DB to SQL file monthly'),
  createBodyText('• Git: All code in GitHub with full history'),

  createHeading('14.2 Recovery Procedures', 2),
  createBodyText('If database corrupted:'),
  new Paragraph({
    text: '1. Stop all worker requests (pause Cloudflare)\n2. Restore Supabase from backup\n3. Verify schema and data integrity\n4. Resume worker\n5. Monitor for anomalies\n6. Notify users via email\n\nRTO (Recovery Time Objective): <1 hour\nRPO (Recovery Point Objective): <24 hours',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('14.3 High Availability', 2),
  createBodyText('• Cloudflare Workers: 99.9% uptime SLA (distributed globally)'),
  createBodyText('• Supabase: 99.95% uptime SLA (managed service)'),
  createBodyText('• GitHub: 99.99% uptime (CDN)'),
  createBodyText('Combined: ~99.85% system uptime'),

];

// Generate document
const doc = new Document({
  sections: [{
    properties: {},
    children: sections,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outputPath = path.join(__dirname, '05_Solution_Architecture_Document.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Generated: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  process.exit(0);
}).catch(err => {
  console.error('Error generating document:', err);
  process.exit(1);
});
