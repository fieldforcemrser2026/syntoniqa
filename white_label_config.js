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
    logo_url:   'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgODAiPgogIDxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iODAiIHJ4PSIxMiIgZmlsbD0iI0MzMEExNCIvPgogIDx0ZXh0IHg9IjEwMCIgeT0iNTMiIGZvbnQtZmFtaWx5PSJBcmlhbCBCbGFjayxBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjM4IiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjQiPk1SUzwvdGV4dD4KPC9zdmc+',
    logo_height:'40px',                // Altezza logo nel login
    logo_alt:   'MRS Lely Center Logo',
    favicon_url:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+CiAgPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNSIgZmlsbD0iI0MzMEExNCIvPgogIDx0ZXh0IHg9IjE2IiB5PSIyMyIgZm9udC1mYW1pbHk9IkFyaWFsIEJsYWNrLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+TVJTPC90ZXh0Pgo8L3N2Zz4=',
    initiali:   'MRS',
    versione:   'v1.0',
  },

  // ─── PALETTE COLORI ─────────────────────────────────────────────
  colors: {
    primary:    '#C30A14',   // Brand Red – bottoni, link attivi, accenti principali
    primary2:   '#A00810',   // Brand Red scuro – hover bottoni
    secondary:  '#3B7EF7',   // Blu indigo – accento secondario
    bg:         '#050505',   // Sfondo principale
    surface:    '#1A1A1A',   // Superfici (sidebar, header)
    card:       '#2A2A2A',   // Sfondo card e pannelli
    border:     '#3A3A3A',   // Bordi e separatori
    text:       '#F5F5F5',   // Testo principale
    textSec:    '#B0B0B0',   // Testo secondario/muted
  },

  // ─── API ENDPOINT ────────────────────────────────────────────────
  api: {
    url:        'https://syntoniqa-mrs-api.fieldforcemrser.workers.dev',
    // token rimosso: ora si usa JWT dopo login (non più hardcoded nel frontend)
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
    pm_scheduling: true,    // PM Scheduling automatico con cicli manutenzione
    catalogo_parti: true,  // Catalogo ricambi searchable
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

  // ─── PM SYNC PROVIDER ───────────────────────────────────────────
  // Configurazione del sistema esterno da cui sincronizzare i dati PM.
  // Cambia questi valori per adattare a qualsiasi provider senza
  // modificare il codice HTML/JS principale.
  pmSync: {
    // Nome visualizzato nell'interfaccia (es. "LSSA", "IFS", "SAP PM")
    providerName:    'LSSA',
    // URL della pagina del provider dove l'utente deve essere loggato
    providerPageUrl: 'https://lssa2.lelyonline.com/performance/preventive-maintenance-overdue',
    // Endpoint API del provider che restituisce i dati PM (relativo all'host o URL assoluto)
    apiEndpoint:     '/api/js/data-source/v2/pms-to-be-done-soon',
    // Chiave in localStorage del browser dove il provider salva il token JWT
    authStorageKey:  'LSSA::authData',
    // Campo nel JSON della chiave di storage che contiene il token Bearer
    authTokenField:  'accessToken',
    // Colore primario del provider (es. per bottone Sync e overlay)
    providerColor:   '#c8102e',
    // Mapping campi risposta API → campi interni Syntoniqa
    fields: {
      serialNumber:        'DeviceSerialNumber',   // numero serie robot/asset
      daysUntilNextPM:     'DaysUntilNextPM',      // giorni al prossimo PM (negativo = scaduto)
      daysSinceLastPM:     'DaysSinceLastPM',      // giorni dall'ultimo PM completato
      milkingsSinceLastPM: 'MilkingsSinceLastPM',  // mungiture dall'ultimo PM (dato LSSA)
      nextPMType:          'NextPMType',            // tipo PM: A/B/C/D/Unknown
      customerNumber:      'CustomerNumber',        // codice cliente (es. Movex)
      customerName:        'CustomerName',          // nome cliente
      deviceType:          'DeviceType',            // tipo macchina/asset
    },
    // Rilevamento automatico formato file importato (per "Import file")
    fileDetection: {
      // Colonna che identifica un export diretto dal provider
      exportColumnKey:    'DeviceSerialNumber',
      // Keyword nell'header del template ufficiale vendor (riga 3 nel template Lely v5.x)
      templateHeaderKey:  'Serial no',
      // Colonne manutenzione nel template ufficiale
      templateCols: {
        serialNo:          'Serial no',
        maintenanceType:   'Maintenance type',
        standardInterval:  'Standard interval',
        weeksMonths:       'Weeks/Months',
        scheduleType:      'Schedule Type',
        nextPMDate:        'Next PM date',
        deviceType:        'Type',
        ownerCode:         'Owner',
      },
    },
  },

  // ─── PWA MANIFEST ───────────────────────────────────────────────
  pwa: {
    name:             'MRS Lely Center Emilia Romagna',
    short_name:       'MRS Field',
    theme_color:      '#050505',
    background_color: '#050505',
    display:          'standalone',
  },

};
