================================================================================
SYNTONIQA v1.0 - MANUALE TECNICO MOBILE
================================================================================

FILE: 04_Manuale_Tecnico.docx
Created: March 3, 2026
Size: 18,586 bytes (~18.6 KB)
Format: Microsoft Word 2007+ (.docx)
Language: Italian (Italiano)

================================================================================
DOCUMENT OVERVIEW
================================================================================

This professional DOCX manual is a comprehensive guide for technicians using
the Syntoniqa mobile PWA application. It covers all features and workflows
for field service management at MRS Lely Center Emilia Romagna.

COVER PAGE
- Title: SYNTONIQA v1.0 - Manuale Tecnico Mobile
- Subtitle: MRS Lely Center Emilia Romagna
- Version: 1.0, March 2026
- Branding: Red (#C30A14) accent color throughout

TABLE OF CONTENTS
- Auto-generated index of all 15 chapters

================================================================================
CHAPTERS (15 sections, ~30 pages of content)
================================================================================

1. INTRODUZIONE
   - Target audience: field technicians
   - Key app features overview
   - System requirements

2. INSTALLAZIONE PWA
   - Step-by-step PWA installation on Chrome mobile
   - Post-installation setup
   - Troubleshooting installation issues

3. LOGIN E AUTENTICAZIONE
   - Credential entry process
   - Session management (24h JWT)
   - Auto-login functionality
   - Password recovery procedure

4. SCHERMATA HOME
   - Dashboard counters (assigned urgencies, today's interventions, pending orders)
   - Bottom navigation menu explanation
   - Quick action access

5. GESTIONE URGENZE
   - Urgency state machine (Aperta → Assegnata → Schedulata → In Corso → Risolta → Chiusa)
   - Complete workflow with numbered steps
   - SLA escalation rules
   - Details field explanation
   - Notification triggers

6. INTERVENTI PIANIFICATI
   - Intervention states (Pianificato → In Corso → Completato / Annullato)
   - Step-by-step completion workflow
   - Intervention data fields
   - Weekly planning

7. CALENDARIO E REMINDER
   - Calendar view and navigation
   - Color-coded intervention types
   - Automatic reminders
   - Calendar export to Google Calendar

8. MAPPA INTERATTIVA
   - Map visualization with colored pins
   - Filter capabilities (by urgency type, priority, status)
   - Navigation integration
   - Offline map functionality

9. ORDINI RICAMBI
   - New order creation workflow
   - Order states (Richiesto → Confermato → Spedito → Consegnato)
   - Order tracking
   - Notification system

10. CHAT E COMUNICAZIONE
    - Chat channel types (Team, Support, Urgencies, Announcements)
    - Message sending process
    - Attachment support (photos, PDFs)
    - Real-time collaboration

11. NOTIFICHE PUSH
    - Permission setup
    - Notification types table (6 notification categories)
    - Notification center and history
    - Sound customization

12. PROFILO E IMPOSTAZIONI
    - Profile data management
    - Password change process
    - Notification preferences
    - Logout procedure

13. TELEGRAM BOT INTEGRATION
    - Bot setup and activation
    - 8 main commands with examples:
      * /vado - Open urgencies list
      * /incorso - Mark in progress
      * /risolto - Close with notes
      * /stato - Current status
      * /oggi - Today's interventions
      * /settimana - Weekly plan
      * /ordine - Create spare parts order
      * AI Analysis - Free text/photo analysis with Gemini

14. QUICK REFERENCE CARD
    - 12-row summary table of common actions
    - Where to find each action
    - How to execute
    - Telegram shortcuts

15. RISOLUZIONE PROBLEMI (TROUBLESHOOTING)
    - 9 common issues with step-by-step solutions:
      * App loading problems
      * Push notifications not arriving
      * Telegram bot issues
      * Urgency assignment problems
      * Session expiration
      * Map not loading
      * Password recovery
      * Chat performance
      * Order creation issues
    - Support contacts and hours

================================================================================
DOCUMENT FEATURES & FORMATTING
================================================================================

PROFESSIONAL STYLING:
✓ Red accent color (#C30A14) on headings and table headers
✓ Proper heading hierarchy (Heading1, Heading2, Heading3)
✓ OutlineLevel for Table of Contents
✓ Page breaks between major sections
✓ Headers and footers with page numbers
✓ Consistent spacing and margins (1" all around)

TABLES (3 professional tables):
✓ Urgency States Table (6 rows × 3 columns)
✓ Order States Table (5 rows × 3 columns)
✓ Notifications Types Table (6 rows × 3 columns)
✓ Quick Reference Card Table (12 rows × 4 columns)
✓ Proper cell widths with WidthType.DXA
✓ Alternating row colors (striped effect)
✓ White text on red header background

TEXT FORMATTING:
✓ Bullet lists for features and options
✓ Numbered lists for step-by-step procedures
✓ Bold text for emphasis
✓ Italic text for notes
✓ Proper line spacing (1.5x for readability)
✓ Paragraph spacing before/after

PAGE LAYOUT:
✓ US Letter size (8.5" × 11")
✓ 1-inch margins on all sides
✓ Clean separation between chapters
✓ Cover page with centered formatting
✓ Professional footer with document info

================================================================================
TECHNICAL SPECIFICATIONS
================================================================================

Document Format: Office Open XML (.docx)
  - ZIP-based container format
  - All internal validation passed
  - Compatible with Microsoft Word 2007+, LibreOffice, Google Docs

Font: Default theme fonts (Calibri body, Cambria headings)
Color Scheme:
  - Primary Accent: #C30A14 (MRS Lely Red)
  - Text: #333333 (Dark Gray)
  - Highlights: #F5F5F5 (Light Gray)

Section Structure:
  - 1 Main document section with page properties
  - 15 chapter divisions with Page Breaks
  - 90+ paragraphs with proper spacing
  - 4 professional data tables
  - Automatic numbering for lists

Word Count: ~8,500 words
Estimated Page Count: ~25-30 pages when printed/exported

================================================================================
HOW TO USE THIS DOCUMENT
================================================================================

1. OPEN IN WORD:
   - Microsoft Word 2007 or later
   - Google Docs (File > Open > Upload)
   - LibreOffice Writer
   - Any compatible DOCX viewer

2. DISTRIBUTE TO TECHNICIANS:
   - Print to PDF for offline reading
   - Email entire document
   - Convert to ePub for mobile reading
   - Print physical copies (~8 pages double-sided)

3. UPDATE AND MAINTAIN:
   - Edit in Word with all formatting preserved
   - Update version number in document properties
   - Regenerate with updated Node.js script
   - Track changes with Word's revision system

4. EXPORT OPTIONS:
   - PDF: File > Export as PDF
   - ePub: File > Export as ePub
   - Print: Use Print dialog for quality output
   - HTML: Save as Webpage

================================================================================
GENERATION NOTES
================================================================================

Generated with: Node.js 'docx' npm package (v8.11.0+)
Script: generate_manual.js (located in repo root)
Generated: 2026-03-03 08:59 UTC

To regenerate or modify:
  $ npm install docx
  $ node generate_manual.js

All section content is defined in the script and can be easily modified
for future versions, localization, or customization.

================================================================================
SUPPORT & MAINTENANCE
================================================================================

For manual updates, corrections, or new sections:
- Contact: Marcello Bozzarelli (m.bozzarelli)
- Repository: github.com/fieldforcemrser2026/syntoniqa
- Telegram: @SyntoniqaMrsBot

Document Version History:
  v1.0 - Initial release (March 2026)
  
================================================================================
