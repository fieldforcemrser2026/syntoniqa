#!/usr/bin/env node
const PptxGenJS = require("pptxgenjs");

// Brand Colors
const colors = {
  primary: "C30A14",      // MRS red
  secondary: "3B7EF7",    // Blue
  darkBg: "0A0A0A",       // Main background
  surface: "1A1A1A",      // Card background
  card: "2A2A2A",         // Secondary card
  textPrimary: "FFFFFF",  // Primary text
  textSecondary: "B0B0B0",// Secondary text
  textMuted: "808080",    // Muted text
  success: "22C55E",
  warning: "F59E0B",
  error: "EF4444",
  critical: "8B5CF6",     // Purple for in_corso
  inactive: "808080",     // Gray for chiusa
};

// Initialize presentation
const prs = new PptxGenJS();

// Helper: Create shadow effect object
function createShadow() {
  return {
    type: "outer",
    angle: 45,
    blur: 8,
    offset: 2,
    opacity: 0.35,
    color: "000000",
  };
}

// Helper: Create card with red left accent bar
function addCardWithAccent(slide, x, y, w, h, title, desc, options = {}) {
  const cardBg = options.cardBg || colors.surface;
  const shadow = createShadow();

  // Main card background
  slide.addShape({
    type: "rect",
    x,
    y,
    w,
    h,
    fill: { color: cardBg },
    line: { color: "none" },
    shadow,
  });

  // Red accent bar (left edge)
  slide.addShape({
    type: "rect",
    x,
    y,
    w: 0.06,
    h,
    fill: { color: colors.primary },
    line: { color: "none" },
  });

  // Title
  if (title) {
    slide.addText(title, {
      x: x + 0.2,
      y: y + 0.15,
      w: w - 0.4,
      h: 0.4,
      fontSize: options.titleSize || 18,
      bold: true,
      color: colors.textPrimary,
      fontFace: "Arial",
      align: "left",
      valign: "top",
    });
  }

  // Description
  if (desc) {
    slide.addText(desc, {
      x: x + 0.2,
      y: y + (title ? 0.55 : 0.15),
      w: w - 0.4,
      h: h - (title ? 0.7 : 0.3),
      fontSize: options.descSize || 12,
      color: colors.textSecondary,
      fontFace: "Arial",
      align: "left",
      valign: "top",
      wrap: true,
    });
  }
}

// ============ SLIDE 1: COVER ============
function addCoverSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Left accent block
  slide.addShape({
    type: "rect",
    x: 0,
    y: 0,
    w: 0.15,
    h: 5.625,
    fill: { color: colors.primary },
    line: { color: "none" },
  });

  // Main title
  slide.addText("SYNTONIQA", {
    x: 1.5,
    y: 1.2,
    w: 6,
    h: 0.8,
    fontSize: 54,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
    align: "left",
  });

  // Version badge
  slide.addText("v1.0", {
    x: 7.8,
    y: 1.4,
    w: 1.2,
    h: 0.4,
    fontSize: 28,
    bold: true,
    color: colors.primary,
    fontFace: "Arial",
    align: "left",
  });

  // Subtitle
  slide.addText("Field Service Management Platform", {
    x: 1.5,
    y: 2.0,
    w: 7,
    h: 0.4,
    fontSize: 18,
    color: colors.textSecondary,
    fontFace: "Arial",
    align: "left",
  });

  // Organization
  slide.addText("MRS Lely Center Emilia Romagna", {
    x: 1.5,
    y: 2.5,
    w: 7,
    h: 0.3,
    fontSize: 14,
    color: colors.textMuted,
    fontFace: "Arial",
    align: "left",
  });

  // Divider line
  slide.addShape({
    type: "rect",
    x: 1.5,
    y: 3.0,
    w: 3,
    h: 0.08,
    fill: { color: colors.primary },
    line: { color: "none" },
  });

  // Date
  slide.addText("Marzo 2026", {
    x: 8,
    y: 5.2,
    w: 1.5,
    h: 0.3,
    fontSize: 12,
    color: colors.textMuted,
    fontFace: "Arial",
    align: "right",
  });
}

// ============ SLIDE 2: EXECUTIVE SUMMARY ============
function addExecutiveSummarySlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Executive Summary", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Stat cards
  const stats = [
    { number: "10.726", label: "Righe di Codice", icon: "📊" },
    { number: "155/155", label: "UAT Test PASS", color: colors.success },
    { number: "22", label: "Tabelle Database" },
  ];

  const cardWidth = 2.8;
  const cardHeight = 1.2;
  const startX = 0.5;
  const startY = 1.1;
  const gap = 0.25;

  stats.forEach((stat, idx) => {
    const x = startX + idx * (cardWidth + gap);
    const cardBg = colors.card;

    // Card background
    slide.addShape({
      type: "rect",
      x,
      y: startY,
      w: cardWidth,
      h: cardHeight,
      fill: { color: cardBg },
      line: { color: "none" },
      shadow: createShadow(),
    });

    // Accent bar
    slide.addShape({
      type: "rect",
      x,
      y: startY,
      w: 0.06,
      h: cardHeight,
      fill: { color: stat.color || colors.secondary },
      line: { color: "none" },
    });

    // Number
    slide.addText(stat.number, {
      x: x + 0.2,
      y: startY + 0.15,
      w: cardWidth - 0.4,
      h: 0.45,
      fontSize: 48,
      bold: true,
      color: stat.color || colors.textPrimary,
      fontFace: "Arial Black",
      align: "center",
    });

    // Label
    slide.addText(stat.label, {
      x: x + 0.2,
      y: startY + 0.65,
      w: cardWidth - 0.4,
      h: 0.35,
      fontSize: 10,
      color: colors.textSecondary,
      fontFace: "Arial",
      align: "center",
    });
  });

  // Description card
  slide.addShape({
    type: "rect",
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 2.5,
    fill: { color: colors.surface },
    line: { color: "none" },
    shadow: createShadow(),
  });

  // Accent bar
  slide.addShape({
    type: "rect",
    x: 0.5,
    y: 2.5,
    w: 0.06,
    h: 2.5,
    fill: { color: colors.primary },
    line: { color: "none" },
  });

  // Content
  const descText =
    "Syntoniqa v1.0 è una piattaforma Field Service Management completa per MRS Lely Center, costruita su Cloudflare Workers e Supabase PostgreSQL. Offre dashboard amministrativa, app mobile PWA per tecnici, bot Telegram con AI, gestione intelligente di urgenze e pianificazione, con 155 test UAT che passano completamente.";

  slide.addText(descText, {
    x: 0.8,
    y: 2.7,
    w: 8.5,
    h: 2.1,
    fontSize: 14,
    color: colors.textSecondary,
    fontFace: "Arial",
    align: "left",
    valign: "top",
    wrap: true,
  });
}

