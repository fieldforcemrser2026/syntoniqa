#!/usr/bin/env node
/**
 * Syntoniqa v1.0 - Mobile Tech Manual Generator
 * Output: 04_Manuale_Tecnico.docx (25-30 pages, technician-focused)
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
    text: 'Mobile Tech Manual',
    fontSize: 36,
    bold: true,
    alignment: AlignmentType.CENTER,
    color: DARK_GRAY,
    spacing: { after: 600 },
  }),
  new Paragraph({
    text: 'For Field Service Technicians\nMRS Lely Center Emilia Romagna',
    fontSize: 28,
    alignment: AlignmentType.CENTER,
    color: '666666',
    spacing: { after: 1200 },
  }),
  new Paragraph({
    text: 'Document Version: 1.0\nRelease Date: March 3, 2026',
    fontSize: 22,
    alignment: AlignmentType.CENTER,
    color: '666666',
    spacing: { after: 400 },
  }),
  new PageBreak(),

  // Table of Contents
  createHeading('Table of Contents', 1),
  new Paragraph({
    text: '1. Getting Started\n2. Installing the PWA App\n3. Login & Authentication\n4. Home Screen\n5. Managing Urgencies\n6. Intervention Planning\n7. Calendar View\n8. Map & Navigation\n9. Spare Parts Orders\n10. Chat System\n11. Notifications\n12. User Profile\n13. Telegram Bot Guide\n14. AI Photo Analysis\nQuick Reference Card (Back Cover)',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  new PageBreak(),

  // Section 1: Getting Started
  createHeading('1. Getting Started', 1),
  createBodyText('Welcome to Syntoniqa, your mobile field service platform. This manual covers the technician mobile app (PWA - Progressive Web App) and the Telegram bot integration.'),

  createHeading('1.1 What is Syntoniqa?', 2),
  createBodyText('Syntoniqa is a cloud-based system that manages your daily work assignments, schedules, and client communications. It eliminates paper forms and keeps everyone connected in real-time.'),

  createHeading('1.2 Device Compatibility', 2),
  createBodyText('• iOS: Safari on iPhone/iPad (iOS 12+)'),
  createBodyText('• Android: Chrome or Firefox (Android 6+)'),
  createBodyText('• Internet: Works offline - syncs when connection restored'),

  new PageBreak(),

  // Section 2: Installing PWA
  createHeading('2. Installing the PWA App', 1),

  createHeading('2.1 Installation Steps (All Devices)', 2),
  createBodyText('Step 1: Visit the app URL in your browser:'),
  new Paragraph({
    text: 'https://fieldforcemrser2026.github.io/syntoniqa/index_v2.html',
    fontSize: 22,
    spacing: { line: 360, before: 100, after: 200 },
    color: BRAND_COLOR,
    bold: true,
  }),
  createBodyText('Step 2: Wait for the "Install" banner to appear at bottom of screen.'),
  createBodyText('Step 3: Tap "Install" and follow the prompts.'),
  createBodyText('Step 4: The app will be added to your home screen as "Syntoniqa".'),
  createBodyText('Step 5: Tap the icon to launch. First load may take 10-15 seconds.'),

  createHeading('2.2 No Install Banner?', 2),
  createBodyText('If you do not see an install banner:'),
  new Paragraph({
    text: '• iOS: Tap the Share icon (arrow up) → "Add to Home Screen"\n• Android: Tap the menu (3 dots) → "Install app"',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('2.3 Updates', 2),
  createBodyText('The app checks for updates every time you open it. If a new version is available, you will be notified. Updates happen automatically in the background.'),

  new PageBreak(),

  // Section 3: Login
  createHeading('3. Login & Authentication', 1),

  createHeading('3.1 First Login', 2),
  createBodyText('Launch the app. You will see a login screen requesting:'),
  createBodyText('• Email: Your work email address'),
  createBodyText('• Password: Your password (set by admin)'),
  createBodyText('Tap "Login". System verifies credentials against Supabase.'),

  createHeading('3.2 Session Management', 2),
  createBodyText('Once logged in, your session remains active for 7 days or until you manually logout. You do not need to re-enter credentials each day.'),

  createHeading('3.3 Lost Password?', 2),
  createBodyText('Tap "Forgot Password?" on login screen. Enter your email. Admin will send you a reset link. Click the link and set a new password.'),

  new PageBreak(),

  // Section 4: Home Screen
  createHeading('4. Home Screen', 1),
  createBodyText('After login, you see the home screen with quick-access buttons and status summary.'),

  createHeading('4.1 Layout', 2),
  createBodyText('Top Section:'),
  new Paragraph({
    text: '• Your name and photo\n• "Shift Status": GREEN if ready, YELLOW if on-call, RED if off-duty\n• "Available" toggle (turn on/off based on shift)',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Main Buttons (Quick Actions):'),
  new Paragraph({
    text: '• [Urgencies] - View assigned urgent jobs\n• [Interventions] - View scheduled maintenance\n• [Orders] - Request spare parts\n• [Calendar] - Weekly schedule view\n• [Map] - Navigate to client sites',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('Stats Section:'),
  new Paragraph({
    text: '• Jobs Today: Count of assigned jobs\n• Billable Hours: Total hours this week\n• Completion Rate: % of jobs finished this week',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 5: Managing Urgencies
  createHeading('5. Managing Urgencies', 1),
  createBodyText('Urgencies are emergency jobs that require rapid response. They appear as high-priority notifications and are always at the top of your list.'),

  createHeading('5.1 Viewing Assigned Urgencies', 2),
  createBodyText('Tap [Urgencies] button. You see all assigned urgencies in these states:'),
  new Paragraph({
    text: '• Assigned but not started (tap to review)\n• In Progress (tap to update status)\n• Completed (for reference)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('5.2 Accepting an Urgency', 2),
  createBodyText('When assigned a new urgency, you receive a Telegram notification and in-app notification. Swipe the notification to view details:'),
  new Paragraph({
    text: '1. Read the description and troubleshoot notes\n2. Check client location and estimated drive time\n3. Tap "Accept" to confirm assignment\n4. Admin is notified of acceptance',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('5.3 Marking as In Progress', 2),
  createBodyText('When you arrive at the site and begin work:'),
  new Paragraph({
    text: '1. Open the urgency detail\n2. Tap "Start Work" button\n3. System records the start time\n4. Admin and on-call team are notified\n5. SLA clock starts running toward escalation threshold',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('5.4 Completing an Urgency', 2),
  createBodyText('When work is finished:'),
  new Paragraph({
    text: '1. Tap "Resolve" button\n2. Enter completion notes (optional)\n3. Take a photo (optional - for AI analysis)\n4. Tap "Submit"\n5. Status moves to RESOLVED - awaiting admin approval',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 6: Intervention Planning
  createHeading('6. Intervention Planning', 1),
  createBodyText('Interventions are scheduled maintenance jobs planned days or weeks in advance.'),

  createHeading('6.1 Viewing Your Schedule', 2),
  createBodyText('Tap [Interventions]. You see all assigned maintenance work:'),
  new Paragraph({
    text: '• Color-coded by status (Scheduled, In Progress, Completed)\n• Grouped by date\n• Shows estimated duration',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('6.2 Accepting Assignment', 2),
  createBodyText('When admin assigns you a scheduled intervention, you receive a notification. Review details and tap "Accept" to confirm you will be available at that time and location.'),

  createHeading('6.3 Updating Status on Site', 2),
  createBodyText('On the scheduled date:'),
  new Paragraph({
    text: '1. Tap the intervention to open details\n2. Tap "I\'m on-site" when you arrive\n3. Perform the work\n4. Tap "Mark Complete" and add notes\n5. Upload photos (optional)\n6. System logs completion time',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 7: Calendar
  createHeading('7. Calendar View', 1),
  createBodyText('See your weekly schedule at a glance.'),

  createHeading('7.1 Accessing Calendar', 2),
  createBodyText('Tap [Calendar] button. Displays current week with all assigned jobs.'),

  createHeading('7.2 Understanding the Layout', 2),
  createBodyText('Days are listed horizontally. Each day shows:'),
  new Paragraph({
    text: '• RED blocks: Urgencies\n• BLUE blocks: Interventions\n• Time labels: Start time of each job\n• Total hours: Billable hours for that day',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('7.3 Navigation', 2),
  createBodyText('Swipe left/right to view other weeks. Tap any job block to open details.'),

  new PageBreak(),

  // Section 8: Map
  createHeading('8. Map & Navigation', 1),
  createBodyText('Real-time map showing your location, assigned clients, and navigation.'),

  createHeading('8.1 Launching Map', 2),
  createBodyText('Tap [Map]. System requests location permission (first time only). Approve to enable GPS tracking.'),

  createHeading('8.2 Map Display', 2),
  createBodyText('You see:'),
  new Paragraph({
    text: '• Your current location (blue dot)\n• Assigned job locations (red pins for urgencies, blue pins for interventions)\n• Estimated drive time to each location\n• Traffic conditions (if available)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('8.3 Getting Directions', 2),
  createBodyText('Tap any client pin. A card opens with:'),
  new Paragraph({
    text: '• Client name and address\n• Tap "Directions" to open your phone\'s native maps app\n• Choose route preference (fastest, shortest, etc.)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 9: Orders
  createHeading('9. Spare Parts Orders', 1),
  createBodyText('Request spare parts on-demand during repairs.'),

  createHeading('9.1 Creating an Order', 2),
  createBodyText('While on-site with a client:'),
  new Paragraph({
    text: '1. Tap [Orders] button\n2. Tap "New Order" button\n3. Enter part code (e.g., LK50000 for clutch)\n4. Enter quantity needed\n5. Select priority: NORMAL or EXPRESS\n6. Add notes (e.g., "Need by tomorrow")\n7. Tap "Submit"',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('9.2 Order Status', 2),
  createBodyText('After submitting, order is sent to Lely supplier. You receive Telegram notifications when:'),
  new Paragraph({
    text: '• Order is confirmed by supplier\n• Parts are shipped\n• Parts arrive at MRS center',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 10: Chat
  createHeading('10. Chat System', 1),
  createBodyText('Real-time messaging with admin and other technicians.'),

  createHeading('10.1 Accessing Chat', 2),
  createBodyText('Swipe from left edge of home screen to open chat sidebar. Or tap chat icon (speech bubble) if visible.'),

  createHeading('10.2 Channels', 2),
  createBodyText('• #urgent: Escalations and critical issues'),
  createBodyText('• #general: Team announcements'),
  createBodyText('• Direct message with admin (1-on-1 private)'),

  createHeading('10.3 Sending Messages', 2),
  createBodyText('Type in the message box and tap "Send". You can attach photos/files via the "+" button.'),

  new PageBreak(),

  // Section 11: Notifications
  createHeading('11. Notifications', 1),
  createBodyText('Stay updated on job assignments and status changes.'),

  createHeading('11.1 Notification Types', 2),
  createTable(
    ['Type', 'Description'],
    [
      ['New Urgency', 'You have been assigned an emergency job'],
      ['Urgency Reminder', 'Urgency nearing SLA deadline (4 hours without starting)'],
      ['Intervention Assigned', 'New scheduled maintenance job assigned to you'],
      ['Intervention Tomorrow', 'Reminder that you have a job scheduled for tomorrow'],
      ['Chat Message', 'New message in subscribed channel or direct message'],
      ['Order Status', 'Spare part order has been shipped or arrived'],
    ],
    [2200, 7160]
  ),

  createHeading('11.2 Managing Notifications', 2),
  createBodyText('Notifications arrive as:'),
  new Paragraph({
    text: '• Telegram messages (instant, even if app is closed)\n• In-app alerts (when app is open)\n• Email (daily digest)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 12: Profile
  createHeading('12. User Profile', 1),
  createBodyText('View and update your personal information.'),

  createHeading('12.1 Accessing Profile', 2),
  createBodyText('Tap the profile icon (person silhouette) at top-right of home screen.'),

  createHeading('12.2 Information Displayed', 2),
  createBodyText('• Your name and email'),
  createBodyText('• Phone number for dispatch calls'),
  createBodyText('• Assigned vehicle (furgone) ID'),
  createBodyText('• Skill certifications'),
  createBodyText('• Emergency contact'),

  createHeading('12.3 Editing Profile', 2),
  createBodyText('Tap "Edit" to update phone number or emergency contact. Other fields (name, email) require admin change.'),

  new PageBreak(),

  // Section 13: Telegram Bot
  createHeading('13. Telegram Bot Guide', 1),
  createBodyText('The Syntoniqa Telegram bot provides instant access to your work assignments and reporting. Available 24/7 via Telegram messenger.'),

  createHeading('13.1 Starting the Bot', 2),
  createBodyText('Open Telegram and search for: @SyntoniQaBot'),
  createBodyText('Tap "Start" to initialize the bot. You will be asked to authorize via a link.'),

  createHeading('13.2 Available Commands', 2),
  createTable(
    ['Command', 'Usage', 'Example'],
    [
      ['/vado', 'List open urgencies and pick one', '/vado → Select urgency #2 → Work starts'],
      ['/incorso', 'Mark current urgency as in-progress', '/incorso → Confirms work started'],
      ['/risolto', 'Mark urgency as resolved with notes', '/risolto Clutch replaced, aligned, tested OK'],
      ['/stato', 'Show my current assignments & SLA status', '/stato → Lists active jobs + time remaining'],
      ['/oggi', 'Show today\'s intervention schedule', '/oggi → Lists jobs for today with times'],
      ['/settimana', 'Show full week schedule', '/settimana → Shows Mon-Sun with all jobs'],
      ['/ordine CODE QTY CLIENTE', 'Request spare part', '/ordine LK50000 2 CLI_001 → Creates order'],
    ],
    [1200, 3400, 4760]
  ),

  createHeading('13.3 Command Examples', 2),
  createBodyText('Example 1: Checking Available Urgencies'),
  new Paragraph({
    text: 'You: /vado\nBot: "5 open urgencies:\n1) CLI_001 Lely A5 - Clutch slip\n2) CLI_005 Astronaut - Vacuum drop\n3) CLI_008 A4 - Motor noise\n4) CLI_012 A6 - Alarm E42\n5) CLI_015 A5 - Hose leak\n\nReply with number (1-5) to accept."',
    fontSize: 22,
    spacing: { line: 360 },
  }),
  createBodyText('You reply: 2'),
  createBodyText('Bot: "Urgency #2 assigned. CLI_005 Lely Astronaut, Vacuum drop. Drive time: 12 min. Reply /incorso when on-site."'),

  createHeading('13.4 Reporting Work Completion', 2),
  createBodyText('Example 2: Completing Work via Telegram'),
  new Paragraph({
    text: 'You: /risolto Replaced vacuum hose, tested suction OK, client satisfied.\nBot: "Urgency URG_00567 marked RESOLVED. Added notes. Admin will review and close. Good work!"',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('13.5 Photo Analysis (AI)', 2),
  createBodyText('Send a photo + short description to the bot:'),
  new Paragraph({
    text: 'You: [Upload photo] "Milking cluster is leaking from joint - is this critical?"\nBot: "Photo analyzed. CRITICAL: Milk leakage indicates seal failure. Risk of bacterial contamination. Recommend immediate replacement of inflations. Risk level: HIGH. Would you like me to create an order?"',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('13.6 Scheduling & Orders', 2),
  createBodyText('Example 3: Ordering Spare Parts'),
  new Paragraph({
    text: 'You: /ordine LK50000 1 CLI_001\nBot: "Order created: 1x LK50000 (Clutch) for CLI_001. Priority: NORMAL. Estimated delivery: 2 days. You will be notified when shipped."',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  new PageBreak(),

  // Section 14: AI Photo Analysis
  createHeading('14. AI Photo Analysis', 1),
  createBodyText('The app integrates Google Gemini AI to analyze photos and diagnose equipment problems in real-time.'),

  createHeading('14.1 How It Works', 2),
  createBodyText('Step 1: While on-site, take a photo of the equipment or issue.'),
  createBodyText('Step 2: Open app → Chat or Telegram bot → Upload photo.'),
  createBodyText('Step 3: Add a brief description: "What is happening?"'),
  createBodyText('Step 4: AI analyzes the photo and returns:'),
  new Paragraph({
    text: '• Equipment condition assessment\n• Detected issues (wear, misalignment, damage)\n• Risk level (CRITICAL, HIGH, MEDIUM, LOW)\n• Recommended actions\n• Suggested parts to order',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('14.2 Example Analysis', 2),
  createBodyText('Photo: Worn milking cluster'),
  new Paragraph({
    text: 'AI Response: "Photo shows advanced wear on inflations. Rubber is discolored (dark brown/black = oxidation). Teat ends appear swollen. Risk: MEDIUM - potential for teat injuries. Recommend replacement within 1 week. Standard part: LK50001 (set of 4)."',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('14.3 Limitations', 2),
  createBodyText('• AI requires good lighting and clear photo'),
  createBodyText('• Close-ups work better than wide angles'),
  createBodyText('• AI suggests actions but does not replace technician judgment'),
  createBodyText('• Always verify with visual inspection and test'),

  new PageBreak(),

  // Quick Reference Card
  createHeading('QUICK REFERENCE CARD', 1),

  createHeading('Urgent Tasks (Do These First)', 2),
  createTable(
    ['Task', 'Steps'],
    [
      ['Accept New Urgency', 'Tap notification → Review → Tap Accept'],
      ['Start Work', 'Open urgency → Tap "Start Work" → Work begins'],
      ['Complete Work', 'Tap "Resolve" → Add notes → Submit'],
      ['Report via Telegram', '/vado → Pick job → /incorso → /risolto notes'],
    ],
    [2200, 7160]
  ),

  createHeading('Daily Routine', 2),
  new Paragraph({
    text: '1. Open app → Check notifications (any new jobs?)\n2. Tap Calendar → Review today\'s schedule\n3. Tap Map → See route to first client\n4. Work each job: /incorso → work → /risolto\n5. At end of day: Check completions in Chat',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('When Something Goes Wrong', 2),
  new Paragraph({
    text: 'Issue: Cannot complete job on time\n→ Telegram: /stato (check SLA time remaining) → Chat admin → They reassign or escalate\n\nIssue: Need spare parts immediately\n→ /ordine CODE QTY CLIENT + /risolto "Awaiting parts" → Admin will expedite\n\nIssue: Lost GPS signal\n→ Jobs already assigned will sync when connection returns\n→ You can still work offline (notes saved locally)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('Critical Numbers', 2),
  new Paragraph({
    text: 'Admin (Marcello): Direct Telegram message\nOn-Call Tech: Displayed in app when you open Urgencies\nEmergency Dispatch: +39 XXXX XXXX (in emergency contact section)',
    fontSize: 22,
    spacing: { line: 360 },
  }),

  createHeading('Support', 2),
  new Paragraph({
    text: 'In-App Issue: Chat → @Admin\nTelegram Bot Not Responding: Restart Telegram app\nApp Crashes: Clear cache (Settings → App → Storage → Clear Cache) → Reopen\nPassword Reset: Click "Forgot Password" on login screen',
    fontSize: 22,
    spacing: { line: 360 },
  }),
];

// Generate document
const doc = new Document({
  sections: [{
    properties: {},
    children: sections,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outputPath = path.join(__dirname, '04_Manuale_Tecnico.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Generated: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  process.exit(0);
}).catch(err => {
  console.error('Error generating document:', err);
  process.exit(1);
});
