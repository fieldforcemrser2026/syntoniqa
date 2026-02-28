/**
 * SYNTONIQA v1.0 — White Label Configuration
 * Modifica questo file per personalizzare il brand per ogni cliente.
 * NON modificare i file HTML — usa solo questo config.
 */

window.SYNTONIQA_CONFIG = {

  // ─── BRAND IDENTITY ─────────────────────────────────────────────
  brand: {
    nome:       'MRS Lely Center Emilia Romagna',
    tagline:    'Lely Center — Field Service',
    logo_url:   '',                    // URL logo PNG (lascia vuoto per usare initiali)
    logo_alt:   'MRS Lely Center Logo',
    initiali:   'MRS',
    versione:   'v1.0',
  },

  // ─── PALETTE COLORI (Lely Brand Guidelines) ─────────────────────
  colors: {
    primary:    '#C30A14',   // Lely Red – bottoni, link attivi, accenti principali
    primary2:   '#A00810',   // Lely Red scuro – hover bottoni
    secondary:  '#3B7EF7',   // Blu indigo – accento secondario
    bg:         '#050505',   // Sfondo principale (Lely Black)
    surface:    '#1A1A1A',   // Superfici (sidebar, header)
    card:       '#2A2A2A',   // Sfondo card e pannelli
    border:     '#3A3A3A',   // Bordi e separatori
    text:       '#F5F5F5',   // Testo principale
    textSec:    '#B0B0B0',   // Testo secondario/muted
  },

  // ─── API ENDPOINT ────────────────────────────────────────────────
  api: {
    url:        'https://syntoniqa-mrs-api.fieldforcemrser.workers.dev',
    token:      'SQ_2026_MRS_88FNJz0TFbdzHMikOeN2HQ',
    timeout_ms: 10000,
  },

  // ─── FEATURE TOGGLE ─────────────────────────────────────────────
  // false = sezione nascosta dalla sidebar
  features: {
    telegram:      true,    // Configurazione Telegram Bot
    ai_planner:    true,    // AI Planner con Gemini
    ordini:        true,    // Modulo ordini ricambi
    installazioni: true,    // Gestione installazioni
    reperibilita:  true,    // Turni di reperibilità
    trasferte:     true,    // Gestione trasferte
    power_bi:      false,   // Export Power BI (richiede setup aggiuntivo)
    pagellini:     true,    // Valutazioni tecnici
    mappa:         true,    // Mappa operativa Leaflet
    kpi:           true,    // Dashboard KPI avanzata
    checklist:     true,    // Checklist interventi
    documenti:     true,    // Gestione documenti
    piano_mensile: true,    // Piano mensile intelligente con vincoli dinamici
    pm_scheduling: true,    // PM Scheduling automatico con cicli Lely
    catalogo_parti: true,  // Catalogo ricambi Lely searchable
  },

  // ─── VINCOLI TEMPLATES (suggerimenti categorie per nuovo tenant) ───
  vincoli_templates: [
    { nome: 'Regole Team',               icona: '👥', desc: 'Coppie, affiancamenti, esclusioni' },
    { nome: 'Disponibilita e Ferie',     icona: '📅', desc: 'Ferie, malattia, permessi, formazione' },
    { nome: 'Veicoli e Attrezzature',    icona: '🚐', desc: 'Assegnazione furgoni, rotazione, officina' },
    { nome: 'Reperibilita e Turni',      icona: '📞', desc: 'Turni reperibilita, riposo post-notturna' },
    { nome: 'Competenze',               icona: '🎓', desc: 'Certificazioni, specializzazioni per tipo macchina' },
    { nome: 'Priorita e SLA',           icona: '⭐', desc: 'Clienti VIP, contratti SLA, urgenze' },
    { nome: 'Carico Lavoro e Riposo',    icona: '⏱️', desc: 'Max ore/giorno, giorni consecutivi, riposo' },
    { nome: 'Zone Geografiche',          icona: '📍', desc: 'Clustering per zona, basi tecnici, viaggi' },
  ],

  // ─── PWA MANIFEST ───────────────────────────────────────────────
  pwa: {
    name:             'MRS Lely Center Emilia Romagna',
    short_name:       'MRS Field',
    theme_color:      '#050505',
    background_color: '#050505',
    display:          'standalone',
  },

};