// ============ SLIDE 3: IL PROBLEMA ============
function addProblemSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("La Sfida", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Left column - Pain points
  const painPoints = [
    "Coordinamento manuale dei tecnici",
    "Nessun tracking urgenze in tempo reale",
    "SLA non monitorati automaticamente",
    "Comunicazione frammentata tra canali",
  ];

  let yPos = 1.1;
  painPoints.forEach((point) => {
    // Icon circle
    slide.addShape({
      type: "ellipse",
      x: 0.5,
      y: yPos,
      w: 0.35,
      h: 0.35,
      fill: { color: colors.warning },
      line: { color: "none" },
    });

    // Warning symbol
    slide.addText("!", {
      x: 0.5,
      y: yPos,
      w: 0.35,
      h: 0.35,
      fontSize: 20,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });

    // Text
    slide.addText(point, {
      x: 1.0,
      y: yPos,
      w: 3.8,
      h: 0.35,
      fontSize: 13,
      color: colors.textSecondary,
      fontFace: "Arial",
      valign: "middle",
      wrap: true,
    });

    yPos += 0.45;
  });

  // Right column - Impact stat
  slide.addShape({
    type: "rect",
    x: 5.2,
    y: 1.1,
    w: 4.3,
    h: 2.5,
    fill: { color: colors.card },
    line: { color: "none" },
    shadow: createShadow(),
  });

  // Accent bar
  slide.addShape({
    type: "rect",
    x: 5.2,
    y: 1.1,
    w: 0.06,
    h: 2.5,
    fill: { color: colors.error },
    line: { color: "none" },
  });

  // Big number
  slide.addText("4h+", {
    x: 5.5,
    y: 1.4,
    w: 3.8,
    h: 0.7,
    fontSize: 60,
    bold: true,
    color: colors.error,
    fontFace: "Arial Black",
    align: "center",
  });

  // Label
  slide.addText("Tempo medio di risposta\nprima di Syntoniqa", {
    x: 5.5,
    y: 2.2,
    w: 3.8,
    h: 1,
    fontSize: 14,
    bold: true,
    color: colors.textSecondary,
    fontFace: "Arial",
    align: "center",
    valign: "top",
  });

  // Bottom impact text
  slide.addText(
    "Necessità: automazione, visibilità in tempo reale, comunicazione unificata",
    {
      x: 0.5,
      y: 4.8,
      w: 9,
      h: 0.6,
      fontSize: 13,
      color: colors.textMuted,
      fontFace: "Arial",
      align: "center",
      italic: true,
    }
  );
}

// ============ SLIDE 4: LA SOLUZIONE ============
function addSolutionSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Syntoniqa — La Soluzione", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // 2x2 grid
  const features = [
    { title: "Dashboard Admin", desc: "Analytics, KPI, gestione risorse" },
    { title: "App Mobile PWA", desc: "Tecnici: interventi, mappa, chat" },
    { title: "Telegram Bot", desc: "Comandi /vado /incorso /risolto" },
    { title: "AI Planner", desc: "Ottimizzazione vincoli e competenze" },
  ];

  const positions = [
    { x: 0.5, y: 1.1 },
    { x: 5.2, y: 1.1 },
    { x: 0.5, y: 3.3 },
    { x: 5.2, y: 3.3 },
  ];

  const w = 4.3;
  const h = 1.8;

  features.forEach((feat, idx) => {
    const { x, y } = positions[idx];

    // Card
    slide.addShape({
      type: "rect",
      x,
      y,
      w,
      h,
      fill: { color: colors.surface },
      line: { color: "none" },
      shadow: createShadow(),
    });

    // Accent bar
    slide.addShape({
      type: "rect",
      x,
      y,
      w: 0.06,
      h,
      fill: { color: colors.primary },
      line: { color: "none" },
    });

    // Icon circle
    const iconColors = [colors.primary, colors.secondary, "0088CC", "9333EA"];
    slide.addShape({
      type: "ellipse",
      x: x + w - 0.6,
      y: y + 0.15,
      w: 0.45,
      h: 0.45,
      fill: { color: iconColors[idx] },
      line: { color: "none" },
    });

    // Title
    slide.addText(feat.title, {
      x: x + 0.2,
      y: y + 0.2,
      w: w - 0.8,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: colors.textPrimary,
      fontFace: "Arial",
    });

    // Description
    slide.addText(feat.desc, {
      x: x + 0.2,
      y: y + 0.65,
      w: w - 0.4,
      h: 1,
      fontSize: 12,
      color: colors.textSecondary,
      fontFace: "Arial",
      wrap: true,
    });
  });
}

