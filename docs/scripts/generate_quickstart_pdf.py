#!/usr/bin/env python3
"""
Syntoniqa v1.0 Quick Start Guide PDF Generator
Creates a 4-page professional guide with embedded mockup images
"""

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm, inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Image, Paragraph, Spacer, PageBreak, Table,
    TableStyle, KeepTogether
)
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from datetime import datetime

# Color scheme
DARK_BG = HexColor("#0f0f1a")
CARD_BG = HexColor("#1e1e32")
TEXT_COLOR = HexColor("#e0e0e0")
TEXT_LIGHT = HexColor("#b0b0b0")
ACCENT_RED = HexColor("#C30A14")
WHITE = HexColor("#ffffff")
LIGHT_GRAY = HexColor("#a0a0a0")

# Page dimensions
PAGE_WIDTH, PAGE_HEIGHT = landscape(A4)
MARGIN = 0.8 * cm

# Custom styles
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=32,
    textColor=WHITE,
    spaceAfter=12,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold'
)

heading_style = ParagraphStyle(
    'CustomHeading',
    parent=styles['Heading2'],
    fontSize=20,
    textColor=WHITE,
    spaceAfter=8,
    fontName='Helvetica-Bold',
    textTransform='uppercase'
)

section_heading = ParagraphStyle(
    'SectionHeading',
    parent=styles['Heading2'],
    fontSize=14,
    textColor=ACCENT_RED,
    spaceAfter=6,
    fontName='Helvetica-Bold'
)

normal_style = ParagraphStyle(
    'CustomNormal',
    parent=styles['Normal'],
    fontSize=10,
    textColor=TEXT_COLOR,
    leading=14,
    fontName='Helvetica'
)

small_style = ParagraphStyle(
    'CustomSmall',
    parent=styles['Normal'],
    fontSize=8,
    textColor=TEXT_LIGHT,
    leading=11,
    fontName='Helvetica'
)

subtitle_style = ParagraphStyle(
    'CustomSubtitle',
    parent=styles['Normal'],
    fontSize=16,
    textColor=TEXT_COLOR,
    spaceAfter=6,
    alignment=TA_CENTER,
    fontName='Helvetica'
)

def create_cover_page():
    """Create page 1: Cover page with dark background and branding"""
    story = []

    # Add dark background via spacer
    story.append(Spacer(1, 1.5 * cm))

    # Main title
    story.append(Paragraph("SYNTONIQA", title_style))
    story.append(Paragraph("v1.0", ParagraphStyle('Version', parent=heading_style, fontSize=18)))

    story.append(Spacer(1, 0.8 * cm))

    # Subtitle
    story.append(Paragraph("Quick Start Guide", subtitle_style))

    story.append(Spacer(1, 1.2 * cm))

    # Organization and date
    story.append(Paragraph("MRS Lely Center Emilia Romagna", normal_style))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Marzo 2026", small_style))

    story.append(Spacer(1, 2 * cm))

    # Red accent box with features
    features = [
        "Field Service Management PWA",
        "Admin Dashboard + Mobile App",
        "Telegram Bot Integration",
        "AI-Powered Analytics"
    ]

    for feature in features:
        story.append(Paragraph(f"• {feature}", normal_style))
        story.append(Spacer(1, 0.2 * cm))

    return story

def create_page_class(bg_color):
    """Create a custom page canvas class for background colors"""
    class NumberedCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            canvas.Canvas.__init__(self, *args, **kwargs)
            self._bg_color = bg_color

        def showPage(self):
            # Draw background
            self.setFillColor(self._bg_color)
            self.rect(0, 0, self.pagesize[0], self.pagesize[1], fill=1, stroke=0)
            canvas.Canvas.showPage(self)

    return NumberedCanvas

