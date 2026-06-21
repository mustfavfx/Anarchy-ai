from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.colors import HexColor
import os

BLACK      = HexColor("#0A0A0A")
RED        = HexColor("#E63030")
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

W, H = A4

class PageTemplate:
    def __init__(self, doc_title="", file_num=3, total_files=8):
        self.doc_title = doc_title
        self.file_num = file_num
        self.total_files = total_files

    def __call__(self, canv, doc):
        canv.saveState()
        canv.setFillColor(BLACK); canv.rect(0,0,W,H,fill=1,stroke=0)
        canv.setFillColor(DARK_GRAY); canv.rect(0,H-28*mm,W,28*mm,fill=1,stroke=0)
        canv.setFillColor(RED); canv.rect(0,H-28*mm,W,1.2*mm,fill=1,stroke=0)
        canv.setFont("Helvetica-Bold",11); canv.setFillColor(RED)
        canv.drawString(18*mm,H-16*mm,"ANARCHY")
        canv.setFont("Helvetica",11); canv.setFillColor(TEXT_WHITE)
        canv.drawString(18*mm+58,H-16*mm,"AI")
        canv.setFont("Helvetica",8); canv.setFillColor(TEXT_GRAY)
        canv.drawCentredString(W/2,H-13*mm,self.doc_title)
        canv.setFont("Helvetica-Bold",7); canv.setFillColor(RED)
        canv.drawCentredString(W/2,H-20*mm,f"FILE {self.file_num} / {self.total_files}")
        canv.setFont("Helvetica",8); canv.setFillColor(TEXT_GRAY)
        canv.drawRightString(W-18*mm,H-16*mm,f"Page {doc.page}")
        canv.setFillColor(DARK_GRAY); canv.rect(0,0,W,14*mm,fill=1,stroke=0)
        canv.setFillColor(RED); canv.rect(0,14*mm,W,0.6*mm,fill=1,stroke=0)
        canv.setFont("Helvetica",7); canv.setFillColor(TEXT_GRAY)
        canv.drawString(18*mm,5*mm,"CONFIDENTIAL — Internal Technical Documentation")
        canv.drawRightString(W-18*mm,5*mm,"© 2025 Anarchy AI Platform")
        canv.setFillColor(RED); canv.rect(0,0,3,H,fill=1,stroke=0)
        canv.restoreState()

def build_styles():
    def s(name,**kw):
        kw.setdefault("fontName","Helvetica")
        kw.setdefault("textColor",TEXT_WHITE)
        return ParagraphStyle(name,**kw)
    return {
        "chapter_title": s("ct",fontName="Helvetica-Bold",fontSize=26,textColor=TEXT_WHITE,spaceAfter=3*mm,spaceBefore=4*mm,leading=32),
        "chapter_sub":   s("cs",fontSize=12,textColor=TEXT_GRAY,spaceAfter=6*mm,leading=18),
        "section_h1":    s("sh1",fontName="Helvetica-Bold",fontSize=15,textColor=RED,spaceAfter=3*mm,spaceBefore=6*mm,leading=20),
        "section_h2":    s("sh2",fontName="Helvetica-Bold",fontSize=11,textColor=TEXT_WHITE,spaceAfter=2*mm,spaceBefore=4*mm,leading=15),
        "body":          s("body",fontSize=9,textColor=TEXT_WHITE,spaceAfter=3*mm,leading=15,alignment=TA_JUSTIFY),
        "body_gray":     s("bg",fontSize=9,textColor=TEXT_GRAY,spaceAfter=2*mm,leading=14,alignment=TA_JUSTIFY),
        "bullet":        s("bul",fontSize=9,textColor=TEXT_WHITE,spaceAfter=1.5*mm,leading=14,leftIndent=8*mm),
        "toc_chapter":   s("tcc",fontName="Helvetica-Bold",fontSize=10,textColor=TEXT_WHITE,spaceAfter=1.5*mm,leading=14),
        "toc_section":   s("tcs",fontSize=9,textColor=TEXT_GRAY,spaceAfter=0.8*mm,leading=13,leftIndent=6*mm),
        "cell":          s("cell",fontSize=8,textColor=TEXT_WHITE,leading=12),
        "cell_red":      s("cr",fontName="Helvetica-Bold",fontSize=8,textColor=RED,leading=12),
        "cell_gray":     s("cg",fontSize=8,textColor=TEXT_GRAY,leading=12),
        "cell_code":     s("cc",fontName="Courier",fontSize=7.5,textColor=CODE_RED,leading=11),
        "cover_red":     s("cvr",fontName="Helvetica-Bold",fontSize=42,textColor=RED,alignment=TA_CENTER,leading=52,spaceAfter=6*mm),
        "cover_title":   s("cvt",fontName="Helvetica-Bold",fontSize=38,textColor=TEXT_WHITE,alignment=TA_CENTER,leading=48,spaceAfter=3*mm),
        "cover_sub":     s("cvs",fontSize=13,textColor=TEXT_GRAY,alignment=TA_CENTER,leading=18,spaceAfter=3*mm),
        "cover_meta":    s("cvm",fontSize=10,textColor=TEXT_GRAY,alignment=TA_CENTER,leading=14),
    }

def hr(color=RED,thickness=0.8):
    return HRFlowable(width="100%",thickness=thickness,color=color,spaceAfter=3*mm,spaceBefore=1*mm)

def sp(h=4):
    return Spacer(1,h*mm)

