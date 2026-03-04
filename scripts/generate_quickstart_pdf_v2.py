#!/usr/bin/env python3
"""
Syntoniqa v1.0 Quick Start Guide PDF Generator - Version 2
Creates a 4-page professional guide with embedded mockup images
Uses direct canvas drawing for better control and image visibility
"""

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm, inch, mm
from reportlab.lib.colors import HexColor, black, white, lightgrey
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import os

# Color scheme
DARK_BG = "#0f0f1a"
CARD_BG = "#1e1e32"
TEXT_COLOR = "#e0e0e0"
TEXT_LIGHT = "#b0b0b0"
ACCENT_RED = "#C30A14"
WHITE = "#ffffff"

# Page dimensions
PAGE_WIDTH, PAGE_HEIGHT = landscape(A4)
MARGIN = 0.8 * cm

class SyntoniqaGuideCanvas(canvas.Canvas):
    """Custom canvas for Syntoniqa Quick Start Guide"""

    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self.page_num = 0
        self.setFont("Helvetica", 10)

    def _draw_background(self):
        """Draw dark background and red accent bar"""
        self.setFillColor(HexColor(DARK_BG))
        self.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

        # Red accent bar at top
        self.setFillColor(HexColor(ACCENT_RED))
        self.rect(0, PAGE_HEIGHT - 0.3*cm, PAGE_WIDTH, 0.3*cm, fill=1, stroke=0)

    def _draw_footer(self, text):
        """Draw footer text"""
        self.setFont("Helvetica", 8)
        self.setFillColor(HexColor(TEXT_LIGHT))
        self.drawString(MARGIN, MARGIN * 0.5, text)

    def draw_page_1_cover(self):
        """Page 1: Cover"""
        self._draw_background()

        x_center = PAGE_WIDTH / 2
        y = PAGE_HEIGHT - 3*cm

        # Title
        self.setFont("Helvetica-Bold", 56)
        self.setFillColor(HexColor(WHITE))
        self.drawCentredString(x_center, y, "SYNTONIQA")

        y -= 1.2*cm
        self.setFont("Helvetica-Bold", 24)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawCentredString(x_center, y, "v1.0")

        y -= 1.5*cm
        self.setFont("Helvetica-Bold", 18)
        self.setFillColor(HexColor(TEXT_COLOR))
        self.drawCentredString(x_center, y, "Quick Start Guide")

        y -= 2*cm
        self.setFont("Helvetica", 12)
        self.setFillColor(HexColor(TEXT_COLOR))
        self.drawCentredString(x_center, y, "MRS Lely Center Emilia Romagna")

        y -= 0.6*cm
        self.setFont("Helvetica", 11)
        self.setFillColor(HexColor(TEXT_LIGHT))
        self.drawCentredString(x_center, y, "Marzo 2026")

        # Features
        y -= 2*cm
        self.setFont("Helvetica", 11)
        self.setFillColor(HexColor(TEXT_COLOR))
        features = [
            "Field Service Management PWA",
            "Admin Dashboard + Mobile App",
            "Telegram Bot Integration",
            "AI-Powered Analytics"
        ]
        for feature in features:
            self.drawCentredString(x_center, y, "• " + feature)
            y -= 0.6*cm

    def draw_page_2_admin(self):
        """Page 2: Admin Quick Start"""
        self._draw_background()

        # Title
        x = MARGIN
        y = PAGE_HEIGHT - 1.2*cm
        self.setFont("Helvetica-Bold", 24)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(x, y, "Pannello Amministratore")

        # Admin image
        img_path = "/sessions/brave-peaceful-lovelace/mockups/admin_dashboard.png"
        y -= 1*cm
        if os.path.exists(img_path):
            try:
                img = ImageReader(img_path)
                img_width = 5*cm
                img_height = 3.3*cm
                self.drawImage(img, x, y - img_height, width=img_width, height=img_height)
                image_drawn = True
            except:
                image_drawn = False
                self.setFont("Helvetica", 9)
                self.setFillColor(HexColor(TEXT_LIGHT))
                self.drawString(x, y, "[Admin Dashboard Image]")
        else:
            image_drawn = False

        # Steps on the right
        step_x = x + 5.5*cm
        step_y = y
        self.setFont("Helvetica-Bold", 10)
        self.setFillColor(HexColor(ACCENT_RED))

        steps = [
            ("1. Accedi", "fieldforcemrser2026.github.io/syntoniqa/admin_v1.html"),
            ("2. Login", "Username + Password"),
            ("3. Dashboard", "Urgenze aperte, interventi oggi, KPI"),
            ("4. Crea Urgenza", "Urgenze → Nuova → Compila form"),
            ("5. Assegna Tecnico", "Seleziona dalla lista"),
            ("6. Monitora SLA", "Timer automatico, escalation")
        ]

        for i, (title, desc) in enumerate(steps):
            self.setFont("Helvetica-Bold", 9)
            self.setFillColor(HexColor(ACCENT_RED))
            self.drawString(step_x, step_y, title)
            step_y -= 0.35*cm

            self.setFont("Helvetica", 8)
            self.setFillColor(HexColor(TEXT_COLOR))
            self.drawString(step_x + 0.3*cm, step_y, desc)
            step_y -= 0.4*cm

        # Key URLs section
        y_urls = PAGE_HEIGHT - 6.5*cm
        self.setFont("Helvetica-Bold", 11)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(x, y_urls, "Key URLs")

        y_urls -= 0.5*cm
        self.setFont("Helvetica", 8)
        self.setFillColor(HexColor(TEXT_COLOR))

        urls = [
            ("Admin:", "https://fieldforcemrser2026.github.io/syntoniqa/admin_v1.html"),
            ("API:", "https://syntoniqa-mrs-api.fieldforcemrser.workers.dev"),
            ("GitHub:", "https://github.com/fieldforcemrser2026/syntoniqa")
        ]

        for label, url in urls:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(HexColor(TEXT_COLOR))
            self.drawString(x, y_urls, label)
            self.setFont("Helvetica", 7)
            self.setFillColor(HexColor(TEXT_LIGHT))
            self.drawString(x + 1.5*cm, y_urls, url)
            y_urls -= 0.4*cm

        # AI Engine note
        y_urls -= 0.3*cm
        self.setFont("Helvetica", 8)
        self.setFillColor(HexColor(TEXT_LIGHT))
        ai_note = "AI Engine: Integrates Gemini, Claude, GPT-4, and open-source models"
        self.drawString(x, y_urls, ai_note)

    def draw_page_3_mobile_telegram(self):
        """Page 3: Mobile App and Telegram Bot"""
        self._draw_background()

        # Title
        x = MARGIN
        y = PAGE_HEIGHT - 1.2*cm
        self.setFont("Helvetica-Bold", 24)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(x, y, "Tecnico Mobile + Bot Telegram")

        # Mobile section (left)
        y -= 1*cm
        self.setFont("Helvetica-Bold", 12)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(x, y, "App Mobile Tecnico")

        y -= 0.6*cm
        # Mobile images
        mobile_img1_path = "/sessions/brave-peaceful-lovelace/mockups/mobile_home.png"
        mobile_img2_path = "/sessions/brave-peaceful-lovelace/mockups/urgenza_detail.png"

        if os.path.exists(mobile_img1_path):
            try:
                img1 = ImageReader(mobile_img1_path)
                img_width = 1.8*cm
                img_height = 1.95*cm
                self.drawImage(img1, x, y - img_height, width=img_width, height=img_height)
            except:
                pass

        if os.path.exists(mobile_img2_path):
            try:
                img2 = ImageReader(mobile_img2_path)
                img_width = 1.8*cm
                img_height = 1.95*cm
                self.drawImage(img2, x + 2.2*cm, y - img_height, width=img_width, height=img_height)
            except:
                pass

        y -= 2.2*cm
        self.setFont("Helvetica", 8)
        self.setFillColor(HexColor(TEXT_COLOR))

        mobile_steps = [
            "1. Installa PWA su home screen",
            "2. Login con credenziali",
            "3. Prendi urgenza dalla lista",
            "4. Segna 'In Corso'",
            "5. Risolvi con note/foto",
            "6. Sync automatico offline"
        ]

        for step in mobile_steps:
            self.drawString(x, y, step)
            y -= 0.35*cm

        # Telegram section (right)
        x_right = MARGIN + 10.5*cm
        y_right = PAGE_HEIGHT - 1.8*cm
        self.setFont("Helvetica-Bold", 12)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(x_right, y_right, "Bot Telegram")

        y_right -= 0.6*cm
        # Telegram image
        telegram_img_path = "/sessions/brave-peaceful-lovelace/mockups/telegram_chat.png"
        if os.path.exists(telegram_img_path):
            try:
                img = ImageReader(telegram_img_path)
                img_width = 2*cm
                img_height = 1.75*cm
                self.drawImage(img, x_right, y_right - img_height, width=img_width, height=img_height)
            except:
                pass

        y_right -= 2.2*cm
        self.setFont("Helvetica", 8)
        self.setFillColor(HexColor(TEXT_COLOR))

        telegram_commands = [
            ("/vado", "Mostra urgenze aperte"),
            ("/incorso", "Segna in corso"),
            ("/risolto", "Risolvi urgenza"),
            ("/ordine", "Crea ordine"),
            ("Foto/Testo", "AI analizza")
        ]

        for cmd, desc in telegram_commands:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(HexColor(ACCENT_RED))
            self.drawString(x_right, y_right, cmd)
            self.setFont("Helvetica", 7)
            self.setFillColor(HexColor(TEXT_COLOR))
            self.drawString(x_right + 1.3*cm, y_right, desc)
            y_right -= 0.35*cm

    def draw_page_4_reference(self):
        """Page 4: Quick Reference Card"""
        self._draw_background()

        # Title
        x = MARGIN
        y = PAGE_HEIGHT - 1.2*cm
        self.setFont("Helvetica-Bold", 24)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(x, y, "Quick Reference Card")

        # Column 1: URLs
        y -= 1.2*cm
        col1_x = x
        self.setFont("Helvetica-Bold", 11)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(col1_x, y, "URL & Accessi")

        y -= 0.5*cm
        self.setFont("Helvetica", 7.5)
        self.setFillColor(HexColor(TEXT_COLOR))

        urls = [
            ("Admin:", "fieldforcemrser2026.github.io/syntoniqa/admin_v1.html"),
            ("Tecnico:", "fieldforcemrser2026.github.io/syntoniqa/index_v2.html"),
            ("API:", "syntoniqa-mrs-api.fieldforcemrser.workers.dev"),
            ("GitHub:", "github.com/fieldforcemrser2026/syntoniqa"),
            ("Supabase:", "sajzbanhkehkkhhgztkq.supabase.co"),
        ]

        for label, url in urls:
            self.setFont("Helvetica-Bold", 7)
            self.setFillColor(HexColor(TEXT_COLOR))
            self.drawString(col1_x, y, label)
            self.setFont("Helvetica", 6.5)
            self.setFillColor(HexColor(TEXT_LIGHT))
            self.drawString(col1_x + 1.2*cm, y, url)
            y -= 0.4*cm

        # Column 2: Workflow
        col2_x = x + 7*cm
        y = PAGE_HEIGHT - 2.2*cm
        self.setFont("Helvetica-Bold", 11)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(col2_x, y, "Workflow Urgenze")

        y -= 0.5*cm
        self.setFont("Helvetica", 7.5)
        self.setFillColor(HexColor(TEXT_COLOR))

        workflow = [
            ("aperta:", "Nuova urgenza"),
            ("assegnata:", "→ Assegnata a tecnico"),
            ("schedulata:", "→ In pianificazione"),
            ("in_corso:", "→ Lavoro in progress"),
            ("risolta:", "→ Lavoro completato"),
            ("chiusa:", "→ Terminale"),
        ]

        for state, action in workflow:
            self.setFont("Helvetica-Bold", 7)
            self.setFillColor(HexColor(ACCENT_RED))
            self.drawString(col2_x, y, state)
            self.setFont("Helvetica", 7)
            self.setFillColor(HexColor(TEXT_COLOR))
            self.drawString(col2_x + 1.5*cm, y, action)
            y -= 0.35*cm

        # Column 3: Telegram
        col3_x = x + 13.5*cm
        y = PAGE_HEIGHT - 2.2*cm
        self.setFont("Helvetica-Bold", 11)
        self.setFillColor(HexColor(ACCENT_RED))
        self.drawString(col3_x, y, "Telegram Bot")

        y -= 0.5*cm
        self.setFont("Helvetica", 7.5)
        self.setFillColor(HexColor(TEXT_COLOR))

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
            self.setFont("Helvetica-Bold", 7)
            self.setFillColor(HexColor(ACCENT_RED))
            self.drawString(col3_x, y, cmd)
            self.setFont("Helvetica", 6.5)
            self.setFillColor(HexColor(TEXT_COLOR))
            self.drawString(col3_x + 1.2*cm, y, desc)
            y -= 0.35*cm

        # Footer
        footer_text = "Supporto: Marcello Bozzarelli | Syntoniqa v1.0 | MRS Lely Center Emilia Romagna | Marzo 2026"
        self.setFont("Helvetica", 7)
        self.setFillColor(HexColor(TEXT_LIGHT))
        self.drawString(MARGIN, MARGIN * 0.5, footer_text)

    def showPage(self):
        """Override showPage to draw content based on page number"""
        self.page_num += 1

        if self.page_num == 1:
            self.draw_page_1_cover()
        elif self.page_num == 2:
            self.draw_page_2_admin()
        elif self.page_num == 3:
            self.draw_page_3_mobile_telegram()
        elif self.page_num == 4:
            self.draw_page_4_reference()

        canvas.Canvas.showPage(self)


def create_pdf():
    """Create the PDF"""
    output_path = "/sessions/brave-peaceful-lovelace/mnt/Syntoniqa_repo/docs/09_Quick_Start_Guide.pdf"

    # Ensure docs directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Create canvas - just 4 empty pages, the showPage override handles drawing
    c = SyntoniqaGuideCanvas(output_path, pagesize=landscape(A4))

    # Create 4 pages
    for i in range(4):
        c.showPage()

    c.save()
    print(f"✓ PDF generated: {output_path}")
    return output_path


if __name__ == "__main__":
    pdf_path = create_pdf()
    print(f"\nOutput: {pdf_path}")
    print(f"File size: {os.path.getsize(pdf_path) / 1024:.1f} KB")
