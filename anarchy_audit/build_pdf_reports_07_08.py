from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.colors import HexColor
import os

BLACK=HexColor("#0A0A0A");RED=HexColor("#E63030");DARK_GRAY=HexColor("#1A1A1A")
MID_GRAY=HexColor("#2A2A2A");LIGHT_GRAY=HexColor("#3A3A3A");TEXT_WHITE=HexColor("#F5F5F5")
TEXT_GRAY=HexColor("#AAAAAA");SUCCESS=HexColor("#2ECC71");WARNING=HexColor("#F39C12")
DANGER=HexColor("#E74C3C");INFO=HexColor("#3498DB");BORDER=HexColor("#2D2D2D")
CODE_RED=HexColor("#E06C75");W,H=A4

class PT:
    def __init__(self,t="",fn=7,tot=8): self.t=t;self.fn=fn;self.tot=tot
    def __call__(self,c,doc):
        c.saveState()
        c.setFillColor(BLACK);c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(DARK_GRAY);c.rect(0,H-28*mm,W,28*mm,fill=1,stroke=0)
        c.setFillColor(RED);c.rect(0,H-28*mm,W,1.2*mm,fill=1,stroke=0)
        c.setFont("Helvetica-Bold",11);c.setFillColor(RED);c.drawString(18*mm,H-16*mm,"ANARCHY")
        c.setFont("Helvetica",11);c.setFillColor(TEXT_WHITE);c.drawString(18*mm+58,H-16*mm,"AI")
        c.setFont("Helvetica",8);c.setFillColor(TEXT_GRAY);c.drawCentredString(W/2,H-13*mm,self.t)
        c.setFont("Helvetica-Bold",7);c.setFillColor(RED);c.drawCentredString(W/2,H-20*mm,f"FILE {self.fn} / {self.tot}")
        c.setFont("Helvetica",8);c.setFillColor(TEXT_GRAY);c.drawRightString(W-18*mm,H-16*mm,f"Page {doc.page}")
        c.setFillColor(DARK_GRAY);c.rect(0,0,W,14*mm,fill=1,stroke=0)
        c.setFillColor(RED);c.rect(0,14*mm,W,0.6*mm,fill=1,stroke=0)
        c.setFont("Helvetica",7);c.setFillColor(TEXT_GRAY)
        c.drawString(18*mm,5*mm,"CONFIDENTIAL — Internal Technical Documentation")
        c.drawRightString(W-18*mm,5*mm,"© 2025 Anarchy AI Platform")
        c.setFillColor(RED);c.rect(0,0,3,H,fill=1,stroke=0)
        c.restoreState()

def S():
    def s(n,**k):
        k.setdefault("fontName","Helvetica");k.setdefault("textColor",TEXT_WHITE)
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
    c.append(Spacer(1,2*mm));c.extend(paras)
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
        ("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),("LEFTPADDING",(0,0),(-1,-1),5),
        ("RIGHTPADDING",(0,0),(-1,-1),5),("LINEBELOW",(0,0),(-1,0),1,bc)]))
    return t

def sev_p(level):
    c={"CRITICAL":"#E74C3C","HIGH":"#E67E22","MEDIUM":"#F1C40F","LOW":"#95A5A6"}.get(level,"#AAA")
    return Paragraph(f"<b><font color='{c}'>{level}</font></b>",ParagraphStyle("sv",fontName="Helvetica-Bold",fontSize=7.5,textColor=HexColor(c),leading=11))

def cat_p(cat):
    c={"Architecture":"#9B59B6","Security":"#E74C3C","Performance":"#E67E22","UX":"#3498DB","Functional":"#2ECC71","Data":"#F39C12"}.get(cat,"#AAA")
    return Paragraph(f"<font color='{c}'>{cat}</font>",ParagraphStyle("ct",fontSize=7.5,textColor=HexColor(c),leading=11))

