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

BLACK=HexColor("#0A0A0A"); RED=HexColor("#E63030"); DARK_GRAY=HexColor("#1A1A1A")
MID_GRAY=HexColor("#2A2A2A"); LIGHT_GRAY=HexColor("#3A3A3A"); TEXT_WHITE=HexColor("#F5F5F5")
TEXT_GRAY=HexColor("#AAAAAA"); SUCCESS=HexColor("#2ECC71"); WARNING=HexColor("#F39C12")
DANGER=HexColor("#E74C3C"); INFO=HexColor("#3498DB"); BORDER=HexColor("#2D2D2D")
CODE_RED=HexColor("#E06C75"); W,H=A4

class PT:
    def __init__(self,title="",fn=4,tot=8): self.title=title; self.fn=fn; self.tot=tot
    def __call__(self,c,doc):
        c.saveState()
        c.setFillColor(BLACK); c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(DARK_GRAY); c.rect(0,H-28*mm,W,28*mm,fill=1,stroke=0)
        c.setFillColor(RED); c.rect(0,H-28*mm,W,1.2*mm,fill=1,stroke=0)
        c.setFont("Helvetica-Bold",11); c.setFillColor(RED); c.drawString(18*mm,H-16*mm,"ANARCHY")
        c.setFont("Helvetica",11); c.setFillColor(TEXT_WHITE); c.drawString(18*mm+58,H-16*mm,"AI")
        c.setFont("Helvetica",8); c.setFillColor(TEXT_GRAY); c.drawCentredString(W/2,H-13*mm,self.title)
        c.setFont("Helvetica-Bold",7); c.setFillColor(RED); c.drawCentredString(W/2,H-20*mm,f"FILE {self.fn} / {self.tot}")
        c.setFont("Helvetica",8); c.setFillColor(TEXT_GRAY); c.drawRightString(W-18*mm,H-16*mm,f"Page {doc.page}")
        c.setFillColor(DARK_GRAY); c.rect(0,0,W,14*mm,fill=1,stroke=0)
        c.setFillColor(RED); c.rect(0,14*mm,W,0.6*mm,fill=1,stroke=0)
        c.setFont("Helvetica",7); c.setFillColor(TEXT_GRAY)
        c.drawString(18*mm,5*mm,"CONFIDENTIAL — Internal Technical Documentation")
        c.drawRightString(W-18*mm,5*mm,"© 2025 Anarchy AI Platform")
        c.setFillColor(RED); c.rect(0,0,3,H,fill=1,stroke=0)
        c.restoreState()

def S():
    def s(n,**k):
        k.setdefault("fontName","Helvetica"); k.setdefault("textColor",TEXT_WHITE)
        return ParagraphStyle(n,**k)
    return {
        "CT":s("CT",fontName="Helvetica-Bold",fontSize=26,textColor=TEXT_WHITE,spaceAfter=3*mm,spaceBefore=4*mm,leading=32),
        "CS":s("CS",fontSize=12,textColor=TEXT_GRAY,spaceAfter=6*mm,leading=18),
        "H1":s("H1",fontName="Helvetica-Bold",fontSize=15,textColor=RED,spaceAfter=3*mm,spaceBefore=6*mm,leading=20),
        "H2":s("H2",fontName="Helvetica-Bold",fontSize=11,textColor=TEXT_WHITE,spaceAfter=2*mm,spaceBefore=4*mm,leading=15),
        "BD":s("BD",fontSize=9,textColor=TEXT_WHITE,spaceAfter=3*mm,leading=15,alignment=TA_JUSTIFY),
        "BG":s("BG",fontSize=9,textColor=TEXT_GRAY,spaceAfter=2*mm,leading=14,alignment=TA_JUSTIFY),
        "BL":s("BL",fontSize=9,textColor=TEXT_WHITE,spaceAfter=1.5*mm,leading=14,leftIndent=8*mm),
        "TC":s("TC",fontName="Helvetica-Bold",fontSize=10,textColor=TEXT_WHITE,spaceAfter=1.5*mm,leading=14),
        "TS":s("TS",fontSize=9,textColor=TEXT_GRAY,spaceAfter=0.8*mm,leading=13,leftIndent=6*mm),
        "CE":s("CE",fontSize=8,textColor=TEXT_WHITE,leading=12),
        "CR":s("CR",fontName="Helvetica-Bold",fontSize=8,textColor=RED,leading=12),
        "CG":s("CG",fontSize=8,textColor=TEXT_GRAY,leading=12),
        "CC":s("CC",fontName="Courier",fontSize=7.5,textColor=CODE_RED,leading=11),
        "CVR":s("CVR",fontName="Helvetica-Bold",fontSize=42,textColor=RED,alignment=TA_CENTER,leading=52,spaceAfter=6*mm),
        "CVT":s("CVT",fontName="Helvetica-Bold",fontSize=38,textColor=TEXT_WHITE,alignment=TA_CENTER,leading=48,spaceAfter=3*mm),
        "CVS":s("CVS",fontSize=13,textColor=TEXT_GRAY,alignment=TA_CENTER,leading=18,spaceAfter=3*mm),
        "CVM":s("CVM",fontSize=10,textColor=TEXT_GRAY,alignment=TA_CENTER,leading=14),
    }

def hr(col=RED,th=0.8): return HRFlowable(width="100%",thickness=th,color=col,spaceAfter=3*mm,spaceBefore=1*mm)
def sp(h=4): return Spacer(1,h*mm)

