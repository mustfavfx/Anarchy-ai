from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.colors import HexColor
import os

# ── Brand Colors ───────────────────────────────────────────────────────────────
BLACK      = HexColor("#0A0A0A")
RED        = HexColor("#E63030")
RED_DARK   = HexColor("#B01E1E")
DARK_GRAY  = HexColor("#1A1A1A")
MID_GRAY   = HexColor("#2A2A2A")
LIGHT_GRAY = HexColor("#3A3A3A")
TEXT_WHITE = HexColor("#F5F5F5")
TEXT_GRAY  = HexColor("#AAAAAA")
SUCCESS    = HexColor("#2ECC71")
WARNING    = HexColor("#F39C12")
DANGER     = HexColor("#E74C3C")
INFO       = HexColor("#3498DB")
BORDER     = HexColor("#2D2D2D")
CODE_RED   = HexColor("#E06C75")
CODE_BG    = HexColor("#1A1A1A")

W, H = A4

# ── Page Template ──────────────────────────────────────────────────────────────
class PageTemplate:
    def __init__(self, doc_title="", file_num=2, total_files=8):
        self.doc_title   = doc_title
        self.file_num    = file_num
        self.total_files = total_files

    def __call__(self, canv, doc):
        canv.saveState()
        canv.setFillColor(BLACK)
        canv.rect(0, 0, W, H, fill=1, stroke=0)

        canv.setFillColor(DARK_GRAY)
        canv.rect(0, H - 28*mm, W, 28*mm, fill=1, stroke=0)
        canv.setFillColor(RED)
        canv.rect(0, H - 28*mm, W, 1.2*mm, fill=1, stroke=0)

        canv.setFont("Helvetica-Bold", 11)
        canv.setFillColor(RED)
        canv.drawString(18*mm, H - 16*mm, "ANARCHY")
        canv.setFont("Helvetica", 11)
        canv.setFillColor(TEXT_WHITE)
        canv.drawString(18*mm + 58, H - 16*mm, "AI")

        canv.setFont("Helvetica", 8)
        canv.setFillColor(TEXT_GRAY)
        canv.drawCentredString(W/2, H - 13*mm, self.doc_title)
        canv.setFont("Helvetica-Bold", 7)
        canv.setFillColor(RED)
        canv.drawCentredString(W/2, H - 20*mm, f"FILE {self.file_num} / {self.total_files}")

        canv.setFont("Helvetica", 8)
        canv.setFillColor(TEXT_GRAY)
        canv.drawRightString(W - 18*mm, H - 16*mm, f"Page {doc.page}")

        canv.setFillColor(DARK_GRAY)
        canv.rect(0, 0, W, 14*mm, fill=1, stroke=0)
        canv.setFillColor(RED)
        canv.rect(0, 14*mm, W, 0.6*mm, fill=1, stroke=0)

        canv.setFont("Helvetica", 7)
        canv.setFillColor(TEXT_GRAY)
        canv.drawString(18*mm, 5*mm, "CONFIDENTIAL — Internal Technical Documentation")
        canv.drawRightString(W - 18*mm, 5*mm, "© 2025 Anarchy AI Platform")

        canv.setFillColor(RED)
        canv.rect(0, 0, 3, H, fill=1, stroke=0)
        canv.restoreState()

# ── Styles ─────────────────────────────────────────────────────────────────────
def build_styles():
    def s(name, **kw):
        kw.setdefault("fontName", "Helvetica")
        kw.setdefault("textColor", TEXT_WHITE)
        return ParagraphStyle(name, **kw)

    return {
        "chapter_title": s("ct", fontName="Helvetica-Bold", fontSize=26,
            textColor=TEXT_WHITE, spaceAfter=3*mm, spaceBefore=4*mm, leading=32),
        "chapter_sub": s("cs", fontSize=12, textColor=TEXT_GRAY,
            spaceAfter=6*mm, leading=18),
        "section_h1": s("sh1", fontName="Helvetica-Bold", fontSize=15,
            textColor=RED, spaceAfter=3*mm, spaceBefore=6*mm, leading=20),
        "section_h2": s("sh2", fontName="Helvetica-Bold", fontSize=11,
            textColor=TEXT_WHITE, spaceAfter=2*mm, spaceBefore=4*mm, leading=16),
        "section_h3": s("sh3", fontName="Helvetica-Bold", fontSize=9,
            textColor=TEXT_GRAY, spaceAfter=1*mm, spaceBefore=2*mm, leading=13),
        "body": s("body", fontSize=9, textColor=TEXT_WHITE,
            spaceAfter=3*mm, leading=15, alignment=TA_JUSTIFY),
        "body_gray": s("bg", fontSize=9, textColor=TEXT_GRAY,
            spaceAfter=2*mm, leading=14, alignment=TA_JUSTIFY),
        "bullet": s("bul", fontSize=9, textColor=TEXT_WHITE,
            spaceAfter=1.5*mm, leading=14, leftIndent=8*mm),
        "bullet_gray": s("bulg", fontSize=8.5, textColor=TEXT_GRAY,
            spaceAfter=1*mm, leading=13, leftIndent=8*mm),
        "code": s("code", fontName="Courier", fontSize=7.5,
            textColor=CODE_RED, backColor=CODE_BG,
            spaceAfter=2*mm, leading=11, leftIndent=3*mm,
            borderPadding=(4, 6, 4, 6)),
        "toc_chapter": s("tcc", fontName="Helvetica-Bold", fontSize=10,
            textColor=TEXT_WHITE, spaceAfter=1.5*mm, leading=14),
        "toc_section": s("tcs", fontSize=9, textColor=TEXT_GRAY,
            spaceAfter=0.8*mm, leading=13, leftIndent=6*mm),
        "cell": s("cell", fontSize=8, textColor=TEXT_WHITE, leading=12),
        "cell_red": s("cellr", fontName="Helvetica-Bold", fontSize=8,
            textColor=RED, leading=12),
        "cell_gray": s("cellg", fontSize=8, textColor=TEXT_GRAY, leading=12),
        "cell_code": s("cellc", fontName="Courier", fontSize=7.5,
            textColor=CODE_RED, leading=11),
        "cover_title": s("cvt", fontName="Helvetica-Bold", fontSize=40,
            textColor=TEXT_WHITE, alignment=TA_CENTER, leading=50, spaceAfter=3*mm),
        "cover_red": s("cvr", fontName="Helvetica-Bold", fontSize=42,
            textColor=RED, alignment=TA_CENTER, leading=52, spaceAfter=6*mm),
        "cover_sub": s("cvs", fontSize=13, textColor=TEXT_GRAY,
            alignment=TA_CENTER, leading=18, spaceAfter=3*mm),
        "cover_meta": s("cvm", fontSize=10, textColor=TEXT_GRAY,
            alignment=TA_CENTER, leading=14),
        "tag_critical": s("tc", fontName="Helvetica-Bold", fontSize=7,
            textColor=DANGER, leading=10),
        "tag_high": s("th", fontName="Helvetica-Bold", fontSize=7,
            textColor=WARNING, leading=10),
        "tag_ok": s("tok", fontName="Helvetica-Bold", fontSize=7,
            textColor=SUCCESS, leading=10),
    }

