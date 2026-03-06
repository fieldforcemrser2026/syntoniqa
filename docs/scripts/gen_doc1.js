const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, VerticalAlign, ShadingType, PageBreak } = require('docx');
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
        text: 'SOLUTION ARCHITECTURE DOCUMENT',
        alignment: AlignmentType.CENTER,
        fontSize: 32,
        bold: true,
        color: RED,
        spacing: { line: 480 },
      }),
      new Paragraph({
        text: 'Syntoniqa v1.0 - Field Service Management',
        alignment: AlignmentType.CENTER,
        fontSize: 20,
        bold: true,
        spacing: { line: 240 },
      }),
      new Paragraph({
        text: 'MRS Lely Center Emilia Romagna | March 2026',
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
      new Paragraph({ text: '1. Executive Summary', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '2. Architecture Overview', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '3. Frontend Architecture', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '4. Backend (Cloudflare Worker)', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '5. Database Schema (22 Tables)', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '6. State Machines', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '7. Authentication & Authorization', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '8. External Integrations', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '9. Cron Jobs (Every 15 Minutes)', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '10. Security Architecture', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '11. Deployment & Operations', fontSize: 13, spacing: { line: 160 } }),
      new Paragraph({ text: '12. Multi-Tenant & White-Label', fontSize: 13, spacing: { line: 160 } }),
      new PageBreak(),

      new Paragraph({
        text: '1. Executive Summary',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Syntoniqa v1.0 is a zero-framework, Progressive Web Application (PWA) Field Service Management (FSM) platform engineered for MRS Lely Center Emilia Romagna. It delivers complete digital workflows for managing Lely robot maintenance, emergencies, spare parts orders, and technician coordination across the Emilia-Romagna region.',
        fontSize: 12,
        spacing: { line: 240 },
      }),
      new Paragraph({
        text: 'Key Metrics:',
        fontSize: 12,
        bold: true,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: '10,726 lines of production code', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: '3 core files (2 SPAs frontend + 1 worker backend)', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: '89 POST endpoints + 8 GET endpoints', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: '2 cron jobs executing every 15 minutes', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: '22 PostgreSQL tables with soft-delete and audit', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Multi-tenant with white-label support', fontSize: 11, spacing: { line: 200 } }),
      new Paragraph({
        text: 'Technology Stack:',
        fontSize: 12,
        bold: true,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: 'Frontend: HTML5 + Leaflet (maps) + Chart.js (analytics) + SheetJS (Excel)', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Backend: Cloudflare Workers (serverless, zero-dependency)', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Database: Supabase PostgreSQL with 70+ geocoded locations', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Integrations: Telegram Bot, Resend Email, Web Push, Google Gemini AI', fontSize: 11, spacing: { line: 200 } }),

      new PageBreak(),

      new Paragraph({
        text: '2. Architecture Overview',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Three-tier Progressive Web Architecture:',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'Tier', bold: true, color: 'FFFFFF', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Component', bold: true, color: 'FFFFFF', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 28, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Technology', bold: true, color: 'FFFFFF', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 27, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Details', bold: true, color: 'FFFFFF', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 27, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'Presentation', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Admin SPA', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 28, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'HTML5/CSS/JS', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 27, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '5548 lines, 33 sections', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 27, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: '', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Mobile PWA', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 28, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'HTML5/CSS/JS', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 27, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '2071 lines, 17 pages', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 27, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'Application', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Backend API', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 28, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Cloudflare Workers', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 27, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '3042 lines, edge compute', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 27, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'Data', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Database', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 28, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'PostgreSQL', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 27, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Supabase, 22 tables', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 27, type: WidthType.PERCENTAGE } }),
          ]),
        ],
      }),

      new Paragraph({ text: '', spacing: { line: 240 } }),
      new PageBreak(),

      new Paragraph({
        text: '3. Frontend Architecture',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: '3.1 Admin Dashboard (admin_v1.html, 5548 lines)',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Single-page application providing complete system administration for all entities.',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: '33 management sections for all entities', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: '17 modal dialogs for CRUD operations', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Real-time Leaflet map with 70+ geocoded locations', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Chart.js KPI dashboard with 7-day snapshots', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'SheetJS Excel bulk import/export', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Dark mode with CSS variables', fontSize: 11, spacing: { line: 160 } }),

      new Paragraph({
        text: '3.2 Mobile PWA (index_v2.html, 2071 lines)',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Responsive field worker application designed for offline capability and real-time connectivity.',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: '17 responsive pages for field workflows', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Bottom navigation menu for quick access', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Real-time map with technician location tracking', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Web Push notifications', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Installable PWA manifest for home screen', fontSize: 11, spacing: { line: 160 } }),

      new Paragraph({
        text: '3.3 White-Label Configuration (white_label_config.js)',
        heading: HeadingLevel.HEADING_2,
        color: RED,
        fontSize: 18,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({
        text: 'Centralized configuration (65 lines) for multi-tenant deployments:',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: 'Brand colors, logo, company name', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'API endpoint URLs and authentication tokens', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Feature toggles (Telegram, AI, orders, installations)', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'PWA manifest and installation settings', fontSize: 11, spacing: { line: 200 } }),

      new PageBreak(),

      new Paragraph({
        text: '4. Backend (Cloudflare Worker, 3042 lines)',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Serverless compute layer with zero runtime dependencies.',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'Lines', bold: true, color: 'FFFFFF', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Component', bold: true, color: 'FFFFFF', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Responsibility', bold: true, color: 'FFFFFF', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 53, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: '1-80', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'CORS & Helpers', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'CORS headers, response builders (json/ok/err)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 53, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: '80-200', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Transform', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'PascalCase ↔ snake_case, normalizeBody, getFields', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 53, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: '250-400', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'handleGet', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '8 GET endpoints (getAll, getById, filters)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 53, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: '400-1600', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'handlePost', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: '89 POST endpoints (CRUD + state transitions)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 53, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: '1600-1800', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Telegram', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Webhook handler, Gemini AI media analysis', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 53, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: '2600-3042', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 15, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Cron Jobs', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 32, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'checkInterventoReminders, checkSLAUrgenze (*/15min)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 53, type: WidthType.PERCENTAGE } }),
          ]),
        ],
      }),

      new Paragraph({ text: '', spacing: { line: 160 } }),
      new Paragraph({
        text: 'Critical Design Patterns:',
        fontSize: 12,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({ text: 'normalizeBody(): POST payloads → snake_case for DB consistency', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'pascalizeRecord(): DB records → PascalCase for frontend', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Mutable global CORS: updated per-request for origin validation', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'State machine validation: prevents invalid workflow transitions', fontSize: 11, spacing: { line: 200 } }),

      new PageBreak(),

      new Paragraph({
        text: '5. Database Schema (22 PostgreSQL Tables)',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Hosted on Supabase (sajzbanhkehkkhhgztkq.supabase.co)',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'Table', bold: true, color: 'FFFFFF', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Purpose', bold: true, color: 'FFFFFF', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Primary Key', bold: true, color: 'FFFFFF', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: RED }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'utenti', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Technicians & Admins', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (TEC_xxx, USR001)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'clienti', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Farms/Customers', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (CLI_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'macchine', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Lely Robots', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (MAC_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'piano', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Scheduled Interventions', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (INT_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'urgenze', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Emergencies', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (URG_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'ordini', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Spare Parts Orders', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (ORD_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'automezzi', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Service Vans', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (FURG_x)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'chat_canali', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Chat Channels', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (CH_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
          createTableRow([
            new TableCell({ children: [new Paragraph({ text: 'workflow_log', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'Audit Trail', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: 'id (auto)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
          ]),
        ],
      }),

      new Paragraph({ text: '', spacing: { line: 160 } }),
      new Paragraph({
        text: 'Standard columns on all tables: tenant_id, obsoleto (soft delete), created_at, updated_at',
        fontSize: 11,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '6. State Machines',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Piano (Intervention): pianificato → in_corso → completato | annullato ↔ pianificato',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Urgenza (Emergency): aperta → assegnata → schedulata → in_corso → risolta → chiusa (terminal)',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '7. Authentication & Authorization',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'JWT tokens (24h expiry). Admin: m.bozzarelli with bcrypt-hashed password. Five roles: Admin, Senior Tech, Technician, Viewer, Bot.',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '8. External Integrations',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Telegram Bot (webhook, 7 commands: /vado, /incorso, /risolto, /ordine, /oggi, /settimana, /stato). Includes Gemini AI media analysis.',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Email (Resend API): emergency alerts, intervention reminders, SLA breaches, order updates.',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Web Push: new assignments, 24h reminders, SLA escalations, chat messages.',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '9. Cron Jobs (Every 15 Minutes)',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'checkInterventoReminders(): monitors tomorrow unassigned interventions, late interventions, stale orders (>7d).',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'checkSLAUrgenze(): calculates SLA expiry, updates sla_stato (ok → warning → critical → breach), escalates if assigned >4h without start.',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '10. Security Architecture',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'CORS whitelist: fieldforcemrser2026.github.io, app.syntoniqa.app, localhost (dev)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Token auth: X-Token header (POST), ?token query (GET)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Input sanitization: normalizeBody() validates types and removes unexpected fields',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Soft delete: obsoleto flag preserves all data. workflow_log tracks all changes with user/timestamp/old-new values.',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '11. Deployment & Operations',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Backend: CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Worker URL: https://syntoniqa-mrs-api.fieldforcemrser.workers.dev',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Frontend: git push origin main → automatic GitHub Pages deployment',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Database: Supabase PostgreSQL with automated daily backups',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new PageBreak(),

      new Paragraph({
        text: '12. Multi-Tenant & White-Label',
        heading: HeadingLevel.HEADING_1,
        color: RED,
        fontSize: 24,
        bold: true,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Tenant isolation: all tables include tenant_id, all queries filtered by env.TENANT_ID',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Current tenant: 785d94d0-b947-4a00-9c4e-3b67833e7045 (MRS Lely Center)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'White-label config: brand colors, API endpoints, feature toggles, PWA manifest',
        fontSize: 12,
        spacing: { line: 200 },
      }),

      new Paragraph({ text: '', spacing: { line: 400 } }),
      new Paragraph({
        text: 'Syntoniqa v1.0 is production-ready, scalable, and fully documented.',
        fontSize: 14,
        bold: true,
        color: RED,
        alignment: AlignmentType.CENTER,
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/brave-peaceful-lovelace/mnt/Syntoniqa_repo/docs/05_Solution_Architecture_Document.docx', buffer);
  console.log('FILE 1 COMPLETE: 05_Solution_Architecture_Document.docx');
  process.exit(0);
});