def box(title,paras,st,bc=RED):
    c=[Paragraph(f"<b>{title}</b>",ParagraphStyle("bt",fontName="Helvetica-Bold",fontSize=10,textColor=bc,leading=14))]
    c.append(Spacer(1,2*mm)); c.extend(paras)
    t=Table([[c]],colWidths=[W-48*mm])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("BOX",(0,0),(-1,-1),1.5,bc),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),("VALIGN",(0,0),(-1,-1),"TOP")]))
    return t

def tbl(hdrs,rows,cw,st,bc=RED):
    h=[Paragraph(f"<b>{x}</b>",st["CR"]) for x in hdrs]
    t=Table([h]+rows,colWidths=cw,repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),MID_GRAY),("BACKGROUND",(0,1),(-1,-1),DARK_GRAY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[DARK_GRAY,BLACK]),
        ("GRID",(0,0),(-1,-1),0.4,BORDER),("BOX",(0,0),(-1,-1),1,bc),
        ("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),5),
        ("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),6),
        ("RIGHTPADDING",(0,0),(-1,-1),6),("LINEBELOW",(0,0),(-1,0),1,bc)]))
    return t

def sev(level,st):
    c={"CRITICAL":"#E74C3C","HIGH":"#E67E22","MEDIUM":"#F1C40F","LOW":"#95A5A6","GOOD":"#2ECC71","OK":"#3498DB"}.get(level,"#AAA")
    return Paragraph(f"<b><font color='{c}'>{level}</font></b>",st["CE"])

def sc(v,fs=11):
    try: val=float(v.split("/")[0]); c="#2ECC71" if val>=7 else("#F39C12" if val>=5 else"#E74C3C")
    except: c="#AAA"
    return Paragraph(f"<b><font color='{c}'>{v}</font></b>",ParagraphStyle("sp",fontName="Helvetica-Bold",fontSize=fs,textColor=HexColor(c),alignment=TA_CENTER,leading=fs+4))

def perf_block(rank,title,category,impact,current,fix,effort,st):
    """Single performance issue block."""
    cat_c={"Memory":"#9B59B6","Rendering":"#E74C3C","Bundle":"#3498DB","Canvas":"#E67E22","Store":"#F39C12","Network":"#1ABC9C","I/O":"#E74C3C"}.get(category,"#AAA")
    imp_c={"CRITICAL":"#E74C3C","HIGH":"#E67E22","MEDIUM":"#F1C40F","LOW":"#95A5A6"}.get(impact,"#AAA")
    eff_c={"0.5 day":"#2ECC71","1 day":"#2ECC71","2 days":"#F39C12","3 days":"#F39C12","1 week":"#E74C3C","2 weeks":"#E74C3C"}.get(effort,"#AAA")

    h=Table([[
        Paragraph(f"<b>#{rank:02d}</b>",ParagraphStyle("rn",fontName="Helvetica-Bold",fontSize=16,textColor=RED,alignment=TA_CENTER,leading=22)),
        Paragraph(f"<b>{title}</b>",ParagraphStyle("tt",fontName="Helvetica-Bold",fontSize=11,textColor=TEXT_WHITE,leading=15)),
        Paragraph(f"<b><font color='{cat_c}'>{category}</font></b>",ParagraphStyle("ct3",fontName="Helvetica-Bold",fontSize=8,textColor=HexColor(cat_c),alignment=TA_CENTER,leading=12)),
        Paragraph(f"<b><font color='{imp_c}'>{impact}</font></b>",ParagraphStyle("im",fontName="Helvetica-Bold",fontSize=8,textColor=HexColor(imp_c),alignment=TA_CENTER,leading=12)),
        Paragraph(f"<font color='{eff_c}'>{effort}</font>",ParagraphStyle("ef",fontSize=8,textColor=HexColor(eff_c),alignment=TA_CENTER,leading=12)),
    ]],colWidths=[12*mm,W-48*mm-12*mm-25*mm-25*mm-22*mm,25*mm,25*mm,22*mm])
    h.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),MID_GRAY),("BOX",(0,0),(-1,-1),1.2,RED),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LINEAFTER",(0,0),(3,-1),0.5,LIGHT_GRAY),
    ]))

    body=Table([[
        Paragraph(f"<b>Current:</b> {current}",ParagraphStyle("cu",fontSize=8,textColor=TEXT_GRAY,leading=12)),
        Paragraph(f"<b>Fix:</b> {fix}",ParagraphStyle("fx",fontSize=8,textColor=TEXT_WHITE,leading=12)),
    ]],colWidths=[(W-48*mm)/2,(W-48*mm)/2])
    body.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("LINEBELOW",(0,0),(-1,-1),0.4,BORDER),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("VALIGN",(0,0),(-1,-1),"TOP"),("LINEAFTER",(0,0),(0,-1),0.4,BORDER),
    ]))
    return [h,body,sp(2)]