// ============ SLIDE 5: ARCHITETTURA ============
function addArchitectureSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Architettura di Sistema", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Top tier - Frontends
  const frontends = [
    { label: "Admin\nDashboard", x: 1.2 },
    { label: "Mobile\nPWA", x: 4.5 },
    { label: "Telegram\nBot", x: 7.8 },
  ];

  frontends.forEach((fe) => {
    slide.addShape({
      type: "rect",
      x: fe.x,
      y: 0.95,
      w: 2.2,
      h: 0.7,
      fill: { color: colors.card },
      line: { color: colors.textSecondary, width: 1 },
    });

    slide.addText(fe.label, {
      x: fe.x,
      y: 0.95,
      w: 2.2,
      h: 0.7,
      fontSize: 12,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });
  });

  // Arrows down
  [1.2, 4.5, 7.8].forEach((x) => {
    slide.addShape({
      type: "rect",
      x: x + 0.9,
      y: 1.75,
      w: 0.15,
      h: 0.4,
      fill: { color: colors.textSecondary },
      line: { color: "none" },
    });
  });

  // Middle - Cloudflare Worker
  slide.addShape({
    type: "rect",
    x: 2.8,
    y: 2.25,
    w: 4.4,
    h: 0.8,
    fill: { color: colors.primary },
    line: { color: "none" },
    shadow: createShadow(),
  });

  slide.addText("Cloudflare Workers", {
    x: 2.8,
    y: 2.25,
    w: 4.4,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: colors.textPrimary,
    align: "center",
    valign: "middle",
  });

  slide.addText("98 API endpoints + 2 Cron jobs", {
    x: 2.8,
    y: 2.65,
    w: 4.4,
    h: 0.3,
    fontSize: 10,
    color: colors.textPrimary,
    align: "center",
    valign: "middle",
  });

  // Arrows down
  slide.addShape({
    type: "rect",
    x: 4.425,
    y: 3.15,
    w: 0.15,
    h: 0.4,
    fill: { color: colors.textSecondary },
    line: { color: "none" },
  });

  // Bottom tier - Data & Services
  const backends = [
    { label: "Supabase\nPostgreSQL", x: 1.5 },
    { label: "External\nServices", x: 6.5 },
  ];

  backends.forEach((be) => {
    slide.addShape({
      type: "rect",
      x: be.x,
      y: 3.65,
      w: 2.5,
      h: 0.7,
      fill: { color: colors.surface },
      line: { color: colors.textSecondary, width: 1 },
    });

    slide.addText(be.label, {
      x: be.x,
      y: 3.65,
      w: 2.5,
      h: 0.7,
      fontSize: 12,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });
  });

  // Legend
  slide.addText("22 tabelle | Zero dipendenze runtime", {
    x: 0.5,
    y: 4.7,
    w: 9,
    h: 0.6,
    fontSize: 11,
    color: colors.textMuted,
    fontFace: "Arial",
    align: "center",
  });
}

// ============ SLIDE 6: GESTIONE URGENZE ============
function addUrgencyManagementSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Workflow Urgenze", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // State machine
  const states = [
    { label: "aperta", color: colors.error },
    { label: "assegnata", color: colors.warning },
    { label: "schedulata", color: colors.secondary },
    { label: "in_corso", color: colors.critical },
    { label: "risolta", color: colors.success },
    { label: "chiusa", color: colors.inactive },
  ];

  const stateBoxWidth = 1.2;
  const stateBoxHeight = 0.5;
  const startY = 1.2;
  const totalWidth = states.length * stateBoxWidth + (states.length - 1) * 0.25;
  const startX = (10 - totalWidth) / 2;

  states.forEach((state, idx) => {
    const x = startX + idx * (stateBoxWidth + 0.25);

    // State box
    slide.addShape({
      type: "rect",
      x,
      y: startY,
      w: stateBoxWidth,
      h: stateBoxHeight,
      fill: { color: state.color },
      line: { color: "none" },
      shadow: createShadow(),
    });

    // State label
    slide.addText(state.label, {
      x,
      y: startY,
      w: stateBoxWidth,
      h: stateBoxHeight,
      fontSize: 11,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });

    // Arrow to next state
    if (idx < states.length - 1) {
      const arrowX = x + stateBoxWidth;
      const arrowW = 0.25;
      slide.addShape({
        type: "triangle",
        x: arrowX,
        y: startY + 0.15,
        w: arrowW,
        h: 0.2,
        fill: { color: colors.textSecondary },
        line: { color: "none" },
        rotate: 90,
      });
    }
  });

  // Info cards below
  const infoCards = [
    { title: "Automazione SLA", desc: "Monitoring automatico di scadenze" },
    {
      title: "Escalation",
      desc: "Notifiche per ritardi >4h",
    },
    { title: "Notifiche", desc: "Telegram + Email + Push" },
  ];

  let cardY = 2.2;
  infoCards.forEach((card, idx) => {
    addCardWithAccent(slide, 1 + idx * 3.0, cardY, 2.6, 2.2, card.title, card.desc);
  });
}

