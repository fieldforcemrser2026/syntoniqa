#!/usr/bin/env python3
"""
SYNTONIQA v1.0 Quick Start Guide - PDF Generator
Creates a professional 2-page visual quick start guide with MRS dark branding
"""

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from datetime import datetime

# Color palette (MRS dark branding)
COLOR_RED = HexColor('#C30A14')
COLOR_BLUE = HexColor('#3B7EF7')
COLOR_DARK = HexColor('#0A0A0A')
COLOR_SURFACE = HexColor('#1A1A1A')
COLOR_CARD = HexColor('#2A2A2A')
COLOR_TEXT_PRIMARY = HexColor('#FFFFFF')
COLOR_TEXT_SECONDARY = HexColor('#B0B0B0')
COLOR_TEXT_MUTED = HexColor('#808080')
COLOR_SUCCESS = HexColor('#22C55E')
COLOR_WARNING = HexColor('#F59E0B')
COLOR_LIGHT_BG = HexColor('#F5F5F5')

# Page dimensions
page_width, page_height = A4
margin = 0.5 * cm

def create_rounded_rect(c, x, y, width, height, radius=0.3*cm, fill=False, stroke=True,
                        strokeColor=COLOR_RED, fillColor=None, strokeWidth=1):
    """Draw a rounded rectangle"""
    p = c.beginPath()
    p.moveTo(x + radius, y)
    p.lineTo(x + width - radius, y)
    p.curveTo(x + width - radius, y, x + width, y, x + width, y + radius)
    p.lineTo(x + width, y + height - radius)
    p.curveTo(x + width, y + height - radius, x + width, y + height, x + width - radius, y + height)
    p.lineTo(x + radius, y + height)
    p.curveTo(x + radius, y + height, x, y + height, x, y + height - radius)
    p.lineTo(x, y + radius)
    p.curveTo(x, y + radius, x, y, x + radius, y)
    p.close()

    if fill and fillColor:
        c.setFillColor(fillColor)
        c.drawPath(p, stroke=stroke, fill=True)
        if stroke:
            c.setStrokeColor(strokeColor)
            c.setLineWidth(strokeWidth)
    elif stroke:
        c.setStrokeColor(strokeColor)
        c.setLineWidth(strokeWidth)
        c.drawPath(p, stroke=True, fill=False)

def draw_circle(c, x, y, radius, fillColor, strokeColor=None, strokeWidth=0):
    """Draw a filled circle"""
    c.setFillColor(fillColor)
    if strokeColor:
        c.setStrokeColor(strokeColor)
        c.setLineWidth(strokeWidth)
    c.circle(x, y, radius, fill=True, stroke=bool(strokeColor))

def draw_header(c, y_pos, title):
    """Draw red header bar"""
    # Red background bar
    c.setFillColor(COLOR_RED)
    c.rect(0, y_pos - 1.2*cm, page_width, 1.2*cm, fill=True, stroke=False)

    # Title
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(COLOR_TEXT_PRIMARY)
    c.drawString(margin, y_pos - 0.6*cm, "SYNTONIQA v1.0")

    # Subtitle
    c.setFont("Helvetica", 14)
    c.setFillColor(COLOR_TEXT_SECONDARY)
    c.drawString(margin, y_pos - 1.0*cm, title)

    return y_pos - 1.5*cm

def draw_step_card(c, x, y, step_num, title, description, icon=""):
    """Draw a single step card"""
    card_width = 4.2*cm
    card_height = 2.8*cm

    # Card background
    create_rounded_rect(c, x, y - card_height, card_width, card_height,
                       radius=0.2*cm, fill=True, fillColor=COLOR_LIGHT_BG,
                       stroke=True, strokeColor=HexColor('#E0E0E0'), strokeWidth=0.5)

    # Step number circle
    circle_x = x + 0.5*cm
    circle_y = y - 0.5*cm
    draw_circle(c, circle_x, circle_y, 0.35*cm, COLOR_RED)

    # Step number text
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(COLOR_TEXT_PRIMARY)
    c.drawString(circle_x - 0.12*cm, circle_y - 0.08*cm, str(step_num))

    # Icon (emoji text)
    c.setFont("Helvetica", 18)
    c.setFillColor(COLOR_RED)
    c.drawString(x + 1.2*cm, y - 0.45*cm, icon)

    # Title
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(COLOR_DARK)
    c.drawString(x + 0.3*cm, y - 0.95*cm, title)

    # Description
    c.setFont("Helvetica", 8)
    c.setFillColor(COLOR_TEXT_MUTED)
    desc_y = y - 1.35*cm
    for line in description.split('\n'):
        c.drawString(x + 0.3*cm, desc_y, line)
        desc_y -= 0.25*cm