def create_admin_page():
    """Create page 2: Admin Quick Start"""
    story = []

    story.append(Spacer(1, 0.5 * cm))

    # Title
    story.append(Paragraph("Pannello Amministratore", heading_style))

    story.append(Spacer(1, 0.4 * cm))

    # Two column layout: image on left, steps on right
    img_path = "/sessions/brave-peaceful-lovelace/mockups/admin_dashboard.png"

    if os.path.exists(img_path):
        admin_img = Image(img_path, width=4.5*cm, height=3*cm)
    else:
        admin_img = Paragraph("[Admin Dashboard Image]", small_style)

    # Steps
    steps = [
        ("1. Accedi", "fieldforcemrser2026.github.io/syntoniqa/admin_v1.html"),
        ("2. Login", "Username + Password"),
        ("3. Dashboard", "Urgenze aperte, interventi oggi, KPI"),
        ("4. Crea Urgenza", "Urgenze → Nuova → Compila form"),
        ("5. Assegna Tecnico", "Seleziona dalla lista"),
        ("6. Monitora SLA", "Timer automatico, escalation")
    ]

    steps_text = []
    for title, desc in steps:
        steps_text.append(Paragraph(f"<b>{title}:</b> {desc}", small_style))
        steps_text.append(Spacer(1, 0.15 * cm))

    # Create table
    data = [
        [admin_img, steps_text]
    ]

    table = Table(data, colWidths=[5*cm, 12*cm])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0.2*cm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0.2*cm),
    ]))

    story.append(table)

    story.append(Spacer(1, 0.6 * cm))

    # Key URLs box
    story.append(Paragraph("Key URLs", section_heading))
    urls = [
        ("Admin Dashboard:", "https://fieldforcemrser2026.github.io/syntoniqa/admin_v1.html"),
        ("API Worker:", "https://syntoniqa-mrs-api.fieldforcemrser.workers.dev"),
        ("GitHub Repo:", "https://github.com/fieldforcemrser2026/syntoniqa")
    ]

    for label, url in urls:
        story.append(Paragraph(f"<b>{label}</b><br/>{url}", small_style))
        story.append(Spacer(1, 0.15 * cm))

    story.append(Spacer(1, 0.3 * cm))

    # AI Engine note
    story.append(Paragraph("<b>AI Engine:</b> Integrates Gemini, Claude, GPT-4, and open-source models for intelligent task automation and analysis.", small_style))

    return story

def create_mobile_telegram_page():
    """Create page 3: Mobile App and Telegram Bot"""
    story = []

    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Tecnico Mobile + Bot Telegram", heading_style))

    story.append(Spacer(1, 0.4 * cm))

    # Left column: Mobile app
    mobile_section = []
    mobile_section.append(Paragraph("App Mobile Tecnico", section_heading))

    mobile_img1_path = "/sessions/brave-peaceful-lovelace/mockups/mobile_home.png"
    mobile_img2_path = "/sessions/brave-peaceful-lovelace/mockups/urgenza_detail.png"

    if os.path.exists(mobile_img1_path):
        mobile_img1 = Image(mobile_img1_path, width=1.8*cm, height=1.95*cm)
    else:
        mobile_img1 = Paragraph("[Mobile Home]", small_style)

    if os.path.exists(mobile_img2_path):
        mobile_img2 = Image(mobile_img2_path, width=1.8*cm, height=1.95*cm)
    else:
        mobile_img2 = Paragraph("[Urgenza Detail]", small_style)

    # Mobile steps
    mobile_steps = [
        "1. Installa PWA su home screen",
        "2. Login con credenziali",
        "3. Prendi urgenza dalla lista",
        "4. Segna 'In Corso'",
        "5. Risolvi con note/foto",
        "6. Sync automatico offline"
    ]

    mobile_text = []
    for step in mobile_steps:
        mobile_text.append(Paragraph(step, small_style))
        mobile_text.append(Spacer(1, 0.12 * cm))

    # Right column: Telegram
    telegram_section = []
    telegram_section.append(Paragraph("Bot Telegram", section_heading))

    telegram_img_path = "/sessions/brave-peaceful-lovelace/mockups/telegram_chat.png"
    if os.path.exists(telegram_img_path):
        telegram_img = Image(telegram_img_path, width=2*cm, height=1.75*cm)
    else:
        telegram_img = Paragraph("[Telegram Chat]", small_style)

    # Telegram commands
    telegram_commands = [
        ("/vado", "Mostra urgenze aperte"),
        ("/incorso", "Segna in corso"),
        ("/risolto", "Risolvi urgenza"),
        ("/ordine", "Crea ordine"),
        ("Foto/Testo", "AI analizza")
    ]

    telegram_text = []
    for cmd, desc in telegram_commands:
        telegram_text.append(Paragraph(f"<b>{cmd}</b> - {desc}", small_style))
        telegram_text.append(Spacer(1, 0.12 * cm))

    # Create two-column layout
    left_data = [[mobile_img1, mobile_img2]]
    left_table = Table(left_data, colWidths=[2*cm, 2*cm])
    left_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0.1*cm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0.1*cm),
    ]))

    mobile_section.append(left_table)
    mobile_section.append(Spacer(1, 0.2 * cm))
    mobile_section.extend(mobile_text)

    telegram_section.append(telegram_img)
    telegram_section.append(Spacer(1, 0.2 * cm))
    telegram_section.extend(telegram_text)

    # Combine in two columns
    main_data = [[mobile_section, telegram_section]]
    main_table = Table(main_data, colWidths=[10*cm, 9*cm])
    main_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0.3*cm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0.3*cm),
    ]))

    story.append(main_table)

    story.append(Spacer(1, 0.4 * cm))

    # AI note
    story.append(Paragraph("<b>AI Engine:</b> Il bot analizza intelligentemente testo e foto per automatizzare la creazione di urgenze e ordini.", small_style))

    return story