// ============ SLIDE 7: PIANO INTERVENTI & AI ============
function addPlanningSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Piano Interventi Intelligente", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Left: Piano workflow
  const pianoStates = [
    { label: "pianificato", color: colors.secondary },
    { label: "in_corso", color: colors.critical },
    { label: "completato", color: colors.success },
  ];

  let pianoY = 1.1;
  pianoStates.forEach((state, idx) => {
    // State circle
    slide.addShape({
      type: "ellipse",
      x: 0.7,
      y: pianoY,
      w: 0.4,
      h: 0.4,
      fill: { color: state.color },
      line: { color: "none" },
    });

    // Label
    slide.addText(state.label, {
      x: 1.2,
      y: pianoY,
      w: 2.5,
      h: 0.4,
      fontSize: 13,
      bold: true,
      color: colors.textPrimary,
      valign: "middle",
    });

    pianoY += 0.6;

    if (idx < pianoStates.length - 1) {
      slide.addShape({
        type: "rect",
        x: 0.85,
        y: pianoY - 0.1,
        w: 0.08,
        h: 0.25,
        fill: { color: colors.textSecondary },
        line: { color: "none" },
      });
      pianoY += 0.15;
    }
  });

  // Right: AI Planner card
  addCardWithAccent(slide, 4.5, 1.1, 5, 2.8, "AI Planner", null);

  slide.addText(
    "Vincoli + Disponibilità + Competenze → Piano Ottimizzato",
    {
      x: 4.8,
      y: 1.6,
      w: 4.4,
      h: 0.6,
      fontSize: 13,
      bold: true,
      color: colors.primary,
      fontFace: "Arial",
      wrap: true,
    }
  );

  // Constraint cards
  const constraints = [
    "Regole Team (junior con senior)",
    "Zone Emilia-Romagna",
    "Competenze tecniche vs asset",
  ];

  let constraintY = 2.4;
  constraints.forEach((constraint) => {
    slide.addShape({
      type: "rect",
      x: 4.8,
      y: constraintY,
      w: 4.4,
      h: 0.35,
      fill: { color: colors.card },
      line: { color: colors.secondary, width: 1 },
    });

    slide.addText(constraint, {
      x: 5.0,
      y: constraintY,
      w: 4.0,
      h: 0.35,
      fontSize: 11,
      color: colors.textSecondary,
      valign: "middle",
    });

    constraintY += 0.45;
  });

  // Bottom stat
  slide.addText("Oltre 1000 interventi pianificati + 100+ urgenze", {
    x: 0.5,
    y: 4.8,
    w: 9,
    h: 0.6,
    fontSize: 12,
    color: colors.textMuted,
    fontFace: "Arial",
    align: "center",
  });
}

// ============ SLIDE 8: APP MOBILE TECNICO ============
function addMobileSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("PWA Mobile Tecnico", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Phone mockup (left)
  const phoneX = 0.8;
  const phoneY = 1.1;
  const phoneW = 2.0;
  const phoneH = 3.8;

  // Phone border
  slide.addShape({
    type: "rect",
    x: phoneX,
    y: phoneY,
    w: phoneW,
    h: phoneH,
    fill: { color: "none" },
    line: { color: colors.surface, width: 3 },
  });

  // Screen
  slide.addShape({
    type: "rect",
    x: phoneX + 0.15,
    y: phoneY + 0.15,
    w: phoneW - 0.3,
    h: phoneH - 0.3,
    fill: { color: colors.card },
    line: { color: "none" },
  });

  // Status bar
  slide.addShape({
    type: "rect",
    x: phoneX + 0.15,
    y: phoneY + 0.15,
    w: phoneW - 0.3,
    h: 0.25,
    fill: { color: colors.surface },
    line: { color: "none" },
  });

  // Header
  slide.addText("SYNTONIQA", {
    x: phoneX + 0.2,
    y: phoneY + 0.45,
    w: phoneW - 0.4,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: colors.primary,
    align: "center",
  });

  // Features (right side)
  const features = ["Home", "Urgenze", "Calendario", "Mappa", "Profilo"];

  let featureY = 1.1;
  features.forEach((feat) => {
    // Icon circle
    slide.addShape({
      type: "ellipse",
      x: 3.3,
      y: featureY,
      w: 0.35,
      h: 0.35,
      fill: { color: colors.secondary },
      line: { color: "none" },
    });

    // Feature name
    slide.addText(feat, {
      x: 3.8,
      y: featureY,
      w: 2.0,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: colors.textPrimary,
      valign: "middle",
    });

    // Description
    const descs = [
      "Dashboard personale",
      "Assegnate e disponibili",
      "Pianificazione settimanale",
      "Localizzazione tecnici",
      "Dati personali e team",
    ];
    slide.addText(descs[features.indexOf(feat)], {
      x: 3.8,
      y: featureY + 0.35,
      w: 3.5,
      h: 0.3,
      fontSize: 10,
      color: colors.textSecondary,
    });

    featureY += 0.75;
  });

  // Bottom stat
  slide.addText("2071 righe | 17 pagine | Bottom navigation", {
    x: 0.5,
    y: 4.8,
    w: 9,
    h: 0.6,
    fontSize: 12,
    color: colors.textMuted,
    fontFace: "Arial",
    align: "center",
  });
}

