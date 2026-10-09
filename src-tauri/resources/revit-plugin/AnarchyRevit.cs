using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Threading;
using System.Windows.Media.Imaging;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.DB.Structure;
using Autodesk.Revit.Attributes;

namespace AnarchyRevit
{
    public class AnarchyApp : IExternalApplication
    {
        public static AnarchyApp Instance { get; private set; }
        public AnarchyAgentHandler Handler { get; private set; }
        public ExternalEvent ExEvent { get; private set; }
        private Thread _workerThread;
        private volatile bool _isRunning = false;

        public Result OnStartup(UIControlledApplication app)
        {
            try
            {
                Instance = this;
                Handler = new AnarchyAgentHandler();
                ExEvent = ExternalEvent.Create(Handler);

                string tabName = "Anarchy";
                try { app.CreateRibbonTab(tabName); } catch { }

                RibbonPanel panel = null;
                foreach (RibbonPanel p in app.GetRibbonPanels(tabName))
                {
                    if (p.Name == "Anarchy AI Suite") { panel = p; break; }
                }
                if (panel == null) panel = app.CreateRibbonPanel(tabName, "Anarchy AI Suite");

                string asmPath = Assembly.GetExecutingAssembly().Location;
                string asmDir = Path.GetDirectoryName(asmPath);
                string icon32 = Path.Combine(asmDir, "AnarchyLogo_32.png");
                string icon16 = Path.Combine(asmDir, "AnarchyLogo_16.png");

                // Button 1: Send View to Anarchy Canvas
                PushButtonData btnSend = new PushButtonData(
                    "AnarchySendView",
                    "Send View\nto AI",
                    asmPath,
                    "AnarchyRevit.SendViewCommand");
                btnSend.ToolTip = "Capture and send the active 3D or 2D Revit view directly to Anarchy AI Builder Canvas.";

                // Button 2: Extract BIM Metadata
                PushButtonData btnBim = new PushButtonData(
                    "AnarchyExtractBim",
                    "Extract\nBIM Data",
                    asmPath,
                    "AnarchyRevit.ExtractBimCommand");
                btnBim.ToolTip = "Extract project levels, rooms, areas, elements, and schedules to Anarchy AI Agent.";

                // Button 3: Connect AI Copilot
                PushButtonData btnCopilot = new PushButtonData(
                    "AnarchyLiveCopilot",
                    "Anarchy AI\nCopilot",
                    asmPath,
                    "AnarchyRevit.ToggleCopilotCommand");
                btnCopilot.ToolTip = "Status and connection control for Anarchy AI Live Architectural Agent.";

                if (File.Exists(icon32))
                {
                    var img = new BitmapImage(new Uri(icon32));
                    btnSend.LargeImage = img;
                    btnSend.Image = img;
                    btnBim.LargeImage = img;
                    btnBim.Image = img;
                    btnCopilot.LargeImage = img;
                    btnCopilot.Image = img;
                }

                panel.AddItem(btnSend);
                panel.AddItem(btnBim);
                panel.AddItem(btnCopilot);

                // Start Live Agent Background Polling Worker
                StartAgentWorker();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("[AnarchyRevit] Startup error: " + ex.Message);
            }
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication app)
        {
            StopAgentWorker();
            return Result.Succeeded;
        }

        public void StartAgentWorker()
        {
            if (_isRunning) return;
            _isRunning = true;
            _workerThread = new Thread(AgentWorkerLoop)
            {
                IsBackground = true,
                Name = "AnarchyRevitAgentWorker"
            };
            _workerThread.Start();
        }

        public void StopAgentWorker()
        {
            _isRunning = false;
            try
            {
                if (_workerThread != null && _workerThread.IsAlive)
                {
                    _workerThread.Join(500);
                }
            }
            catch { }
        }

