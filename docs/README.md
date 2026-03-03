# Syntoniqa v1.0 — Documentazione Tecnica

Repository di documentazione ufficiale per Syntoniqa v1.0, PWA per field service management per MRS Lely Center Emilia Romagna.

## File Disponibili

| # | Titolo | Tipo | Destinatario | Pagine | Data |
|---|--------|------|-------------|--------|------|
| 01 | Executive Deck | PowerPoint | C-Level, Management | ~20 | 2026-03-03 |
| 02 | Architecture (Animated) | HTML | Architects, Tech Leads | 1 | 2026-03-03 |
| 03 | Manuale Admin | DOCX | Amministratori | 26 | 2026-03-03 |
| 04 | Manuale Tecnico | DOCX | Tecnici sul Campo | 25+ | 2026-03-03 |
| 05 | Solution Architecture | DOCX | Technical Stakeholders | 18 | 2026-03-03 |
| 06 | API Reference | HTML | Backend Developers | 1 | 2026-03-03 |
| 08 | UAT Report | DOCX | QA Team, Stakeholders | 15 | 2026-03-03 |

## Guida Rapida per Utenti

### Se sei un Tecnico sul Campo
**Leggi:** [04_Manuale_Tecnico.docx](04_Manuale_Tecnico.docx)

Questo manuale copre:
- Installazione PWA su iOS e Android
- Login e gestione profilo
- Urgenze e interventi pianificati
- Chat team, notifiche, ordini ricambi
- Bot Telegram con 18+ comandi
- Quick reference card e troubleshooting

**Tempo lettura:** 30-45 minuti

### Se sei un Amministratore
**Leggi:** [03_Manuale_Admin.docx](03_Manuale_Admin.docx)

Questo manuale copre:
- Dashboard admin (admin_v1.html)
- Gestione utenti, clienti, macchine
- Configurazione SLA e automezzi
- Report e KPI
- Telegram webhook e integrazioni

**Tempo lettura:** 1-2 ore

### Se sei un Architetto/Developer
**Leggi:** [05_Solution_Architecture_Document.docx](05_Solution_Architecture_Document.docx) + [06_API_Reference.html](06_API_Reference.html)

Copertura:
- Architettura sistema (3-tier: Frontend, Worker, DB)
- Cloudflare Workers deployment
- Supabase PostgreSQL schema (22 tabelle)
- API endpoints (8 GET + 89 POST)
- Cron jobs e Telegram bot flow
- Security, CORS, state machines

**Tempo lettura:** 2-3 ore

### Se sei Management
**Guarda:** [01_Executive_Deck.pptx](01_Executive_Deck.pptx)

Slide overview:
- Business case
- Key metrics
- Team structure
- Timeline
- ROI

**Tempo vista:** 15-20 minuti

## Installazione Offline

Per consultare questi documenti offline:

1. **DOCX (Word):** Scarica il file e apri con Microsoft Word, Google Docs, o LibreOffice
2. **HTML:** Scarica il file e apri con browser (chrome, safari, edge)
3. **PPTX (PowerPoint):** Scarica il file e apri con Office, Google Slides, o LibreOffice Impress

## Aggiornamenti

Questi documenti vengono aggiornati regolarmente. Per la versione più recente:

```bash
cd /sessions/brave-peaceful-lovelace/mnt/Syntoniqa_repo
git pull origin main
ls -la docs/
```

Per rigenerare il manuale tecnico:

```bash
node /sessions/brave-peaceful-lovelace/create_tech_manual.js
```

## Supporto

- **Domande Tecniche:** Contatta il team dev (Marcello)
- **Problemi con l'app:** Vedi troubleshooting nel manuale tecnico
- **Accesso Doc:** Richiedi credenziali GitHub al repository

## Metadata

- **Versione:** Syntoniqa v1.0
- **Organizzazione:** MRS Lely Center Emilia Romagna
- **Lingua:** Italiano
- **Ultimo aggiornamento:** 3 Marzo 2026
- **Repository:** https://github.com/fieldforcemrser2026/syntoniqa
- **Codice:** 10.726 righe | 59 commit | Zero framework

---

**Nota:** Questi documenti sono propietari di MRS Lely Center. Distribuzione riservata solo al team interno e partner autorizzati.