def info_box(title,paragraphs,styles,border_color=RED):
    content=[Paragraph(f"<b>{title}</b>",ParagraphStyle("ibt",fontName="Helvetica-Bold",fontSize=10,textColor=border_color,leading=14))]
    content.append(Spacer(1,2*mm))
    content.extend(paragraphs)
    t=Table([[content]],colWidths=[W-48*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),
        ("BOX",(0,0),(-1,-1),1.5,border_color),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    return t

def severity_badge(level,styles):
    c={"CRITICAL":"#E74C3C","HIGH":"#E67E22","MEDIUM":"#F1C40F","LOW":"#95A5A6","GOOD":"#2ECC71","OK":"#3498DB","MISSING":"#E74C3C","BROKEN":"#E74C3C","PARTIAL":"#F39C12","WORKING":"#2ECC71"}.get(level,"#AAAAAA")
    return Paragraph(f"<b><font color='{c}'>{level}</font></b>",styles["cell"])

def score_p(score_str,big=False):
    try:
        val=float(score_str.split("/")[0])
        c="#2ECC71" if val>=7 else ("#F39C12" if val>=5 else "#E74C3C")
    except:
        c="#AAAAAA"
    fs=14 if big else 11
    return Paragraph(f"<b><font color='{c}'>{score_str}</font></b>",
        ParagraphStyle("sp",fontName="Helvetica-Bold",fontSize=fs,textColor=HexColor(c),alignment=TA_CENTER,leading=fs+4))

def std_table(headers,rows,col_widths,styles,box_color=RED):
    h=[Paragraph(f"<b>{x}</b>",styles["cell_red"]) for x in headers]
    t=Table([h]+rows,colWidths=col_widths,repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),MID_GRAY),
        ("BACKGROUND",(0,1),(-1,-1),DARK_GRAY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[DARK_GRAY,BLACK]),
        ("GRID",(0,0),(-1,-1),0.4,BORDER),
        ("BOX",(0,0),(-1,-1),1,box_color),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
        ("LINEBELOW",(0,0),(-1,0),1,box_color),
    ]))
    return t