        private void AgentWorkerLoop()
        {
            while (_isRunning)
            {
                try
                {
                    string pollUrl = "http://127.0.0.1:14400/agent/poll-command?software=revit";
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(pollUrl);
                    req.Method = "GET";
                    req.Timeout = 3000;
                    req.Headers.Add("X-Autodesk-Software", "revit");

                    string token = ReadAnarchyToken();
                    if (!string.IsNullOrEmpty(token)) req.Headers.Add("X-Anarchy-Token", token);

                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    {
                        if (resp.StatusCode == HttpStatusCode.OK)
                        {
                            using (StreamReader reader = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                            {
                                string body = reader.ReadToEnd();
                                if (!string.IsNullOrEmpty(body) && body.Contains("\"command\":") && !body.Contains("\"command\":null"))
                                {
                                    ProcessIncomingCommandJson(body);
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // Bridge server may be offline or starting up; retry every 1.5s
                }

                Thread.Sleep(1500);
            }
        }

        private void ProcessIncomingCommandJson(string json)
        {
            try
            {
                var cmd = SimpleJsonParser.ExtractCommand(json);
                if (cmd != null && !string.IsNullOrEmpty(cmd.Id))
                {
                    Handler.EnqueueCommand(cmd);
                    ExEvent.Raise();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("[AnarchyRevit] Process command error: " + ex.Message);
            }
        }

        public static string ReadAnarchyToken()
        {
            try
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string tokenFile = Path.Combine(appData, "com.anarchyai.app", ".token");
                if (File.Exists(tokenFile)) return File.ReadAllText(tokenFile).Trim();
            }
            catch { }
            return "";
        }
    }

    public class RevitCommandItem
    {
        public string Id { get; set; } = "";
        public string Software { get; set; } = "revit";
        public string Action { get; set; } = "tool_call";
        public string Script { get; set; } = "";
        public string ToolName { get; set; } = "";
        public Dictionary<string, string> Params { get; set; } = new Dictionary<string, string>();
    }

    public class AnarchyAgentHandler : IExternalEventHandler
    {
        private readonly Queue<RevitCommandItem> _queue = new Queue<RevitCommandItem>();
        private readonly object _lock = new object();

        public void EnqueueCommand(RevitCommandItem cmd)
        {
            lock (_lock)
            {
                _queue.Enqueue(cmd);
            }
        }

        public string GetName() => "AnarchyRevitAgentHandler";

        public void Execute(UIApplication uiapp)
        {
            RevitCommandItem cmd = null;
            lock (_lock)
            {
                if (_queue.Count > 0) cmd = _queue.Dequeue();
            }

            if (cmd == null) return;

            UIDocument uidoc = uiapp.ActiveUIDocument;
            Document doc = uidoc?.Document;

            bool success = false;
            string output = "";
            string error = "";

            if (doc == null)
            {
                PostResult(cmd.Id, false, null, "No active document open in Revit.");
                return;
            }

            try
            {
                string tool = !string.IsNullOrEmpty(cmd.ToolName) ? cmd.ToolName : cmd.Script;
                tool = (tool ?? "").ToLower().Trim();

                switch (tool)
                {
                    case "create_architectural_house":
                    case "create_architectural_villa":
                    case "create_villa":
                        (success, output, error) = CreateArchitecturalVilla(uidoc, cmd.Params);
                        break;

                    case "create_levels":
                    case "setup_levels":
                    case "create_level":
                        (success, output, error) = CreateLevels(doc, cmd.Params);
                        break;

                    case "create_walls":
                    case "build_walls":
                        (success, output, error) = CreateWalls(doc, cmd.Params);
                        break;

                    case "create_floors":
                    case "build_floor":
                        (success, output, error) = CreateFloors(doc, cmd.Params);
                        break;

                    case "place_doors_windows":
                    case "place_openings":
                        (success, output, error) = PlaceDoorsAndWindows(doc, cmd.Params);
                        break;

                    case "set_camera":
                    case "set_3d_view":
                    case "align_camera":
                        (success, output, error) = SetPerspectiveCamera(uidoc, cmd.Params);
                        break;

                    case "export_active_view":
                    case "render_preview":
                    case "viewport_sync":
                        (success, output, error) = ExportActiveView(uidoc, cmd.Params);
                        break;

                    case "get_model_summary":
                    case "extract_bim_data":
                    case "get_scene_info":
                        (success, output, error) = ExtractBimMetadata(doc, uidoc.ActiveView);
                        break;

                    case "export_model":
                        (success, output, error) = ExportModel(doc, cmd.Params);
                        break;

                    default:
                        (success, output, error) = (false, "", $"Unknown Revit tool or command: '{tool}'");
                        break;
                }
            }
            catch (Exception ex)
            {
                success = false;
                error = ex.Message + "\n" + ex.StackTrace;
            }

            PostResult(cmd.Id, success, output, error);
        }

        private static void PostResult(string cmdId, bool success, string output, string error)
        {
            try
            {
                string json = "{" +
                    "\"id\":\"" + cmdId + "\"," +
                    "\"success\":" + (success ? "true" : "false") + "," +
                    "\"output\":" + (output != null ? "\"" + EscapeJson(output) + "\"" : "null") + "," +
                    "\"error\":" + (!string.IsNullOrEmpty(error) ? "\"" + EscapeJson(error) + "\"" : "null") +
                "}";

                byte[] bytes = Encoding.UTF8.GetBytes(json);
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:14400/agent/command-result");
                req.Method = "POST";
                req.ContentType = "application/json";
                req.ContentLength = bytes.Length;
                req.Timeout = 4000;
                req.Headers.Add("X-Autodesk-Software", "revit");

                string token = AnarchyApp.ReadAnarchyToken();
                if (!string.IsNullOrEmpty(token)) req.Headers.Add("X-Anarchy-Token", token);

                using (Stream s = req.GetRequestStream()) { s.Write(bytes, 0, bytes.Length); }
                using (var r = (HttpWebResponse)req.GetResponse()) { }
            }
            catch { }
        }

        // ==========================================
        // Parametric BIM Generators
        // ==========================================

        private (bool, string, string) CreateArchitecturalVilla(UIDocument uidoc, Dictionary<string, string> p)
        {
            Document doc = uidoc.Document;
            double widthM = GetDouble(p, "width", 14.0);
            double lengthM = GetDouble(p, "length", 16.0);
            double heightM = GetDouble(p, "height", 3.5);
            string style = p.ContainsKey("style") ? p["style"] : "Modern";

            double widthFt = MetersToFeet(widthM);
            double lengthFt = MetersToFeet(lengthM);
            double heightFt = MetersToFeet(heightM);

            int wallsCreated = 0;
            int levelsCreated = 0;
            int openingsPlaced = 0;

            using (Transaction t = new Transaction(doc, "Anarchy AI: Generate Villa"))
            {
                t.Start();

                // 1. Resolve or Create Ground Level
                Level groundLevel = GetOrCreateLevel(doc, "Ground Floor", 0.0, ref levelsCreated);
                Level firstLevel = GetOrCreateLevel(doc, "Level 1", heightFt, ref levelsCreated);
                Level roofLevel = GetOrCreateLevel(doc, "Roof", heightFt * 2.0, ref levelsCreated);

                // 2. Resolve Wall Type
                WallType wallType = GetDefaultWallType(doc);
                if (wallType == null)
                {
                    t.RollBack();
                    return (false, "", "No basic wall type found in project.");
                }

                // 3. Create Outer Perimeter Walls (Rectangular Villa Envelope with Setbacks)
                XYZ p1 = new XYZ(-widthFt / 2.0, -lengthFt / 2.0, 0);
                XYZ p2 = new XYZ(widthFt / 2.0, -lengthFt / 2.0, 0);
                XYZ p3 = new XYZ(widthFt / 2.0, lengthFt / 2.0, 0);
                XYZ p4 = new XYZ(-widthFt / 2.0, lengthFt / 2.0, 0);

                List<Wall> outerWalls = new List<Wall>
                {
                    Wall.Create(doc, Line.CreateBound(p1, p2), wallType.Id, groundLevel.Id, heightFt, 0, false, false),
                    Wall.Create(doc, Line.CreateBound(p2, p3), wallType.Id, groundLevel.Id, heightFt, 0, false, false),
                    Wall.Create(doc, Line.CreateBound(p3, p4), wallType.Id, groundLevel.Id, heightFt, 0, false, false),
                    Wall.Create(doc, Line.CreateBound(p4, p1), wallType.Id, groundLevel.Id, heightFt, 0, false, false)
                };
                wallsCreated += outerWalls.Count;

                // 4. Create First Floor Perimeter (Modern cantilever shift)
                XYZ f1 = new XYZ(-widthFt / 2.0 - MetersToFeet(1.5), -lengthFt / 2.0, heightFt);
                XYZ f2 = new XYZ(widthFt / 2.0, -lengthFt / 2.0, heightFt);
                XYZ f3 = new XYZ(widthFt / 2.0, lengthFt / 2.0 - MetersToFeet(2.0), heightFt);
                XYZ f4 = new XYZ(-widthFt / 2.0 - MetersToFeet(1.5), lengthFt / 2.0 - MetersToFeet(2.0), heightFt);

                List<Wall> upperWalls = new List<Wall>
                {
                    Wall.Create(doc, Line.CreateBound(f1, f2), wallType.Id, firstLevel.Id, heightFt, 0, false, false),
                    Wall.Create(doc, Line.CreateBound(f2, f3), wallType.Id, firstLevel.Id, heightFt, 0, false, false),
                    Wall.Create(doc, Line.CreateBound(f3, f4), wallType.Id, firstLevel.Id, heightFt, 0, false, false),
                    Wall.Create(doc, Line.CreateBound(f4, f1), wallType.Id, firstLevel.Id, heightFt, 0, false, false)
                };
                wallsCreated += upperWalls.Count;

                // 5. Interior Partitions (Living Room, Kitchen, Suites)
                XYZ ip1 = new XYZ(0, -lengthFt / 2.0, 0);
                XYZ ip2 = new XYZ(0, lengthFt / 4.0, 0);
                XYZ ip3 = new XYZ(-widthFt / 2.0, 0, 0);
                XYZ ip4 = new XYZ(0, 0, 0);

                Wall intWall1 = Wall.Create(doc, Line.CreateBound(ip1, ip2), wallType.Id, groundLevel.Id, heightFt, 0, false, false);
                Wall intWall2 = Wall.Create(doc, Line.CreateBound(ip3, ip4), wallType.Id, groundLevel.Id, heightFt, 0, false, false);
                wallsCreated += 2;

                // 6. Place Openings (Entrance Door & Windows)
                FamilySymbol doorSymbol = GetFirstFamilySymbol(doc, BuiltInCategory.OST_Doors);
                FamilySymbol winSymbol = GetFirstFamilySymbol(doc, BuiltInCategory.OST_Windows);

                if (doorSymbol != null)
                {
                    if (!doorSymbol.IsActive) doorSymbol.Activate();
                    XYZ doorLoc = new XYZ(0, -lengthFt / 2.0, 0);
                    doc.Create.NewFamilyInstance(doorLoc, doorSymbol, outerWalls[0], groundLevel, StructuralType.NonStructural);
                    openingsPlaced++;
                }

                if (winSymbol != null)
                {
                    if (!winSymbol.IsActive) winSymbol.Activate();
                    XYZ winLoc1 = new XYZ(widthFt / 4.0, -lengthFt / 2.0, MetersToFeet(1.0));
                    XYZ winLoc2 = new XYZ(widthFt / 2.0, 0, MetersToFeet(1.0));
                    doc.Create.NewFamilyInstance(winLoc1, winSymbol, outerWalls[0], groundLevel, StructuralType.NonStructural);
                    doc.Create.NewFamilyInstance(winLoc2, winSymbol, outerWalls[1], groundLevel, StructuralType.NonStructural);
                    openingsPlaced += 2;
                }

                t.Commit();
            }

            // Align 3D Perspective View
            try
            {
                SetPerspectiveCamera(uidoc, new Dictionary<string, string>
                {
                    { "eye_level", "true" },
                    { "yaw", "35" },
                    { "distance", (Math.Max(widthM, lengthM) * 1.8).ToString() }
                });
            }
            catch { }

            string summary = $"Parametrically modeled {style} Villa in Revit: {wallsCreated} walls, {levelsCreated} levels, {openingsPlaced} openings (Width: {widthM}m, Length: {lengthM}m, Height: {heightM * 2}m).";
            return (true, summary, "");
        }

        private (bool, string, string) CreateLevels(Document doc, Dictionary<string, string> p)
        {
            string name = p.ContainsKey("name") ? p["name"] : "New Level";
            double elevationM = GetDouble(p, "elevation", 3.5);
            double elevationFt = MetersToFeet(elevationM);

            using (Transaction t = new Transaction(doc, "Anarchy AI: Create Level"))
            {
                t.Start();
                Level lvl = Level.Create(doc, elevationFt);
                try { lvl.Name = name; } catch { }
                t.Commit();

                return (true, $"Created Level '{name}' at elevation {elevationM}m ({elevationFt:F1} ft).", "");
            }
        }

        private (bool, string, string) CreateWalls(Document doc, Dictionary<string, string> p)
        {
            double widthM = GetDouble(p, "width", 10.0);
            double lengthM = GetDouble(p, "length", 12.0);
            double heightM = GetDouble(p, "height", 3.2);

            double widthFt = MetersToFeet(widthM);
            double lengthFt = MetersToFeet(lengthM);
            double heightFt = MetersToFeet(heightM);

            using (Transaction t = new Transaction(doc, "Anarchy AI: Create Walls"))
            {
                t.Start();
                int dummy = 0;
                Level lvl = GetOrCreateLevel(doc, "Ground Floor", 0.0, ref dummy);
                WallType wt = GetDefaultWallType(doc);
                if (wt == null)
                {
                    t.RollBack();
                    return (false, "", "No basic wall type available in project.");
                }

                XYZ p1 = new XYZ(-widthFt / 2.0, -lengthFt / 2.0, 0);
                XYZ p2 = new XYZ(widthFt / 2.0, -lengthFt / 2.0, 0);
                XYZ p3 = new XYZ(widthFt / 2.0, lengthFt / 2.0, 0);
                XYZ p4 = new XYZ(-widthFt / 2.0, lengthFt / 2.0, 0);

                Wall.Create(doc, Line.CreateBound(p1, p2), wt.Id, lvl.Id, heightFt, 0, false, false);
                Wall.Create(doc, Line.CreateBound(p2, p3), wt.Id, lvl.Id, heightFt, 0, false, false);
                Wall.Create(doc, Line.CreateBound(p3, p4), wt.Id, lvl.Id, heightFt, 0, false, false);
                Wall.Create(doc, Line.CreateBound(p4, p1), wt.Id, lvl.Id, heightFt, 0, false, false);

                t.Commit();
                return (true, $"Created 4 perimeter walls ({widthM}m x {lengthM}m, height: {heightM}m).", "");
            }
        }

        private (bool, string, string) CreateFloors(Document doc, Dictionary<string, string> p)
        {
            double widthM = GetDouble(p, "width", 12.0);
            double lengthM = GetDouble(p, "length", 14.0);
            double widthFt = MetersToFeet(widthM);
            double lengthFt = MetersToFeet(lengthM);

            using (Transaction t = new Transaction(doc, "Anarchy AI: Create Floor"))
            {
                t.Start();
                int dummy = 0;
                Level lvl = GetOrCreateLevel(doc, "Ground Floor", 0.0, ref dummy);
                FloorType ft = new FilteredElementCollector(doc).OfClass(typeof(FloorType)).FirstElement() as FloorType;
                if (ft == null)
                {
                    t.RollBack();
                    return (false, "", "No floor type found in project.");
                }

                XYZ p1 = new XYZ(-widthFt / 2.0, -lengthFt / 2.0, 0);
                XYZ p2 = new XYZ(widthFt / 2.0, -lengthFt / 2.0, 0);
                XYZ p3 = new XYZ(widthFt / 2.0, lengthFt / 2.0, 0);
                XYZ p4 = new XYZ(-widthFt / 2.0, lengthFt / 2.0, 0);

                CurveLoop loop = new CurveLoop();
                loop.Append(Line.CreateBound(p1, p2));
                loop.Append(Line.CreateBound(p2, p3));
                loop.Append(Line.CreateBound(p3, p4));
                loop.Append(Line.CreateBound(p4, p1));

                Floor.Create(doc, new List<CurveLoop> { loop }, ft.Id, lvl.Id);
                t.Commit();

                return (true, $"Created architectural floor slab ({widthM}m x {lengthM}m).", "");
            }
        }

        private (bool, string, string) PlaceDoorsAndWindows(Document doc, Dictionary<string, string> p)
        {
            using (Transaction t = new Transaction(doc, "Anarchy AI: Place Openings"))
            {
                t.Start();
                var walls = new FilteredElementCollector(doc).OfClass(typeof(Wall)).ToElements();
                if (walls.Count == 0)
                {
                    t.RollBack();
                    return (false, "", "No walls found to host doors or windows.");
                }

                Wall targetWall = walls[0] as Wall;
                Level lvl = doc.GetElement(targetWall.LevelId) as Level;

                FamilySymbol door = GetFirstFamilySymbol(doc, BuiltInCategory.OST_Doors);
                int count = 0;
                if (door != null)
                {
                    if (!door.IsActive) door.Activate();
                    LocationCurve lc = targetWall.Location as LocationCurve;
                    XYZ mid = (lc.Curve.GetEndPoint(0) + lc.Curve.GetEndPoint(1)) * 0.5;
                    doc.Create.NewFamilyInstance(mid, door, targetWall, lvl, StructuralType.NonStructural);
                    count++;
                }

                t.Commit();
                return (true, $"Placed {count} opening(s) into model.", "");
            }
        }

        // ==========================================
        // View, Camera, & Rendering Operations
        // ==========================================

        private (bool, string, string) SetPerspectiveCamera(UIDocument uidoc, Dictionary<string, string> p)
        {
            Document doc = uidoc.Document;
            bool eyeLevel = p.ContainsKey("eye_level") && p["eye_level"].ToLower() == "true";
            double yawDeg = GetDouble(p, "yaw", 35.0);
            double distM = GetDouble(p, "distance", 22.0);
            double distFt = MetersToFeet(distM);

            View3D view3D = null;
            using (Transaction t = new Transaction(doc, "Anarchy AI: Configure 3D Camera"))
            {
                t.Start();

                // Find or create "Anarchy AI 3D Perspective"
                foreach (View3D v in new FilteredElementCollector(doc).OfClass(typeof(View3D)).Cast<View3D>())
                {
                    if (!v.IsTemplate && v.IsPerspective)
                    {
                        view3D = v;
                        break;
                    }
                }

                if (view3D == null)
                {
                    ViewFamilyType vft = new FilteredElementCollector(doc)
                        .OfClass(typeof(ViewFamilyType))
                        .Cast<ViewFamilyType>()
                        .FirstOrDefault(x => x.ViewFamily == ViewFamily.ThreeDimensional);

                    if (vft != null)
                    {
                        view3D = View3D.CreatePerspective(doc, vft.Id);
                        try { view3D.Name = "Anarchy AI 3D View"; } catch { }
                    }
                }

                if (view3D != null)
                {
                    double yawRad = yawDeg * Math.PI / 180.0;
                    double eyeZ = eyeLevel ? MetersToFeet(1.68) : MetersToFeet(6.5);
                    XYZ eye = new XYZ(Math.Cos(yawRad) * distFt, Math.Sin(yawRad) * distFt, eyeZ);
                    XYZ target = new XYZ(0, 0, MetersToFeet(1.5));
                    XYZ forward = (target - eye).Normalize();
                    XYZ up = XYZ.BasisZ;

                    ViewOrientation3D orient = new ViewOrientation3D(eye, up, forward);
                    view3D.SetOrientation(orient);
                }

                t.Commit();
            }

            if (view3D != null)
            {
                uidoc.ActiveView = view3D;
                return (true, $"Configured 3D Perspective Camera (Yaw: {yawDeg}°, Eye-Level: {eyeLevel}, Distance: {distM}m).", "");
            }

            return (false, "", "Failed to resolve or create 3D Perspective view.");
        }

        private (bool, string, string) ExportActiveView(UIDocument uidoc, Dictionary<string, string> p)
        {
            Document doc = uidoc.Document;
            View view = uidoc.ActiveView;

            string baseName = Path.Combine(Path.GetTempPath(), "anarchy_revit_view_" + Guid.NewGuid().ToString("N"));

            ImageExportOptions opts = new ImageExportOptions
            {
                ExportRange = ExportRange.SetOfViews,
                FilePath = baseName,
                HLRandWFViewsFileType = ImageFileType.PNG,
                ShadowViewsFileType = ImageFileType.PNG,
                ImageResolution = ImageResolution.DPI_150,
                PixelSize = 2048,
                ZoomType = ZoomFitType.FitToPage,
                FitDirection = FitDirectionType.Horizontal
            };
            opts.SetViewsAndSheets(new List<ElementId> { view.Id });

            doc.ExportImage(opts);

            string exportedFile = null;
            string dir = Path.GetTempPath();
            foreach (string f in Directory.GetFiles(dir, Path.GetFileName(baseName) + "*.png"))
            {
                exportedFile = f;
                break;
            }

            if (exportedFile == null || !File.Exists(exportedFile))
            {
                return (false, "", "Image export failed in Revit.");
            }

            byte[] bytes = File.ReadAllBytes(exportedFile);
            string dataUrl = "data:image/png;base64," + Convert.ToBase64String(bytes);

            string payload = "{\"type\":\"EXTERNAL_IMAGE_NODE\",\"image\":\"" + dataUrl + "\",\"source\":\"revit\"}";
            byte[] postBytes = Encoding.UTF8.GetBytes(payload);

            HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:14400/upload-view");
            req.Method = "POST";
            req.ContentType = "application/json";
            req.ContentLength = postBytes.Length;
            req.Timeout = 6000;

            string token = AnarchyApp.ReadAnarchyToken();
            if (!string.IsNullOrEmpty(token)) req.Headers.Add("X-Anarchy-Token", token);

            using (Stream s = req.GetRequestStream()) { s.Write(postBytes, 0, postBytes.Length); }
            using (var resp = (HttpWebResponse)req.GetResponse()) { }

            try { File.Delete(exportedFile); } catch { }

            // Also synchronize metadata
            ExtractBimMetadata(doc, view);

            return (true, $"Exported '{view.Name}' (2048px) and synchronized to Anarchy AI Builder Canvas.", "");
        }

        private (bool, string, string) ExtractBimMetadata(Document doc, View view)
        {
            int levelCount = new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Levels).WhereElementIsNotElementType().GetElementCount();
            int wallCount = new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Walls).WhereElementIsNotElementType().GetElementCount();
            int doorCount = new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Doors).WhereElementIsNotElementType().GetElementCount();
            int winCount = new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Windows).WhereElementIsNotElementType().GetElementCount();
            int roomCount = new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Rooms).WhereElementIsNotElementType().GetElementCount();

            // Room details
            var rooms = new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Rooms).WhereElementIsNotElementType().ToElements();
            StringBuilder roomList = new StringBuilder();
            roomList.Append("[");
            bool first = true;
            foreach (Room r in rooms)
            {
                if (r.Area > 0)
                {
                    if (!first) roomList.Append(",");
                    double areaM2 = r.Area * 0.092903;
                    roomList.Append("{\"name\":\"" + EscapeJson(r.Name) + "\",\"area_m2\":" + areaM2.ToString("F1") + "}");
                    first = false;
                }
            }
            roomList.Append("]");