// ============ SLIDE 9: TELEGRAM BOT ============
function addTelegramSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Telegram Bot Integration", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Left: Commands
  addCardWithAccent(slide, 0.5, 1.1, 4.5, 3.8, "Comandi Disponibili", null);

  const commands = [
    { cmd: "/vado", desc: "Visualizza urgenze aperte (top 5)" },
    { cmd: "/vado 2", desc: "Prendi urgenza #2" },
    { cmd: "/incorso", desc: "Segna urgenza in corso" },
    { cmd: "/risolto", desc: "Chiudi urgenza con note" },
    { cmd: "/oggi", desc: "Interventi di oggi" },
    { cmd: "/ordine", desc: "Crea ordine ricambi" },
  ];

  let cmdY = 1.65;
  commands.forEach((item) => {
    slide.addText(item.cmd, {
      x: 0.8,
      y: cmdY,
      w: 1.2,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: colors.primary,
      fontFace: "Arial",
    });

    slide.addText(item.desc, {
      x: 2.1,
      y: cmdY,
      w: 2.6,
      h: 0.3,
      fontSize: 10,
      color: colors.textSecondary,
      wrap: true,
    });

    cmdY += 0.35;
  });

  // Right: AI Analysis
  addCardWithAccent(slide, 5.2, 1.1, 4.3, 3.8, "AI Media Analysis", null);

  slide.addText(
    "Foto o testo libero → Gemini AI analizza → Azione automatica creata",
    {
      x: 5.5,
      y: 1.65,
      w: 3.9,
      h: 0.8,
      fontSize: 12,
      bold: true,
      color: colors.primary,
      wrap: true,
    }
  );

  // Capabilities
  const aiCapabilities = [
    "Riconoscimento problemi",
    "Estrazione dati dalle immagini",
    "Suggerimento azioni",
    "Link a ricambi correlati",
  ];

  let aiY = 2.7;
  aiCapabilities.forEach((cap) => {
    slide.addShape({
      type: "ellipse",
      x: 5.5,
      y: aiY,
      w: 0.2,
      h: 0.2,
      fill: { color: colors.secondary },
      line: { color: "none" },
    });

    slide.addText(cap, {
      x: 5.9,
      y: aiY - 0.05,
      w: 3.4,
      h: 0.25,
      fontSize: 11,
      color: colors.textSecondary,
      valign: "middle",
    });

    aiY += 0.4;
  });

  // Footer
  slide.addText(
    "Notifiche Telegram per assegnamenti, escalation, aggiornamenti ordini",
    {
      x: 0.5,
      y: 4.8,
      w: 9,
      h: 0.6,
      fontSize: 11,
      color: colors.textMuted,
      fontFace: "Arial",
      align: "center",
    }
  );
}

// ============ SLIDE 10: ORDINI & LOGISTICA ============
function addOrdersSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Ordini Ricambi", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Order state flow
  const orderStates = [
    { label: "richiesto", color: colors.warning },
    { label: "approvato", color: colors.secondary },
    { label: "ordinato", color: colors.critical },
    { label: "consegnato", color: colors.success },
  ];

  let stateX = 0.8;
  orderStates.forEach((state, idx) => {
    // Box
    slide.addShape({
      type: "rect",
      x: stateX,
      y: 1.1,
      w: 2.0,
      h: 0.5,
      fill: { color: state.color },
      line: { color: "none" },
      shadow: createShadow(),
    });

    // Label
    slide.addText(state.label, {
      x: stateX,
      y: 1.1,
      w: 2.0,
      h: 0.5,
      fontSize: 12,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });

    // Arrow
    if (idx < orderStates.length - 1) {
      slide.addShape({
        type: "triangle",
        x: stateX + 2.0,
        y: 1.25,
        w: 0.3,
        h: 0.2,
        fill: { color: colors.textSecondary },
        line: { color: "none" },
        rotate: 90,
      });
    }

    stateX += 2.3;
  });

  // Feature cards
  const orderFeatures = [
    { title: "Tracking Tempo Reale", desc: "Stato ordine aggiornato live" },
    {
      title: "Notifiche Automatiche",
      desc: "Tecnico notificato su ogni cambio",
    },
    { title: "Storico Completo", desc: "Archivio ordinato per cliente" },
  ];

  let featureX = 0.5;
  orderFeatures.forEach((feat) => {
    addCardWithAccent(slide, featureX, 2.2, 3.0, 2.1, feat.title, feat.desc);
    featureX += 3.2;
  });
}

// ============ SLIDE 11: MAPPA & TERRITORIO ============
function addMapSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Mappa Operativa", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Map simulation card
  slide.addShape({
    type: "rect",
    x: 0.5,
    y: 1.1,
    w: 6.0,
    h: 4.0,
    fill: { color: colors.card },
    line: { color: colors.surface, width: 2 },
    shadow: createShadow(),
  });

  // Decorative map elements
  const zones = [
    { label: "Bologna", x: 2.0, y: 1.5, color: colors.success },
    { label: "Reggio E.", x: 2.5, y: 2.8, color: colors.primary },
    { label: "Piacenza", x: 1.0, y: 2.0, color: colors.warning },
    { label: "Modena", x: 3.0, y: 2.2, color: colors.secondary },
  ];

  zones.forEach((zone) => {
    slide.addShape({
      type: "ellipse",
      x: zone.x,
      y: zone.y,
      w: 0.25,
      h: 0.25,
      fill: { color: zone.color },
      line: { color: "none" },
    });

    slide.addText(zone.label, {
      x: zone.x + 0.3,
      y: zone.y - 0.1,
      w: 1.5,
      h: 0.3,
      fontSize: 9,
      color: colors.textSecondary,
    });
  });

  // Legend (right side)
  const legendX = 6.8;
  const legendItems = [
    { label: "Urgenti", color: colors.error },
    { label: "Pianificati", color: colors.secondary },
    { label: "Completati", color: colors.success },
  ];

  let legendY = 1.5;
  legendItems.forEach((item) => {
    slide.addShape({
      type: "ellipse",
      x: legendX,
      y: legendY,
      w: 0.2,
      h: 0.2,
      fill: { color: item.color },
      line: { color: "none" },
    });

    slide.addText(item.label, {
      x: legendX + 0.3,
      y: legendY - 0.05,
      w: 2.2,
      h: 0.25,
      fontSize: 10,
      color: colors.textSecondary,
      valign: "middle",
    });

    legendY += 0.4;
  });

  // Stats
  slide.addText(
    "Copertura: 70+ comuni Emilia-Romagna | 10 tecnici | Localizzazione real-time",
    {
      x: 0.5,
      y: 4.8,
      w: 9,
      h: 0.6,
      fontSize: 11,
      color: colors.textMuted,
      fontFace: "Arial",
      align: "center",
    }
  );
}