def create_reference_page():
    """Create page 4: Quick Reference Card"""
    story = []

    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Quick Reference Card", heading_style))

    story.append(Spacer(1, 0.3 * cm))

    # Column 1: URLs & Access
    col1 = []
    col1.append(Paragraph("URL & Accessi", section_heading))
    col1.append(Spacer(1, 0.1 * cm))

    urls = [
        ("Admin:", "fieldforcemrser2026.github.io/syntoniqa/admin_v1.html"),
        ("Tecnico:", "fieldforcemrser2026.github.io/syntoniqa/index_v2.html"),
        ("API:", "syntoniqa-mrs-api.fieldforcemrser.workers.dev"),
        ("GitHub:", "github.com/fieldforcemrser2026/syntoniqa"),
        ("Supabase:", "sajzbanhkehkkhhgztkq.supabase.co"),
    ]

    for label, url in urls:
        col1.append(Paragraph(f"<b>{label}</b><br/><font size=7>{url}</font>", small_style))
        col1.append(Spacer(1, 0.15 * cm))

    # Column 2: Urgenza Workflow
    col2 = []
    col2.append(Paragraph("Workflow Urgenze", section_heading))
    col2.append(Spacer(1, 0.1 * cm))

    workflow = [
        ("aperta", "Nuova urgenza"),
        ("assegnata", "→ Assegnata a tecnico"),
        ("schedulata", "→ In pianificazione"),
        ("in_corso", "→ Lavoro in progress"),
        ("risolta", "→ Lavoro completato"),
        ("chiusa", "→ Terminale"),
    ]

    for state, action in workflow:
        col2.append(Paragraph(f"<b>{state}</b> {action}", small_style))
        col2.append(Spacer(1, 0.12 * cm))

    # Column 3: Telegram Commands
    col3 = []
    col3.append(Paragraph("Telegram Bot", section_heading))
    col3.append(Spacer(1, 0.1 * cm))

    commands = [
        ("/vado", "Mostra urgenze"),
        ("/vado 2", "Prendi urgenza #2"),
        ("/incorso", "Segna in corso"),
        ("/risolto", "Risolvi urgenza"),
        ("/oggi", "Piano odierno"),
        ("/ordine", "Crea ordine"),
        ("/help", "Aiuto comandi"),
    ]

    for cmd, desc in commands:
        col3.append(Paragraph(f"<b>{cmd}</b><br/>{desc}", small_style))
        col3.append(Spacer(1, 0.12 * cm))

    # Create 3-column table
    data = [[col1, col2, col3]]
    table = Table(data, colWidths=[6.5*cm, 6.5*cm, 6*cm])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0.3*cm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0.3*cm),
        ('TOPPADDING', (0, 0), (-1, -1), 0.2*cm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0.2*cm),
    ]))

    story.append(table)

    story.append(Spacer(1, 0.8 * cm))

    # Footer
    footer_text = "Supporto: Marcello Bozzarelli | Syntoniqa v1.0 | MRS Lely Center Emilia Romagna | Marzo 2026"
    story.append(Paragraph(footer_text, small_style))

    return story

def main():
    """Generate the complete PDF"""
    output_path = "/sessions/brave-peaceful-lovelace/mnt/Syntoniqa_repo/docs/09_Quick_Start_Guide.pdf"

    # Ensure docs directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Create document with custom page canvas
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        pageCompression=1
    )

    # Build story with all pages
    story = []

    # Page 1: Cover
    story.extend(create_cover_page())
    story.append(PageBreak())

    # Page 2: Admin
    story.extend(create_admin_page())
    story.append(PageBreak())

    # Page 3: Mobile + Telegram
    story.extend(create_mobile_telegram_page())
    story.append(PageBreak())

    # Page 4: Reference
    story.extend(create_reference_page())

    # Custom canvas with dark background
    class DarkCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            canvas.Canvas.__init__(self, *args, **kwargs)
            self.page_num = 0

        def showPage(self):
            # Get page size
            w, h = self._pagesize if hasattr(self, '_pagesize') else landscape(A4)

            # Draw dark background
            self.setFillColor(DARK_BG)
            self.rect(0, 0, w, h, fill=1, stroke=0)

            # Draw red accent bar at top
            self.setFillColor(ACCENT_RED)
            self.rect(0, h - 0.3*cm, w, 0.3*cm, fill=1, stroke=0)

            canvas.Canvas.showPage(self)

    # Build the PDF
    doc.build(story, canvasmaker=DarkCanvas)

    print(f"✓ PDF generated: {output_path}")
    return output_path

if __name__ == "__main__":
    pdf_path = main()
    print(f"\nOutput: {pdf_path}")