def draw_telegram_box(c, x, y, width):
    """Draw Telegram commands quick reference"""
    box_height = 2.5*cm

    # Box background
    create_rounded_rect(c, x, y - box_height, width, box_height,
                       radius=0.2*cm, fill=True, fillColor=HexColor('#E3F2FD'),
                       stroke=True, strokeColor=HexColor('#90CAF9'), strokeWidth=1)

    # Title
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(COLOR_BLUE)
    c.drawString(x + 0.3*cm, y - 0.45*cm, "Comandi Telegram Bot")

    # Commands
    c.setFont("Courier", 8)
    c.setFillColor(COLOR_DARK)
    commands = [
        "/vado - Accetta urgenza disponibile",
        "/incorso - Segna inizio intervento",
        "/risolto NOTE - Risolvi urgenza",
        "/oggi - Interventi di oggi"
    ]

    cmd_y = y - 0.85*cm
    for cmd in commands:
        c.drawString(x + 0.4*cm, cmd_y, cmd)
        cmd_y -= 0.35*cm

def draw_qr_placeholder(c, x, y, size=1.2*cm):
    """Draw QR code placeholder"""
    create_rounded_rect(c, x, y - size, size, size,
                       radius=0.1*cm, fill=False,
                       stroke=True, strokeColor=COLOR_RED, strokeWidth=1)

    c.setFont("Helvetica", 7)
    c.setFillColor(COLOR_TEXT_MUTED)
    c.drawString(x + 0.1*cm, y - 0.6*cm, "QR Code")

def draw_footer(c, y_pos):
    """Draw page footer"""
    c.setFont("Helvetica", 8)
    c.setFillColor(COLOR_TEXT_MUTED)
    footer_text = "MRS Lely Center Emilia Romagna — Marzo 2026"
    c.drawString(margin, margin * 0.5, footer_text)

    # Page number (will be added per page)
    c.drawString(page_width - margin - 1*cm, margin * 0.5, f"Pagina 1 di 2")