# ── Helpers ────────────────────────────────────────────────────────────────────
def hr(color=RED, thickness=0.8):
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceAfter=3*mm, spaceBefore=1*mm)

def sp(h=4):
    return Spacer(1, h*mm)

def info_box(title, paragraphs, styles, border_color=RED):
    content = [Paragraph(f"<b>{title}</b>", ParagraphStyle("ibt",
        fontName="Helvetica-Bold", fontSize=10, textColor=border_color, leading=14))]
    content.append(Spacer(1, 2*mm))
    content.extend(paragraphs)
    t = Table([[content]], colWidths=[W - 48*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), DARK_GRAY),
        ("BOX", (0,0),(-1,-1), 1.5, border_color),
        ("LEFTPADDING", (0,0),(-1,-1), 8),
        ("RIGHTPADDING", (0,0),(-1,-1), 8),
        ("TOPPADDING", (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("VALIGN", (0,0),(-1,-1), "TOP"),
    ]))
    return t

def std_table(header_row, data_rows, col_widths, styles, box_color=RED):
    header = [Paragraph(f"<b>{h}</b>", styles["cell_red"]) for h in header_row]
    data = [header] + data_rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,0), MID_GRAY),
        ("BACKGROUND", (0,1),(-1,-1), DARK_GRAY),
        ("ROWBACKGROUNDS", (0,1),(-1,-1), [DARK_GRAY, BLACK]),
        ("GRID", (0,0),(-1,-1), 0.4, BORDER),
        ("BOX", (0,0),(-1,-1), 1, box_color),
        ("VALIGN", (0,0),(-1,-1), "TOP"),
        ("TOPPADDING", (0,0),(-1,-1), 5),
        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0),(-1,-1), 6),
        ("RIGHTPADDING", (0,0),(-1,-1), 6),
        ("LINEBELOW", (0,0),(-1,0), 1, box_color),
    ]))
    return t

def severity_badge(level, styles):
    colors_map = {
        "CRITICAL": ("#E74C3C", "CRITICAL"),
        "HIGH":     ("#E67E22", "HIGH"),
        "MEDIUM":   ("#F1C40F", "MEDIUM"),
        "LOW":      ("#95A5A6", "LOW"),
        "GOOD":     ("#2ECC71", "GOOD"),
        "OK":       ("#3498DB", "OK"),
    }
    c, label = colors_map.get(level, ("#AAAAAA", level))
    return Paragraph(f"<b><font color='{c}'>{label}</font></b>", styles["cell"])

def score_p(score_str):
    """Returns colored score paragraph."""
    try:
        val = float(score_str.split("/")[0])
        c = "#2ECC71" if val >= 7 else ("#F39C12" if val >= 5 else "#E74C3C")
    except:
        c = "#AAAAAA"
    return Paragraph(f"<b><font color='{c}'>{score_str}</font></b>",
                     ParagraphStyle("sp", fontName="Helvetica-Bold", fontSize=11,
                                    textColor=HexColor(c), alignment=TA_CENTER, leading=15))