            string bimMetaJson = "{" +
                "\"source\":\"revit\"," +
                "\"project_title\":\"" + EscapeJson(doc.Title) + "\"," +
                "\"active_view\":\"" + EscapeJson(view?.Name ?? "3D") + "\"," +
                "\"levels\":" + levelCount + "," +
                "\"walls\":" + wallCount + "," +
                "\"doors\":" + doorCount + "," +
                "\"windows\":" + winCount + "," +
                "\"rooms_count\":" + roomCount + "," +
                "\"rooms\":" + roomList.ToString() +
            "}";

            byte[] bimBytes = Encoding.UTF8.GetBytes(bimMetaJson);
            HttpWebRequest bimReq = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:14400/agent/bim-metadata");
            bimReq.Method = "POST";
            bimReq.ContentType = "application/json";
            bimReq.ContentLength = bimBytes.Length;
            bimReq.Timeout = 4000;

            string token = AnarchyApp.ReadAnarchyToken();
            if (!string.IsNullOrEmpty(token)) bimReq.Headers.Add("X-Anarchy-Token", token);

            try
            {
                using (Stream bs = bimReq.GetRequestStream()) { bs.Write(bimBytes, 0, bimBytes.Length); }
                using (var bResp = (HttpWebResponse)bimReq.GetResponse()) { }
            }
            catch { }