def create_admin_page(c):
    """Create first page: Admin Quick Start"""
    page_height_val = page_height

    # Header
    y = draw_header(c, page_height_val - margin, "Quick Start Guide — Admin")

    # Section title
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(COLOR_DARK)
    c.drawString(margin, y - 0.5*cm, "5 Passaggi per Iniziare")

    y = y - 1.0*cm

    # Draw 5 step cards in 2 rows
    steps = [
        (1, "Accedi alla Dashboard", "URL: admin_v1.html\nCredenziali: m.bozzarelli", "🔐"),
        (2, "Panoramica KPI", "Visualizza urgenze aperte,\ninterventi in corso, SLA", "📊"),
        (3, "Crea un'Urgenza", "Compila modulo con cliente,\nmacchina, priorità, tecnico", "🚨"),
        (4, "Pianifica Intervento", "Seleziona data, cliente,\nmacchina e assegna tecnico", "📅"),
        (5, "Monitora Mappa", "Visualizza posizioni real-time\ndegli automezzi", "🗺️"),
    ]

    for i in range(5):
        step_num, title, desc, icon = steps[i]
        x = margin + (i % 2) * 4.5*cm
        y_current = y - (i // 2) * 3.0*cm
        draw_step_card(c, x, y_current, step_num, title, desc, icon)

    # Key features box
    y = y - 4.5*cm
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(COLOR_DARK)
    c.drawString(margin, y - 0.5*cm, "Funzioni Principali")

    y = y - 1.0*cm
    features = [
        "✓ Real-time KPI dashboard con grafici",
        "✓ Gestione completa clienti e macchine",
        "✓ Mappa interattiva con posizioni tecnici",
        "✓ Monitoring SLA e escalation automatiche",
        "✓ Export dati in Excel"
    ]

    c.setFont("Helvetica", 9)
    c.setFillColor(COLOR_TEXT_SECONDARY)
    for feature in features:
        c.drawString(margin + 0.3*cm, y, feature)
        y -= 0.35*cm

    # Footer with page number
    c.setFont("Helvetica", 8)
    c.setFillColor(COLOR_TEXT_MUTED)
    c.drawString(margin, margin * 0.5, "MRS Lely Center Emilia Romagna — Marzo 2026")
    c.drawString(page_width - margin - 1.5*cm, margin * 0.5, "Pagina 1 di 2")

def create_technician_page(c):
    """Create second page: Technician Quick Start"""
    page_height_val = page_height

    # Header
    y = draw_header(c, page_height_val - margin, "Quick Start Guide — Tecnico")

    # Section title
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(COLOR_DARK)
    c.drawString(margin, y - 0.5*cm, "5 Passaggi per Iniziare")

    y = y - 1.0*cm

    # Draw 5 step cards
    steps = [
        (1, "Installa la PWA", "Apri link da mobile,\nclick Aggiungi a Home", "📱"),
        (2, "I Tuoi Interventi", "Home page mostra interventi\ndel giorno assegnati", "📋"),
        (3, "Prendi Urgenza", "Lista urgenze → click\n'Prendi' per accettare", "⚡"),
        (4, "Lavora e Risolvi", "Segna 'In Corso' → 'Risolto'\ncon note e tempo impiegato", "✅"),
        (5, "Usa Telegram Bot", "Comandi rapidi da chat\n/vado /incorso /risolto", "💬"),
    ]

    for i in range(5):
        step_num, title, desc, icon = steps[i]
        x = margin + (i % 2) * 4.5*cm
        y_current = y - (i // 2) * 3.0*cm
        draw_step_card(c, x, y_current, step_num, title, desc, icon)

    # Telegram quick reference
    y = y - 4.5*cm
    draw_telegram_box(c, margin, y, page_width - 2*margin)

    y = y - 3.0*cm

    # QR Code section
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(COLOR_DARK)
    c.drawString(margin, y - 0.5*cm, "Scansiona il QR per accedere")

    # QR placeholder
    draw_qr_placeholder(c, page_width - 2.0*cm, y, 1.2*cm)

    # Quick tips
    y = y - 2.0*cm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(COLOR_DARK)
    c.drawString(margin, y, "Suggerimenti Rapidi")

    y = y - 0.5*cm
    c.setFont("Helvetica", 9)
    c.setFillColor(COLOR_TEXT_SECONDARY)
    tips = [
        "• La PWA funziona offline: i dati si sincronizzano quando torna la connessione",
        "• Foto durante intervento: usa la fotocamera per documentare il lavoro",
        "• Telegram ti notifica quando ricevi un'urgenza assegnata",
        "• Checklist disponibili: compila durante l'intervento per conformità"
    ]

    for tip in tips:
        c.drawString(margin + 0.3*cm, y, tip)
        y -= 0.35*cm

    # Footer
    c.setFont("Helvetica", 8)
    c.setFillColor(COLOR_TEXT_MUTED)
    c.drawString(margin, margin * 0.5, "MRS Lely Center Emilia Romagna — Marzo 2026")
    c.drawString(page_width - margin - 1.5*cm, margin * 0.5, "Pagina 2 di 2")

def create_pdf():
    """Create the complete 2-page PDF"""
    output_path = "/sessions/brave-peaceful-lovelace/mnt/Syntoniqa_repo/docs/09_Quick_Start_Guide.pdf"

    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle("SYNTONIQA v1.0 - Quick Start Guide")

    # Page 1: Admin Quick Start
    create_admin_page(c)
    c.showPage()

    # Page 2: Technician Quick Start
    create_technician_page(c)
    c.showPage()

    # Save
    c.save()
    print(f"✓ PDF created: {output_path}")
    return output_path

if __name__ == "__main__":
    create_pdf()