def service_block(name, score, severity, description, issues, recommendations, methods, styles):
    """Full service audit block."""
    elements = []
    # Header row: name + score + severity
    sev_c = {"CRITICAL":"#E74C3C","HIGH":"#E67E22","MEDIUM":"#F1C40F","GOOD":"#2ECC71","OK":"#3498DB"}.get(severity,"#AAA")
    sc_val = float(score.split("/")[0]) if "/" in score else 0
    sc_c   = "#2ECC71" if sc_val >= 7 else ("#F39C12" if sc_val >= 5 else "#E74C3C")

    header_t = Table([[
        Paragraph(f"<font fontName='Courier' color='#E06C75'>{name}</font>",
                  ParagraphStyle("sn", fontName="Courier", fontSize=13,
                                 textColor=CODE_RED, leading=18)),
        Paragraph(f"<b><font color='{sc_c}'>{score}</font></b>",
                  ParagraphStyle("ss", fontName="Helvetica-Bold", fontSize=22,
                                 textColor=HexColor(sc_c), alignment=TA_CENTER, leading=28)),
        Paragraph(f"<b><font color='{sev_c}'>{severity}</font></b>",
                  ParagraphStyle("sv", fontName="Helvetica-Bold", fontSize=11,
                                 textColor=HexColor(sev_c), alignment=TA_CENTER, leading=16)),
    ]], colWidths=[W - 48*mm - 30*mm - 30*mm, 30*mm, 30*mm])
    header_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), MID_GRAY),
        ("BOX", (0,0),(-1,-1), 1.5, RED),
        ("TOPPADDING", (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING", (0,0),(-1,-1), 10),
        ("RIGHTPADDING", (0,0),(-1,-1), 10),
        ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
        ("LINEAFTER", (0,0),(0,-1), 0.5, LIGHT_GRAY),
        ("LINEAFTER", (1,0),(1,-1), 0.5, LIGHT_GRAY),
    ]))
    elements.append(header_t)

    # Description
    desc_t = Table([[Paragraph(description, styles["body"])]], colWidths=[W - 48*mm])
    desc_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), DARK_GRAY),
        ("LEFTPADDING", (0,0),(-1,-1), 10),
        ("RIGHTPADDING", (0,0),(-1,-1), 10),
        ("TOPPADDING", (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LINEBELOW", (0,0),(-1,-1), 0.4, BORDER),
    ]))
    elements.append(desc_t)

    # Issues + Recommendations side by side
    issue_col = [Paragraph("<b>Issues Found</b>", ParagraphStyle("if",
        fontName="Helvetica-Bold", fontSize=9, textColor=DANGER, leading=13))]
    issue_col.append(Spacer(1, 2*mm))
    for i in issues:
        issue_col.append(Paragraph(f"✗  {i}", ParagraphStyle("iss",
            fontSize=8, textColor=TEXT_WHITE, leading=13, leftIndent=4*mm)))

    rec_col = [Paragraph("<b>Recommendations</b>", ParagraphStyle("rc",
        fontName="Helvetica-Bold", fontSize=9, textColor=SUCCESS, leading=13))]
    rec_col.append(Spacer(1, 2*mm))
    for r in recommendations:
        rec_col.append(Paragraph(f"✓  {r}", ParagraphStyle("rec",
            fontSize=8, textColor=TEXT_WHITE, leading=13, leftIndent=4*mm)))

    col_w = (W - 48*mm - 3*mm) / 2
    ir_t = Table([[issue_col, rec_col]], colWidths=[col_w, col_w])
    ir_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(0,0), DARK_GRAY),
        ("BACKGROUND", (1,0),(1,0), HexColor("#0F1A0F")),
        ("BOX", (0,0),(0,0), 0.5, DANGER),
        ("BOX", (1,0),(1,0), 0.5, SUCCESS),
        ("LEFTPADDING", (0,0),(-1,-1), 8),
        ("RIGHTPADDING", (0,0),(-1,-1), 8),
        ("TOPPADDING", (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("VALIGN", (0,0),(-1,-1), "TOP"),
        ("COLPADDING", (0,0),(-1,-1), 1),
    ]))
    elements.append(ir_t)

    # Key methods table
    if methods:
        m_header = [Paragraph(f"<b>{h}</b>", styles["cell_red"])
                    for h in ["Method / Property", "Status", "Issue"]]
        m_data = [m_header]
        for method, status, issue in methods:
            st_c = {"OK":"#2ECC71","Problem":"#E74C3C","Missing":"#E67E22","Risk":"#F1C40F"}.get(status,"#AAA")
            m_data.append([
                Paragraph(f"<font fontName='Courier' color='#E06C75'>{method}</font>", styles["cell"]),
                Paragraph(f"<b><font color='{st_c}'>{status}</font></b>", styles["cell"]),
                Paragraph(issue, styles["cell_gray"]),
            ])
        cw = [55*mm, 20*mm, W - 48*mm - 55*mm - 20*mm]
        mt = Table(m_data, colWidths=cw, repeatRows=1)
        mt.setStyle(TableStyle([
            ("BACKGROUND", (0,0),(-1,0), MID_GRAY),
            ("BACKGROUND", (0,1),(-1,-1), DARK_GRAY),
            ("ROWBACKGROUNDS", (0,1),(-1,-1), [DARK_GRAY, BLACK]),
            ("GRID", (0,0),(-1,-1), 0.3, BORDER),
            ("BOX", (0,0),(-1,-1), 0.8, LIGHT_GRAY),
            ("TOPPADDING", (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING", (0,0),(-1,-1), 5),
            ("RIGHTPADDING", (0,0),(-1,-1), 5),
            ("VALIGN", (0,0),(-1,-1), "TOP"),
            ("LINEBELOW", (0,0),(-1,0), 0.8, RED),
        ]))
        elements.append(mt)

    elements.append(sp(4))
    return elements

def store_block(name, score, description, state_keys, issues, recommendations, styles):
    """Zustand store audit block."""
    elements = []
    sc_val = float(score.split("/")[0]) if "/" in score else 0
    sc_c   = "#2ECC71" if sc_val >= 7 else ("#F39C12" if sc_val >= 5 else "#E74C3C")

    h_t = Table([[
        Paragraph(f"<font fontName='Courier' color='#E06C75'>{name}</font>",
                  ParagraphStyle("sn2", fontName="Courier", fontSize=12,
                                 textColor=CODE_RED, leading=16)),
        Paragraph(f"<b><font color='{sc_c}'>{score}</font></b>",
                  ParagraphStyle("ss2", fontName="Helvetica-Bold", fontSize=20,
                                 textColor=HexColor(sc_c), alignment=TA_CENTER, leading=26)),
        Paragraph("ZUSTAND STORE", ParagraphStyle("sz",
                  fontName="Helvetica-Bold", fontSize=8,
                  textColor=INFO, alignment=TA_CENTER, leading=12)),
    ]], colWidths=[W - 48*mm - 28*mm - 35*mm, 28*mm, 35*mm])
    h_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), MID_GRAY),
        ("BOX", (0,0),(-1,-1), 1.2, INFO),
        ("TOPPADDING", (0,0),(-1,-1), 7),
        ("BOTTOMPADDING", (0,0),(-1,-1), 7),
        ("LEFTPADDING", (0,0),(-1,-1), 10),
        ("RIGHTPADDING", (0,0),(-1,-1), 10),
        ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
        ("LINEAFTER", (0,0),(1,-1), 0.5, LIGHT_GRAY),
    ]))
    elements.append(h_t)

    # State keys + description
    keys_str = " | ".join([f"<font color='#E06C75'>{k}</font>" for k in state_keys])
    body_t = Table([[
        Paragraph(description, styles["body_gray"]),
        Paragraph(f"<b>State Keys:</b><br/>{keys_str}",
                  ParagraphStyle("sk", fontSize=8, textColor=TEXT_GRAY, leading=12)),
    ]], colWidths=[(W-48*mm)*0.55, (W-48*mm)*0.45])
    body_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), DARK_GRAY),
        ("LEFTPADDING", (0,0),(-1,-1), 8),
        ("RIGHTPADDING", (0,0),(-1,-1), 8),
        ("TOPPADDING", (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("VALIGN", (0,0),(-1,-1), "TOP"),
        ("LINEAFTER", (0,0),(0,-1), 0.5, BORDER),
        ("LINEBELOW", (0,0),(-1,-1), 0.4, BORDER),
    ]))
    elements.append(body_t)

    # Issues + recs
    issue_col = [Paragraph("<b>Issues</b>", ParagraphStyle("is2",
        fontName="Helvetica-Bold", fontSize=9, textColor=DANGER, leading=13))]
    for i in issues:
        issue_col.append(Paragraph(f"• {i}", ParagraphStyle("ip",
            fontSize=8, textColor=TEXT_WHITE, leading=12, leftIndent=3*mm)))

    rec_col = [Paragraph("<b>Fixes</b>", ParagraphStyle("rf",
        fontName="Helvetica-Bold", fontSize=9, textColor=SUCCESS, leading=13))]
    for r in recommendations:
        rec_col.append(Paragraph(f"• {r}", ParagraphStyle("rp",
            fontSize=8, textColor=TEXT_WHITE, leading=12, leftIndent=3*mm)))

    col_w = (W - 48*mm - 2*mm) / 2
    ir_t = Table([[issue_col, rec_col]], colWidths=[col_w, col_w])
    ir_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(0,0), DARK_GRAY),
        ("BACKGROUND", (1,0),(1,0), HexColor("#0F1A0F")),
        ("BOX", (0,0),(0,0), 0.5, DANGER),
        ("BOX", (1,0),(1,0), 0.5, SUCCESS),
        ("LEFTPADDING", (0,0),(-1,-1), 7),
        ("RIGHTPADDING", (0,0),(-1,-1), 7),
        ("TOPPADDING", (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("VALIGN", (0,0),(-1,-1), "TOP"),
    ]))
    elements.append(ir_t)
    elements.append(sp(4))
    return elements