def build_pdf7():
    out = os.path.join(os.path.dirname(__file__), "reports", "Anarchy_AI_Report_07_Top50_Problems_Top100_Improvements.pdf")
    output_dir = os.path.dirname(out)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    st=S();tmpl=PT("Top 50 Problems + Top 100 Improvements",7,8)
    doc=SimpleDocTemplate(out,pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,
        topMargin=35*mm,bottomMargin=20*mm,
        title="Anarchy AI — Top 50 Problems + Top 100 Improvements",
        subject="Technical Audit Report — File 7 of 8")
    story=[]

    # COVER
    story+=[sp(18),Paragraph("ANARCHY",st["CVR"]),Paragraph("AI Platform",st["CVT"]),sp(3),
            hr(RED,2),sp(3),Paragraph("Top 50 Problems + Top 100 Improvements",st["CVS"]),
            Paragraph("Technical Audit Report — File 7 of 8",st["CVM"]),sp(8)]
    ct=Table([[
        Paragraph("50<br/><font size='8' color='#AAAAAA'>Total Problems</font>",ParagraphStyle("c1",fontName="Helvetica-Bold",fontSize=32,textColor=DANGER,alignment=TA_CENTER,leading=40)),
        Paragraph("12<br/><font size='8' color='#AAAAAA'>Critical Issues</font>",ParagraphStyle("c2",fontName="Helvetica-Bold",fontSize=32,textColor=DANGER,alignment=TA_CENTER,leading=40)),
        Paragraph("100<br/><font size='8' color='#AAAAAA'>Improvements</font>",ParagraphStyle("c3",fontName="Helvetica-Bold",fontSize=32,textColor=SUCCESS,alignment=TA_CENTER,leading=40)),
        Paragraph("9.9<br/><font size='8' color='#AAAAAA'>Achievable Score</font>",ParagraphStyle("c4",fontName="Helvetica-Bold",fontSize=32,textColor=SUCCESS,alignment=TA_CENTER,leading=40)),
    ]],colWidths=[(W-48*mm)/4]*4)
    ct.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("BOX",(0,0),(-1,-1),1.5,RED),
        ("GRID",(0,0),(-1,-1),0.5,BORDER),("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12)]))
    story+=[ct,PageBreak()]

    # TOP 50 PROBLEMS
    story+=[Paragraph("Top 50 Problems — Ranked by Severity & Impact",st["CT"]),
            Paragraph("Complete prioritized issue registry across all audit categories",st["CS"]),hr()]

    problems=[
        (1,"CRITICAL","Architecture","TreeFlowCanvas.tsx — 2000+ line God Component","Unmaintainable; single point of failure for canvas, AI, history, export","3-4 days"),
        (2,"CRITICAL","Security","API Key in Renderer Process (SEC-001)","Replicate key visible in DevTools — data breach risk","2 days"),
        (3,"CRITICAL","Security","Supabase RLS Incomplete (SEC-002)","Cross-user data leakage on all history, library, canvas tables","1 day"),
        (4,"CRITICAL","Security","Unauthenticated Local HTTP Bridge (SEC-003)","Any local process can inject malicious images into canvas","1 day"),
        (5,"CRITICAL","Architecture","No AI Job Queue in ReplicateService","5 concurrent requests cascade-fail; production unusable under load","1 week"),
        (6,"CRITICAL","Architecture","Zero Test Coverage","No unit, integration, or E2E tests — regressions undetectable","2 weeks"),
        (7,"CRITICAL","Functional","No React Error Boundaries on Canvas","Single node failure causes full white screen with no recovery","0.5 day"),
        (8,"CRITICAL","Performance","History Page Memory Exhaustion","All records loaded into RAM — crash on 500+ records","2 days"),
        (9,"CRITICAL","Performance","Re-render Storm — 30+ per user action","Broad Zustand subscriptions cause mass unnecessary re-renders","3 days"),
        (10,"CRITICAL","Architecture","LiteGraph Migration 40% Complete","Hybrid ReactFlow+LiteGraph causes race conditions and state bugs","1 week"),
        (11,"CRITICAL","Functional","No Canvas Viewport Culling","All canvas nodes rendered even when outside viewport","2 days"),
        (12,"CRITICAL","Functional","Double-Submit on Generate Button","Button not disabled during active job — duplicate credits charged","0.5 day"),
        (13,"HIGH","Security","Stripe Webhook Not Verified (SEC-004)","Replay attack can add unlimited credits without payment","0.5 day"),
        (14,"HIGH","Security","Credit Overdraft Race Condition (SEC-005)","Rapid concurrent generations bypass credit balance check","1 day"),
        (15,"HIGH","Performance","ReactFlow Bundle Dead Weight","~120KB removed after LiteGraph migration complete","0.5 day"),
        (16,"HIGH","Functional","No Generation Cancel Button","User trapped in 30-60s wait with no exit","1 day"),
        (17,"HIGH","Performance","No Code Splitting on Routes","Entire 830KB bundle loads synchronously on startup","1 day"),
        (18,"HIGH","UX","Fake Generation Progress Timer","Erodes trust — 73% indicator not reflecting real progress","1 day"),
        (19,"HIGH","Functional","Nano Banana 2 Seed Confusion","Seed UI shown for model that ignores seeds — variations look identical","0.5 day"),
        (20,"HIGH","Architecture","GhostNode.tsx — 600+ line Multi-type Component","10 node types in one component — unmaintainable, blocks LiteGraph migration","2-3 days"),
        (21,"HIGH","Data","No History Pagination","Flat load of all records — power user crash scenario","2 days"),
        (22,"HIGH","Security","Prompt Injection via Node Labels (SEC-006)","Shared canvas files can inject into AI prompts","1 day"),
        (23,"HIGH","Performance","Image Object URLs Never Revoked","Blob URLs accumulate all session — 50MB+ memory leak per session","0.5 day"),
        (24,"HIGH","Security","No Content Security Policy (SEC-007)","Injected scripts run freely in renderer","1 day"),
        (25,"HIGH","Functional","DXF Bridge — No Health Check","Silent failures when Python process crashes","1 day"),
        (26,"HIGH","UX","Generic Error Messages","'Generation failed' with no cause or actionable next step","1 day"),
        (27,"HIGH","Architecture","HistoryService.ts — 6 Responsibilities","God Service — CRUD + search + pagination + thumbnail + export","2 days"),
        (28,"HIGH","Architecture","ExportService — Sync I/O in Renderer","File writes block Electron UI thread during export","2 days"),
        (29,"HIGH","UX","No Onboarding / First-Run Experience","Blank canvas on first launch — highest churn point","1 week"),
        (30,"HIGH","Performance","Store Writes During Pan/Zoom Animation","Canvas viewport position saved on every mousemove event","0.5 day"),
        (31,"HIGH","Performance","Full-res Images as Canvas Thumbnails","4K renders used as 240px node previews — 8MB+ per node","1 day"),
        (32,"HIGH","Functional","History Search — Client-side Linear Scan","O(n) search on every keystroke — freezes on 500+ records","1 day"),
        (33,"HIGH","UX","No Keyboard Shortcuts for Core Actions","No Ctrl+Z, Ctrl+Enter, Space+drag — feels like amateur software","1 day"),
        (34,"HIGH","UX","No Node Palette — GhostNode Types Hidden","Users cannot discover available node types","1 day"),
        (35,"MEDIUM","UX","No Canvas Minimap","Large workflows are impossible to navigate without minimap","2 days"),
        (36,"MEDIUM","Architecture","No Zustand Middleware","No devtools, no immer, no persist — hard to debug state","0.5 day"),
        (37,"MEDIUM","UX","No Canvas Workflow Templates","Blank canvas intimidating — no Quick Start","3 days"),
        (38,"MEDIUM","Functional","Library — No Organization","Flat image list unusable for professional multi-project use","1 week"),
        (39,"MEDIUM","Security","No Rate Limiting on Generation","User can fire 100 generations/min, depleting credits","1 day"),
        (40,"MEDIUM","Performance","No Lazy Loading on History Thumbnails","Thumbnails load synchronously during page mount","2 days"),
        (41,"MEDIUM","UX","No Notification History","Dismissed toasts gone forever — no way to review past alerts","1 day"),
        (42,"MEDIUM","Performance","No Supabase Query Indexes","Missing composite index on (user_id, created_at)","0.5 day"),
        (43,"MEDIUM","UX","No Global Search","Must navigate to each section to search — no Cmd+K","2 days"),
        (44,"MEDIUM","Architecture","AIConfigStore — API Key in Zustand","Credentials stored in plain state — accessible via DevTools","1 day"),
        (45,"MEDIUM","Functional","PDF Export — In-memory All Pages","OOM risk on large multi-page exports","2 days"),
        (46,"MEDIUM","Security","No Account Lockout on Failed Login","Brute force login attempts possible","0.5 day"),
        (47,"MEDIUM","UX","No Empty State Illustrations","History/Library/Projects pages show blank — feel unfinished","1 day"),
        (48,"MEDIUM","Architecture","No Documentation / JSDoc","Zero inline documentation — knowledge siloed in one developer","2 weeks"),
        (49,"LOW","Security","Electron App Not Code-Signed","Windows SmartScreen warning on install","3 days"),
        (50,"LOW","UX","No Side-by-Side Upscale Comparison","No before/after slider for upscale quality review","2 days"),
    ]

    prob_rows=[[
        Paragraph(f"<b>#{p[0]:02d}</b>",ParagraphStyle("rn",fontName="Helvetica-Bold",fontSize=8,textColor=RED,alignment=TA_CENTER,leading=12)),
        sev_p(p[1]),cat_p(p[2]),
        Paragraph(p[3],st["CE"]),
        Paragraph(p[4],st["CG"]),
        Paragraph(p[5],st["CG"]),
    ] for p in problems]
    story.append(tbl(["#","Severity","Category","Problem","Impact","Effort"],prob_rows,
        [10*mm,22*mm,24*mm,55*mm,45*mm,W-48*mm-10*mm-22*mm-24*mm-55*mm-45*mm],st))
    story.append(PageBreak())

    # TOP 100 IMPROVEMENTS
    story+=[Paragraph("Top 100 Improvements",st["CT"]),
            Paragraph("Complete improvement backlog sorted by sprint and impact",st["CS"]),hr()]

    improvements_by_sprint={
        "Sprint 1 — Critical Fixes (2 weeks)":[
            "Add React Error Boundary around entire canvas + each node type",
            "Disable Generate button + show spinner during active AI job",
            "Move Replicate API key to Electron main process (safeStorage + IPC)",
            "Enable Supabase RLS on history, library_images, canvas_states, notifications tables",
            "Add shared secret token authentication to local HTTP bridges (port 14400 + 7430)",
            "Add pre-flight credit check before every generation request",
            "Fix Stripe webhook signature verification (constructEvent)",
            "Replace credit check-then-deduct with atomic Supabase RPC",
            "Add generation cancel button with AbortController",
            "Add real Replicate progress steps (uploading → processing → downloading)",
            "Add DXF bridge health check + 10-second timeout with clear error message",
            "Show Nano Banana 2 capability badge: 'Seeds: Not Supported'",
        ],
        "Sprint 2 — Architecture Refactor (3 weeks)":[
            "Split TreeFlowCanvas.tsx into: CanvasEngine, NodeManager, useAIOrchestrator, useCanvasPersistence, CanvasContextMenu, GhostNodeOrchestrator, CanvasToolbar",
            "Migrate all 10 GhostNode types to LiteGraph custom node classes",
            "Create GhostNodeRegistry for dynamic node type registration",
            "Remove ReactFlow dependency entirely after migration",
            "Implement AIJobQueue (p-queue with concurrency 3) in Electron main process",
            "Add exponential backoff retry to ReplicateService (3 attempts, 1s/2s/4s)",
            "Add circuit breaker to ReplicateService (open after 5 failures)",
            "Split ReplicateService into: FluxService, NanoBananaService, UpscaleService",
            "Add granular Zustand selectors on all canvas components",
            "Wrap all canvas node components in React.memo with custom comparators",
            "Add Zustand devtools + immer + persist middleware to all stores",
            "Move API key from AIConfigStore to Electron safeStorage",
        ],
        "Sprint 3 — Performance Sprint (2 weeks)":[
            "Implement cursor-based pagination in HistoryService + HistoryPage",
            "Add virtual scroll to HistoryPage (react-virtualized or Tanstack Virtual)",
            "Move History search to Supabase full-text search (pg_trgm)",
            "Add URL.revokeObjectURL() after every image loads into canvas",
            "Debounce canvas viewport store writes to 100ms idle threshold",
            "Enable LiteGraph dirty region tracking (setDirty per changed node)",
            "Add viewport culling: skip draw() for nodes outside visible bounds",
            "Resize images to 2x display size before injecting as canvas thumbnails",
            "Add React.lazy() + Suspense for all page routes",
            "Add Vite manualChunks for vendor / canvas / app separation",
            "Create local image cache in Electron userData folder",
            "Add Supabase composite index on (user_id, created_at DESC)",
        ],
        "Sprint 4 — UX Sprint (2 weeks)":[
            "Add actionable error messages for all failure modes (generation, export, auth, billing)",
            "Add floating node palette (Tab key) showing all 10 GhostNode types with previews",
            "Add canvas minimap (M key toggle, bottom-right corner)",
            "Add 3 workflow templates on new canvas: Quick Render, Variation Explorer, Day/Night",
            "Add Cmd+K global spotlight search across history + library + canvas",
            "Add 'Load in Canvas' button on every history card",
            "Add skeleton card loaders for History and Library pages",
            "Add notification deduplication (same message within 5s → count badge)",
            "Add notification history bell icon in header (last 50 notifications)",
            "Add Ctrl+Z undo / Ctrl+Y redo / Ctrl+Enter generate / Space+drag pan",
            "Add ? shortcut overlay modal with full keyboard reference",
            "Add empty state illustrations for History, Library, Projects pages",
        ],
        "Sprint 5 — Onboarding + Polish (2 weeks)":[
            "Create Quick Start sample project that opens on first launch",
            "Add 5-step interactive canvas tutorial (skip-able)",
            "Add API key setup wizard with step-by-step guidance",
            "Add contextual help ? tooltip on every major feature",
            "Add 'Discover' tab with 3 prompt ideas for common arch scenarios",
            "Add credit cost display before generation (≈ N credits)",
            "Add prompt history dropdown (last 10 prompts)",
            "Add negative prompt field to generation panel",
            "Add batch generation (4 seeds in one click)",
            "Add canvas node grouping with colored frame + collapse",
            "Add side-by-side upscale comparison (before/after slider)",
            "Add PNG + WebP export format options",
        ],
        "Sprint 6 — Security + Reliability (2 weeks)":[
            "Add Content Security Policy to all Electron BrowserWindows",
            "Add prompt sanitization + length limits on all user-controlled inputs",
            "Add rate limiting: 10 generations/minute per user via Supabase Edge Function",
            "Add billing_audit_log table (immutable append-only)",
            "Fix DXF subprocess to use array args (no shell injection)",
            "Add Supabase Auth failed attempt lockout + CAPTCHA",
            "Add security event logging (failed logins, credit anomalies)",
            "Run npm audit + remediate all HIGH/CRITICAL dependency vulnerabilities",
            "Add streaming PDF generation (page-by-page, no in-memory buffer)",
            "Add export queue (prevent concurrent file writes)",
            "Add batch export: ZIP of all canvas outputs",
            "Add export progress bar with page count",
        ],
        "Sprint 7 — Library + Collaboration (3 weeks)":[
            "Add Library Collections / project folders",
            "Add Library tag system with color coding",
            "Enable drag-from-Library to Canvas as source node",
            "Add image metadata view (model, prompt, date, size)",
            "Add Library search (Supabase FTS on filename + prompt)",
            "Add bulk upload with real progress indicators",
            "Add Supabase CDN transform for auto image compression",
            "Add Google OAuth social login via Supabase Auth",
            "Add project sharing: generate shareable canvas link",
            "Add canvas comment / annotation cards",
            "Add auto-layout (arrange nodes by data flow direction)",
            "Add node collapse/expand for complex canvases",
        ],
        "Sprint 8 — Advanced Features (4 weeks)":[
            "Implement full AI Job Queue with UI status (queue position, ETA)",
            "Add real-time Replicate webhook callback for progress (replace polling)",
            "Add canvas workflow export/import (.ana file format)",
            "Add Revit bridge integration (Revit → Anarchy AI source node)",
            "Add local AI support via Ollama (local node type)",
            "Add ZainCash payment integration for Iraqi market",
            "Add MFA (TOTP) via Supabase Auth",
            "Add Sentry performance monitoring + error tracking",
            "Add custom FPS counter overlay in dev mode",
            "Implement EV code signing for Windows .exe",
            "Add auto-updater with signature verification",
            "Set up Playwright E2E tests for all critical user flows",
        ],
        "Sprint 9 — Plugin Architecture + 9.9/10 (ongoing)":[
            "Design and implement plugin API: NodeTypePlugin interface",
            "Port all GhostNode types to plugin system",
            "Create plugin marketplace skeleton (local plugins only first)",
            "Add WebGL canvas renderer for 500+ node canvases",
            "Add Level-of-Detail rendering (simplified nodes at low zoom)",
            "Add real-time collaboration via Supabase Realtime (cursor sharing)",
            "Add project version history with visual diff between canvas versions",
            "Add AI-powered prompt suggestions (LLM analyzes reference image + suggests prompts)",
            "Add client presentation mode (full-screen, hide UI chrome)",
            "Achieve 80%+ test coverage (Vitest unit + Playwright E2E)",
            "Complete external security penetration test",
            "Launch public beta with 100-user waitlist",
        ],
    }

    for sprint,items in improvements_by_sprint.items():
        story.append(Paragraph(sprint,st["H1"]))
        imp_rows=[[
            Paragraph(f"<b>{i+1:02d}</b>",ParagraphStyle("in",fontName="Helvetica-Bold",fontSize=8,textColor=RED,alignment=TA_CENTER,leading=12)),
            Paragraph(item,st["CE"]),
        ] for i,item in enumerate(items)]
        imp_t=Table(imp_rows,colWidths=[10*mm,W-48*mm-10*mm])
        imp_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("ROWBACKGROUNDS",(0,0),(-1,-1),[DARK_GRAY,BLACK]),
            ("GRID",(0,0),(-1,-1),0.3,BORDER),("BOX",(0,0),(-1,-1),0.8,RED),
            ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
            ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
            ("VALIGN",(0,0),(-1,-1),"TOP"),
        ]))
        story.append(imp_t)
        story.append(sp(4))

    story.append(box("End of File 7 / 8",[Paragraph(
        "This concludes the Top 50 Problems + Top 100 Improvements registry. "
        "Continue with <b>File 8 — Roadmap + Competitor Analysis + Future Architecture</b> "
        "for the 1-year and 3-year strategic roadmap, comparison with Midjourney and Leonardo AI, "
        "and the future architecture vision (Job System, Event Bus, Plugin Architecture, Canvas Engine).",
        st["BD"])],st,bc=RED))

    doc.build(story,onFirstPage=tmpl,onLaterPages=tmpl)
    print(f"PDF 7 created: {out}")