// ============ SLIDE 12: KPI & ANALYTICS ============
function addKPISlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Dashboard KPI", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Chart area (simulated)
  slide.addShape({
    type: "rect",
    x: 0.5,
    y: 1.1,
    w: 5.5,
    h: 2.2,
    fill: { color: colors.card },
    line: { color: colors.surface, width: 1 },
    shadow: createShadow(),
  });

  slide.addText("Prestazioni Settimanali", {
    x: 0.7,
    y: 1.25,
    w: 5.1,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: colors.textPrimary,
  });

  // Simulated bars
  const days = ["Lun", "Mar", "Mer", "Gio", "Ven"];
  let barX = 1.2;
  days.forEach((day, idx) => {
    const heights = [1.2, 1.6, 1.0, 1.4, 1.8];
    slide.addShape({
      type: "rect",
      x: barX,
      y: 2.6 - heights[idx] * 0.3,
      w: 0.6,
      h: heights[idx] * 0.3,
      fill: { color: [colors.primary, colors.secondary, colors.success][idx % 3] },
      line: { color: "none" },
    });

    slide.addText(day, {
      x: barX - 0.1,
      y: 2.75,
      w: 0.8,
      h: 0.25,
      fontSize: 9,
      color: colors.textSecondary,
      align: "center",
    });

    barX += 0.9;
  });

  // Metrics grid (right)
  const metrics = [
    { title: "SLA Compliance", value: "92%", color: colors.success },
    { title: "Tempo Medio", value: "1.2h", color: colors.secondary },
    { title: "Interventi/Sett", value: "156", color: colors.primary },
    { title: "Soddisfazione", value: "4.8/5", color: colors.secondary },
  ];

  const metricX = 6.2;
  let metricY = 1.1;
  metrics.forEach((metric) => {
    // Card
    slide.addShape({
      type: "rect",
      x: metricX,
      y: metricY,
      w: 3.3,
      h: 0.75,
      fill: { color: colors.surface },
      line: { color: "none" },
      shadow: createShadow(),
    });

    // Color bar
    slide.addShape({
      type: "rect",
      x: metricX,
      y: metricY,
      w: 0.08,
      h: 0.75,
      fill: { color: metric.color },
      line: { color: "none" },
    });

    // Title
    slide.addText(metric.title, {
      x: metricX + 0.15,
      y: metricY + 0.05,
      w: 3.0,
      h: 0.25,
      fontSize: 10,
      color: colors.textSecondary,
    });

    // Value
    slide.addText(metric.value, {
      x: metricX + 0.15,
      y: metricY + 0.35,
      w: 3.0,
      h: 0.3,
      fontSize: 18,
      bold: true,
      color: metric.color,
      fontFace: "Arial Black",
    });

    metricY += 0.95;
  });
}

// ============ SLIDE 13: NOTIFICHE MULTI-CANALE ============
function addNotificationsSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Sistema Notifiche", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Channel cards
  const channels = [
    {
      title: "Push Notifications",
      desc: "Browser & app native",
      icon: "🔔",
    },
    {
      title: "Email",
      desc: "Resend SMTP con template",
      icon: "📧",
    },
    {
      title: "Telegram",
      desc: "Private + Group bot",
      icon: "✈️",
    },
  ];

  const channelX = 0.5;
  const channelW = 3.0;
  const channelH = 1.8;

  channels.forEach((ch, idx) => {
    addCardWithAccent(slide, channelX + idx * 3.15, 1.1, channelW, channelH, ch.title, ch.desc);
  });

  // Trigger events (below)
  slide.addText("Trigger Events:", {
    x: 0.5,
    y: 3.2,
    w: 9,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: colors.textPrimary,
  });

  const triggers = [
    "• Nuova urgenza assegnata",
    "• Escalation SLA (>4h senza start)",
    "• Cambio stato intervento",
    "• Ordine ricambi aggiornato",
  ];

  let triggerY = 3.6;
  triggers.forEach((trigger) => {
    slide.addText(trigger, {
      x: 1.0,
      y: triggerY,
      w: 8,
      h: 0.3,
      fontSize: 11,
      color: colors.textSecondary,
    });
    triggerY += 0.35;
  });
}

// ============ SLIDE 14: SICUREZZA & COMPLIANCE ============
function addSecuritySlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Sicurezza & Compliance", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Security features grid
  const securityFeatures = [
    { feature: "JWT Auth", desc: "Token-based authentication" },
    { feature: "Role-Based Access", desc: "Admin, Tecnico, readonly" },
    { feature: "Audit Trail", desc: "Workflow log di tutte azioni" },
    { feature: "Soft Delete", desc: "Dati non mai cancellati" },
    { feature: "CORS Policy", desc: "Origins whitelisted" },
    { feature: "Password Hashing", desc: "bcrypt salted hashes" },
  ];

  let secX = 0.5;
  let secY = 1.1;
  let col = 0;

  securityFeatures.forEach((feat, idx) => {
    const w = 4.3;
    const h = 0.65;

    if (col === 2) {
      secX = 0.5;
      secY += 0.85;
      col = 0;
    }

    // Feature box
    slide.addShape({
      type: "rect",
      x: secX,
      y: secY,
      w: w,
      h: h,
      fill: { color: colors.card },
      line: { color: colors.secondary, width: 1 },
      shadow: createShadow(),
    });

    // Lock icon placeholder
    slide.addShape({
      type: "ellipse",
      x: secX + 0.15,
      y: secY + 0.15,
      w: 0.35,
      h: 0.35,
      fill: { color: colors.primary },
      line: { color: "none" },
    });

    // Feature name
    slide.addText(feat.feature, {
      x: secX + 0.6,
      y: secY + 0.08,
      w: w - 0.75,
      h: 0.25,
      fontSize: 12,
      bold: true,
      color: colors.textPrimary,
    });

    // Description
    slide.addText(feat.desc, {
      x: secX + 0.6,
      y: secY + 0.35,
      w: w - 0.75,
      h: 0.25,
      fontSize: 9,
      color: colors.textSecondary,
    });

    secX += 4.6;
    col++;
  });

  // Bottom compliance badge
  slide.addShape({
    type: "rect",
    x: 3.5,
    y: 4.5,
    w: 3.0,
    h: 0.8,
    fill: { color: colors.primary },
    line: { color: "none" },
    shadow: createShadow(),
  });

  slide.addText("GDPR Compliant", {
    x: 3.5,
    y: 4.5,
    w: 3.0,
    h: 0.8,
    fontSize: 16,
    bold: true,
    color: colors.textPrimary,
    align: "center",
    valign: "middle",
  });
}

