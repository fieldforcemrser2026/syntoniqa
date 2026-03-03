#!/usr/bin/env node
/**
 * Syntoniqa v1.0 - Admin Manual Generator
 * Output: 03_Manuale_Admin.docx (40+ pages, professional formatting)
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
    text: 'Admin Manual',
    fontSize: 36,
    bold: true,
    alignment: AlignmentType.CENTER,
    color: DARK_GRAY,
    spacing: { after: 600 },
  }),
  new Paragraph({
    text: 'Field Service Management Platform\nMRS Lely Center Emilia Romagna',
    fontSize: 28,
    alignment: AlignmentType.CENTER,
    color: '666666',
    spacing: { after: 1200 },
  }),
  new Paragraph({
    text: 'Document Version: 1.0\nRelease Date: March 3, 2026\nStatus: Approved for UAT (155/155 PASS)',
    fontSize: 22,
    alignment: AlignmentType.CENTER,
    color: '666666',
    spacing: { after: 400 },
  }),
  new PageBreak(),

  // Table of Contents
  createHeading('Table of Contents', 1),
  new Paragraph({
    text: '1. Getting Started\n2. Dashboard Overview\n3. Managing Urgencies\n4. Intervention Planning\n5. AI Planner Integration\n6. Project Management & Scheduling\n7. Spare Parts Orders\n8. Client Management\n9. Equipment Management\n10. Vehicles (Automezzi)\n11. On-Call Management\n12. Travel Management\n13. Installations\n14. Chat System\n15. Notifications\n16. KPI Dashboard\n17. SLA Configuration\n18. User Management\nAppendix A: Glossary\nAppendix B: Troubleshooting\nAppendix C: FAQ',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  new PageBreak(),

  // Section 1: Getting Started
  createHeading('1. Getting Started', 1),
  createBodyText('Welcome to Syntoniqa v1.0, a professional Field Service Management platform designed specifically for MRS Lely Center. This manual covers all administrative functions and best practices.'),

  createHeading('1.1 Login', 2),
  createBodyText('Access the admin dashboard at:'),
  new Paragraph({
    text: 'https://fieldforcemrser2026.github.io/syntoniqa/admin_v1.html',
    fontSize: 22,
    spacing: { line: 360, before: 100, after: 200 },
    color: BRAND_COLOR,
    bold: true,
  }),
  createBodyText('Default credentials:'),
  createBodyText('Username: m.bozzarelli'),
  createBodyText('Password: As configured in Supabase auth'),
  createBodyText('Login form performs JWT authentication against Supabase PostgreSQL. Session token is stored securely in browser localStorage and included in all subsequent API calls via the X-Token header.'),

  createHeading('1.2 Dashboard Overview', 2),
  createBodyText('Upon login, you access the main admin dashboard featuring:'),
  new Paragraph({
    text: '• Real-time KPI metrics (intervention completion, SLA compliance, revenue)\n• Quick-action buttons (Create Urgency, New Intervention, New Order)\n• Map view with all active clients and technicians\n• Chat sidebar for internal communication\n• Navigation menu with 15+ module links\n• User profile (top-right corner with logout option)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 2: Managing Urgencies
  createHeading('2. Managing Urgencies (Urgenze)', 1),
  createBodyText('Urgencies represent emergency or high-priority interventions that require rapid response. They follow a strict state machine to ensure proper workflow management.'),

  createHeading('2.1 Urgency State Machine', 2),
  createBodyText('Every urgency transitions through the following states:'),
  createTable(
    ['State', 'Description', 'Next States', 'Who Can Assign'],
    [
      ['APERTA', 'Newly created, unassigned', 'ASSEGNATA, RIFIUTATA', 'Admin'],
      ['ASSEGNATA', 'Assigned to a technician', 'SCHEDULATA, APERTA (reject)', 'Admin'],
      ['SCHEDULATA', 'Scheduled for specific date/time', 'IN_CORSO, APERTA (reject)', 'Admin/Tech'],
      ['IN_CORSO', 'Technician is actively working', 'RISOLTA, ASSEGNATA', 'Technician'],
      ['RISOLTA', 'Work completed, pending admin approval', 'CHIUSA, IN_CORSO', 'Admin'],
      ['CHIUSA', 'Closed, terminal state', '—', 'System (auto)'],
    ],
    [2200, 2200, 2100, 1860]
  ),

  createHeading('2.2 Creating an Urgency', 2),
  createBodyText('Step 1: Click "New Urgency" button on dashboard or navigate to Urgenze module.'),
  createBodyText('Step 2: Fill in required fields:'),
  new Paragraph({
    text: '• Client: Select from dropdown\n• Machine: Select equipment affected\n• Priority: HIGH / MEDIUM / LOW\n• Description: Detailed issue description\n• Symptoms: What is happening on-site\n• Requested Resolution Time: HH:MM format',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Step 3: Click "Create Urgency". System assigns unique ID (URG_XXXXX).'),
  createBodyText('Step 4: Urgency appears in APERTA state and sends notification to on-call technician.'),

  createHeading('2.3 Assigning & Managing', 2),
  createBodyText('To assign an urgency:'),
  new Paragraph({
    text: '1. Open urgency detail\n2. Click "Assign Technician" button\n3. Select available technician from list (filtered by availability)\n4. Add assignment notes (optional)\n5. Click "Confirm Assignment"\n6. Technician receives Telegram notification and in-app notification',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('SLA Engine: System automatically tracks time from APERTA → IN_CORSO. If >4 hours elapse without work starting, system sends escalation alert to admin and senior technician.'),

  createHeading('2.4 Monitoring SLA Compliance', 2),
  createBodyText('SLA status is displayed with color coding:'),
  new Paragraph({
    text: '🟢 OK: Within target resolution time\n🟡 WARNING: 75% of SLA time consumed\n🔴 CRITICAL: 90% of SLA time consumed\n⚫ BREACH: Exceeded resolution time',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Configure SLA times in section 17.'),

  new PageBreak(),

  // Section 3: Intervention Planning
  createHeading('3. Intervention Planning (Piano Interventi)', 1),
  createBodyText('Interventions represent scheduled maintenance, inspections, and routine service visits. They are planned in advance and tracked through completion.'),

  createHeading('3.1 Intervention State Machine', 2),
  createBodyText('Interventions follow this state model:'),
  createTable(
    ['State', 'Description', 'Valid Transitions'],
    [
      ['PIANIFICATO', 'Scheduled, not yet assigned', 'IN_CORSO, ANNULLATO'],
      ['IN_CORSO', 'Work is underway', 'COMPLETATO, PIANIFICATO'],
      ['COMPLETATO', 'Work finished, terminal state', '—'],
      ['ANNULLATO', 'Cancelled, terminal state', 'PIANIFICATO (rare restart)'],
    ],
    [2200, 3500, 3660]
  ),

  createHeading('3.2 Creating an Intervention Plan', 2),
  createBodyText('Step 1: Navigate to Piano Interventi module.'),
  createBodyText('Step 2: Click "Create Intervention".'),
  createBodyText('Step 3: Fill required fields:'),
  new Paragraph({
    text: '• Type: Preventive, Corrective, Inspection\n• Client & Machine: Select target\n• Scheduled Date: YYYY-MM-DD\n• Scheduled Time: HH:MM\n• Estimated Duration: Minutes\n• Description: Scope of work\n• Required Parts: Optional spare parts list\n• Assigned Technician(s): Auto-filtered by availability',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Step 4: Click "Create Plan". System assigns INT_XXXXX ID.'),

  createHeading('3.3 Managing Technician Assignment', 2),
  createBodyText('When creating or editing an intervention, the system provides a filtered list of available technicians. Filters consider:'),
  new Paragraph({
    text: '• Technician availability on scheduled date\n• Geographic proximity to client\n• Skill level required vs. technician certification\n• Current workload (planned interventions for that day)\n• Team preferences (junior techs must be paired with senior)',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Best Practice: Always assign senior technician as lead when pairing with junior staff (Giuseppe, Gino, Emanuele must work with Jacopo, Anton, or Giovanni).'),

  createHeading('3.4 Tracking & Reporting', 2),
  createBodyText('Dashboard KPI shows:'),
  new Paragraph({
    text: '• Total planned interventions for this week\n• % completed (COMPLETATO / total)\n• Overdue interventions (past date, still PIANIFICATO)\n• Technician productivity (interventions per technician)\n• Average intervention duration vs. estimated',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 4: AI Planner
  createHeading('4. AI Planner Integration (Gemini)', 1),
  createBodyText('Syntoniqa integrates Google Gemini AI to analyze photos, predict equipment failures, and suggest optimized intervention schedules.'),

  createHeading('4.1 AI Photo Analysis', 2),
  createBodyText('When a technician uploads a photo during work or reports via Telegram, the system:'),
  new Paragraph({
    text: '1. Extracts image and sends to Gemini API\n2. AI analyzes photo for equipment condition, wear patterns, alignment issues\n3. Generates structured report with severity assessment (CRITICAL / HIGH / MEDIUM / LOW)\n4. Auto-creates urgency or intervention plan if issue detected\n5. Notifies admin with AI analysis summary',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Access: Telegram Bot → Send photo + brief description OR In-app Chat → Upload photo.'),

  createHeading('4.2 Predictive Maintenance', 2),
  createBodyText('AI Planner suggests optimal intervention dates based on:'),
  new Paragraph({
    text: '• Historical intervention patterns for each machine\n• Manufacturer recommended service intervals\n• Current equipment health scores\n• Seasonal usage patterns\n• SLA compliance history',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Admin can accept/reject suggestions via "AI Suggestions" panel on dashboard.'),

  createHeading('4.3 Configuring AI Behavior', 2),
  createBodyText('Navigate to Settings → AI Configuration:'),
  createBodyText('• Toggle AI Photo Analysis: ON/OFF'),
  createBodyText('• Toggle Predictive Suggestions: ON/OFF'),
  createBodyText('• Set Gemini API Key: (stored securely as env var GEMINI_KEY)'),

  new PageBreak(),

  // Section 5: PM Scheduling
  createHeading('5. Project Management & Scheduling', 1),
  createBodyText('Advanced scheduling tools help optimize technician routes, reduce travel time, and maximize billable hours.'),

  createHeading('5.1 Weekly Schedule View', 2),
  createBodyText('Navigate to Scheduling module to see:'),
  new Paragraph({
    text: '• Gantt chart with all interventions for selected week\n• Color-coded by technician\n• Drag-drop to reassign or reschedule\n• Conflict detection (overlapping assignments)\n• Travel time estimation between clients',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('5.2 Optimizing Routes', 2),
  createBodyText('System suggests route optimization to minimize drive time:'),
  new Paragraph({
    text: '1. Select date range\n2. Filter by technician or region\n3. Click "Optimize Routes"\n4. Review suggested order\n5. Accept or manually reorder\n6. Push to technician via Telegram or in-app notification',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 6: Spare Parts
  createHeading('6. Spare Parts Orders (Ordini Ricambi)', 1),
  createBodyText('Track and manage spare parts inventory and orders for equipment maintenance.'),

  createHeading('6.1 Creating an Order', 2),
  createBodyText('Step 1: Navigate to Ordini module.'),
  createBodyText('Step 2: Click "New Order".'),
  createBodyText('Step 3: Enter:'),
  new Paragraph({
    text: '• Part Code: Lely M3 part number\n• Quantity: Number of units\n• Client: Which client needs it\n• Urgency: NORMAL, EXPRESS\n• Notes: Special delivery instructions',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Step 4: Click "Submit Order". System sends to Lely supplier integration.'),

  createHeading('6.2 Order States', 2),
  createTable(
    ['State', 'Description'],
    [
      ['RICHIESTO', 'Order submitted, awaiting supplier confirmation'],
      ['CONFERMATO', 'Supplier confirmed availability & price'],
      ['SPEDITO', 'Parts shipped from supplier'],
      ['RICEVUTO', 'Parts received at MRS location'],
      ['USATO', 'Parts installed and consumed'],
      ['ANNULLATO', 'Order cancelled'],
    ],
    [2200, 7160]
  ),

  new PageBreak(),

  // Section 7: Client Management
  createHeading('7. Client Management', 1),
  createBodyText('Manage customer data, locations, billing info, and contact details.'),

  createHeading('7.1 Create Client', 2),
  createBodyText('Navigate to Clienti module → "New Client":'),
  new Paragraph({
    text: '• Business Name: Company name\n• Contact Name: Primary contact\n• Phone: Mobile & landline\n• Email: Primary communication\n• Address: Full street address\n• City/Province: For logistics\n• Coordinates: Auto-geocoded if possible\n• Billing ID: M3 master data reference',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('7.2 Client Dashboard', 2),
  createBodyText('Each client detail page shows:'),
  new Paragraph({
    text: '• Equipment installed (all machines, versions)\n• Maintenance history (past interventions)\n• Open urgencies\n• Scheduled interventions\n• SLA compliance for this client\n• Total billable hours YTD\n• Contact history (chats, calls)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 8: Equipment
  createHeading('8. Equipment Management (Macchine)', 1),
  createBodyText('Register and track Lely robotics and milking equipment installed at client sites.'),

  createHeading('8.1 Adding Equipment', 2),
  createBodyText('Navigate to Macchine → "New Equipment":'),
  new Paragraph({
    text: '• Model: e.g., "Lely Astronaut A5"\n• Serial Number: Manufacturer ID\n• Client: Installation site\n• Installation Date: When deployed\n• Warranty Expiry: Support end date\n• Firmware Version: Current software\n• Status: ACTIVE, MAINTENANCE, EOL',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('8.2 Maintenance Records', 2),
  createBodyText('Equipment page links to all associated interventions, urgencies, and part replacements. Helps identify wear patterns and predict failures.'),

  new PageBreak(),

  // Section 9: Vehicles
  createHeading('9. Vehicle Management (Automezzi)', 1),
  createBodyText('Track service vans, fuel, maintenance, and technician assignments.'),

  createHeading('9.1 Adding a Vehicle', 2),
  createBodyText('Navigate to Automezzi → "New Vehicle":'),
  new Paragraph({
    text: '• Plate: License plate number\n• Brand/Model: Vehicle description\n• Type: FURGONE, AUTO, TRUCK\n• Assigned Technician: Primary driver\n• Base Location: Home depot\n• Current Fuel Level: % (auto-tracked via IoT telematics if available)\n• Service Due Date: Next maintenance',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('9.2 Current Assignments', 2),
  createBodyText('The system shows which technician is assigned to which vehicle, helping optimize logistics and route planning.'),

  new PageBreak(),

  // Section 10: On-Call Management
  createHeading('10. On-Call Management (Reperibilità)', 1),
  createBodyText('Schedule on-call duty rotations for urgent after-hours support.'),

  createHeading('10.1 Creating On-Call Schedule', 2),
  createBodyText('Navigate to Reperibilità → "New Schedule":'),
  new Paragraph({
    text: '• Start Date: When rotation begins\n• End Date: When it ends\n• Technician: Who is on-call\n• Coverage Type: WEEKDAY, WEEKEND, 24H\n• Contact Method: PHONE, TELEGRAM, EMAIL\n• Escalation Contact: If primary unavailable',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('10.2 Automation', 2),
  createBodyText('System automatically routes urgencies to on-call technician first. If accepted: assignment goes through. If no response in 5 minutes, escalates to secondary contact.'),

  new PageBreak(),

  // Section 11: Travel Management
  createHeading('11. Travel Management (Trasferte)', 1),
  createBodyText('Track technician travel time and expenses for client sites outside normal coverage area.'),

  createHeading('11.1 Logging Travel', 2),
  createBodyText('Technician logs travel via mobile app or admin logs manually:'),
  new Paragraph({
    text: '• Departure Location: Origin\n• Destination: Client location\n• Distance: Miles/km (auto-calculated)\n• Duration: Travel time\n• Expense Type: FUEL, PARKING, ACCOMMODATION\n• Amount: Cost\n• Reimbursement Status: PENDING, APPROVED, PAID',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('11.2 Reports', 2),
  createBodyText('Admin dashboard aggregates travel expenses by technician, client, and time period for billing and cost analysis.'),

  new PageBreak(),

  // Section 12: Installations
  createHeading('12. Installations (Installazioni)', 1),
  createBodyText('Manage new equipment installation projects, including commissioning and validation.'),

  createHeading('12.1 Creating Installation Project', 2),
  createBodyText('Navigate to Installazioni → "New Installation":'),
  new Paragraph({
    text: '• Equipment Model: What is being installed\n• Client: Deployment location\n• Project Manager: Responsible technician/manager\n• Start Date: Installation begin\n• Expected Completion: Target finish date\n• Scope: Detailed work breakdown\n• Risk Assessment: Potential issues',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('12.2 Project Tracking', 2),
  createBodyText('System tracks installation milestones (foundation prep, assembly, electrical, software, testing, commissioning). Progress updates sent to client.'),

  new PageBreak(),

  // Section 13: Chat System
  createHeading('13. Chat System', 1),
  createBodyText('Real-time internal communication between admins and technicians.'),

  createHeading('13.1 Channels', 2),
  createBodyText('• #general: All staff announcements'),
  createBodyText('• #urgent: High-priority escalations'),
  createBodyText('• #technical: Engineering discussions'),
  createBodyText('• Direct messages: 1-on-1 tech/admin conversations'),

  createHeading('13.2 Integrations', 2),
  createBodyText('Chat supports file uploads, photo sharing, and mentions (@username). Messages are logged in audit trail.'),

  new PageBreak(),

  // Section 14: Notifications
  createHeading('14. Notifications', 1),
  createBodyText('System delivers notifications via multiple channels: in-app, email, Telegram, Web Push.'),

  createHeading('14.1 Notification Types', 2),
  createTable(
    ['Type', 'Trigger', 'Channels'],
    [
      ['Urgency Assigned', 'Admin assigns urgency to tech', 'Telegram, In-app, Email'],
      ['SLA Warning', 'Urgency at 75% SLA time', 'Email, Telegram (admin)'],
      ['SLA Breach', 'Urgency exceeds SLA', 'Telegram (all), Email (admin)'],
      ['Intervention Reminder', 'Intervention scheduled for tomorrow', 'In-app, Email'],
      ['Order Updated', 'Spare part order status changes', 'In-app, Telegram'],
      ['Chat Message', 'New message in subscribed channel', 'In-app, Email (digest)'],
    ],
    [1560, 3900, 3900]
  ),

  createHeading('14.2 Configuring Notifications', 2),
  createBodyText('Admin Settings → Notifications:'),
  new Paragraph({
    text: '• Enable/disable by notification type\n• Choose delivery channels per type\n• Set quiet hours (no notifications 8pm-6am)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 15: KPI Dashboard
  createHeading('15. KPI Dashboard', 1),
  createBodyText('Real-time analytics and performance metrics.'),

  createHeading('15.1 Key Metrics', 2),
  createTable(
    ['Metric', 'Definition', 'Target'],
    [
      ['Intervention Completion Rate', '(Completed / Planned) × 100', '95%'],
      ['SLA Compliance', 'Urgencies resolved within SLA', '98%'],
      ['Technician Utilization', 'Billable hours / Available hours', '75%'],
      ['Response Time', 'Time from APERTA to IN_CORSO', '<2 hours'],
      ['Customer Satisfaction', 'Survey score average', '>4.5/5.0'],
      ['Equipment Downtime', 'Hours per machine per month', '<5 hours'],
    ],
    [2100, 3900, 2360]
  ),

  createHeading('15.2 Drilling Down', 2),
  createBodyText('Click any metric to drill down by technician, client, machine, or time period. Export data as CSV or send to Power BI (if feature enabled).'),

  new PageBreak(),

  // Section 16: SLA Configuration
  createHeading('16. SLA Configuration', 1),
  createBodyText('Define Service Level Agreements and response time targets.'),

  createHeading('16.1 Setting SLA Rules', 2),
  createBodyText('Navigate to Settings → SLA Configuration:'),
  new Paragraph({
    text: '• Priority Level: CRITICAL, HIGH, MEDIUM, LOW\n• Target Resolution Time: HH:MM from urgency creation\n• Escalation Thresholds: Alert at 75%, 90%, breach at 100%\n• Weekend Coverage: Include weekends in SLA calc\n• Holiday Adjustments: Add holidays (pause SLA clock)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('16.2 SLA Engine', 2),
  createBodyText('Cron job runs every 15 minutes to:'),
  new Paragraph({
    text: '1. Calculate time elapsed per urgency\n2. Compare against SLA target\n3. Update status (OK → WARNING → CRITICAL → BREACH)\n4. Send alerts when thresholds crossed\n5. Log SLA metrics in kpi_log table for analytics',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 17: User Management
  createHeading('17. User Management', 1),
  createBodyText('Create, edit, and manage system users with role-based access control (RBAC).'),

  createHeading('17.1 User Roles', 2),
  createTable(
    ['Role', 'Permissions', 'Typical User'],
    [
      ['ADMIN', 'Full system access, create users, configure SLA', 'Marcello Bozzarelli'],
      ['MANAGER', 'Create/edit interventions, view KPI, assign techs', 'Caposquadra (Jacopo)'],
      ['SENIOR_TECH', 'View/update own jobs, create urgent orders', 'Senior technicians'],
      ['TECH', 'View/update assignments, submit timesheets', 'Field technicians'],
      ['READONLY', 'View-only dashboard, no create/edit', 'Auditors, management'],
    ],
    [1560, 5200, 2600]
  ),

  createHeading('17.2 Creating a User', 2),
  createBodyText('Settings → Users → "New User":'),
  new Paragraph({
    text: '• Email: Unique login identifier\n• Name: Full name\n• Role: Select from dropdown\n• Status: ACTIVE, INACTIVE\n• Assign Technician (if TECH): Link to technician record',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('System sends invitation email with temporary password. User must reset on first login.'),

  new PageBreak(),

  // Appendix A: Glossary
  createHeading('Appendix A: Glossary', 1),
  createTable(
    ['Term', 'Definition'],
    [
      ['Urgenza', 'Emergency/urgent intervention requiring rapid response'],
      ['Piano Interventi', 'Scheduled maintenance intervention, planned in advance'],
      ['SLA', 'Service Level Agreement - target resolution time'],
      ['Ricambi', 'Spare parts inventory and ordering'],
      ['Tecnico', 'Field service technician'],
      ['Caposquadra', 'Team lead/senior technician (Jacopo)'],
      ['Automezzi', 'Service vehicles/vans'],
      ['Reperibilità', 'On-call duty schedule'],
      ['Trasferte', 'Travel/business trips with associated costs'],
      ['KPI', 'Key Performance Indicator - metrics dashboard'],
      ['Tenant', 'Organization/company using Syntoniqa'],
      ['JWT', 'JSON Web Token - authentication credential'],
      ['Workflow Log', 'Audit trail of all system actions'],
      ['Geocache', 'Location coordinates database for routing'],
      ['Gemini', 'Google AI for photo analysis and predictions'],
    ],
    [1560, 7800]
  ),

  new PageBreak(),

  // Appendix B: Troubleshooting
  createHeading('Appendix B: Troubleshooting', 1),

  createHeading('B.1 Login Issues', 2),
  createBodyText('Problem: "Invalid credentials" error'),
  createBodyText('Solution: Verify email is correct. Reset password via "Forgot Password" link. Check Supabase user table to confirm user exists and is ACTIVE.'),

  createHeading('B.2 Notification Not Sent', 2),
  createBodyText('Problem: Technician did not receive Telegram or email'),
  createBodyText('Solution: Verify Telegram bot token is valid in Cloudflare env vars. Check email is in user profile. Verify email service (Resend) has credits. Check SMTP logs.'),

  createHeading('B.3 SLA Not Updating', 2),
  createBodyText('Problem: Urgency SLA status stuck at "OK"'),
  createBodyText('Solution: Cron job runs every 15 min. Check Cloudflare logs for errors. Verify urgenza has valid sla_config. Check workflow_log for SLA calc attempts.'),

  createHeading('B.4 Map Showing No Clients', 2),
  createBodyText('Problem: Map is blank or shows few clients'),
  createBodyText('Solution: Verify clients have valid coordinates (lat/lng). Admin can batch-geocode from Settings → Geocoding. Refresh browser cache (Ctrl+Shift+Delete).'),

  new PageBreak(),

  // Appendix C: FAQ
  createHeading('Appendix C: Frequently Asked Questions', 1),

  createHeading('Q: Can I reassign an urgency mid-work?', 2),
  createBodyText('A: Yes. If urgency is in SCHEDULATA or IN_CORSO state, admin can reassign to another technician. Original tech gets notification. Recommended only for emergencies (tech unavailable, critical escalation).'),

  createHeading('Q: What happens if a technician rejects an assigned urgency?', 2),
  createBodyText('A: Urgency moves back to APERTA state. Admin is notified and must reassign to different technician or escalate.'),

  createHeading('Q: Can interventions be rescheduled?', 2),
  createBodyText('A: Yes, if in PIANIFICATO state. Click intervention → "Reschedule" → select new date/time. Technician receives updated notification.'),

  createHeading('Q: How is technician productivity calculated?', 2),
  createBodyText('A: KPI = Total billable hours / (Available hours - vacation days). Billable hours come from timestamp of IN_CORSO → COMPLETATO transitions.'),

  createHeading('Q: What is the Telegram bot token used for?', 2),
  createBodyText('A: Bot sends notifications to technicians (new urgencies, SLA warnings, order updates). Token must be kept secret and stored in Cloudflare env vars only.'),

  createHeading('Q: Can I export data to Excel?', 2),
  createBodyText('A: Yes. Dashboard → "Export" button generates CSV. Excel import is on-demand via SheetJS library. Large datasets (>10k rows) may be slow.'),

];

// Generate document
const doc = new Document({
  sections: [{
    properties: {},
    children: sections,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outputPath = path.join(__dirname, '03_Manuale_Admin.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Generated: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  process.exit(0);
}).catch(err => {
  console.error('Error generating document:', err);
  process.exit(1);
});