            string output = $"BIM Metadata: {levelCount} Levels, {wallCount} Walls, {roomCount} Rooms, {doorCount} Doors, {winCount} Windows in '{doc.Title}'.";
            return (true, output, "");
        }

        private (bool, string, string) ExportModel(Document doc, Dictionary<string, string> p)
        {
            string format = (p.ContainsKey("format") ? p["format"] : "dwg").ToLower();
            string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "AnarchyRevitExports");
            Directory.CreateDirectory(folder);

            string fileName = "RevitExport_" + DateTime.Now.ToString("yyyyMMdd_HHmmss");

            if (format == "ifc")
            {
                IFCExportOptions ifcOpts = new IFCExportOptions();
                doc.Export(folder, fileName + ".ifc", ifcOpts);
                string fullPath = Path.Combine(folder, fileName + ".ifc");
                return (true, "Exported IFC file to: " + fullPath, "");
            }
            else
            {
                DWGExportOptions dwgOpts = new DWGExportOptions();
                var views = new List<ElementId> { doc.ActiveView.Id };
                doc.Export(folder, fileName + ".dwg", views, dwgOpts);
                string fullPath = Path.Combine(folder, fileName + ".dwg");
                return (true, "Exported DWG file to: " + fullPath, "");
            }
        }

        // ==========================================
        // Helper Utilities
        // ==========================================

        private static Level GetOrCreateLevel(Document doc, string name, double elevFt, ref int count)
        {
            foreach (Level l in new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>())
            {
                if (l.Name.Equals(name, StringComparison.OrdinalIgnoreCase)) return l;
            }
            Level created = Level.Create(doc, elevFt);
            try { created.Name = name; } catch { }
            count++;
            return created;
        }

        private static WallType GetDefaultWallType(Document doc)
        {
            return new FilteredElementCollector(doc)
                .OfClass(typeof(WallType))
                .Cast<WallType>()
                .FirstOrDefault(wt => wt.Kind == WallKind.Basic);
        }

        private static FamilySymbol GetFirstFamilySymbol(Document doc, BuiltInCategory cat)
        {
            return new FilteredElementCollector(doc)
                .OfCategory(cat)
                .OfClass(typeof(FamilySymbol))
                .Cast<FamilySymbol>()
                .FirstOrDefault();
        }

        private static double MetersToFeet(double m) => m * 3.28083989501312;
        private static double FeetToMeters(double ft) => ft * 0.3048;

        private static double GetDouble(Dictionary<string, string> dict, string key, double def)
        {
            if (dict.ContainsKey(key) && double.TryParse(dict[key], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double val))
            {
                return val;
            }
            return def;
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }
    }

    // ==========================================
    // Ribbon Command Handlers
    // ==========================================

    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class SendViewCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                UIDocument uidoc = commandData.Application.ActiveUIDocument;
                var handler = new AnarchyAgentHandler();
                var res = handler.GetType().GetMethod("ExportActiveView", BindingFlags.NonPublic | BindingFlags.Instance)
                    ?.Invoke(handler, new object[] { uidoc, new Dictionary<string, string>() });

                TaskDialog.Show("Anarchy AI", "View successfully sent to Anarchy AI Builder Canvas!");
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Anarchy AI", "Error: " + ex.Message);
                return Result.Failed;
            }
        }
    }

    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class ExtractBimCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                UIDocument uidoc = commandData.Application.ActiveUIDocument;
                var handler = new AnarchyAgentHandler();
                handler.GetType().GetMethod("ExtractBimMetadata", BindingFlags.NonPublic | BindingFlags.Instance)
                    ?.Invoke(handler, new object[] { uidoc.Document, uidoc.ActiveView });

                TaskDialog.Show("Anarchy AI", "BIM Metadata extracted and sent to Anarchy AI Agent!");
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Anarchy AI", "Error: " + ex.Message);
                return Result.Failed;
            }
        }
    }

    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class ToggleCopilotCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            TaskDialog.Show("Anarchy AI", "Anarchy AI Live Copilot is connected and listening on background port 14400.\nYou can dispatch modeling, cameras, and BIM commands directly from the AI chat!");
            return Result.Succeeded;
        }
    }

    // ==========================================
    // Lightweight JSON Parsing Helper
    // ==========================================
    public static class SimpleJsonParser
    {
        public static RevitCommandItem ExtractCommand(string json)
        {
            var item = new RevitCommandItem();
            int cmdIdx = json.IndexOf("\"command\":");
            if (cmdIdx == -1) return null;

            string cmdSub = json.Substring(cmdIdx);

            item.Id = ExtractString(cmdSub, "id");
            item.Software = ExtractString(cmdSub, "software");
            item.Action = ExtractString(cmdSub, "action");
            item.Script = ExtractString(cmdSub, "script");

            // Extract toolName from params or script
            int paramsIdx = cmdSub.IndexOf("\"params\":");
            if (paramsIdx != -1)
            {
                string pSub = cmdSub.Substring(paramsIdx);
                item.ToolName = ExtractString(pSub, "tool_name");
                item.Params = ExtractDictionary(pSub);
            }

            if (string.IsNullOrEmpty(item.ToolName) && !string.IsNullOrEmpty(item.Script))
            {
                item.ToolName = item.Script;
            }

            return item;
        }

        private static string ExtractString(string json, string key)
        {
            string needle = "\"" + key + "\":\"";
            int idx = json.IndexOf(needle);
            if (idx == -1) return "";
            int start = idx + needle.Length;
            int end = json.IndexOf("\"", start);
            if (end == -1) return "";
            return json.Substring(start, end - start);
        }

        private static Dictionary<string, string> ExtractDictionary(string json)
        {
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            int braceStart = json.IndexOf("{");
            int braceEnd = json.IndexOf("}", braceStart == -1 ? 0 : braceStart);
            if (braceStart == -1 || braceEnd == -1) return dict;

            string block = json.Substring(braceStart + 1, braceEnd - braceStart - 1);
            string[] pairs = block.Split(',');
            foreach (string p in pairs)
            {
                string[] kv = p.Split(':');
                if (kv.Length >= 2)
                {
                    string k = kv[0].Replace("\"", "").Trim();
                    string v = kv[1].Replace("\"", "").Trim();
                    dict[k] = v;
                }
            }
            return dict;
        }
    }
}