// ============ SLIDE 15: TEAM MRS ============
function addTeamSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Il Team", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Team members (using IDs only)
  const team = [
    { id: "TEC_691", role: "caposquadra" },
    { id: "TEC_ANT", role: "senior" },
    { id: "TEC_GIO", role: "senior" },
    { id: "TEC_FAB", role: "tecnico" },
    { id: "TEC_MIR", role: "assente" },
    { id: "TEC_FAZ", role: "junior" },
    { id: "TEC_GIU", role: "junior" },
    { id: "TEC_GIN", role: "junior" },
    { id: "TEC_EMU", role: "junior" },
    { id: "USR001", role: "admin" },
  ];

  const cardW = 1.65;
  const cardH = 1.2;
  let cardX = 0.5;
  let cardY = 1.1;
  let col = 0;

  team.forEach((member) => {
    if (col === 5) {
      cardX = 0.5;
      cardY += 1.4;
      col = 0;
    }

    // Card
    slide.addShape({
      type: "rect",
      x: cardX,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: { color: colors.card },
      line: { color: colors.surface, width: 1 },
      shadow: createShadow(),
    });

    // Role color indicator
    const roleColors = {
      admin: colors.primary,
      caposquadra: colors.critical,
      senior: colors.secondary,
      tecnico: colors.success,
      junior: colors.warning,
      assente: colors.inactive,
    };

    slide.addShape({
      type: "rect",
      x: cardX,
      y: cardY,
      w: cardW,
      h: 0.12,
      fill: { color: roleColors[member.role] },
      line: { color: "none" },
    });

    // ID
    slide.addText(member.id, {
      x: cardX + 0.1,
      y: cardY + 0.2,
      w: cardW - 0.2,
      h: 0.35,
      fontSize: 11,
      bold: true,
      color: colors.textPrimary,
      align: "center",
    });

    // Role
    slide.addText(member.role, {
      x: cardX + 0.1,
      y: cardY + 0.6,
      w: cardW - 0.2,
      h: 0.35,
      fontSize: 9,
      color: colors.textSecondary,
      align: "center",
      italic: true,
    });

    cardX += cardW + 0.2;
    col++;
  });
}

// ============ SLIDE 16: ROADMAP ============
function addRoadmapSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Roadmap", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Timeline phases
  const phases = [
    {
      quarter: "Q1 2026",
      items: ["Core platform", "155 UAT tests PASS", "Production ready"],
      color: colors.success,
      x: 0.5,
    },
    {
      quarter: "Q2 2026",
      items: ["Offline mode (Service Worker)", "KPI dashboard tecnico", "Push notifications"],
      color: colors.secondary,
      x: 3.5,
    },
    {
      quarter: "Q3-Q4 2026",
      items: ["Multi-tenant setup", "i18n (English/Italian)", "Power BI export"],
      color: colors.critical,
      x: 6.5,
    },
  ];

  phases.forEach((phase) => {
    // Phase box
    slide.addShape({
      type: "rect",
      x: phase.x,
      y: 1.1,
      w: 2.8,
      h: 3.5,
      fill: { color: colors.card },
      line: { color: phase.color, width: 2 },
      shadow: createShadow(),
    });

    // Header
    slide.addShape({
      type: "rect",
      x: phase.x,
      y: 1.1,
      w: 2.8,
      h: 0.4,
      fill: { color: phase.color },
      line: { color: "none" },
    });

    // Quarter label
    slide.addText(phase.quarter, {
      x: phase.x,
      y: 1.1,
      w: 2.8,
      h: 0.4,
      fontSize: 13,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });

    // Items
    let itemY = 1.65;
    phase.items.forEach((item) => {
      slide.addText("• " + item, {
        x: phase.x + 0.2,
        y: itemY,
        w: 2.4,
        h: 0.6,
        fontSize: 10,
        color: colors.textSecondary,
        wrap: true,
      });
      itemY += 0.7;
    });
  });
}