def feature_block(name, icon, score, status, description, working, broken, missing, styles):
    """Full feature audit block."""
    sc_val = float(score.split("/")[0])
    sc_c   = "#2ECC71" if sc_val>=7 else ("#F39C12" if sc_val>=5 else "#E74C3C")
    st_c   = {"WORKING":"#2ECC71","PARTIAL":"#F39C12","BROKEN":"#E74C3C","MISSING":"#E74C3C"}.get(status,"#AAA")

    header_t = Table([[
        Paragraph(f"{icon}  <b>{name}</b>",ParagraphStyle("fn",fontName="Helvetica-Bold",fontSize=13,textColor=TEXT_WHITE,leading=18)),
        Paragraph(f"<b><font color='{sc_c}'>{score}</font></b>",ParagraphStyle("fs",fontName="Helvetica-Bold",fontSize=22,textColor=HexColor(sc_c),alignment=TA_CENTER,leading=28)),
        Paragraph(f"<b><font color='{st_c}'>{status}</font></b>",ParagraphStyle("fst",fontName="Helvetica-Bold",fontSize=10,textColor=HexColor(st_c),alignment=TA_CENTER,leading=14)),
    ]],colWidths=[W-48*mm-28*mm-30*mm,28*mm,30*mm])
    header_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),MID_GRAY),
        ("BOX",(0,0),(-1,-1),1.5,RED),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("LINEAFTER",(0,0),(1,-1),0.5,LIGHT_GRAY),
    ]))

    desc_t = Table([[Paragraph(description,styles["body_gray"])]],colWidths=[W-48*mm])
    desc_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LINEBELOW",(0,0),(-1,-1),0.3,BORDER),
    ]))

    def make_col(title,items,color,prefix):
        col=[Paragraph(f"<b>{title}</b>",ParagraphStyle("ct2",fontName="Helvetica-Bold",fontSize=9,textColor=HexColor(color),leading=13))]
        col.append(Spacer(1,2*mm))
        for item in items:
            col.append(Paragraph(f"{prefix}  {item}",ParagraphStyle("ci2",fontSize=8,textColor=TEXT_WHITE,leading=12,leftIndent=3*mm)))
        return col

    col_w=(W-48*mm-2*mm)/3
    three_t=Table([[
        make_col("Working ✓",working,"#2ECC71","✓"),
        make_col("Broken ✗",broken,"#E74C3C","✗"),
        make_col("Missing ◯",missing,"#F39C12","◯"),
    ]],colWidths=[col_w,col_w,col_w])
    three_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(0,0),HexColor("#0D1A0D")),
        ("BACKGROUND",(1,0),(1,0),HexColor("#1A0D0D")),
        ("BACKGROUND",(2,0),(2,0),HexColor("#1A150D")),
        ("BOX",(0,0),(0,0),0.5,SUCCESS),
        ("BOX",(1,0),(1,0),0.5,DANGER),
        ("BOX",(2,0),(2,0),0.5,WARNING),
        ("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))

    return [header_t,desc_t,three_t,sp(4)]


def build_pdf():
    output = os.path.join(os.path.dirname(__file__), "reports", "Anarchy_AI_Report_03_Functional_Audit.pdf")
    output_dir = os.path.dirname(output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    styles=build_styles()
    tmpl=PageTemplate(doc_title="Functional Audit",file_num=3,total_files=8)
    doc=SimpleDocTemplate(output,pagesize=A4,
        leftMargin=18*mm,rightMargin=18*mm,topMargin=35*mm,bottomMargin=20*mm,
        title="Anarchy AI — Functional Audit",author="Anarchy AI Internal",
        subject="Technical Audit Report — File 3 of 8")
    story=[]

    # COVER
    story.append(sp(18))
    story.append(Paragraph("ANARCHY",styles["cover_red"]))
    story.append(Paragraph("AI Platform",styles["cover_title"]))
    story.append(sp(3))
    story.append(hr(RED,2))
    story.append(sp(3))
    story.append(Paragraph("Functional Audit",styles["cover_sub"]))
    story.append(Paragraph("Technical Audit Report — File 3 of 8",styles["cover_meta"]))
    story.append(sp(8))

    cov_t=Table([[
        Paragraph("10<br/><font size='8' color='#AAAAAA'>Features Audited</font>",ParagraphStyle("c1",fontName="Helvetica-Bold",fontSize=32,textColor=INFO,alignment=TA_CENTER,leading=40)),
        Paragraph("6.4<br/><font size='8' color='#AAAAAA'>Avg Feature Score</font>",ParagraphStyle("c2",fontName="Helvetica-Bold",fontSize=32,textColor=WARNING,alignment=TA_CENTER,leading=40)),
        Paragraph("3<br/><font size='8' color='#AAAAAA'>Broken Features</font>",ParagraphStyle("c3",fontName="Helvetica-Bold",fontSize=32,textColor=DANGER,alignment=TA_CENTER,leading=40)),
        Paragraph("12+<br/><font size='8' color='#AAAAAA'>Missing Features</font>",ParagraphStyle("c4",fontName="Helvetica-Bold",fontSize=32,textColor=WARNING,alignment=TA_CENTER,leading=40)),
    ]],colWidths=[(W-48*mm)/4]*4)
    cov_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("BOX",(0,0),(-1,-1),1.5,RED),
        ("GRID",(0,0),(-1,-1),0.5,BORDER),("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12),
    ]))
    story.append(cov_t)
    story.append(sp(8))

    meta=[("File","3 of 8 — Functional Audit"),
          ("Features","Generate, Upscale, Variations, History, Library, Canvas, Billing, Auth, Export, Notifications"),
          ("Method","Feature-by-feature functional testing analysis"),
          ("Date","2025 — Confidential Internal Report")]
    md=[[Paragraph(k,styles["cell_red"]),Paragraph(v,styles["cell"])] for k,v in meta]
    mt=Table(md,colWidths=[40*mm,W-48*mm-40*mm])
    mt.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("GRID",(0,0),(-1,-1),0.4,BORDER),
        ("BOX",(0,0),(-1,-1),1,LIGHT_GRAY),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]))
    story.append(mt)
    story.append(PageBreak())

    # TOC
    story.append(Paragraph("Table of Contents",styles["chapter_title"]))
    story.append(hr())
    toc=[
        ("1","Functional Overview & Score Matrix","03",True),
        ("2","Core AI Features","04",True),
        ("2.1","Generate (Image Generation)","04",False),
        ("2.2","Upscale","05",False),
        ("2.3","Variations","05",False),
        ("3","Data & Organization Features","06",True),
        ("3.1","History","06",False),
        ("3.2","Library","07",False),
        ("4","Canvas & Workflow Features","08",True),
        ("4.1","Canvas (Node-Based Workflow)","08",False),
        ("5","Platform Features","09",True),
        ("5.1","Billing & Credits","09",False),
        ("5.2","Authentication","10",False),
        ("5.3","Export","10",False),
        ("5.4","Notifications","11",False),
        ("6","Expected Bugs & Failure Modes","12",True),
        ("7","Feature Gap Analysis vs VizMaker","13",True),
        ("8","Functional Improvement Roadmap","15",True),
    ]
    for num,title,page,is_main in toc:
        row_t=Table([[
            Paragraph(f"<b>{num}</b>" if is_main else num,styles["toc_chapter"] if is_main else styles["toc_section"]),
            Paragraph(f"<b>{title}</b>" if is_main else title,styles["toc_chapter"] if is_main else styles["toc_section"]),
            Paragraph(page,ParagraphStyle("tpg",fontName="Helvetica-Bold" if is_main else "Helvetica",
                fontSize=10 if is_main else 9,textColor=RED if is_main else TEXT_GRAY,alignment=TA_RIGHT,leading=14)),
        ]],colWidths=[12*mm,W-48*mm-12*mm-14*mm,14*mm])
        row_t.setStyle(TableStyle([
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("TOPPADDING",(0,0),(-1,-1),2 if is_main else 1),
            ("BOTTOMPADDING",(0,0),(-1,-1),2 if is_main else 1),
            ("LINEBELOW",(0,0),(-1,-1),0.3 if is_main else 0.2,LIGHT_GRAY if is_main else BORDER),
        ]))
        story.append(row_t)
    story.append(PageBreak())

    # CH1: OVERVIEW
    story.append(Paragraph("1. Functional Overview & Score Matrix",styles["chapter_title"]))
    story.append(Paragraph("Complete audit of all 10 major features — working state, bugs, and missing capabilities",styles["chapter_sub"]))
    story.append(hr())
    story.append(Paragraph(
        "The functional audit evaluates each feature on three axes: implementation completeness "
        "(what is built vs what was designed), stability (bug frequency and severity), "
        "and user experience quality (does it feel professional-grade). "
        "The overall functional score of 6.4/10 reflects a platform that works well for basic "
        "use cases but has significant gaps in edge case handling and power-user workflows.",
        styles["body"]))
    story.append(sp(2))

    overview_rows=[
        [Paragraph("Generate",styles["cell"]),score_p("7.0/10"),severity_badge("PARTIAL",styles),
         Paragraph("Core flow works; missing queue, cancel, seed UI for FLUX",styles["cell_gray"])],
        [Paragraph("Upscale",styles["cell"]),score_p("6.5/10"),severity_badge("PARTIAL",styles),
         Paragraph("Works but no batch mode, no format options, slow feedback",styles["cell_gray"])],
        [Paragraph("Variations",styles["cell"]),score_p("6.0/10"),severity_badge("PARTIAL",styles),
         Paragraph("Works for FLUX; Nano Banana 2 seed issue causes identical outputs",styles["cell_gray"])],
        [Paragraph("History",styles["cell"]),score_p("5.5/10"),severity_badge("PARTIAL",styles),
         Paragraph("No pagination, search is slow, no re-use workflow",styles["cell_gray"])],
        [Paragraph("Library",styles["cell"]),score_p("5.0/10"),severity_badge("PARTIAL",styles),
         Paragraph("Basic exists; missing collections, tagging, smart folders",styles["cell_gray"])],
        [Paragraph("Canvas",styles["cell"]),score_p("6.5/10"),severity_badge("PARTIAL",styles),
         Paragraph("ReactFlow→LiteGraph migration incomplete; hybrid instability",styles["cell_gray"])],
        [Paragraph("Billing",styles["cell"]),score_p("6.8/10"),severity_badge("PARTIAL",styles),
         Paragraph("Stripe integration exists; webhook verification incomplete",styles["cell_gray"])],
        [Paragraph("Authentication",styles["cell"]),score_p("7.5/10"),severity_badge("WORKING",styles),
         Paragraph("Supabase Auth solid; missing MFA, social login limited",styles["cell_gray"])],
        [Paragraph("Export",styles["cell"]),score_p("6.0/10"),severity_badge("PARTIAL",styles),
         Paragraph("Image + PDF works; DXF pipeline fragile, no batch export",styles["cell_gray"])],
        [Paragraph("Notifications",styles["cell"]),score_p("7.0/10"),severity_badge("WORKING",styles),
         Paragraph("Toast system works; missing grouping, no notification history",styles["cell_gray"])],
    ]
    story.append(std_table(
        ["Feature","Score","Status","Assessment"],
        overview_rows,
        [35*mm,22*mm,24*mm,W-48*mm-35*mm-22*mm-24*mm],
        styles
    ))
    story.append(PageBreak())

    # CH2: CORE AI FEATURES
    story.append(Paragraph("2. Core AI Features",styles["chapter_title"]))
    story.append(Paragraph("Analysis of the three primary AI generation capabilities",styles["chapter_sub"]))
    story.append(hr())

    # 2.1 Generate
    story.append(Paragraph("2.1  Generate — Image Generation",styles["section_h1"]))
    story+=feature_block(
        name="Generate / Image Generation",icon="🎨",score="7.0/10",status="PARTIAL",
        description=(
            "The core generation feature — taking a prompt and architectural image, "
            "sending to Replicate (FLUX or Nano Banana 2), and returning a rendered result. "
            "This is the most-used feature and its core path works well. However, it lacks "
            "the production-grade reliability features (queue, cancel, progress) needed for "
            "professional users who run 10+ generations per session."
        ),
        working=[
            "Basic prompt → image generation via FLUX works correctly",
            "img2img (image + prompt) flow functions for Nano Banana 2",
            "Model switching between FLUX and Nano Banana 2 works",
            "Results correctly injected into canvas as output nodes",
            "Style presets correctly modify generation parameters",
            "Error message shown to user when generation fails",
        ],
        broken=[
            "No job queue — concurrent generations race and timeout",
            "Generate button not disabled while job is running — double-submit",
            "No cancel button — user must wait for timeout (30-60s)",
            "Seed parameter UI shown for Nano Banana 2 (which ignores seeds)",
            "Progress indicator is fake timer, not real Replicate progress",
            "On network drop mid-generation, result is silently lost",
        ],
        missing=[
            "Generation queue with position indicator (e.g., '2nd in queue')",
            "Real-time progress from Replicate webhook",
            "Cancel/abort running generation",
            "Batch generation (run same prompt with 4 different seeds)",
            "Prompt history dropdown (recent prompts)",
            "Negative prompt field",
            "Generation cost preview before submitting",
        ],
        styles=styles
    )

    # 2.2 Upscale
    story.append(Paragraph("2.2  Upscale",styles["section_h1"]))
    story+=feature_block(
        name="Upscale",icon="⬆",score="6.5/10",status="PARTIAL",
        description=(
            "Upscales a generated image using a Replicate upscaler model. "
            "Currently supports 2x and 4x upscaling via the Real-ESRGAN model. "
            "The feature works for its basic use case but lacks batch processing, "
            "format control, and quality comparison views."
        ),
        working=[
            "2x upscale via Real-ESRGAN works correctly",
            "4x upscale works correctly",
            "Upscaled image correctly replaces or adds alongside original in canvas",
            "Progress shown during upscale (though not real-time)",
        ],
        broken=[
            "Upscale on very large images (>4096px) fails silently",
            "No format selection — always outputs JPEG with fixed quality",
            "Upscale result sometimes mislinked to wrong canvas node",
            "Memory not freed after upscale — repeated upscales cause slowdown",
        ],
        missing=[
            "Side-by-side comparison view (before/after slider)",
            "Batch upscale (upscale all nodes in canvas)",
            "Format selection: JPEG quality, PNG lossless, WebP",
            "AI-based upscaler selection (Real-ESRGAN vs Clarity vs others)",
            "Partial upscale (upscale only a region via mask)",
        ],
        styles=styles
    )
    story.append(PageBreak())

    # 2.3 Variations
    story.append(Paragraph("2.3  Variations",styles["section_h1"]))
    story+=feature_block(
        name="Variations",icon="🔄",score="6.0/10",status="PARTIAL",
        description=(
            "Generates multiple variations of a selected image, either with different seeds "
            "(FLUX) or via img2img variation (Nano Banana 2). The critical known issue is "
            "that Nano Banana 2 does not support seed parameters (autoregressive architecture), "
            "so seed-based variation attempts produce nearly identical outputs rather than "
            "true variations. This is a fundamental model limitation that requires "
            "different UI guidance for each model."
        ),
        working=[
            "FLUX seed-based variations work correctly — distinct outputs per seed",
            "Variation strength slider correctly modifies output diversity",
            "Variations correctly added as sibling nodes on canvas",
            "Variation node links back to parent for traceability",
        ],
        broken=[
            "Nano Banana 2 variation with seed produces identical outputs (seed ignored)",
            "No UI warning that Nano Banana 2 does not support seeds",
            "Variation count defaults to 4 — no option to change per-session",
            "Variations sometimes overwrite instead of adding new nodes",
        ],
        missing=[
            "UI model capability badges: 'Supports seeds: No' for Nano Banana 2",
            "Variation grid view: 2x2 or 3x3 preview of all variations",
            "Variation interpolation: smooth morphing between two images",
            "Variation history: track which variation seed was chosen",
            "Auto-variation: automatically generate 4 variations after each render",
        ],
        styles=styles
    )

    # CH3: DATA FEATURES
    story.append(Paragraph("3. Data & Organization Features",styles["chapter_title"]))
    story.append(Paragraph("History and Library — how users find, organize, and reuse their work",styles["chapter_sub"]))
    story.append(hr())

    # 3.1 History
    story.append(Paragraph("3.1  History",styles["section_h1"]))
    story+=feature_block(
        name="History",icon="📋",score="5.5/10",status="PARTIAL",
        description=(
            "The History page shows all past generation records with thumbnails, prompts, "
            "model info, and timestamps. It is the second most-used feature after Generate. "
            "The critical functional issue is no pagination — all records load on mount. "
            "The most-requested missing feature is the ability to click a history item "
            "and re-load it directly into a new canvas node for iteration."
        ),
        working=[
            "History records saved correctly after each generation",
            "Thumbnail preview displayed for each record",
            "Timestamp, model, and prompt metadata shown",
            "Delete individual record works",
            "Basic text search filters visible records",
        ],
        broken=[
            "All records loaded into memory on page mount — no pagination",
            "Search is client-side linear scan — slow with 100+ records",
            "Thumbnail generation sometimes fails, leaving blank preview",
            "Delete confirmation dialog sometimes fails to close",
            "Sort by date ascending/descending sometimes reversed",
        ],
        missing=[
            "Cursor-based pagination (load 20 at a time, infinite scroll)",
            "'Re-use' button: load history item into new canvas node",
            "Filter by model (FLUX only, Nano Banana 2 only)",
            "Filter by date range",
            "Bulk select and delete",
            "Export history to CSV/JSON",
            "Favorite / star records for quick access",
        ],
        styles=styles
    )
    story.append(PageBreak())

    # 3.2 Library
    story.append(Paragraph("3.2  Library",styles["section_h1"]))
    story+=feature_block(
        name="Library",icon="📁",score="5.0/10",status="PARTIAL",
        description=(
            "The Library stores saved images, project assets, and reference materials. "
            "It is the least-developed major feature in the platform. Currently it functions "
            "as a flat image grid with no organization tools. For architectural professionals "
            "who manage dozens of projects simultaneously, the library needs collections, "
            "tagging, and project linking to be genuinely useful."
        ),
        working=[
            "Image upload and storage via Supabase Storage works",
            "Grid view displays library images correctly",
            "Image preview on click works",
            "Delete image from library works",
        ],
        broken=[
            "No folder or collection structure — all images in flat list",
            "Upload progress bar often stalls at 99%",
            "Large images (>10MB) fail to upload without clear error",
            "No drag-and-drop from Library directly to Canvas",
        ],
        missing=[
            "Collections / folders for project organization",
            "Tags and labels for images",
            "Smart folders: 'All FLUX renders', 'This week', 'Starred'",
            "Drag-and-drop from Library to Canvas as source node",
            "Reference image import from URL",
            "Batch upload with progress",
            "Image metadata view (model, prompt, seed used to generate)",
            "Search by prompt text within library",
        ],
        styles=styles
    )

    # CH4: CANVAS
    story.append(Paragraph("4. Canvas & Workflow Features",styles["chapter_title"]))
    story.append(hr())

    story.append(Paragraph("4.1  Canvas — Node-Based Workflow",styles["section_h1"]))
    story+=feature_block(
        name="Canvas / Node-Based Workflow",icon="🔗",score="6.5/10",status="PARTIAL",
        description=(
            "The canvas is the central UI of Anarchy AI — a node-based workflow editor "
            "where architects connect image sources, AI models, and processing steps. "
            "Currently in migration from ReactFlow to LiteGraph.js, the canvas shows "
            "the intended 240×320px card nodes with image previews and red circular "
            "connectors — but 40% of the migration is incomplete, causing hybrid state "
            "instability. When stable, the canvas is genuinely compelling."
        ),
        working=[
            "Node creation and deletion works in both ReactFlow and LiteGraph modes",
            "Basic connections between nodes (source → render → upscale)",
            "Viewport pan and zoom works",
            "Node position auto-save via Supabase",
            "Canvas background grid renders correctly",
            "3ds Max bridge correctly injects screenshot as source node",
        ],
        broken=[
            "LiteGraph migration 40% complete — some node types use old ReactFlow API",
            "GhostNode type routing switches incorrectly between LiteGraph and ReactFlow",
            "Undo/redo history sometimes desynchronizes with canvas state",
            "Copy-paste of nodes loses connection metadata",
            "Right-click context menu occasionally appears off-screen",
        ],
        missing=[
            "Node grouping / framing (group related nodes visually)",
            "Canvas minimap for large workflows",
            "Node search / spotlight (Cmd+K to find node type)",
            "Workflow templates: starter layouts for common architect tasks",
            "Export workflow as .ana file format",
            "Node comment/annotation cards",
            "Auto-layout (arrange nodes automatically by data flow direction)",
            "Collapse/expand complex nodes to save canvas space",
        ],
        styles=styles
    )
    story.append(PageBreak())

    # CH5: PLATFORM
    story.append(Paragraph("5. Platform Features",styles["chapter_title"]))
    story.append(Paragraph("Billing, Authentication, Export, and Notifications",styles["chapter_sub"]))
    story.append(hr())

    story.append(Paragraph("5.1  Billing & Credits",styles["section_h1"]))
    story+=feature_block(
        name="Billing & Credits",icon="💳",score="6.8/10",status="PARTIAL",
        description=(
            "Billing is handled via Stripe with a credit-based consumption model. "
            "The integration is mostly complete — users can purchase credits and "
            "credits are deducted per generation. The main gap is incomplete "
            "Stripe webhook verification (important for security) and the lack "
            "of a pre-flight credit check before expensive operations."
        ),
        working=[
            "Stripe payment flow for credit purchase works",
            "Credit balance shown in UI and deducted per generation",
            "Billing history / invoice page accessible",
            "Low credit warning notification shown",
            "Free tier credit allocation on signup works",
        ],
        broken=[
            "Stripe webhook signature verification incomplete — replay attack risk",
            "Credit deduction sometimes fails silently — generation succeeds but credits not deducted",
            "Credit balance can go negative on rapid concurrent generations",
            "Refund flow not implemented — manual process required",
        ],
        missing=[
            "Pre-flight: check sufficient credits before submitting generation",
            "Credit cost display per model before generation",
            "Subscription tier (monthly credits instead of pay-per-use)",
            "Team billing: shared credit pool for small firms",
            "Usage analytics: credits spent per project/day/model",
            "ZainCash integration for Iraqi market (IQD-denominated)",
        ],
        styles=styles
    )

    story.append(Paragraph("5.2  Authentication",styles["section_h1"]))
    story+=feature_block(
        name="Authentication",icon="🔐",score="7.5/10",status="WORKING",
        description=(
            "Authentication is the strongest platform feature. Supabase Auth provides "
            "email/password login, password reset, and session persistence. "
            "The implementation is clean and reliable. Main improvements needed "
            "are MFA support and Google social login for professional users."
        ),
        working=[
            "Email/password sign-up and login works correctly",
            "Password reset via email works",
            "Session persistence across app restarts (JWT stored correctly)",
            "Auth-gated routes redirect correctly to login",
            "DEV_MODE bypass for development (properly guarded)",
            "Sign out correctly clears all session data",
        ],
        broken=[
            "Email verification flow occasionally sends to spam",
            "Session refresh fails after 7-day token expiry — silent logout",
        ],
        missing=[
            "Multi-Factor Authentication (MFA / TOTP)",
            "Google OAuth social login",
            "SSO for enterprise/firm accounts",
            "Account deletion with data export",
            "'Remember this device' option",
        ],
        styles=styles
    )
    story.append(PageBreak())

    story.append(Paragraph("5.3  Export",styles["section_h1"]))
    story+=feature_block(
        name="Export",icon="📤",score="6.0/10",status="PARTIAL",
        description=(
            "Export handles image download, PDF generation, and DXF vector output. "
            "Image and PDF export work for basic cases. The DXF pipeline (Python FastAPI "
            "on port 7430) is the most fragile component — it depends on a Python subprocess "
            "that can crash silently, leaving the user with no feedback."
        ),
        working=[
            "Single image export (JPEG) works correctly",
            "PDF export with watermark works for single-image exports",
            "Export triggers correctly from canvas toolbar",
            "Watermark applied correctly to exported images",
        ],
        broken=[
            "DXF export fails silently if Python subprocess not running",
            "PDF export freezes UI for large canvases (>50 nodes)",
            "Export filename uses generic timestamp — not project name",
            "Multi-image PDF (one per canvas node) occasionally skips nodes",
        ],
        missing=[
            "Batch export: download all canvas outputs as ZIP",
            "PNG export (currently JPEG only)",
            "WebP export for web use cases",
            "DXF export health check with auto-restart on failure",
            "Export progress bar with estimated time",
            "Export preset profiles (print quality, web quality, client presentation)",
            "Direct upload to cloud storage (Google Drive, Dropbox)",
        ],
        styles=styles
    )

    story.append(Paragraph("5.4  Notifications",styles["section_h1"]))
    story+=feature_block(
        name="Notifications",icon="🔔",score="7.0/10",status="WORKING",
        description=(
            "The notification system using Zustand + toast components is the second-best "
            "implemented feature after Authentication. Generation complete, billing alerts, "
            "and error messages all trigger correctly. The main UX issue is notification "
            "flooding — a failed batch of 5 generations creates 5 identical error toasts."
        ),
        working=[
            "Generation complete toast triggers reliably",
            "Error notifications show for failed generations",
            "Low credit warning notification works",
            "Toast auto-dismiss after configurable timeout",
            "Notification type icons distinguish success/error/warning",
        ],
        broken=[
            "Duplicate notifications for repeated errors — no deduplication",
            "Notifications obscure canvas controls if many stack up",
            "Notification positioning inconsistent between pages",
        ],
        missing=[
            "Notification center (bell icon) with history of past 50 alerts",
            "Deduplication: group identical messages with count badge",
            "Desktop OS notifications for background generation complete",
            "Notification preferences: mute certain notification types",
            "In-app notification for new platform features / changelogs",
        ],
        styles=styles
    )

    # CH6: EXPECTED BUGS
    story.append(PageBreak())
    story.append(Paragraph("6. Expected Bugs & Failure Modes",styles["chapter_title"]))
    story.append(Paragraph("Predicted failure scenarios based on code analysis",styles["chapter_sub"]))
    story.append(hr())
    story.append(Paragraph(
        "The following bugs are predicted with high confidence based on the code patterns "
        "identified in the audit. They may not all be reproducible in a simple test session "
        "but will surface under real-world usage conditions.",
        styles["body_gray"]))
    story.append(sp(2))

    bugs=[
        ("BUG-001","CRITICAL","Canvas White Screen","Open a canvas with 50+ nodes after LiteGraph migration — hybrid state causes render error with no Error Boundary to catch it","Add Error Boundary around canvas; complete LiteGraph migration"),
        ("BUG-002","CRITICAL","Credit Overdraft","Generate 6 images rapidly before credit deduction confirms — balance goes negative; generations may succeed without payment","Add pre-flight credit check; use atomic Supabase transaction for deduction"),
        ("BUG-003","HIGH","Silent DXF Failure","Export to DXF when Python process not started — UI shows loading forever with no timeout","Add DXF bridge health check + 10s timeout with clear error message"),
        ("BUG-004","HIGH","History Memory Leak","Open History page with 500+ records — browser process RAM exceeds 2GB, UI becomes unresponsive","Implement cursor pagination; load max 20 records at a time"),
        ("BUG-005","HIGH","Variation Confusion","Run 4 variations on Nano Banana 2 — all 4 look identical because seed is ignored; user thinks feature is broken","Show model capability badge 'Seeds: Not Supported' for Nano Banana 2"),
        ("BUG-006","HIGH","Double Generation","Click Generate, wait 3s, click again — two generations fire; both deduct credits; second overwrites first result","Disable Generate button during active job; use loading state from store"),
        ("BUG-007","HIGH","Stale Auth Session","Leave app open 7+ days — JWT expires; next generation fails with auth error but user sees generic error","Implement automatic token refresh 24h before expiry"),
        ("BUG-008","MEDIUM","Lost Generation on Network Drop","Generation running, network drops for 5s, returns — result is gone, credits deducted, no retry","Add Replicate webhook callback as fallback for polling-based result fetch"),
        ("BUG-009","MEDIUM","Export Filename Collision","Export 3 images in same second — all get same timestamp filename — last one overwrites","Add UUID suffix to all export filenames"),
        ("BUG-010","MEDIUM","Upscale Node Mismatch","Upscale on canvas with 4+ nodes — result sometimes linked to wrong parent node","Fix upscale result injection: pass explicit nodeId to upscale call"),
    ]
    bug_rows=[[
        Paragraph(f"<font color='#E06C75'>{b[0]}</font>",styles["cell_code"]),
        severity_badge(b[1],styles),
        Paragraph(f"<b>{b[2]}</b>",styles["cell"]),
        Paragraph(b[3],styles["cell_gray"]),
        Paragraph(b[4],styles["cell"]),
    ] for b in bugs]
    story.append(std_table(
        ["ID","Severity","Bug Name","Scenario","Fix"],
        bug_rows,
        [20*mm,22*mm,30*mm,57*mm,W-48*mm-20*mm-22*mm-30*mm-57*mm],
        styles
    ))
    story.append(PageBreak())

    # CH7: GAP ANALYSIS vs VIZMAKER
    story.append(Paragraph("7. Feature Gap Analysis vs VizMaker",styles["chapter_title"]))
    story.append(Paragraph("Where Anarchy AI leads, where it lags, and where to invest next",styles["chapter_sub"]))
    story.append(hr())
    story.append(Paragraph(
        "VizMaker is the primary competitor — a web-based architectural visualization AI tool. "
        "This comparison maps feature parity and identifies ANARCHY's strategic advantages "
        "and the gaps that must be closed before the first public release.",
        styles["body"]))
    story.append(sp(2))

    gap_rows=[
        ["Text-to-image generation",          "✓ Full","✓ Full","Parity"],
        ["img2img (image + prompt)",           "✓ Full","✓ Full","Parity"],
        ["Multiple AI models",                 "✓ FLUX+NB2","✗ Single","ANARCHY leads"],
        ["Node-based canvas workflow",         "✓ Full","✗ None","ANARCHY leads"],
        ["3ds Max native bridge",              "✓ Full","✗ None","ANARCHY leads"],
        ["Revit integration",                  "◯ Planned","✗ None","ANARCHY leads (when complete)"],
        ["DXF vector export",                  "✓ Partial","✗ None","ANARCHY leads"],
        ["Generation history",                 "✓ Partial","✓ Full","VizMaker better (pagination)"],
        ["Image library / organization",       "✓ Partial","✓ Full","VizMaker better (collections)"],
        ["Upscale",                            "✓ Full","✓ Full","Parity"],
        ["Variations / seeds",                 "✓ Partial","✓ Full","VizMaker better (UI clarity)"],
        ["Batch generation",                   "✗ Missing","✓ Full","VizMaker wins"],
        ["Real-time progress",                 "✗ Fake","✓ Real","VizMaker wins"],
        ["Generation cancel",                  "✗ Missing","✓ Full","VizMaker wins"],
        ["Collaboration / sharing",            "✗ Missing","✓ Partial","VizMaker wins"],
        ["Offline mode",                       "✗ Missing","✗ Missing","Neither"],
        ["Mobile app",                         "✗ Missing","✗ Missing","Neither"],
        ["Style presets library",              "✓ Basic","✓ Full","VizMaker better"],
        ["Prompt builder assistant",           "✗ Missing","✓ Partial","VizMaker leads"],
        ["Client presentation mode",           "✗ Missing","✓ Partial","VizMaker leads"],
        ["Local AI (Ollama)",                  "◯ Planned","✗ None","ANARCHY leads (when complete)"],
        ["ZainCash / local payment",           "◯ Planned","✗ None","ANARCHY leads (Iraqi market)"],
    ]
    def gap_status(s):
        c={"ANARCHY leads":"#2ECC71","VizMaker wins":"#E74C3C","VizMaker better":"#E67E22","Parity":"#3498DB","Neither":"#95A5A6","ANARCHY leads (when complete)":"#F39C12","ANARCHY leads (Iraqi market)":"#2ECC71"}.get(s,"#AAA")
        return Paragraph(f"<b><font color='{c}'>{s}</font></b>",ParagraphStyle("gs",fontName="Helvetica-Bold",fontSize=8,textColor=HexColor(c),leading=12))

    def feat_status(s):
        c={"✓ Full":"#2ECC71","✓ Partial":"#F39C12","✗ None":"#E74C3C","✗ Missing":"#E74C3C","◯ Planned":"#3498DB","✗ Fake":"#E74C3C","✓ Basic":"#F39C12","✓ Real":"#2ECC71"}.get(s,"#AAA")
        return Paragraph(f"<font color='{c}'>{s}</font>",ParagraphStyle("fs2",fontSize=8,textColor=HexColor(c),leading=12))

    gap_data=[[
        Paragraph(r[0],styles["cell"]),
        feat_status(r[1]),
        feat_status(r[2]),
        gap_status(r[3]),
    ] for r in gap_rows]
    story.append(std_table(
        ["Feature","ANARCHY AI","VizMaker","Verdict"],
        gap_data,
        [70*mm,28*mm,28*mm,W-48*mm-70*mm-28*mm-28*mm],
        styles
    ))
    story.append(PageBreak())

    # CH8: ROADMAP
    story.append(Paragraph("8. Functional Improvement Roadmap",styles["chapter_title"]))
    story.append(Paragraph("Prioritized plan to reach functional parity and beyond",styles["chapter_sub"]))
    story.append(hr())

    story.append(Paragraph("Sprint 1 — Fix Critical Broken Features",styles["section_h2"]))
    for item in [
        "Add generate button loading state — prevent double-submit",
        "Add pre-flight credit check before every generation",
        "Add Error Boundary around canvas — prevent white screen",
        "Fix Stripe webhook signature verification",
        "Add DXF bridge health check with 10s timeout",
        "Show Nano Banana 2 capability badge: 'Seeds: Not Supported'",
    ]:
        story.append(Paragraph(f"• {item}",styles["bullet"]))
    story.append(sp(2))

    story.append(Paragraph("Sprint 2 — History & Library Overhaul",styles["section_h2"]))
    for item in [
        "Implement cursor-based pagination in History (load 20 at a time)",
        "Move History search to Supabase full-text search",
        "Add 'Re-use in Canvas' button to history records",
        "Add Library collections / folders",
        "Enable drag-and-drop from Library to Canvas",
        "Add bulk select and delete in History",
    ]:
        story.append(Paragraph(f"• {item}",styles["bullet"]))
    story.append(sp(2))

    story.append(Paragraph("Sprint 3 — Generation Quality Improvements",styles["section_h2"]))
    for item in [
        "Add real-time Replicate webhook progress (replace fake timer)",
        "Add cancel button for running generation",
        "Implement generation queue with queue position indicator",
        "Add batch generation: 4 seeds in one click",
        "Add negative prompt field",
        "Show generation cost per model before submit",
    ]:
        story.append(Paragraph(f"• {item}",styles["bullet"]))
    story.append(sp(2))

    story.append(Paragraph("Sprint 4 — Canvas & Export Polish",styles["section_h2"]))
    for item in [
        "Complete LiteGraph migration — remove ReactFlow entirely",
        "Add canvas minimap",
        "Add node grouping / frame feature",
        "Add batch export (ZIP of all canvas outputs)",
        "Add PNG and WebP export formats",
        "Add export progress bar",
        "Add workflow templates (3 starter canvas layouts)",
    ]:
        story.append(Paragraph(f"• {item}",styles["bullet"]))
    story.append(sp(3))

    story.append(info_box("End of File 3 / 8",
        [Paragraph(
            "This concludes the Functional Audit. "
            "Continue with <b>File 4 — Performance Audit</b> for detailed analysis of memory leaks, "
            "re-render storms, bundle size optimization, canvas performance, "
            "and the top 20 performance issues with fix estimates.",
            styles["body"])],
        styles,border_color=RED))

    doc.build(story,onFirstPage=tmpl,onLaterPages=tmpl)
    print(f"PDF created: {output}")

if __name__=="__main__":
    build_pdf()