# ══════════════════════════════════════════════════════════════════════════════
# BUILD PDF
# ══════════════════════════════════════════════════════════════════════════════
def build_pdf():
    output = os.path.join(os.path.dirname(__file__), "reports", "Anarchy_AI_Report_02_Services_Stores_Components.pdf")
    output_dir = os.path.dirname(output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    styles = build_styles()
    tmpl   = PageTemplate(
        doc_title="Services + Stores + Components Audit",
        file_num=2, total_files=8
    )
    doc = SimpleDocTemplate(
        output, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=35*mm, bottomMargin=20*mm,
        title="Anarchy AI — Services + Stores + Components Audit",
        author="Anarchy AI Internal",
        subject="Technical Audit Report — File 2 of 8",
    )
    story = []

    # ── COVER ──────────────────────────────────────────────────────────────────
    story.append(sp(18))
    story.append(Paragraph("ANARCHY", styles["cover_red"]))
    story.append(Paragraph("AI Platform", styles["cover_title"]))
    story.append(sp(3))
    story.append(hr(RED, 2))
    story.append(sp(3))
    story.append(Paragraph("Services + Stores + Components Audit", styles["cover_sub"]))
    story.append(Paragraph("Technical Audit Report — File 2 of 8", styles["cover_meta"]))
    story.append(sp(8))

    cover_t = Table([[
        Paragraph("4<br/><font size='8' color='#AAAAAA'>Services Audited</font>",
                  ParagraphStyle("c1", fontName="Helvetica-Bold", fontSize=32,
                                 textColor=DANGER, alignment=TA_CENTER, leading=40)),
        Paragraph("3<br/><font size='8' color='#AAAAAA'>Stores Audited</font>",
                  ParagraphStyle("c2", fontName="Helvetica-Bold", fontSize=32,
                                 textColor=INFO, alignment=TA_CENTER, leading=40)),
        Paragraph("5<br/><font size='8' color='#AAAAAA'>God Components</font>",
                  ParagraphStyle("c3", fontName="Helvetica-Bold", fontSize=32,
                                 textColor=WARNING, alignment=TA_CENTER, leading=40)),
        Paragraph("6.1<br/><font size='8' color='#AAAAAA'>Avg Layer Score</font>",
                  ParagraphStyle("c4", fontName="Helvetica-Bold", fontSize=32,
                                 textColor=RED, alignment=TA_CENTER, leading=40)),
    ]], colWidths=[(W - 48*mm)/4]*4)
    cover_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), DARK_GRAY),
        ("BOX", (0,0),(-1,-1), 1.5, RED),
        ("GRID", (0,0),(-1,-1), 0.5, BORDER),
        ("ALIGN", (0,0),(-1,-1), "CENTER"),
        ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0),(-1,-1), 12),
        ("BOTTOMPADDING", (0,0),(-1,-1), 12),
    ]))
    story.append(cover_t)
    story.append(sp(8))

    meta = [
        ("File", "2 of 8 — Services + Stores + Components"),
        ("Covers", "ReplicateService, HistoryService, ExportService, WatermarkService"),
        ("Stores", "AIConfigStore, HistoryStore, NotificationStore"),
        ("Components", "God Components analysis + Component patterns"),
        ("Date", "2025 — Confidential Internal Report"),
    ]
    md = [[Paragraph(k, styles["cell_red"]), Paragraph(v, styles["cell"])] for k, v in meta]
    mt = Table(md, colWidths=[40*mm, W - 48*mm - 40*mm])
    mt.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), DARK_GRAY),
        ("GRID", (0,0),(-1,-1), 0.4, BORDER),
        ("BOX", (0,0),(-1,-1), 1, LIGHT_GRAY),
        ("TOPPADDING", (0,0),(-1,-1), 5),
        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0),(-1,-1), 8),
        ("RIGHTPADDING", (0,0),(-1,-1), 8),
        ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(mt)
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ──────────────────────────────────────────────────────
    story.append(Paragraph("Table of Contents", styles["chapter_title"]))
    story.append(hr())
    story.append(sp(2))

    toc = [
        ("1", "Services Layer Audit",               "03", True),
        ("1.1", "Layer Overview & Score Summary",   "03", False),
        ("1.2", "ReplicateService.ts",              "04", False),
        ("1.3", "HistoryService.ts",                "06", False),
        ("1.4", "ExportService.ts",                 "08", False),
        ("1.5", "WatermarkService.ts",              "09", False),
        ("2", "Stores Layer Audit",                 "10", True),
        ("2.1", "Stores Overview",                  "10", False),
        ("2.2", "AIConfigStore.ts",                 "10", False),
        ("2.3", "HistoryStore.ts",                  "11", False),
        ("2.4", "NotificationStore.ts",             "12", False),
        ("3", "Components Layer Audit",             "13", True),
        ("3.1", "Component Patterns Analysis",      "13", False),
        ("3.2", "God Components Deep-Dive",         "13", False),
        ("3.3", "TreeFlowCanvas.tsx — Full Breakdown", "14", False),
        ("3.4", "GhostNode.tsx — Full Breakdown",   "15", False),
        ("4", "Cross-Cutting Recommendations",      "16", True),
        ("4.1", "Service Layer Refactoring Plan",   "16", False),
        ("4.2", "Store Architecture Upgrade",       "16", False),
        ("4.3", "Component Decomposition Plan",     "16", False),
    ]
    for num, title, page, is_main in toc:
        row_t = Table([[
            Paragraph(f"<b>{num}</b>" if is_main else num,
                      styles["toc_chapter"] if is_main else styles["toc_section"]),
            Paragraph(f"<b>{title}</b>" if is_main else title,
                      styles["toc_chapter"] if is_main else styles["toc_section"]),
            Paragraph(page, ParagraphStyle("tpg",
                fontName="Helvetica-Bold" if is_main else "Helvetica",
                fontSize=10 if is_main else 9,
                textColor=RED if is_main else TEXT_GRAY,
                alignment=TA_RIGHT, leading=14)),
        ]], colWidths=[12*mm, W - 48*mm - 12*mm - 14*mm, 14*mm])
        row_t.setStyle(TableStyle([
            ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
            ("TOPPADDING", (0,0),(-1,-1), 2 if is_main else 1),
            ("BOTTOMPADDING", (0,0),(-1,-1), 2 if is_main else 1),
            ("LINEBELOW", (0,0),(-1,-1), 0.3 if is_main else 0.2,
             LIGHT_GRAY if is_main else BORDER),
        ]))
        story.append(row_t)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPTER 1: SERVICES LAYER
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Services Layer Audit", styles["chapter_title"]))
    story.append(Paragraph("Deep analysis of all service classes — business logic, error handling, and API integration",
                            styles["chapter_sub"]))
    story.append(hr())

    # 1.1 Overview
    story.append(Paragraph("1.1  Layer Overview & Score Summary", styles["section_h1"]))
    story.append(Paragraph(
        "The services layer is responsible for all business logic, API communication, and "
        "data transformation. Currently, four primary services carry the bulk of the application's "
        "operational logic. All four show signs of the God Service anti-pattern — each handling "
        "too many responsibilities without clear boundaries or abstraction interfaces.",
        styles["body"]))
    story.append(sp(2))

    svc_overview = std_table(
        ["Service", "Score", "Severity", "Primary Concern"],
        [
            [Paragraph("ReplicateService.ts", styles["cell_code"]),
             score_p("4.5/10"),
             severity_badge("CRITICAL", styles),
             Paragraph("No queue, no retry, no circuit breaker — single point of failure for all AI ops", styles["cell_gray"])],
            [Paragraph("HistoryService.ts", styles["cell_code"]),
             score_p("5.5/10"),
             severity_badge("HIGH", styles),
             Paragraph("God Service — 6 responsibilities in one class, no pagination strategy", styles["cell_gray"])],
            [Paragraph("ExportService.ts", styles["cell_code"]),
             score_p("6.0/10"),
             severity_badge("HIGH", styles),
             Paragraph("Synchronous file I/O blocks Electron renderer, no progress reporting", styles["cell_gray"])],
            [Paragraph("WatermarkService.ts", styles["cell_code"]),
             score_p("7.0/10"),
             severity_badge("MEDIUM", styles),
             Paragraph("Tightly coupled to ExportService — cannot be used as composable step", styles["cell_gray"])],
        ],
        [50*mm, 22*mm, 24*mm, W - 48*mm - 50*mm - 22*mm - 24*mm],
        styles
    )
    story.append(svc_overview)
    story.append(sp(3))
    story.append(PageBreak())

    # 1.2 ReplicateService
    story.append(Paragraph("1.2  ReplicateService.ts", styles["section_h1"]))
    story += service_block(
        name="ReplicateService.ts",
        score="4.5/10",
        severity="CRITICAL",
        description=(
            "The ReplicateService is the most critical service in the entire application — "
            "it is the gateway to all AI generation capabilities (FLUX, Nano Banana 2, upscaling, "
            "variations). Currently it is a monolithic class that handles every AI model type "
            "without queuing, retry logic, circuit breaking, or proper error classification. "
            "A single Replicate API rate limit or timeout will cause all active generation "
            "requests to silently fail with no recovery path."
        ),
        issues=[
            "No request queue — 5 concurrent requests all hit Replicate rate limits simultaneously",
            "No retry logic — a single network hiccup causes permanent failure",
            "No circuit breaker — continues hammering a failing API endpoint",
            "All model types (FLUX, Nano Banana 2, upscale, variation) in one class — violates SRP",
            "No request deduplication — duplicate nodes can trigger identical expensive requests",
            "No cost estimation before request — user can burn credits accidentally",
            "Seed parameter handling not validated — silent failure on Nano Banana 2 (no seed support)",
            "No request cancellation — user cannot stop a running generation",
            "Error messages from Replicate not translated to user-friendly messages",
            "No telemetry — impossible to know which models fail most often",
        ],
        recommendations=[
            "Implement Bull Queue (or p-queue) with concurrency limit of 3",
            "Add exponential backoff retry: 3 attempts, 1s/2s/4s delays",
            "Add circuit breaker: open after 5 failures, half-open after 30s",
            "Split into FluxService, NanoBananaService, UpscaleService, VariationService",
            "Add pre-flight credit check before any generation request",
            "Implement AbortController for request cancellation",
            "Add Nano Banana 2 seed warning in UI (architectural difference vs FLUX)",
            "Emit job status events: pending, started, progress, completed, failed",
            "Log all requests/responses to local SQLite for debugging",
            "Add cost per model to UI before user confirms generation",
        ],
        methods=[
            ("generate(prompt, model, options)", "Problem", "No queue, no retry, no error classification"),
            ("generateVariation(imageUrl, options)", "Problem", "Shares same failure modes as generate()"),
            ("upscale(imageUrl, options)", "Problem", "Synchronous — blocks if Replicate is slow"),
            ("getModelConfig(modelId)", "OK",      "Simple lookup — no issues"),
            ("handleError(error)", "Missing",      "No centralized error handler exists"),
            ("cancelRequest(requestId)", "Missing", "No cancellation support"),
            ("getQueueStatus()", "Missing",         "No queue status reporting"),
            ("estimateCost(model, options)", "Missing", "No pre-flight cost estimation"),
        ],
        styles=styles
    )

    # Architecture recommendation
    story.append(info_box("Recommended ReplicateService Architecture",
        [Paragraph(
            "Replace monolithic ReplicateService with a layered system: "
            "<b>AIJobQueue</b> (Bull/p-queue, manages concurrency + priority) → "
            "<b>AIRouter</b> (selects model service by type) → "
            "<b>FluxService | NanoBananaService | UpscaleService</b> (one class per model family) → "
            "<b>ReplicateAPIClient</b> (single HTTP client with retry + circuit breaker). "
            "This separation means adding a new AI model requires only a new leaf service — "
            "zero changes to the queue or router.",
            styles["body"])],
        styles, border_color=WARNING))
    story.append(PageBreak())

    # 1.3 HistoryService
    story.append(Paragraph("1.3  HistoryService.ts", styles["section_h1"]))
    story += service_block(
        name="HistoryService.ts",
        score="5.5/10",
        severity="HIGH",
        description=(
            "HistoryService manages the persistence and retrieval of all generation history records. "
            "It currently handles CRUD operations, search, filtering, thumbnail generation, "
            "bulk deletion, and export — six distinct responsibilities that should be split "
            "into separate modules. The most critical issue is the absence of cursor-based "
            "pagination: the service fetches all history records on mount, which will "
            "cause memory exhaustion and severe UI lag for power users with 500+ records."
        ),
        issues=[
            "fetchAllHistory() loads entire history table into memory — no pagination",
            "Thumbnail generation happens synchronously on the main query — slows initial load",
            "Search is performed client-side on the full in-memory dataset — O(n) on every keystroke",
            "No soft-delete — permanent deletion loses data with no recovery option",
            "Bulk operations (delete all) have no confirmation at service level — one bad call wipes data",
            "No history record versioning — cannot track edits to prompts over time",
            "Supabase queries missing proper indexes on created_at and user_id columns",
        ],
        recommendations=[
            "Implement cursor-based pagination: fetchHistory(cursor, limit=20)",
            "Load thumbnails lazily using Intersection Observer in the component",
            "Move search to Supabase full-text search (pg_trgm) — server-side, indexed",
            "Add soft-delete with is_deleted flag + 30-day recovery window",
            "Add optimistic updates: mark deleted in UI immediately, confirm via API",
            "Add history record versioning with prompt_history JSONB column",
            "Create composite Supabase index on (user_id, created_at DESC)",
        ],
        methods=[
            ("fetchAllHistory(userId)", "Problem", "Loads all records — replace with paginated fetch"),
            ("saveRecord(record)", "OK",      "Works correctly; add optimistic update"),
            ("deleteRecord(id)", "Problem",   "Hard delete — should be soft delete"),
            ("searchHistory(query)", "Problem", "Client-side linear search — move to Supabase FTS"),
            ("exportHistory(format)", "Problem", "Mixed with ExportService responsibility"),
            ("generateThumbnail(canvas)", "Problem", "Sync operation on main thread during fetch"),
            ("bulkDelete(ids)", "Risk",       "No service-level confirmation guard"),
        ],
        styles=styles
    )
    story.append(PageBreak())

    # 1.4 ExportService
    story.append(Paragraph("1.4  ExportService.ts", styles["section_h1"]))
    story += service_block(
        name="ExportService.ts",
        score="6.0/10",
        severity="HIGH",
        description=(
            "ExportService handles image export, PDF generation, and triggers the DXF pipeline. "
            "The primary issues are synchronous file I/O in the Electron renderer process "
            "(should be delegated to the main process via IPC), missing progress reporting for "
            "large exports, and the absence of a proper export queue for batch operations. "
            "The service is also entangled with WatermarkService coupling."
        ),
        issues=[
            "Synchronous file writes block Electron renderer — UI freezes during large image exports",
            "PDF export generates all pages in memory before writing — OOM risk on large projects",
            "No export progress events — user has no feedback during 5-10s export operations",
            "DXF pipeline triggered via Node.js child_process with no health check",
            "WatermarkService called directly — tight coupling makes watermark optional impossible",
            "No export queue — rapid export clicks create multiple concurrent file writes",
            "Export formats hardcoded — adding new format requires modifying the service directly",
        ],
        recommendations=[
            "Move all file I/O to Electron main process via IPC (ipcMain.handle('export:image'))",
            "Stream PDF generation page-by-page to avoid memory spikes",
            "Emit export:progress events with percentage for UI progress bar",
            "Add DXF bridge health check with auto-restart on crash",
            "Use composition: exportImage(canvas, [watermarkPlugin, compressionPlugin])",
            "Add export queue with status: queued → processing → complete → failed",
            "Define ExportFormat interface to allow plugin-style format extension",
        ],
        methods=[
            ("exportImage(canvas, options)", "Problem", "Sync render in renderer process — move to main"),
            ("exportPDF(pages, options)", "Problem",   "Full in-memory generation — stream instead"),
            ("exportDXF(imageData)", "Risk",           "No DXF bridge health check before call"),
            ("applyWatermark(image)", "Problem",       "Tight coupling — should be composable plugin"),
            ("getExportProgress()", "Missing",         "No progress tracking implemented"),
            ("queueExport(job)", "Missing",            "No export queue — all exports fire immediately"),
        ],
        styles=styles
    )
    story.append(sp(2))

    # 1.5 WatermarkService
    story.append(Paragraph("1.5  WatermarkService.ts", styles["section_h1"]))
    story += service_block(
        name="WatermarkService.ts",
        score="7.0/10",
        severity="MEDIUM",
        description=(
            "WatermarkService is the most well-structured service in the codebase. It handles "
            "watermark rendering, positioning, and opacity for exported images. The main issues "
            "are tight coupling to ExportService and the lack of a composable pipeline interface "
            "that would allow watermarking to be applied optionally at any export stage."
        ),
        issues=[
            "Called directly by ExportService — not composable or injectable",
            "Watermark position hardcoded — no user customization at export time",
            "No support for custom text watermarks — only logo/image watermarks",
            "Canvas watermark rendering uses deprecated method in newer browser engines",
        ],
        recommendations=[
            "Implement WatermarkPlugin interface: apply(canvas) => canvas",
            "Allow watermark toggle per-export without modifying service",
            "Add position options: corner, tiled, center",
            "Add text watermark support with font and opacity config",
        ],
        methods=[
            ("applyWatermark(canvas, config)", "OK",      "Works correctly; needs composable interface"),
            ("setOpacity(value)", "OK",                   "Correct implementation"),
            ("setPosition(pos)", "Problem",               "Position partially hardcoded"),
            ("applyTextWatermark(canvas, text)", "Missing","Text watermark not implemented"),
        ],
        styles=styles
    )
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPTER 2: STORES LAYER
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Stores Layer Audit", styles["chapter_title"]))
    story.append(Paragraph("Analysis of all Zustand stores — state design, subscriptions, and middleware gaps",
                            styles["chapter_sub"]))
    story.append(hr())

    story.append(Paragraph("2.1  Stores Overview", styles["section_h1"]))
    story.append(Paragraph(
        "Anarchy AI uses Zustand for global state management — a solid, lightweight choice "
        "for an Electron + React application. However, all three stores lack devtools middleware, "
        "immer integration, and persist middleware configuration. The most critical issue is "
        "AIConfigStore storing API credentials in plain Zustand state, which is accessible "
        "via browser DevTools in the Electron renderer process.",
        styles["body"]))
    story.append(sp(2))

    stores_overview = std_table(
        ["Store", "Score", "State Keys", "Primary Issue"],
        [
            [Paragraph("AIConfigStore.ts", styles["cell_code"]),
             score_p("5.0/10"),
             Paragraph("apiKey, model, params, provider", styles["cell_gray"]),
             Paragraph("API key stored in plain Zustand state — accessible via DevTools", styles["cell_gray"])],
            [Paragraph("HistoryStore.ts", styles["cell_code"]),
             score_p("5.5/10"),
             Paragraph("records, filter, sort, selected, loading", styles["cell_gray"]),
             Paragraph("Entire history in memory — no virtualization or pagination", styles["cell_gray"])],
            [Paragraph("NotificationStore.ts", styles["cell_code"]),
             score_p("7.5/10"),
             Paragraph("notifications, queue, preferences", styles["cell_gray"]),
             Paragraph("No notification grouping — duplicate toasts for repeated errors", styles["cell_gray"])],
        ],
        [50*mm, 22*mm, 58*mm, W - 48*mm - 50*mm - 22*mm - 58*mm],
        styles, box_color=INFO
    )
    story.append(stores_overview)
    story.append(sp(4))

    # 2.2 AIConfigStore
    story.append(Paragraph("2.2  AIConfigStore.ts", styles["section_h1"]))
    story += store_block(
        name="AIConfigStore.ts",
        score="5.0/10",
        description=(
            "Manages AI provider configuration including API keys, model selection, "
            "and generation parameters. The critical security issue is that the Replicate "
            "API key lives in plain Zustand state in the renderer process — any DevTools "
            "inspection or XSS attack can read it. All credential storage must move to "
            "Electron's safeStorage or the OS keychain via the main process."
        ),
        state_keys=["replicateApiKey", "selectedModel", "generationParams", "provider", "isConfigured"],
        issues=[
            "API key stored in plain Zustand state — visible in Electron DevTools",
            "No validation of API key format before storing",
            "Missing persist middleware — settings lost on app restart unless manually saved",
            "No encryption of stored configuration",
            "selectedModel changes trigger full canvas re-render unnecessarily",
            "No model capability flags (e.g., supportsSeeds: false for Nano Banana 2)",
        ],
        recommendations=[
            "Move API key to Electron main process: store via safeStorage.encryptString()",
            "Expose key only as ipcRenderer.invoke('config:getApiKey') — never in renderer state",
            "Add Zustand persist middleware with encrypted localStorage adapter",
            "Add model capability registry: { nanoBanana2: { supportsSeeds: false } }",
            "Subscribe selectively: useAIConfig(s => s.selectedModel) not entire store",
            "Add API key validation against Replicate format before saving",
        ],
        styles=styles
    )

    # 2.3 HistoryStore
    story.append(Paragraph("2.3  HistoryStore.ts", styles["section_h1"]))
    story += store_block(
        name="HistoryStore.ts",
        score="5.5/10",
        description=(
            "Manages the in-memory collection of generation history records, filtering, "
            "sorting, and selection state. The critical issue is that all records are loaded "
            "into this store on mount with no pagination — a user with 1000+ history records "
            "will experience significant memory pressure and slow initial renders. "
            "The store also drives unnecessary re-renders because components subscribe to "
            "the entire records array rather than individual record selectors."
        ),
        state_keys=["records", "filteredRecords", "selectedIds", "searchQuery", "sortOrder", "isLoading", "pagination"],
        issues=[
            "records[] contains ALL history — no pagination or windowing",
            "filteredRecords recomputed on every store update, not memoized",
            "selectedIds array causes re-render of entire history list on any selection change",
            "No optimistic update on delete — UI waits for Supabase confirmation",
            "Missing error state for failed history loads",
            "Sort and filter applied client-side — should be server-side Supabase queries",
        ],
        recommendations=[
            "Replace records[] with paginated cursor approach: pages Map<cursor, Record[]>",
            "Memoize filteredRecords with useMemo in consuming component",
            "Replace selectedIds[] with selectedId Set for O(1) lookup",
            "Add optimisticDelete(id): remove from state immediately, revert on API error",
            "Add errorState with retry action for failed loads",
            "Pass sort/filter to Supabase query — eliminate client-side computation",
        ],
        styles=styles
    )
    story.append(PageBreak())

    # 2.4 NotificationStore
    story.append(Paragraph("2.4  NotificationStore.ts", styles["section_h1"]))
    story += store_block(
        name="NotificationStore.ts",
        score="7.5/10",
        description=(
            "The best-designed store in the codebase. Manages toast notifications, "
            "system alerts, and user preference flags for notification types. "
            "The main improvement areas are notification deduplication (currently shows "
            "10 identical 'Generation failed' toasts in rapid succession) and "
            "persistence of user notification preferences across sessions."
        ),
        state_keys=["notifications", "queue", "preferences", "unreadCount"],
        issues=[
            "No deduplication — rapid errors create stacked identical toasts",
            "Notification preferences not persisted — reset on every app restart",
            "No notification history — once dismissed, cannot review past alerts",
            "Queue has no max-length limit — can accumulate unbounded notifications",
        ],
        recommendations=[
            "Add deduplication: if same message within 3s, increment count instead of new toast",
            "Persist preferences via Zustand persist middleware to localStorage",
            "Add notification log with last 50 entries, accessible from UI",
            "Set queue max length to 5 — auto-dismiss oldest when exceeded",
        ],
        styles=styles
    )

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPTER 3: COMPONENTS LAYER
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Components Layer Audit", styles["chapter_title"]))
    story.append(Paragraph("Analysis of React component patterns, God Components, and decomposition strategy",
                            styles["chapter_sub"]))
    story.append(hr())

    story.append(Paragraph("3.1  Component Patterns Analysis", styles["section_h1"]))
    story.append(Paragraph(
        "The components layer shows a clear split between well-structured page-level components "
        "and severely over-grown canvas components. The pattern issues stem from the absence "
        "of a clear component taxonomy and the lack of custom hooks as an extraction target "
        "for business logic currently embedded in components.",
        styles["body"]))
    story.append(sp(2))

    patterns_rows = [
        ("Page Components (HistoryPage, SettingsPage, BuilderPage)",
         "Mixed", "HIGH",
         "Good structure but contain too much business logic — needs hook extraction"),
        ("Canvas Components (TreeFlowCanvas, GhostNode)",
         "God",   "CRITICAL",
         "2000+ lines, 10+ responsibilities each — highest priority for decomposition"),
        ("UI Primitives (Button, Input, Modal, Badge)",
         "Good",  "OK",
         "Well-structured, reusable, properly typed — no changes needed"),
        ("Node Type Components (SourceNode, RenderNode, etc.)",
         "Mixed", "MEDIUM",
         "Partially migrated to LiteGraph — hybrid state causes inconsistency"),
        ("Layout Components (AppShell, Sidebar, Header)",
         "Good",  "OK",
         "Clean separation, correct use of CSS variables for theming"),
        ("Form Components (PromptInput, ModelSelector, ParamSlider)",
         "Mixed", "MEDIUM",
         "Validation logic embedded in component — extract to form validation schema"),
    ]

    patterns_data = []
    for comp, pat, risk, finding in patterns_rows:
        patterns_data.append([
            Paragraph(comp, styles["cell"]),
            Paragraph(pat, styles["cell_red"] if pat == "God" else styles["cell"]),
            severity_badge(risk, styles),
            Paragraph(finding, styles["cell_gray"])
        ])
    comp_overview = std_table(
        ["Component Group", "Pattern Type", "Risk Level", "Primary Finding"],
        patterns_data,
        [55*mm, 22*mm, 24*mm, W - 48*mm - 55*mm - 22*mm - 24*mm],
        styles,
        box_color=WARNING
    )
    story.append(comp_overview)
    story.append(sp(4))

    # 3.2 God Components Deep-Dive
    story.append(Paragraph("3.2  God Components Deep-Dive", styles["section_h1"]))
    story.append(Paragraph(
        "A 'God Component' is a component that controls too many states, renders too many sub-elements, "
        "and handles business logic that should be delegated to custom hooks or services. In Anarchy AI, "
        "we identified two critical God Components that negatively impact maintainability, performance, "
        "and testability: <b>TreeFlowCanvas.tsx</b> and <b>GhostNode.tsx</b>.",
        styles["body"]))
    story.append(sp(3))

    # 3.3 TreeFlowCanvas
    story.append(Paragraph("3.3  TreeFlowCanvas.tsx — Full Breakdown", styles["section_h1"]))
    story.append(Paragraph(
        "<b>TreeFlowCanvas.tsx</b> is the main workspace canvas component. At over 2,200 lines of code, "
        "it is the single largest component in the application. It handles user interactions, node drag-and-drop, "
        "context menus, workflow saving/loading, hotkeys, state synchronization, zoom/pan controls, "
        "and direct API calls for generation.",
        styles["body"]))
    story.append(sp(2))

    story.append(info_box("TreeFlowCanvas.tsx Audit Findings", [
        Paragraph("• <b>State Bloat:</b> Contains 15+ local useState hooks and subscribes to 4 different Zustand stores entirely.", styles["bullet"]),
        Paragraph("• <b>Performance Bottlenecks:</b> Any node update triggers a complete canvas re-render. Missing canvas virtualization or React.memo wrappers on node components.", styles["bullet"]),
        Paragraph("• <b>Inline Business Logic:</b> Contains nested async functions for calling Replicate directly instead of delegating to ReplicateService.", styles["bullet"]),
        Paragraph("• <b>Recommendation:</b> Extract canvas state management into a custom hook (e.g., <code>useCanvasState</code>). Refactor node event handlers into independent service-level hooks.", styles["bullet"]),
    ], styles, border_color=DANGER))
    story.append(sp(4))

    # 3.4 GhostNode
    story.append(Paragraph("3.4  GhostNode.tsx — Full Breakdown", styles["section_h1"]))
    story.append(Paragraph(
        "<b>GhostNode.tsx</b> is the custom node template representing preview or placeholder states in the builder. "
        "It contains extensive conditional rendering logic, direct styling overrides, and layout equations "
        "that make it rigid and difficult to extend.",
        styles["body"]))
    story.append(sp(2))

    story.append(info_box("GhostNode.tsx Audit Findings", [
        Paragraph("• <b>Tight Coupling:</b> Deeply coupled to xyflow library internals and local UI state. Hard to reuse outside of xyflow context.", styles["bullet"]),
        Paragraph("• <b>Style Bloat:</b> Contains over 300 lines of inline styles and CSS class names, violating the separation of concerns.", styles["bullet"]),
        Paragraph("• <b>Recommendation:</b> Standardize GhostNode using atomic primitives. Move styling to component-specific CSS modules and use xyflow standard helper hooks.", styles["bullet"]),
    ], styles, border_color=WARNING))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPTER 4: CROSS-CUTTING RECOMMENDATIONS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Cross-Cutting Recommendations", styles["chapter_title"]))
    story.append(Paragraph("Architectural action plan to modularize, secure, and optimize the codebase",
                            styles["chapter_sub"]))
    story.append(hr())

    # 4.1 Service Layer Refactoring Plan
    story.append(Paragraph("4.1  Service Layer Refactoring Plan", styles["section_h1"]))
    story.append(Paragraph(
        "To address the 'God Service' anti-pattern and improve resilience, we recommend "
        "decoupling ReplicateService and HistoryService. Business logic must be separated from "
        "data fetching, and API calls must include fail-safe mechanisms.",
        styles["body"]))
    story.append(sp(2))
    story.append(info_box("Service Refactoring Checklist", [
        Paragraph("1. Introduce an <b>AIJobQueue</b> to queue Replicate requests and throttle concurrent tasks.", styles["bullet"]),
        Paragraph("2. Split ReplicateService into model-specific classes (Flux, NanoBanana, Upscaler).", styles["bullet"]),
        Paragraph("3. Migrate history queries to a paginated API to support scalability.", styles["bullet"]),
    ], styles, border_color=RED))
    story.append(sp(4))

    # 4.2 Store Architecture Upgrade
    story.append(Paragraph("4.2  Store Architecture Upgrade", styles["section_h1"]))
    story.append(Paragraph(
        "Zustand stores must be secured and optimized. Credentials must be removed from the "
        "renderer memory space, and state subscriptions must be fine-grained to avoid "
        "rendering cascades.",
        styles["body"]))
    story.append(sp(2))
    story.append(info_box("Store Security & Performance Checklist", [
        Paragraph("1. Move API keys to Electron Main process and encrypt them using safeStorage.", styles["bullet"]),
        Paragraph("2. Enable Zustand's DevTools middleware for debuggability.", styles["bullet"]),
        Paragraph("3. Optimize select subscriptions in components to prevent unnecessary React re-renders.", styles["bullet"]),
    ], styles, border_color=INFO))
    story.append(sp(4))

    # 4.3 Component Decomposition Plan
    story.append(Paragraph("4.3  Component Decomposition Plan", styles["section_h1"]))
    story.append(Paragraph(
        "The components layer must adopt a strict hierarchy. God Components like TreeFlowCanvas "
        "must be decomposed into sub-components, with layout and business logic isolated.",
        styles["body"]))
    story.append(sp(2))
    story.append(info_box("Component Refactoring Checklist", [
        Paragraph("1. Extract canvas event handling logic into custom React hooks.", styles["bullet"]),
        Paragraph("2. Break down TreeFlowCanvas into smaller UI units: CanvasToolbar, NodeContainer, ContextMenu.", styles["bullet"]),
        Paragraph("3. Standardize visual styles with CSS variables and utilities.", styles["bullet"]),
    ], styles, border_color=SUCCESS))
    story.append(sp(4))

    doc.build(story, onFirstPage=tmpl, onLaterPages=tmpl)
    print(f"PDF built successfully at {output}")

if __name__ == "__main__":
    build_pdf()