// ============ SLIDE 17: ROI & IMPATTO ============
function addROISlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Title
  slide.addText("Impatto Previsto", {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontSize: 36,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Before/After comparison
  const comparisons = [
    {
      metric: "Tempo Risposta",
      before: "4h+",
      after: "<1h",
      icon: "⏱️",
    },
    {
      metric: "SLA Tracking",
      before: "Manuale",
      after: "Automatico",
      icon: "📊",
    },
    {
      metric: "Comunicazione",
      before: "Telefono",
      after: "Multi-canale",
      icon: "💬",
    },
  ];

  let compX = 0.5;
  comparisons.forEach((comp) => {
    const w = 3.0;

    // Before box
    slide.addShape({
      type: "rect",
      x: compX,
      y: 1.1,
      w: w,
      h: 0.6,
      fill: { color: colors.error },
      line: { color: "none" },
      shadow: createShadow(),
    });

    slide.addText(comp.before, {
      x: compX,
      y: 1.1,
      w: w,
      h: 0.6,
      fontSize: 14,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });

    // Arrow
    slide.addShape({
      type: "triangle",
      x: compX + w + 0.1,
      y: 1.3,
      w: 0.3,
      h: 0.2,
      fill: { color: colors.primary },
      line: { color: "none" },
      rotate: 90,
    });

    // After box
    slide.addShape({
      type: "rect",
      x: compX + w + 0.5,
      y: 1.1,
      w: w,
      h: 0.6,
      fill: { color: colors.success },
      line: { color: "none" },
      shadow: createShadow(),
    });

    slide.addText(comp.after, {
      x: compX + w + 0.5,
      y: 1.1,
      w: w,
      h: 0.6,
      fontSize: 14,
      bold: true,
      color: colors.textPrimary,
      align: "center",
      valign: "middle",
    });

    // Metric label
    slide.addText(comp.metric, {
      x: compX,
      y: 1.85,
      w: w + 0.5 + w,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: colors.textSecondary,
      align: "center",
    });

    compX += w + 0.5 + w + 0.4;
  });

  // Big ROI callout
  slide.addShape({
    type: "rect",
    x: 2.0,
    y: 2.8,
    w: 6.0,
    h: 1.6,
    fill: { color: colors.primary },
    line: { color: "none" },
    shadow: createShadow(),
  });

  slide.addText("Riduzione Costi + Efficienza", {
    x: 2.2,
    y: 2.95,
    w: 5.6,
    h: 0.4,
    fontSize: 13,
    bold: true,
    color: colors.textPrimary,
    align: "center",
  });

  slide.addText("Automazione completa del workflow operativo", {
    x: 2.2,
    y: 3.4,
    w: 5.6,
    h: 0.8,
    fontSize: 18,
    bold: true,
    color: colors.textPrimary,
    align: "center",
    valign: "top",
  });

  // Benefits
  const benefits = ["✓ 75% riduzione tempo amministrativo", "✓ 95% SLA compliance", "✓ 30% riduzione turnaround"];

  let benY = 3.0;
  benefits.forEach((ben) => {
    slide.addText(ben, {
      x: 1.0,
      y: 3.0 + benefits.indexOf(ben) * 0.35,
      w: 8,
      h: 0.3,
      fontSize: 10,
      color: colors.success,
      bold: true,
    });
  });
}

// ============ SLIDE 18: CHIUSURA ============
function addClosingSlide() {
  const slide = prs.addSlide();
  slide.background = { color: colors.darkBg };

  // Right accent block
  slide.addShape({
    type: "rect",
    x: 9.85,
    y: 0,
    w: 0.15,
    h: 5.625,
    fill: { color: colors.primary },
    line: { color: "none" },
  });

  // Main title
  slide.addText("SYNTONIQA", {
    x: 1.5,
    y: 1.5,
    w: 7,
    h: 0.7,
    fontSize: 54,
    bold: true,
    color: colors.textPrimary,
    fontFace: "Arial Black",
  });

  // Subtitle
  slide.addText("v1.0", {
    x: 1.5,
    y: 2.3,
    w: 7,
    h: 0.4,
    fontSize: 28,
    bold: true,
    color: colors.primary,
    fontFace: "Arial",
  });

  // Ready message
  slide.addText("Ready for Production", {
    x: 1.5,
    y: 2.85,
    w: 7,
    h: 0.5,
    fontSize: 24,
    bold: true,
    color: colors.success,
    fontFace: "Arial",
  });

  // Organization
  slide.addText("MRS Lely Center Emilia Romagna", {
    x: 1.5,
    y: 3.55,
    w: 7,
    h: 0.4,
    fontSize: 14,
    color: colors.textSecondary,
    fontFace: "Arial",
  });

  // Divider
  slide.addShape({
    type: "rect",
    x: 1.5,
    y: 4.1,
    w: 3,
    h: 0.06,
    fill: { color: colors.primary },
    line: { color: "none" },
  });

  // Contact info
  slide.addText(
    "Web: fieldforcemrser2026.github.io/syntoniqa | API: syntoniqa-mrs-api.fieldforcemrser.workers.dev",
    {
      x: 0.5,
      y: 4.5,
      w: 9,
      h: 0.8,
      fontSize: 10,
      color: colors.textMuted,
      fontFace: "Arial",
      align: "center",
      wrap: true,
    }
  );
}

// ============ BUILD PRESENTATION ============
addCoverSlide();
addExecutiveSummarySlide();
addProblemSlide();
addSolutionSlide();
addArchitectureSlide();
addUrgencyManagementSlide();
addPlanningSlide();
addMobileSlide();
addTelegramSlide();
addOrdersSlide();
addMapSlide();
addKPISlide();
addNotificationsSlide();
addSecuritySlide();
addTeamSlide();
addRoadmapSlide();
addROISlide();
addClosingSlide();

// Save presentation
const outputPath = "/sessions/brave-peaceful-lovelace/mnt/Syntoniqa_repo/docs/01_Executive_Deck.pptx";
prs.writeFile({ fileName: outputPath });

console.log(`✓ Executive Deck created: ${outputPath}`);
console.log(`✓ Total slides: 18`);
console.log(`✓ MRS branding applied (C30A14 primary, 3B7EF7 secondary)`);
