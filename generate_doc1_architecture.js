const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, VerticalAlign, ShadingType, PageBreak } = require('docx');
const fs = require('fs');

const RED_COLOR = 'C30A14';
const LIGHT_GRAY = 'F5F5F5';

const doc = new Document({
  sections: [{
    pageHeight: 15840,
    pageWidth: 12240,
    margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
    children: [
      // COVER PAGE
      new Paragraph({ text: '', spacing: { line: 480 } }),
      new Paragraph({ text: '', spacing: { line: 480 } }),
      new Paragraph({
        text: 'SOLUTION ARCHITECTURE DOCUMENT',
        alignment: AlignmentType.CENTER,
        fontSize: 32,
        bold: true,
        color: RED_COLOR,
        spacing: { line: 480 },
      }),
      new Paragraph({
        text: 'Syntoniqa v1.0',
        alignment: AlignmentType.CENTER,
        fontSize: 28,
        bold: true,
      }),
      new Paragraph({
        text: 'Field Service Management Platform',
        alignment: AlignmentType.CENTER,
        fontSize: 20,
        spacing: { line: 240 },
      }),
      new Paragraph({ text: '', spacing: { line: 480 } }),
      new Paragraph({
        text: 'MRS Lely Center Emilia Romagna',
        alignment: AlignmentType.CENTER,
        fontSize: 18,
        bold: true,
        color: RED_COLOR,
      }),
      new Paragraph({
        text: 'March 2026 | Version 1.0',
        alignment: AlignmentType.CENTER,
        fontSize: 14,
        color: '999999',
        spacing: { line: 240 },
      }),
      new PageBreak(),

      // TABLE OF CONTENTS
      new Paragraph({
        text: 'TABLE OF CONTENTS',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '1. Executive Summary', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '2. Architecture Overview', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '3. Frontend Architecture', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '4. Backend (Cloudflare Worker)', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '5. Database Schema (22 Tables)', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '6. State Machines', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '7. Authentication & Authorization', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '8. External Integrations', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '9. Cron Jobs & Scheduled Tasks', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '10. Security Architecture', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '11. Deployment Architecture', fontSize: 14, spacing: { line: 180 } }),
      new Paragraph({ text: '12. White-Label & Multi-Tenant', fontSize: 14, spacing: { line: 180 } }),
      new PageBreak(),

      // 1. EXECUTIVE SUMMARY
      new Paragraph({
        text: '1. Executive Summary',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'Syntoniqa v1.0 is a zero-framework, Progressive Web Application (PWA) Field Service Management (FSM) platform engineered for MRS Lely Center Emilia Romagna. It delivers complete digital workflows for managing Lely robot maintenance, emergencies, spare parts orders, and technician coordination across the Emilia-Romagna region.',
        fontSize: 13,
        spacing: { line: 240 },
      }),
      new Paragraph({
        text: 'Key Statistics:',
        fontSize: 13,
        bold: true,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: '10,726 lines of production code', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: '3 core files: frontend (2 SPAs) + backend worker', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: '89 POST endpoints + 8 GET endpoints', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: '2 cron jobs executing every 15 minutes', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: '22 PostgreSQL tables with soft-delete and audit trail', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: 'Multi-tenant architecture with white-label support', fontSize: 12, spacing: { line: 240 } }),
      new Paragraph({
        text: 'Technology Foundation:',
        fontSize: 13,
        bold: true,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: 'Frontend: HTML5 + Leaflet (maps) + Chart.js (analytics) + SheetJS (Excel)', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: 'Backend: Cloudflare Workers (serverless, zero-dependency)', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: 'Database: Supabase PostgreSQL with 70+ geocoded locations', fontSize: 12, spacing: { line: 100 } }),
      new Paragraph({ text: 'Integrations: Telegram Bot, Resend Email, Web Push, Google Gemini AI', fontSize: 12, spacing: { line: 240 } }),
      new PageBreak(),

      // 2. ARCHITECTURE OVERVIEW
      new Paragraph({
        text: '2. Architecture Overview',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'Three-tier Progressive Web Architecture:',
        fontSize: 13,
        spacing: { line: 200 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            height: { value: 400, rule: 'auto' },
            cells: [
              new TableCell({
                children: [new Paragraph({ text: 'Tier', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 18, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Component', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 28, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Technology', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Details', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: 'Presentation', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 18, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Admin SPA', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 28, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'HTML5/CSS/JS', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: '5548 lines, 33 sections', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: '', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 18, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Mobile PWA', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 28, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'HTML5/CSS/JS', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: '2071 lines, 17 pages', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: 'Application', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 18, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Backend API', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 28, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Cloudflare Workers', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: '3042 lines, edge compute', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: 'Data', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 18, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Database', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 28, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'PostgreSQL', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Supabase hosted, 22 tables', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 27, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '', spacing: { line: 240 } }),
      new PageBreak(),

      // 3. FRONTEND ARCHITECTURE
      new Paragraph({
        text: '3. Frontend Architecture',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 160 } }),
      new Paragraph({
        text: '3.1 Admin Dashboard (admin_v1.html, 5548 lines)',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 120 } }),
      new Paragraph({
        text: 'Single-page application providing complete system administration.',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Capabilities:',
        fontSize: 12,
        bold: true,
        spacing: { line: 120 },
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
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 120 } }),
      new Paragraph({
        text: 'Responsive field worker application with offline capability.',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Features:',
        fontSize: 12,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({ text: '17 responsive pages', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Bottom navigation menu', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Real-time map with location tracking', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Web Push notifications', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Installable PWA manifest', fontSize: 11, spacing: { line: 160 } }),
      new Paragraph({
        text: '3.3 White-Label Configuration (white_label_config.js, 65 lines)',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 120 } }),
      new Paragraph({
        text: 'Centralized tenant configuration for multi-tenant deployments.',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({ text: 'Brand colors, logo, company name', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'API endpoint URLs and authentication tokens', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'Feature toggles (Telegram, AI, orders, installations)', fontSize: 11, spacing: { line: 80 } }),
      new Paragraph({ text: 'PWA manifest settings', fontSize: 11, spacing: { line: 160 } }),
      new PageBreak(),

      // 4. BACKEND
      new Paragraph({
        text: '4. Backend (Cloudflare Worker, 3042 lines)',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'Serverless compute layer with zero runtime dependencies.',
        fontSize: 13,
        spacing: { line: 200 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: 'Lines', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 15, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Component', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 32, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Responsibility', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 53, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: '1-80', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 15, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'CORS & Helpers', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 32, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'CORS headers, response builders (json/ok/err)', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 53, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: '80-200', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 15, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Transform Helpers', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 32, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'PascalCase ↔ snake_case, normalizeBody, getFields', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 53, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: '250-400', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 15, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'handleGet', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 32, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: '8 GET endpoints (getAll, getById, filters)', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 53, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: '400-1600', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 15, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'handlePost', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 32, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: '89 POST endpoints (CRUD + state transitions)', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 53, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: '1600-1800', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 15, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Telegram Webhook', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 32, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Message handler, Gemini AI media analysis', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
                width: { size: 53, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: '2600-3042', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 15, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Cron Jobs', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 32, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'checkInterventoReminders, checkSLAUrgenze (*/15min)', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                width: { size: 53, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '', spacing: { line: 240 } }),
      new Paragraph({
        text: 'Critical Design Patterns:',
        fontSize: 12,
        bold: true,
        spacing: { line: 120 },
      }),
      new Paragraph({ text: 'normalizeBody(): POST payloads → snake_case for DB consistency', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'pascalizeRecord(): DB records → PascalCase for frontend', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'Mutable global CORS: updated per-request for origin validation', fontSize: 11, spacing: { line: 100 } }),
      new Paragraph({ text: 'State machine validation: prevents invalid workflow transitions', fontSize: 11, spacing: { line: 200 } }),
      new PageBreak(),

      // 5. DATABASE SCHEMA
      new Paragraph({
        text: '5. Database Schema (22 PostgreSQL Tables)',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'Hosted on Supabase (sajzbanhkehkkhhgztkq.supabase.co)',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: 'Table', bold: true, color: 'FFFFFF', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 18, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Purpose', bold: true, color: 'FFFFFF', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 38, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Primary Key', bold: true, color: 'FFFFFF', fontSize: 10 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 44, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'utenti', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Technicians & Admins', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (TEC_xxx, USR001)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'clienti', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Farms/Customers', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (CLI_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'macchine', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Lely Robots', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (MAC_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'piano', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Scheduled Interventions', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (INT_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'urgenze', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Emergencies', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (URG_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'ordini', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Spare Parts Orders', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (ORD_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'automezzi', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Service Vans', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (FURG_x)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'notifiche', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'In-app Notifications', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (NOT_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'chat_canali', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Chat Channels', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (CH_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'reperibilita', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'On-Call Schedules', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (REP_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'trasferte', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 18, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Business Trips', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 38, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'id (TRA_xxx)', fontSize: 10 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 44, type: WidthType.PERCENTAGE } }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '', spacing: { line: 160 } }),
      new Paragraph({
        text: 'All 22 tables include: tenant_id, obsoleto (soft delete), created_at, updated_at',
        fontSize: 11,
        spacing: { line: 200 },
      }),
      new PageBreak(),

      // 6. STATE MACHINES
      new Paragraph({
        text: '6. State Machines',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 160 } }),
      new Paragraph({
        text: '6.1 Piano (Scheduled Intervention) States',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({
        text: 'pianificato → in_corso → completato (terminal)',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'annullato → pianificato (reschedule)',
        fontSize: 11,
        spacing: { line: 160 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: '6.2 Urgenza (Emergency) States',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({
        text: 'aperta → assegnata → schedulata → in_corso → risolta → chiusa (terminal)',
        fontSize: 11,
        spacing: { line: 100 },
        indent: { left: 240 },
      }),
      new Paragraph({
        text: 'Reject paths: assegnata ⇄ aperta, schedulata ⇄ aperta',
        fontSize: 11,
        spacing: { line: 200 },
        indent: { left: 240 },
      }),
      new PageBreak(),

      // 7. AUTHENTICATION
      new Paragraph({
        text: '7. Authentication & Authorization',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'JWT tokens with 24-hour expiry. Admin login: m.bozzarelli with bcrypt-hashed password.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cells: [
              new TableCell({
                children: [new Paragraph({ text: 'Role', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 22, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: 'Permissions', bold: true, color: 'FFFFFF', fontSize: 11 })],
                shading: { type: ShadingType.CLEAR, fill: RED_COLOR },
                width: { size: 78, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'Admin', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 22, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Full CRUD on all entities, user management, reports', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 78, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'Senior Tech', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 22, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Read interventions, update own, manage junior technicians', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 78, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'Technician', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 22, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Read own interventions, update own status, view map', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY }, width: { size: 78, type: WidthType.PERCENTAGE } }),
            ],
          }),
          new TableRow({
            cells: [
              new TableCell({ children: [new Paragraph({ text: 'Viewer', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 22, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ text: 'Read-only access to reports and dashboards', fontSize: 11 })], shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, width: { size: 78, type: WidthType.PERCENTAGE } }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '', spacing: { line: 240 } }),
      new PageBreak(),

      // 8. INTEGRATIONS
      new Paragraph({
        text: '8. External Integrations',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'Telegram Bot',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({
        text: 'Webhook-based with 7 commands: /vado, /incorso, /risolto, /ordine, /oggi, /settimana, /stato. Includes Gemini AI media analysis for photo inspection.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Email (Resend API)',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({
        text: 'Transactional emails for emergency alerts, intervention reminders, SLA breaches, order updates.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'Web Push Notifications',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({
        text: 'Service worker sends push for new assignments, 24h reminders, SLA escalations, chat messages.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new PageBreak(),

      // 9. CRON JOBS
      new Paragraph({
        text: '9. Cron Jobs (Every 15 Minutes)',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'checkInterventoReminders():',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({
        text: 'Monitors tomorrow unassigned interventions, late interventions (past date, not completed), stale orders (>7d in requested state).',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({
        text: 'checkSLAUrgenze():',
        heading: HeadingLevel.HEADING_2,
        color: RED_COLOR,
        fontSize: 18,
        bold: true,
      }),
      new Paragraph({
        text: 'Calculates SLA expiry, updates sla_stato (ok → warning → critical → breach), escalates if assigned >4h without start.',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new PageBreak(),

      // 10. SECURITY
      new Paragraph({
        text: '10. Security',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'CORS Whitelist: fieldforcemrser2026.github.io, app.syntoniqa.app, localhost (dev)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Token Auth: X-Token header (POST) or ?token query (GET)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Input Sanitization: normalizeBody() removes unexpected fields, validates types',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Soft Delete: obsoleto flag preserves all data, workflow_log tracks all changes with user/timestamp/old-new values',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new PageBreak(),

      // 11. DEPLOYMENT
      new Paragraph({
        text: '11. Deployment',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
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
        text: 'Frontend: git push origin main → GitHub Pages (https://fieldforcemrser2026.github.io/syntoniqa/)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Database: Supabase PostgreSQL (sajzbanhkehkkhhgztkq.supabase.co) with automated daily backups',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new PageBreak(),

      // 12. WHITE-LABEL
      new Paragraph({
        text: '12. Multi-Tenant & White-Label',
        heading: HeadingLevel.HEADING_1,
        color: RED_COLOR,
        fontSize: 24,
        bold: true,
      }),
      new Paragraph({ text: '', spacing: { line: 200 } }),
      new Paragraph({
        text: 'Tenant Isolation: tenant_id in all tables, queries filtered by env.TENANT_ID',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Current Tenant: 785d94d0-b947-4a00-9c4e-3b67833e7045 (MRS Lely Center)',
        fontSize: 12,
        spacing: { line: 160 },
      }),
      new Paragraph({
        text: 'Configuration: white_label_config.js controls brand, colors, API endpoints, feature toggles, PWA manifest',
        fontSize: 12,
        spacing: { line: 200 },
      }),
      new Paragraph({ text: '', spacing: { line: 300 } }),
      new Paragraph({
        text: 'Syntoniqa v1.0 is production-ready, scalable, and fully documented.',
        fontSize: 14,
        bold: true,
        color: RED_COLOR,
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