def build_pdf8():
    out = os.path.join(os.path.dirname(__file__), "reports", "Anarchy_AI_Report_08_Roadmap_Competitors_Architecture.pdf")
    output_dir = os.path.dirname(out)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    st=S();tmpl=PT("Roadmap + Competitors + Future Architecture",8,8)
    doc=SimpleDocTemplate(out,pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,
        topMargin=35*mm,bottomMargin=20*mm,
        title="Anarchy AI — Roadmap + Competitors + Future Architecture",
        subject="Technical Audit Report — File 8 of 8")
    story=[]

    # COVER
    story+=[sp(18),Paragraph("ANARCHY",st["CVR"]),Paragraph("AI Platform",st["CVT"]),sp(3),
            hr(RED,2),sp(3),Paragraph("Roadmap + Competitor Analysis + Future Architecture",st["CVS"]),
            Paragraph("Technical Audit Report — File 8 of 8",st["CVM"]),sp(8)]
    ct=Table([[
        Paragraph("3 yr<br/><font size='8' color='#AAAAAA'>Roadmap</font>",ParagraphStyle("c1",fontName="Helvetica-Bold",fontSize=32,textColor=INFO,alignment=TA_CENTER,leading=40)),
        Paragraph("4<br/><font size='8' color='#AAAAAA'>Competitors</font>",ParagraphStyle("c2",fontName="Helvetica-Bold",fontSize=32,textColor=WARNING,alignment=TA_CENTER,leading=40)),
        Paragraph("6<br/><font size='8' color='#AAAAAA'>Future Systems</font>",ParagraphStyle("c3",fontName="Helvetica-Bold",fontSize=32,textColor=SUCCESS,alignment=TA_CENTER,leading=40)),
        Paragraph("9.9<br/><font size='8' color='#AAAAAA'>Target Score</font>",ParagraphStyle("c4",fontName="Helvetica-Bold",fontSize=32,textColor=RED,alignment=TA_CENTER,leading=40)),
    ]],colWidths=[(W-48*mm)/4]*4)
    ct.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),("BOX",(0,0),(-1,-1),1.5,RED),
        ("GRID",(0,0),(-1,-1),0.5,BORDER),("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12)]))
    story+=[ct,PageBreak()]

    # CH1: COMPETITOR COMPARISON
    story+=[Paragraph("1. Competitor Analysis",st["CT"]),
            Paragraph("Detailed comparison with Midjourney, Leonardo AI, VizMaker, and Krea AI",st["CS"]),hr()]
    story.append(Paragraph(
        "Anarchy AI operates in a competitive landscape dominated by general-purpose AI image "
        "tools and a small number of architecture-specific platforms. The key strategic insight "
        "is that Anarchy AI is the ONLY tool targeting the architecture workflow specifically "
        "with a native 3D software bridge. This is an undefended competitive position "
        "that must be reinforced before larger players copy it.",st["BD"]))
    story.append(sp(2))

    comp_rows=[
        ["Node-based canvas","✗","✗","✗","~ Partial","✓ Full"],
        ["Architecture-specific AI","~ Generic","~ LoRA","✓ Arch focus","~ Generic","✓ Arch focus"],
        ["3ds Max / Revit bridge","✗","✗","✗","✗","✓ Native"],
        ["DXF vector export","✗","✗","✗","✗","✓ Built-in"],
        ["Multiple AI models","✓ MJ only","✓ Many","~ Limited","✓ Many","✓ FLUX+NB2"],
        ["Local AI (Ollama)","✗","✗","✗","✗","~ Planned"],
        ["Desktop native app","✗","✗","✗","✗","✓ Electron"],
        ["Offline capability","✗","✗","✗","✗","~ Planned"],
        ["Generation history","✓ Full","✓ Full","✓ Full","✓ Full","~ Partial"],
        ["Batch generation","✓ Full","✓ Full","✓ Full","✓ Full","✗ Missing"],
        ["Real-time progress","✓ Full","✓ Full","✓ Full","✓ Full","✗ Fake timer"],
        ["Collaboration","✓ Servers","✓ Teams","~ Basic","✓ Teams","✗ Missing"],
        ["API access","✓ API","✓ API","✗","✓ API","✓ Replicate"],
        ["Pricing (entry)","$10/mo","Free tier","$29/mo","Free tier","Credits"],
        ["Iraqi market support","✗","✗","✗","✗","✓ ZainCash planned"],
        ["Style presets","✓ Full","✓ Full","✓ Full","✓ Full","~ Basic"],
        ["Client presentation","✗","~ Basic","~ Basic","~ Basic","✗ Missing"],
        ["Plugin/extension system","✗","~ LoRA","✗","✗","~ Planned"],
    ]

    def feat_c(v):
        cc={"✓ Full":"#2ECC71","✓ Arch focus":"#2ECC71","✓ Native":"#2ECC71","✓ Built-in":"#2ECC71",
            "✓ FLUX+NB2":"#2ECC71","✓ Electron":"#2ECC71","✓ Credits":"#2ECC71","✓ Replicate":"#2ECC71",
            "✓ ZainCash planned":"#F39C12","~ Partial":"#F39C12","~ Limited":"#F39C12","~ Planned":"#3498DB",
            "~ Basic":"#F39C12","~ LoRA":"#F39C12","✗":"#E74C3C","✗ Missing":"#E74C3C","✗ Fake timer":"#E74C3C"
            }.get(v,"#AAAAAA")
        return Paragraph(f"<font color='{cc}'>{v}</font>",ParagraphStyle("fv",fontSize=7,textColor=HexColor(cc),alignment=TA_CENTER,leading=10))

    comp_data=[[
        Paragraph(r[0],st["CE"]),
        feat_c(r[1]),feat_c(r[2]),feat_c(r[3]),feat_c(r[4]),
        feat_c(r[5]),
    ] for r in comp_rows]
    story.append(tbl(["Feature","Midjourney","Leonardo AI","VizMaker","Krea AI","ANARCHY AI"],
        comp_data,[45*mm,22*mm,24*mm,22*mm,22*mm,W-48*mm-45*mm-22*mm-24*mm-22*mm-22*mm],st))
    story.append(sp(3))

    story.append(box("Strategic Positioning",
        [Paragraph("<b>ANARCHY AI's undefended competitive moat:</b> The 3ds Max / Revit native bridge + node-based canvas + DXF export pipeline is a combination that NO competitor has. This is the product's defensible advantage.",st["BD"]),
         Paragraph("<b>The positioning statement:</b> 'VizMaker makes rendering faster. ANARCHY makes the architect smarter.' — This frames ANARCHY as the professional workflow tool, not just a faster generation button.",st["BD"]),
         Paragraph("<b>Risk:</b> Midjourney and Leonardo AI have the resources to add architecture modes. The window to establish market presence is 12-18 months before this niche attracts major players.",st["BD"])],
        st,bc=WARNING))
    story.append(PageBreak())

    # CH2: FUTURE ARCHITECTURE SYSTEMS
    story+=[Paragraph("2. Future Architecture Systems",st["CT"]),
            Paragraph("Six architectural systems needed to reach 9.9/10 — design specifications",st["CS"]),hr()]

    systems=[
        ("AI Job Queue System","The missing foundation of all AI operations",
         "A priority-based, persistent job queue with retry, circuit breaker, and real-time status reporting. All AI operations (generate, upscale, variation) pass through this queue. Workers run in Electron main process. Frontend subscribes to job events via IPC.",
         ["Bull Queue or p-queue (concurrency 3) in Electron main process",
          "Job schema: { id, type, payload, priority, status, retryCount, createdAt, updatedAt }",
          "Priority levels: manual > auto-variation > background",
          "Retry: 3 attempts with exponential backoff (1s, 2s, 4s)",
          "Circuit breaker: open after 5 failures, half-open after 30s",
          "Frontend: useJobQueue() hook subscribes to IPC job events",
          "UI: Job queue panel shows active, pending, completed jobs"]),
        ("Event Bus System","Decoupled communication between modules",
         "A typed event bus that replaces direct function calls between canvas, services, and stores. This is the key architectural change that makes all components independently testable and allows features to be added without touching existing code.",
         ["EventEmitter3 or Mitt as the event bus implementation",
          "Typed events: GenerationStarted, GenerationCompleted, NodeAdded, CanvasSaved, etc.",
          "Electron IPC bridge: main process events cross to renderer via ipcMain/ipcRenderer",
          "Components emit events; services subscribe; stores react",
          "Prevents circular dependencies: canvas → event bus → service (not canvas → service directly)",
          "Enables analytics: every event logged for debugging and metrics"]),
        ("Workflow Engine","Executable canvas workflows",
         "The canvas becomes executable — not just a visual diagram, but a runnable pipeline. Click 'Run Workflow' and the engine traverses the node graph from source to output, executing each node's AI operation in dependency order.",
         ["Topological sort of node graph to determine execution order",
          "WorkflowExecutor: traverse graph, execute each node sequentially or in parallel where possible",
          "Node interface: execute(inputs) => Promise<outputs> — each node type implements this",
          "Progress tracking: emit progress events as each node completes",
          "Error handling: if a node fails, mark it red, stop downstream nodes, suggest retry",
          "Workflow templates: Save and share entire canvas workflows as .ana files"]),
        ("History Graph System","Non-linear generation history",
         "Replace the flat history list with a visual history graph — a tree showing the branching evolution of images. Click any node to see how that image was created, which parent it came from, and what variations were explored.",
         ["Store parent_id on every history record to build the tree",
          "History graph UI: tree visualization with branching paths",
          "Node detail: expand any history node to see prompt, model, seed, parent",
          "Re-branch: click any historical node to start a new variation branch",
          "Prune: collapse explored branches that didn't lead to good results",
          "Export: export any branch path as a PDF showing the creative evolution"]),
        ("Plugin Architecture","Extensible node type system",
         "Allow third-party developers to add new node types to the canvas. A plugin defines its input/output schema, UI, and execute() function. Anarchy AI loads plugins at startup and they appear in the node palette.",
         ["Plugin interface: { name, type, inputs, outputs, ui, execute }",
          "Plugin loader: Electron reads plugins from userData/plugins/ folder",
          "Plugin sandbox: plugins run in a restricted context (no filesystem access by default)",
          "Built-in plugins: migrate all 10 GhostNode types to plugin format first",
          "Plugin API: access to canvas state, history, and Replicate API via provided hooks",
          "Future: plugin marketplace with signed, reviewed plugins"]),
        ("Canvas Engine 2.0","WebGL-accelerated canvas for 500+ nodes",
         "Replace the HTML5 Canvas LiteGraph renderer with a WebGL-based engine for large-scale canvases. This enables smooth 60fps rendering with 500+ nodes, GPU-accelerated image display in nodes, and support for real-time video frames in the future.",
         ["Pixi.js or Three.js for WebGL canvas rendering layer",
          "Migrate LiteGraph node definitions to WebGL sprite-based rendering",
          "GPU texture management: images stored as WebGL textures (not DOM elements)",
          "Level-of-Detail: simplified rendering at zoom < 30% for smooth pan/zoom",
          "Viewport culling: GPU clip-space test replaces CPU bounding box check",
          "Target: 60fps on 200 nodes; 30fps on 500 nodes; 15fps on 1000 nodes"]),
    ]

    for name,tagline,description,specs in systems:
        h=Table([[
            Paragraph(f"<b>{name}</b>",ParagraphStyle("sn",fontName="Helvetica-Bold",fontSize=13,textColor=TEXT_WHITE,leading=18)),
            Paragraph(tagline,ParagraphStyle("tl",fontSize=9,textColor=TEXT_GRAY,alignment=TA_RIGHT,leading=13)),
        ]],colWidths=[W-48*mm-80*mm,80*mm])
        h.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),MID_GRAY),("BOX",(0,0),(-1,-1),1.5,RED),
            ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
        story.append(h)
        desc_t=Table([[Paragraph(description,st["BG"])]],colWidths=[W-48*mm])
        desc_t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),DARK_GRAY),
            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LINEBELOW",(0,0),(-1,-1),0.3,BORDER)]))
        story.append(desc_t)
        spec_rows=[[Paragraph(f"• {s}",st["CE"])] for s in specs]
        spec_t=Table(spec_rows,colWidths=[W-48*mm])
        spec_t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),HexColor("#0F0F1A")),
            ("BOX",(0,0),(-1,-1),0.5,INFO),
            ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
            ("VALIGN",(0,0),(-1,-1),"TOP")]))
        story.append(spec_t)
        story.append(sp(4))

    story.append(PageBreak())

    # CH3: 1-YEAR ROADMAP
    story+=[Paragraph("3. One-Year Roadmap",st["CT"]),
            Paragraph("Month-by-month milestones to reach 9.0/10 and public launch",st["CS"]),hr()]

    roadmap_1yr=[
        ("Month 1-2","Stabilization","Fix all CRITICAL bugs, complete LiteGraph migration, add Error Boundaries, implement AI Job Queue","7.5/10","Private alpha release to 10 trusted architects"),
        ("Month 3-4","Architecture","Break God Components, add granular Zustand selectors, performance sprint, code splitting","8.0/10","Closed beta — 50 users, credit-based pricing live"),
        ("Month 5-6","UX Overhaul","Node palette, workflow templates, history pagination, onboarding tour, real progress indicators","8.5/10","Public beta launch — waitlist open"),
        ("Month 7-8","Security","Complete RLS, code signing, MFA, webhook verification, rate limiting, security audit","8.8/10","Production v1.0 release"),
        ("Month 9-10","Features","Revit bridge, local AI (Ollama), batch generation, library collections, Google OAuth","9.0/10","v1.1 — Professional tier launch"),
        ("Month 11-12","Scale","Event Bus, Workflow Engine, History Graph, plugin architecture skeleton, Sentry monitoring","9.3/10","v1.5 — Power User release"),
    ]
    rm_rows=[[
        Paragraph(r[0],st["CE"]),
        Paragraph(f"<b>{r[1]}</b>",st["CR"]),
        Paragraph(r[2],st["CG"]),
        Paragraph(f"<b><font color='#2ECC71'>{r[3]}</font></b>",ParagraphStyle("sc2",fontName="Helvetica-Bold",fontSize=10,textColor=SUCCESS,alignment=TA_CENTER,leading=14)),
        Paragraph(r[4],st["CG"]),
    ] for r in roadmap_1yr]
    story.append(tbl(["Period","Focus","Key Work","Score","Milestone"],rm_rows,
        [22*mm,28*mm,70*mm,18*mm,W-48*mm-22*mm-28*mm-70*mm-18*mm],st))
    story.append(PageBreak())

    # CH4: 3-YEAR ROADMAP
    story+=[Paragraph("4. Three-Year Vision",st["CT"]),
            Paragraph("Strategic milestones to reach 9.9/10 and category leadership",st["CS"]),hr()]

    roadmap_3yr=[
        ("Year 1","Foundation","Stable, secure, production-ready platform. Node canvas, 3ds Max bridge, AI queue, 3 AI models.","9.3/10","1,000 active architects globally"),
        ("Year 2","Ecosystem","Plugin marketplace, Workflow Engine, History Graph, Canvas Engine 2.0, real-time collaboration, Revit + SketchUp bridges.","9.7/10","10,000 active users; $1M ARR"),
        ("Year 3","Platform","ANARCHY becomes the operating system for architectural visualization. Third-party plugins, firm licensing, white-label API for AEC software vendors.","9.9/10","100,000 users; category leader"),
    ]
    yr_rows=[[
        Paragraph(f"<b>{r[0]}</b>",st["CR"]),
        Paragraph(f"<b>{r[1]}</b>",st["CE"]),
        Paragraph(r[2],st["CG"]),
        Paragraph(f"<b><font color='#2ECC71'>{r[3]}</font></b>",ParagraphStyle("ysc",fontName="Helvetica-Bold",fontSize=12,textColor=SUCCESS,alignment=TA_CENTER,leading=16)),
        Paragraph(r[4],st["CG"]),
    ] for r in roadmap_3yr]
    story.append(tbl(["Year","Theme","Key Capabilities","Score","Target"],yr_rows,
        [18*mm,22*mm,80*mm,20*mm,W-48*mm-18*mm-22*mm-80*mm-20*mm],st))
    story.append(sp(4))

    # CH5: HOW TO REACH 9.9
    story+=[Paragraph("5. How Anarchy AI Reaches 9.9 / 10",st["CT"]),
            Paragraph("The complete formula — architecture + product + market",st["CS"]),hr()]
    story.append(Paragraph(
        "9.9/10 is not a technical score — it is a product-market-architecture score. "
        "The technical foundation enables the product vision; the product vision earns "
        "the market position. The three pillars must advance together.",st["BD"]))
    story.append(sp(2))

    pillar_rows=[
        ["Technical Excellence (Architecture)","Current: 6.8","Target: 9.5",
         "Complete LiteGraph migration. God Components split. AI Job Queue. Event Bus. Test coverage 80%. Performance: 60fps on 200 nodes. Zero production-critical bugs."],
        ["Product Completeness (Features)","Current: 6.4","Target: 9.5",
         "Real-time progress. Cancel. Batch generation. Workflow templates. History graph. Library collections. Plugin architecture. Revit/SketchUp bridges. Collaboration."],
        ["Market Position (UX + Distribution)","Current: 6.8","Target: 9.8",
         "Professional UX matching Figma quality bar. Active community of 10,000+ architects. VizMaker users migrating to ANARCHY. Cited in architecture schools and firms."],
    ]
    for curr,before,after,detail in pillar_rows:
        row_t=Table([[
            [Paragraph(f"<b>{curr}</b>",ParagraphStyle("pn",fontName="Helvetica-Bold",fontSize=11,textColor=RED,leading=15)),
             Spacer(1,1*mm),
             Paragraph(f"<font color='#E74C3C'>{before}</font>  →  <font color='#2ECC71'>{after}</font>",
                ParagraphStyle("ps",fontSize=10,textColor=TEXT_WHITE,leading=14))],
            Paragraph(detail,st["BG"]),
        ]],colWidths=[55*mm,W-48*mm-55*mm])
        row_t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(0,0),MID_GRAY),("BACKGROUND",(1,0),(1,0),DARK_GRAY),
            ("BOX",(0,0),(-1,-1),1,RED),("LINEAFTER",(0,0),(0,-1),0.5,LIGHT_GRAY),
            ("TOPPADDING",(0,0),(-1,-1),10),("BOTTOMPADDING",(0,0),(-1,-1),10),
            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]))
        story.append(row_t)
        story.append(sp(2))

    story.append(sp(3))
    story.append(box("Final Statement",
        [Paragraph(
            "<b>Anarchy AI has everything needed to win in the architectural AI visualization market.</b> "
            "The product concept is differentiated (node-based + 3ds Max bridge). The visual identity is strong. "
            "The technical stack is appropriate. The competitive window is open. "
            "What stands between the current state and 9.9/10 is not a gap in vision — "
            "it is the execution discipline of fixing 50 known issues in 12 focused sprints. "
            "The path is clear. The work is defined. The market is waiting.",
            st["BD"])],
        st,bc=SUCCESS))
    story.append(sp(3))

    story.append(box("End of Audit Series — File 8 / 8",
        [Paragraph(
            "This concludes the complete Anarchy AI Technical Audit Series — 8 files, ~140 pages. "
            "Files covered: Architecture, Services/Stores/Components, Functional, Performance, "
            "Security, UX, Top 50 Problems + Top 100 Improvements, and Roadmap. "
            "Total issues documented: 50 problems, 100 improvements, 15 security vulnerabilities, "
            "10 expected bugs, 20 performance issues, 40 UX improvements.",
            st["BD"])],
        st,bc=RED))

    doc.build(story,onFirstPage=tmpl,onLaterPages=tmpl)
    print(f"PDF 8 created: {out}")


if __name__=="__main__":
    build_pdf7()
    build_pdf8()
