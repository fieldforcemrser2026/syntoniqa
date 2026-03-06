const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, ShadingType, PageBreak } = require('docx');
const fs = require('fs');

const RED = 'C30A14';
const GRAY = 'F5F5F5';

function createTableRow(cells) {
  return new TableRow({ children: cells });
}

const doc = new Document({
  sections: [{
    pageHeight: 15840,
    pageWidth: 12240,
    margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
    children: [
      new Paragraph({
        text: 'DEPLOYMENT RUNBOOK',
        alignment: AlignmentType.CENTER,
        fontSize: 32,
        bold: true,
        color: RED,
        spacing: { line: 480 },
      }),
      new Paragraph({
        text: 'Syntoniqa v1.0',
        alignment: AlignmentType.CENTER,
        fontSize: 20,
        bold: true,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Operational Guide for Cloud Deployment',
        alignment: AlignmentType.CENTER,
        fontSize: 14,
        color: '666666',
        spacing: { line: 480 },
      }),
      new PageBreak(),

      new Paragraph({
        text: 'TABLE OF CONTENTS',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({ text: '1. Prerequisites', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '2. Environment Variables & Secrets', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '3. Backend Deployment (Cloudflare Workers)', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '4. Frontend Deployment (GitHub Pages)', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '5. Database Setup & Migrations', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '6. Telegram Bot Configuration', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '7. New Tenant Setup', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '8. CI/CD Pipeline', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '9. Monitoring & Logs', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '10. Rollback Procedures', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '11. Backup & Disaster Recovery', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '12. Troubleshooting', fontSize: 13, spacing: { line: 160 } }),
      new PageBreak(),

      new Paragraph({
        text: '1. Prerequisites',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Before deploying Syntoniqa v1.0, ensure you have:',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: 'Cloudflare account with Workers enabled', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Supabase project created and initialized', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'GitHub repository with admin access', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Telegram Bot Token (created via BotFather)', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Resend API key for email delivery', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Google Gemini API key for AI features', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Node.js v16+ and npm installed locally', fontSize: 11, spacing: { line: 200 } }),

      new PageBreak(),

      new Paragraph({
        text: '2. Environment Variables & Secrets',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Set these variables in Cloudflare Workers Dashboard (Settings > Variables):',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'Variable Name', bold: true, color: 'FFFFFF', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Value', bold: true, color: 'FFFFFF', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'SUPABASE_URL', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'https://sajzbanhkehkkhhgztkq.supabase.co', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'SUPABASE_SERVICE_KEY', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '<service_role_key_from_supabase>', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'SQ_TOKEN', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '<unique_api_token_for_authentication>', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'GEMINI_KEY', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '<google_gemini_api_key>', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'TELEGRAM_BOT_TOKEN', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '<bot_token_from_botfather>', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'RESEND_API_KEY', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '<resend_email_api_key>', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'TENANT_ID', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '785d94d0-b947-4a00-9c4e-3b67833e7045', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 70, type: WidthType.PERCENTAGE } }),
          ]),
        ],
      }),

      new Paragraph({ text: '', spacing: { line: 240 } }),
      new PageBreak(),

      new Paragraph({
        text: '3. Backend Deployment (Cloudflare Workers)',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Step 1: Install Wrangler CLI',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'npm install -g wrangler',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Step 2: Authenticate with Cloudflare',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'wrangler login',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Step 3: Deploy Worker',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'CLOUDFLARE_API_TOKEN=<your_token> npx wrangler deploy',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Worker is now live at: https://syntoniqa-mrs-api.fieldforcemrser.workers.dev',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '4. Frontend Deployment (GitHub Pages)',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'GitHub Pages automatically deploys when you push to the main branch.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Step 1: Commit changes',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'git add admin_v1.html index_v2.html white_label_config.js',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'git commit -m "feat: update frontend"',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Step 2: Push to GitHub',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'git push origin main',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Frontend is now live at: https://fieldforcemrser2026.github.io/syntoniqa/',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '5. Database Setup & Migrations',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Log in to Supabase dashboard and create all 22 tables with proper schemas.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Core Tables:',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({ text: 'utenti (users: ID, name, email, role, password_hash)', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'clienti (customers: ID, name, address, lat, lng)', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'macchine (robots: ID, client_id, model, serial)', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'piano (interventions: ID, date, client_id, state)', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'urgenze (emergencies: ID, state, assigned_to, sla_stato)', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'ordini (orders: ID, state, created_date)', fontSize: 11, spacing: { line: 200 } }),
      new Paragraph({
        text: 'Enable Row Level Security (RLS) for all tables to enforce tenant_id isolation.',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '6. Telegram Bot Configuration',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Step 1: Create Bot via BotFather',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Chat with @BotFather on Telegram, use /newbot to create a new bot. Save the token.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Step 2: Register Webhook',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'POST https://api.telegram.org/bot<TOKEN>/setWebhook',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Body: {"url":"https://syntoniqa-mrs-api.fieldforcemrser.workers.dev/telegram"}',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Step 3: Create Admin Group',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Create a new Telegram group, add the bot with admin permissions. Note the group chat ID (negative number). Update env.TELEGRAM_GROUP_CHAT with this ID.',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '7. New Tenant Setup',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'To onboard a new tenant/organization:',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: '1. Generate unique UUID for tenant',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: '2. Insert into Supabase config table with tenant_id',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: '3. Create white_label_config.js entry with tenant branding',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: '4. Set TENANT_ID environment variable in CF Workers',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: '5. Seed initial data (users, clients, machines, etc)',
        fontSize: 11,
        spacing: { line: 200 } }),

      new PageBreak(),

      new Paragraph({
        text: '8. CI/CD Pipeline',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'GitHub Actions workflow for automatic deployment on push to main:',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: '1. Run tests (if automated tests exist)',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: '2. Deploy backend: wrangler deploy',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: '3. Frontend auto-deploys via GitHub Pages on commit',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: '4. Health check: GET /health from deployed worker',
        fontSize: 11,
        spacing: { line: 200 } }),

      new PageBreak(),

      new Paragraph({
        text: '9. Monitoring & Logs',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Monitor Cloudflare Workers Analytics:',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Workers Dashboard > Analytics & Logs',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Check request counts, error rates, response times',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Monitor Supabase:',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Project > Reports for query performance',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Auth tab for login attempts and 2FA',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Observe Cron Jobs:',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Check worker logs for checkInterventoReminders, checkSLAUrgenze execution',
        fontSize: 11,
        spacing: { line: 200 },
        indent: { left: 240 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '10. Rollback Procedures',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Backend Rollback:',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'wrangler rollback',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Frontend Rollback:',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'git revert <commit_hash>',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'git push origin main',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Database Rollback:',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Supabase > Backups > Restore from automated backup',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '11. Backup & Disaster Recovery',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Supabase automated backups: Daily at 2am UTC, retention 30 days',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Manual pg_dump export:',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'pg_dump -h <host> -U postgres <database> > backup.sql',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Store backups securely (AWS S3, Google Drive, etc)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Test restore procedure monthly',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '12. Troubleshooting',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Worker 500 Error',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Check Cloudflare Workers logs for JavaScript errors',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: 'Verify all environment variables are set',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: 'Test token validation: ensure X-Token header matches SQ_TOKEN',
        fontSize: 11,
        spacing: { line: 160 } }),
      new Paragraph({
        text: 'Database Connection Issues',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Verify SUPABASE_URL and SUPABASE_SERVICE_KEY in CF Workers',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: 'Check Supabase project status in dashboard',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: 'Test connection with psql command line',
        fontSize: 11,
        spacing: { line: 160 } }),
      new Paragraph({
        text: 'Telegram Bot Not Responding',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Verify webhook URL is correct: getWebhook API',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: 'Check bot token in TELEGRAM_BOT_TOKEN variable',
        fontSize: 11,
        spacing: { line: 80 } }),
      new Paragraph({
        text: 'Test webhook manually with curl and sample payload',
        fontSize: 11,
        spacing: { line: 200 } }),

      new Paragraph({ text: '', spacing: { line: 400 } }),
      new Paragraph({
        text: 'Deployment Complete. Monitor system health and logs regularly.',
        fontSize: 14,
        bold: true,
        color: RED,
        alignment: AlignmentType.CENTER,
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/brave-peaceful-lovelace/mnt/Syntoniqa_repo/docs/07_Deployment_Runbook.docx', buffer);
  console.log('FILE 2 COMPLETE: 07_Deployment_Runbook.docx');
  process.exit(0);
});