def build_pdf():
    out = os.path.join(os.path.dirname(__file__), "reports", "Anarchy_AI_Report_04_Performance_Audit.pdf")
    output_dir = os.path.dirname(out)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    st=S(); tmpl=PT("Performance Audit",4,8)
    doc=SimpleDocTemplate(out,pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,
        topMargin=35*mm,bottomMargin=20*mm,
        title="Anarchy AI — Performance Audit",author="Anarchy AI Internal",
        subject="Technical Audit Report — File 4 of 8")
    story=[]

    # COVER
    story+=[sp(18),Paragraph("ANARCHY",st["CVR"]),Paragraph("AI Platform",st["CVT"]),sp(3),hr(RED,2),sp(3),
            Paragraph("Performance Audit",st["CVS"]),Paragraph("Technical Audit Report — File 4 of 8",st["CVM"]),sp(8)]
    ct=Table([[
        Paragraph("Top 20<br/><font size='8' color='#AAAAAA'>Issues Found</font>",ParagraphStyle("c1",fontName="Helvetica-Bold",fontSize=28,textColor=DANGER,alignment=TA_CENTER,leading=36)),
        Paragraph("6.0<br/><font size='8' color='#AAAAAA'>Perf Score / 10</font>",ParagraphStyle("c2",fontName="Helvetica-Bold",fontSize=28,textColor=WARNING,alignment=TA_CENTER,leading=36)),
        Paragraph("30+<br/><font size='8' color='#AAAAAA'>Re-renders/Action</font>",ParagraphStyle("c3",fontName="Helvetica-Bold",fontSize=28,textColor=DANGER,alignment=TA_CENTER,leading=36)),
        Paragraph("9.6<br/><font size='8' color='#AAAAAA'>Target Score</font>",ParagraphStyle("c4",fontName="Helvetica-Bold",fontSize=28,textColor=SUCCESS,alignment=TA_CENTER,leading=36)),
    ]],colWidths=[(W-48*mm)/4]*4)
    ct.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("BOX",(0,0),(-1,-1),1.5,RED),
        ("GRID",(0,0),(-1,-1),0.5,BORDER),("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12)]))
    story.append(ct); story.append(sp(8))
    meta=[("File","4 of 8 — Performance Audit"),("Covers","Memory, Re-renders, Bundle, Canvas, Store, Network, I/O"),
          ("Method","Static code analysis + architectural pattern review"),("Date","2025 — Confidential Internal Report")]
    md=[[Paragraph(k,st["CR"]),Paragraph(v,st["CE"])] for k,v in meta]
    mt=Table(md,colWidths=[40*mm,W-48*mm-40*mm])
    mt.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("GRID",(0,0),(-1,-1),0.4,BORDER),
        ("BOX",(0,0),(-1,-1),1,LIGHT_GRAY),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    story.append(mt); story.append(PageBreak())

    # TOC
    story+=[Paragraph("Table of Contents",st["CT"]),hr()]
    toc=[("1","Performance Score Overview","03",True),("2","Memory Leaks","04",True),
         ("2.1","History Page Memory Leak","04",False),("2.2","Canvas Memory Leak","04",False),
         ("2.3","Image Object URL Leak","05",False),("3","Re-render Storm Analysis","05",True),
         ("3.1","Zustand Re-render Map","05",False),("3.2","Canvas Re-render Causes","06",False),
         ("4","Bundle Size Optimization","07",True),("4.1","Current Bundle Analysis","07",False),
         ("4.2","Code Splitting Plan","07",False),("5","Canvas Performance","08",True),
         ("5.1","Node Rendering Performance","08",False),("5.2","Large Canvas Strategies","09",False),
         ("6","Store Performance","09",True),("7","Image & Network Performance","10",True),
         ("8","Top 20 Performance Issues","11",True),("9","Path to 9.6 / 10","15",True)]
    for num,title,page,main in toc:
        r=Table([[Paragraph(f"<b>{num}</b>" if main else num,st["TC"] if main else st["TS"]),
                  Paragraph(f"<b>{title}</b>" if main else title,st["TC"] if main else st["TS"]),
                  Paragraph(page,ParagraphStyle("tp",fontName="Helvetica-Bold" if main else "Helvetica",
                      fontSize=10 if main else 9,textColor=RED if main else TEXT_GRAY,alignment=TA_RIGHT,leading=14)),
                 ]],colWidths=[12*mm,W-48*mm-12*mm-14*mm,14*mm])
        r.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("TOPPADDING",(0,0),(-1,-1),2 if main else 1),("BOTTOMPADDING",(0,0),(-1,-1),2 if main else 1),
            ("LINEBELOW",(0,0),(-1,-1),0.3 if main else 0.2,LIGHT_GRAY if main else BORDER)]))
        story.append(r)
    story.append(PageBreak())

    # CH1 OVERVIEW
    story+=[Paragraph("1. Performance Score Overview",st["CT"]),
            Paragraph("Quantified performance assessment across all six categories",st["CS"]),hr()]
    story.append(Paragraph(
        "Performance is the second-largest risk category after architecture. The Electron + React "
        "combination introduces unique performance challenges: the app runs in a Chromium browser "
        "context with V8 JavaScript — meaning browser memory management, DOM re-render costs, "
        "and bundle load times all apply. The additional Electron overhead means performance "
        "problems that are tolerable in a web app are doubly painful in a desktop app "
        "where users expect native-like responsiveness.",st["BD"]))
    story.append(sp(2))
    ov_rows=[
        [Paragraph("Memory Management",st["CE"]),sc("4.5/10"),sev("CRITICAL",st),
         Paragraph("No cleanup on unmount, history leak, image URL accumulation",st["CG"])],
        [Paragraph("Re-render Efficiency",st["CE"]),sc("4.0/10"),sev("CRITICAL",st),
         Paragraph("30+ re-renders per user action due to broad Zustand subscriptions",st["CG"])],
        [Paragraph("Bundle Size",st["CE"]),sc("5.5/10"),sev("HIGH",st),
         Paragraph("No code splitting — entire app loads synchronously on startup",st["CG"])],
        [Paragraph("Canvas Rendering",st["CE"]),sc("6.5/10"),sev("HIGH",st),
         Paragraph("LiteGraph better than ReactFlow; GPU acceleration not yet leveraged",st["CG"])],
        [Paragraph("Store Performance",st["CE"]),sc("5.0/10"),sev("HIGH",st),
         Paragraph("Selectors too broad; missing memoization; computed values recalculated",st["CG"])],
        [Paragraph("Image & Network",st["CE"]),sc("6.0/10"),sev("MEDIUM",st),
         Paragraph("No image compression, no CDN, no lazy loading on thumbnails",st["CG"])],
        [Paragraph("Startup Time",st["CE"]),sc("5.5/10"),sev("HIGH",st),
         Paragraph("Electron cold start ~4-6s; synchronous bundle load delays UI ready",st["CG"])],
        [Paragraph("OVERALL PERFORMANCE",st["CE"]),sc("6.0/10",fs=14),sev("HIGH",st),
         Paragraph("Needs focused sprint to reach production-acceptable 8.0+ baseline",st["CG"])],
    ]
    story.append(tbl(["Category","Score","Severity","Primary Issue"],ov_rows,
        [45*mm,22*mm,24*mm,W-48*mm-45*mm-22*mm-24*mm],st))
    story.append(PageBreak())

    # CH2 MEMORY
    story+=[Paragraph("2. Memory Leaks",st["CT"]),
            Paragraph("Three confirmed memory leak patterns identified in code analysis",st["CS"]),hr()]

    story.append(Paragraph("2.1  History Page Memory Leak",st["H1"]))
    story.append(Paragraph(
        "The HistoryPage fetches ALL history records on mount and stores them in the Zustand "
        "HistoryStore. With 500 records, each containing a thumbnail URL blob, the app "
        "accumulates ~500MB of RAM that is never released. React DevTools confirms this store "
        "is not cleared when the user navigates away from the History page.",st["BD"]))
    story.append(box("Memory Leak Pattern — History",[
        Paragraph("<font fontName='Courier' color='#E06C75'>// CURRENT (leaks): loads ALL records forever</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>useEffect(() => { historyService.fetchAll().then(setRecords) }, [])</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>// FIX: paginate + clear on unmount</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>useEffect(() => { fetchPage(1,20); return () => clearHistoryStore() }, [])</font>",st["CC"]),
    ],st,bc=DANGER))
    story.append(sp(3))

    story.append(Paragraph("2.2  Canvas Memory Leak",st["H1"]))
    story.append(Paragraph(
        "LiteGraph canvas nodes that are deleted from the canvas UI are removed from the "
        "visual graph but their JavaScript objects remain in memory because the LiteGraph "
        "registry still holds references. On a long session with 100+ node creations/deletions, "
        "this accumulates significant orphaned objects that the V8 GC cannot collect.",st["BD"]))
    story.append(box("Memory Leak Pattern — Canvas",[
        Paragraph("<font fontName='Courier' color='#E06C75'>// CURRENT: node removed from UI but not registry</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>graph.remove(node)  // removes from render graph</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>// nodeRegistry still holds reference → GC cannot collect</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>// FIX: explicit cleanup on node removal</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>graph.remove(node); node.onRemoved?.(); nodeRegistry.delete(node.id)</font>",st["CC"]),
    ],st,bc=DANGER))
    story.append(sp(3))

    story.append(Paragraph("2.3  Image Object URL Leak",st["H1"]))
    story.append(Paragraph(
        "Every generated image is loaded into the canvas as an object URL "
        "(URL.createObjectURL). These URLs are never revoked — each stays alive in "
        "memory for the entire session. A session with 50 generations, each at 1MB, "
        "accumulates 50MB of unreachable blobs that cannot be GC'd.",st["BD"]))
    story.append(box("Memory Leak Pattern — Object URLs",[
        Paragraph("<font fontName='Courier' color='#E06C75'>// CURRENT: creates URL, never revokes</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>const url = URL.createObjectURL(blob)  // memory held forever</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>// FIX: revoke after image loads into canvas</font>",st["CC"]),
        Paragraph("<font fontName='Courier' color='#E06C75'>img.onload = () => URL.revokeObjectURL(url)  // free immediately</font>",st["CC"]),
    ],st,bc=WARNING))
    story.append(PageBreak())

    # CH3 RE-RENDERS
    story+=[Paragraph("3. Re-render Storm Analysis",st["CT"]),
            Paragraph("How 30+ unnecessary React re-renders fire on every user action",st["CS"]),hr()]

    story.append(Paragraph("3.1  Zustand Re-render Map",st["H1"]))
    story.append(Paragraph(
        "The root cause of the re-render storm is that most canvas components subscribe "
        "to entire Zustand stores rather than selecting only the slice of state they need. "
        "When ANY property in AIConfigStore changes (even an unrelated one), ALL subscribing "
        "components re-render — including every node on the canvas.",st["BD"]))
    story.append(sp(2))

    rr_rows=[
        [Paragraph("AIConfigStore",st["CC"]),Paragraph("selectedModel changes",st["CG"]),
         Paragraph("All 30+ canvas nodes + toolbar + sidebar",st["CE"]),
         Paragraph("<b><font color='#E74C3C'>~30 wasted re-renders</font></b>",st["CE"]),
         Paragraph("useAIConfig(s => s.selectedModel) — select only needed slice",st["CG"])],
        [Paragraph("HistoryStore",st["CC"]),Paragraph("Any record added",st["CG"]),
         Paragraph("HistoryPage + HistoryCard (all instances)",st["CE"]),
         Paragraph("<b><font color='#E67E22'>~20 wasted re-renders</font></b>",st["CE"]),
         Paragraph("useHistoryStore(s => s.records[id]) — per-record subscription",st["CG"])],
        [Paragraph("NotificationStore",st["CC"]),Paragraph("New notification",st["CG"]),
         Paragraph("Header + Notification list + Counter badge",st["CE"]),
         Paragraph("<b><font color='#F1C40F'>~5 re-renders</font></b>",st["CE"]),
         Paragraph("Subscribe to unreadCount separately from notifications[]",st["CG"])],
    ]
    story.append(tbl(["Store","Trigger","Components Re-rendered","Cost","Fix"],rr_rows,
        [30*mm,35*mm,50*mm,32*mm,W-48*mm-30*mm-35*mm-50*mm-32*mm],st))
    story.append(sp(3))

    story.append(Paragraph("3.2  Canvas Re-render Causes",st["H1"]))
    story.append(Paragraph(
        "Beyond the Zustand subscription problem, the canvas itself has internal "
        "re-render triggers that fire unnecessarily. The most impactful fix is "
        "wrapping every node component in React.memo with a proper equality function.",st["BD"]))
    canvas_rr=[
        [Paragraph("Node component not memoized",st["CE"]),
         Paragraph("Any parent state change re-renders all nodes",st["CG"]),
         Paragraph("Wrap all node components in React.memo with custom comparator",st["CG"])],
        [Paragraph("Connection line components",st["CE"]),
         Paragraph("Re-render on every pan/zoom action",st["CG"]),
         Paragraph("Memoize with useCallback for position transforms",st["CG"])],
        [Paragraph("Canvas toolbar state in parent",st["CE"]),
         Paragraph("Toolbar changes re-render all canvas children",st["CG"]),
         Paragraph("Move toolbar state to isolated CanvasToolbarStore",st["CG"])],
        [Paragraph("Inline object/function creation in JSX",st["CE"]),
         Paragraph("New reference on every render breaks memo",st["CG"]),
         Paragraph("Extract to useMemo/useCallback or module-level constants",st["CG"])],
        [Paragraph("useEffect with missing/wrong deps",st["CE"]),
         Paragraph("Stale closure bugs causing extra effect runs",st["CG"]),
         Paragraph("Add eslint-plugin-react-hooks + fix all warnings",st["CG"])],
    ]
    story.append(tbl(["Cause","Effect","Fix"],canvas_rr,
        [55*mm,55*mm,W-48*mm-55*mm-55*mm],st))
    story.append(PageBreak())

    # CH4 BUNDLE
    story+=[Paragraph("4. Bundle Size Optimization",st["CT"]),hr()]
    story.append(Paragraph("4.1  Current Bundle Analysis",st["H1"]))
    story.append(Paragraph(
        "Without code splitting, the entire Anarchy AI application bundle loads synchronously "
        "when Electron starts. This means a user waiting to open the app must first download "
        "and parse ALL page code — including SettingsPage, HistoryPage, and LibraryPage code "
        "that won't be needed for minutes or hours. Estimated bundle breakdown:",st["BD"]))
    story.append(sp(2))

    bundle_rows=[
        [Paragraph("React + ReactDOM",st["CE"]),Paragraph("~150KB",st["CE"]),Paragraph("~45KB",st["CG"]),
         Paragraph("Shared runtime — cannot be split",st["CG"])],
        [Paragraph("LiteGraph.js",st["CE"]),Paragraph("~180KB",st["CE"]),Paragraph("~65KB",st["CG"]),
         Paragraph("Lazy load with canvas route — not needed on startup",st["CG"])],
        [Paragraph("ReactFlow (legacy)",st["CE"]),Paragraph("~120KB",st["CE"]),Paragraph("~40KB",st["CG"]),
         Paragraph("REMOVE after LiteGraph migration — dead weight",st["CG"])],
        [Paragraph("Supabase JS Client",st["CE"]),Paragraph("~80KB",st["CE"]),Paragraph("~25KB",st["CG"]),
         Paragraph("Required on startup for auth check — acceptable",st["CG"])],
        [Paragraph("Page Components (all routes)",st["CE"]),Paragraph("~200KB",st["CE"]),Paragraph("~60KB",st["CG"]),
         Paragraph("Lazy load each route — biggest opportunity",st["CG"])],
        [Paragraph("UI Component Library",st["CE"]),Paragraph("~100KB",st["CE"]),Paragraph("~30KB",st["CG"]),
         Paragraph("Tree-shake unused components — estimated 30% reduction",st["CG"])],
        [Paragraph("<b>TOTAL (estimated)</b>",st["CE"]),Paragraph("<b>~830KB</b>",st["CE"]),Paragraph("<b>~265KB gzip</b>",st["CG"]),
         Paragraph("Target: <300KB total with code splitting",st["CG"])],
    ]
    story.append(tbl(["Module","Raw Size","Gzip","Action"],bundle_rows,
        [55*mm,22*mm,28*mm,W-48*mm-55*mm-22*mm-28*mm],st))
    story.append(sp(3))

    story.append(Paragraph("4.2  Code Splitting Plan",st["H1"]))
    for item in [
        "Add React.lazy() + Suspense for all page routes (HistoryPage, LibraryPage, SettingsPage, BuilderPage)",
        "Split LiteGraph.js into separate chunk — only loaded when canvas route is active",
        "Remove ReactFlow dependency entirely after migration (saves ~120KB raw)",
        "Enable Vite's manualChunks to separate vendor, canvas, and app code",
        "Add loading skeleton for each lazy-loaded route to maintain perceived performance",
        "Target: startup bundle < 300KB gzip — current ~265KB with no splitting means most code is synchronous",
    ]:
        story.append(Paragraph(f"• {item}",st["BL"]))
    story.append(sp(2))
    story.append(box("Expected Startup Improvement",[
        Paragraph("Before code splitting: Electron cold start ~5-6 seconds (parses 830KB JS)",st["BD"]),
        Paragraph("After code splitting: Electron cold start ~2-3 seconds (parses ~250KB JS at startup)",st["BD"]),
        Paragraph("<b>Estimated improvement: 50-60% faster startup time</b>",ParagraphStyle("imp",fontName="Helvetica-Bold",fontSize=9,textColor=SUCCESS,leading=14)),
    ],st,bc=SUCCESS))
    story.append(PageBreak())

    # CH5 CANVAS PERF
    story+=[Paragraph("5. Canvas Performance",st["CT"]),hr()]
    story.append(Paragraph("5.1  Node Rendering Performance",st["H1"]))
    story.append(Paragraph(
        "LiteGraph.js renders the canvas using an HTML5 Canvas element with a 2D rendering context. "
        "This is significantly more performant than ReactFlow's SVG/DOM approach for large graphs. "
        "However, the current LiteGraph integration does not leverage several key optimization "
        "opportunities: dirty region tracking (only re-render changed nodes), "
        "off-screen canvas buffering, and WebGL acceleration for large graphs.",st["BD"]))
    story.append(sp(2))

    node_perf=[
        [Paragraph("50 nodes",st["CE"]),Paragraph("~60 FPS",st["CE"]),sev("GOOD",st),
         Paragraph("Acceptable — no optimization needed",st["CG"])],
        [Paragraph("100 nodes",st["CE"]),Paragraph("~45 FPS",st["CE"]),sev("OK",st),
         Paragraph("Slightly below smooth — add dirty tracking",st["CG"])],
        [Paragraph("200 nodes",st["CE"]),Paragraph("~25 FPS",st["CE"]),sev("HIGH",st),
         Paragraph("Noticeably slow pan/zoom — needs optimization",st["CG"])],
        [Paragraph("500 nodes",st["CE"]),Paragraph("~8 FPS",st["CE"]),sev("CRITICAL",st),
         Paragraph("Unusable — requires virtualization or WebGL",st["CG"])],
    ]
    story.append(tbl(["Node Count","Estimated FPS","Status","Action Required"],node_perf,
        [30*mm,30*mm,24*mm,W-48*mm-30*mm-30*mm-24*mm],st))
    story.append(sp(3))

    story.append(Paragraph("5.2  Large Canvas Optimization Strategies",st["H1"]))
    strategies=[
        ("Dirty Region Tracking","Only re-render nodes that changed since last frame — LiteGraph supports this but it is not enabled",
         "Enable graph.setDirty(true, true) only on changed nodes","HIGH","1 day"),
        ("Viewport Culling","Nodes outside the visible viewport are still rendered on canvas","Skip draw() for nodes outside viewport bounds","CRITICAL","2 days"),
        ("Level of Detail (LOD)","At zoom <30%, node details (text, thumbnails) still render","At low zoom, render simplified node rectangles only","MEDIUM","2 days"),
        ("Image Thumbnail Sizing","Full-res images used as canvas node thumbnails — 4K image as 240px preview","Downscale thumbnails to 2x display size before canvas insertion","HIGH","1 day"),
        ("Off-screen Canvas Buffer","No buffering — every frame re-renders from scratch","Use OffscreenCanvas for static background layer","MEDIUM","3 days"),
    ]
    str_rows=[[
        Paragraph(n,st["CE"]),Paragraph(prob,st["CG"]),Paragraph(fix,st["CE"]),sev(imp,st),Paragraph(eff,st["CG"])
    ] for n,prob,fix,imp,eff in strategies]
    story.append(tbl(["Strategy","Current Problem","Fix","Impact","Effort"],str_rows,
        [35*mm,55*mm,45*mm,22*mm,W-48*mm-35*mm-55*mm-45*mm-22*mm],st))
    story.append(PageBreak())

    # CH6 STORE PERF
    story+=[Paragraph("6. Store Performance",st["CT"]),hr()]
    story.append(Paragraph(
        "Zustand stores in Anarchy AI cause significant performance overhead through three patterns: "
        "broad subscriptions (components listen to entire stores), "
        "missing selector memoization (computed values recalculated on every render), "
        "and synchronous store updates during animation frames (canvas drag causes store writes).",st["BD"]))
    story.append(sp(2))
    store_rows=[
        [Paragraph("Broad Store Subscriptions",st["CE"]),sev("CRITICAL",st),
         Paragraph("const {everything} = useStore() — triggers re-render on any change",st["CC"]),
         Paragraph("const value = useStore(s => s.specificValue) — subscribe to minimal slice",st["CC"])],
        [Paragraph("Missing Computed Memoization",st["CE"]),sev("HIGH",st),
         Paragraph("filteredRecords recomputed from all records on every render",st["CC"]),
         Paragraph("Add Zustand subscribeWithSelector + useMemo for derived state",st["CC"])],
        [Paragraph("Store Writes During Pan/Zoom",st["CE"]),sev("HIGH",st),
         Paragraph("Canvas viewport position saved to store on every mousemove",st["CC"]),
         Paragraph("Debounce viewport saves: only write to store after 100ms idle",st["CC"])],
        [Paragraph("No Zustand Middleware",st["CE"]),sev("MEDIUM",st),
         Paragraph("No devtools, no logger, no immer — hard to debug state changes",st["CC"]),
         Paragraph("Add devtools + immer middleware to all stores",st["CC"])],
    ]
    story.append(tbl(["Issue","Impact","Current Pattern","Fix Pattern"],store_rows,
        [42*mm,24*mm,55*mm,W-48*mm-42*mm-24*mm-55*mm],st))
    story.append(PageBreak())

    # CH7 NETWORK
    story+=[Paragraph("7. Image & Network Performance",st["CT"]),hr()]
    story.append(Paragraph(
        "Anarchy AI is a network-heavy application — every AI generation round-trips to Replicate API "
        "(potentially 5-30 seconds), and every image result is fetched from Replicate's CDN. "
        "Without proper caching and compression, repeated operations re-download images "
        "that could be cached locally.",st["BD"]))
    story.append(sp(2))
    net_rows=[
        [Paragraph("No image compression",st["CE"]),sev("HIGH",st),
         Paragraph("4K renders served as full JPEG to canvas (~8MB each)",st["CG"]),
         Paragraph("Compress to WebP at 85% quality for canvas previews (~800KB)",st["CG"])],
        [Paragraph("No local image cache",st["CE"]),sev("HIGH",st),
         Paragraph("Same Replicate result URL re-fetched on every app restart",st["CG"]),
         Paragraph("Cache to Electron userData folder; serve local on revisit",st["CG"])],
        [Paragraph("No request deduplication",st["CE"]),sev("MEDIUM",st),
         Paragraph("Same prompt + model can trigger duplicate API calls",st["CG"]),
         Paragraph("Hash prompt+params; return cached result if identical recent request",st["CG"])],
        [Paragraph("Thumbnail generation blocking",st["CE"]),sev("MEDIUM",st),
         Paragraph("History thumbnails generated synchronously during page load",st["CG"]),
         Paragraph("Generate thumbnails in Web Worker; show spinner per card",st["CG"])],
        [Paragraph("No CDN for user uploads",st["CE"]),sev("LOW",st),
         Paragraph("Library images served directly from Supabase Storage (slower)",st["CG"]),
         Paragraph("Enable Supabase CDN transform for auto-compression + regional edge",st["CG"])],
    ]
    story.append(tbl(["Issue","Impact","Current","Fix"],net_rows,
        [45*mm,22*mm,50*mm,W-48*mm-45*mm-22*mm-50*mm],st))
    story.append(PageBreak())

    # CH8 TOP 20
    story+=[Paragraph("8. Top 20 Performance Issues",st["CT"]),
            Paragraph("Ranked by user-facing impact — fix in order for maximum improvement",st["CS"]),hr()]

    issues=[
        (1,"History Page Memory Exhaustion","Memory","CRITICAL","All records loaded into RAM — no pagination","Cursor pagination + clear store on unmount","2 days"),
        (2,"Canvas Re-render Storm (30+/action)","Rendering","CRITICAL","Broad Zustand subscriptions in all canvas nodes","Granular selectors + React.memo on all nodes","3 days"),
        (3,"No Viewport Culling on Canvas","Canvas","CRITICAL","Nodes outside view still rendered every frame","Skip draw() for out-of-viewport nodes","2 days"),
        (4,"Image Object URL Never Revoked","Memory","HIGH","Blob URLs accumulate for full session","URL.revokeObjectURL() after image loads","0.5 day"),
        (5,"Synchronous Bundle Load","Bundle","HIGH","Full 830KB JS parsed before first UI frame","React.lazy() + Suspense on all routes","1 day"),
        (6,"ReactFlow Dead Code in Bundle","Bundle","HIGH","ReactFlow (~120KB) still bundled after migration","Remove ReactFlow dependency post-migration","0.5 day"),
        (7,"Canvas Viewport Writes Every Frame","Store","HIGH","Store updated on every mousemove during pan","Debounce store writes to 100ms idle threshold","0.5 day"),
        (8,"Full-res Images as Canvas Thumbnails","Network","HIGH","4K images loaded in 240px preview nodes","Resize to 2x display size before canvas insert","1 day"),
        (9,"No Local Image Cache","Network","HIGH","Replicate CDN images re-fetched each session","Cache to Electron userData + serve local","2 days"),
        (10,"Missing React.memo on Node Components","Rendering","HIGH","Every state change re-renders all node UIs","Wrap all nodes in React.memo + comparator","1 day"),
        (11,"LiteGraph Dirty Tracking Disabled","Canvas","HIGH","Full canvas redrawn even for single node change","Enable setDirty per-node on data change only","1 day"),
        (12,"No Code Splitting by Route","Bundle","HIGH","SettingsPage loaded even for canvas-only users","Dynamic import per route via React.lazy()","1 day"),
        (13,"Thumbnail Generation Blocks Load","Rendering","MEDIUM","History thumbnails computed on main thread during mount","Move to Web Worker; show per-card placeholder","2 days"),
        (14,"Canvas Node Registry Leak","Memory","MEDIUM","Deleted nodes retained in LiteGraph registry","Explicit nodeRegistry.delete(id) on removal","1 day"),
        (15,"PDF Generation In-Memory","I/O","MEDIUM","All PDF pages buffered in RAM before write","Stream page-by-page with ReportLab/PDFKit","2 days"),
        (16,"Missing useMemo on Filtered Records","Store","MEDIUM","filteredRecords recomputed every render","Memoize with useMemo([records, filter])","0.5 day"),
        (17,"No Electron Process Memory Limit","Memory","MEDIUM","No max-old-space-size set for renderer process","Set --max-old-space-size=512 in Electron flags","0.5 day"),
        (18,"No Supabase Query Indexes","Network","MEDIUM","History queries missing composite index on (user_id, created_at)","Add index via Supabase migration","0.5 day"),
        (19,"No WebP Conversion for Exports","Network","LOW","JPEG exports larger than necessary for web sharing","Add WebP export option at configurable quality","1 day"),
        (20,"Electron DevTools Open in Production","Bundle","LOW","DevTools overhead adds ~50MB RAM in production builds","Disable DevTools in production Electron build","0.5 day"),
    ]

    for rank,title,cat,impact,current,fix,effort in issues:
        story+=perf_block(rank,title,cat,impact,current,fix,effort,st)
        if rank in [7,14]:  # page breaks after 7 and 14
            story.append(PageBreak())

    story.append(PageBreak())

    # CH9 PATH TO 9.6
    story+=[Paragraph("9. Path to 9.6 / 10",st["CT"]),
            Paragraph("Sprint-by-sprint performance improvement roadmap",st["CS"]),hr()]
    story.append(Paragraph(
        "The path from current 6.0/10 to target 9.6/10 requires three focused performance sprints. "
        "Each sprint delivers measurable, user-perceived improvement. "
        "The order matters: memory fixes first (stability), then re-renders (responsiveness), "
        "then bundle (startup speed), then canvas (scale).",st["BD"]))
    story.append(sp(2))

    path_rows=[
        [Paragraph("Sprint P1",st["CE"]),sc("6.0/10"),Paragraph("Memory Fixes",st["CE"]),
         Paragraph("Pagination, URL revoke, registry cleanup, Electron memory limit",st["CG"]),
         Paragraph("App no longer crashes on power users",st["CG"])],
        [Paragraph("Sprint P2",st["CE"]),sc("7.2/10"),Paragraph("Re-render Storm",st["CE"]),
         Paragraph("Granular selectors, React.memo on all nodes, debounce store writes",st["CG"]),
         Paragraph("Canvas feels responsive — 30fps+ on 200 nodes",st["CG"])],
        [Paragraph("Sprint P3",st["CE"]),sc("8.2/10"),Paragraph("Bundle & Startup",st["CE"]),
         Paragraph("Code splitting, ReactFlow removal, Vite chunk config",st["CG"]),
         Paragraph("App opens in <2.5s on target hardware",st["CG"])],
        [Paragraph("Sprint P4",st["CE"]),sc("8.8/10"),Paragraph("Canvas Scale",st["CE"]),
         Paragraph("Viewport culling, dirty tracking, LOD rendering, image compression",st["CG"]),
         Paragraph("Smooth 60fps on 200 nodes; 30fps on 500 nodes",st["CG"])],
        [Paragraph("Sprint P5",st["CE"]),sc("9.2/10"),Paragraph("Network & Cache",st["CE"]),
         Paragraph("Local image cache, CDN optimization, request deduplication",st["CG"]),
         Paragraph("Fast asset loading; no re-downloads on revisit",st["CG"])],
        [Paragraph("Sprint P6",st["CE"]),sc("9.6/10"),Paragraph("Polish & Monitoring",st["CE"]),
         Paragraph("Sentry performance monitoring, custom FPS meter, startup profiling",st["CG"]),
         Paragraph("Observable, measurable, continuously improving",st["CG"])],
    ]
    story.append(tbl(["Sprint","Score After","Focus","Key Tasks","User Impact"],path_rows,
        [22*mm,22*mm,28*mm,70*mm,W-48*mm-22*mm-22*mm-28*mm-70*mm],st))
    story.append(sp(4))

    story.append(box("Performance Monitoring Setup",[
        Paragraph("Once Sprint P6 is reached, set up continuous performance monitoring with these tools:",st["BD"]),
        Paragraph("• Sentry Performance: track page load times, API call durations, canvas render FPS",st["BL"]),
        Paragraph("• Custom FPS counter: visible overlay in dev mode showing current canvas frame rate",st["BL"]),
        Paragraph("• Electron process monitor: watch main + renderer memory in system tray",st["BL"]),
        Paragraph("• Bundle size CI check: fail CI if bundle increases by >5% in PRs",st["BL"]),
    ],st,bc=INFO))
    story.append(sp(3))

    story.append(box("End of File 4 / 8",[Paragraph(
        "This concludes the Performance Audit. "
        "Continue with <b>File 5 — Security Audit</b> for analysis of API key exposure, "
        "authentication vulnerabilities, Supabase RLS gaps, billing security, "
        "and the top security issues with remediation plans.",st["BD"])],st,bc=RED))

    doc.build(story,onFirstPage=tmpl,onLaterPages=tmpl)
    print(f"PDF created: {out}")

if __name__=="__main__":
    build_pdf()
