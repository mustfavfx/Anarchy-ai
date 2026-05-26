using System;
using System.IO;
using System.Net;
using System.Text;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Input;
using System.Runtime.InteropServices;
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.PlottingServices;
using Autodesk.Windows;

[assembly: ExtensionApplication(typeof(AnarchyAutoCad.AnarchyApp))]
[assembly: CommandClass(typeof(AnarchyAutoCad.AnarchyCommands))]

namespace AnarchyAutoCad
{
    public class AnarchyApp : IExtensionApplication
    {
        public void Initialize()
        {
            try
            {
                if (ComponentManager.Ribbon == null)
                    ComponentManager.ItemInitialized += OnComponentInit;
                else
                    AddRibbonTab();
            }
            catch { }
        }

        private void OnComponentInit(object sender, RibbonItemEventArgs e)
        {
            if (ComponentManager.Ribbon != null)
            {
                ComponentManager.ItemInitialized -= OnComponentInit;
                AddRibbonTab();
            }
        }

        private void AddRibbonTab()
        {
            var rc = ComponentManager.Ribbon;
            if (rc == null) return;
            foreach (RibbonTab t in rc.Tabs)
                if (t.Id == "ANARCHY_TAB") return;

            var tab = new RibbonTab();
            tab.Title = "Anarchy";
            tab.Id = "ANARCHY_TAB";

            var panelSrc = new RibbonPanelSource();
            panelSrc.Title = "Send";

            var btn = new RibbonButton();
            btn.Text = "Send to\nAnarchy";
            btn.ShowText = true;
            btn.ShowImage = true;
            btn.Size = RibbonItemSize.Large;
            btn.Orientation = System.Windows.Controls.Orientation.Vertical;
            btn.CommandHandler = new CmdHandler();
            btn.CommandParameter = "ANARCHYSEND ";

            try
            {
                string asmDir = Path.GetDirectoryName(typeof(AnarchyApp).Assembly.Location);
                string iconPath = Path.Combine(asmDir, "AnarchyLogo_32.png");
                if (File.Exists(iconPath))
                {
                    var img = new System.Windows.Media.Imaging.BitmapImage(new Uri(iconPath));
                    btn.LargeImage = img;
                    btn.Image = img;
                }
            }
            catch { }

            panelSrc.Items.Add(btn);
            var panel = new RibbonPanel();
            panel.Source = panelSrc;
            tab.Panels.Add(panel);
            rc.Tabs.Add(tab);
        }

        public void Terminate() { }
    }

    public class CmdHandler : ICommand
    {
        public event EventHandler CanExecuteChanged;
        public bool CanExecute(object p) { return true; }
        public void Execute(object p)
        {
            string s = p as string;
            if (s == null) return;
            var doc = Application.DocumentManager.MdiActiveDocument;
            if (doc != null) doc.SendStringToExecute(s, true, false, true);
        }
    }

    public class AnarchyCommands
    {
        [CommandMethod("ANARCHYSEND", CommandFlags.Modal)]
        public void SendToAnarchy()
        {
            var doc = Application.DocumentManager.MdiActiveDocument;
            if (doc == null) return;
            var ed = doc.Editor;
            var db = doc.Database;

            try
            {
                ed.WriteMessage("\nAnarchy: Pick first corner of area to send (or press Enter for full extents):");

                var opt1 = new PromptPointOptions("\nFirst corner: ");
                opt1.AllowNone = true;
                var res1 = ed.GetPoint(opt1);

                Point3d minPt, maxPt;
                bool useWindow = false;

                if (res1.Status == PromptStatus.OK)
                {
                    var opt2 = new PromptCornerOptions("\nOpposite corner: ", res1.Value);
                    var res2 = ed.GetCorner(opt2);
                    if (res2.Status != PromptStatus.OK) return;

                    minPt = new Point3d(
                        Math.Min(res1.Value.X, res2.Value.X),
                        Math.Min(res1.Value.Y, res2.Value.Y), 0);
                    maxPt = new Point3d(
                        Math.Max(res1.Value.X, res2.Value.X),
                        Math.Max(res1.Value.Y, res2.Value.Y), 0);
                    useWindow = true;
                }
                else
                {
                    // Enter pressed - use full extents
                    Extents3d ext = GetDrawingExtents(db);
                    minPt = new Point3d(ext.MinPoint.X, ext.MinPoint.Y, 0);
                    maxPt = new Point3d(ext.MaxPoint.X, ext.MaxPoint.Y, 0);
                    useWindow = (minPt.X < maxPt.X && minPt.Y < maxPt.Y);
                }

                string tempPng = Path.Combine(Path.GetTempPath(), "anarchy_export.png");

                ed.WriteMessage("\nAnarchy: Exporting via PlotEngine...");
                ed.WriteMessage("\nAnarchy: useWindow=" + useWindow + " min=(" + minPt.X.ToString("F2") + "," + minPt.Y.ToString("F2") + ") max=(" + maxPt.X.ToString("F2") + "," + maxPt.Y.ToString("F2") + ")");
                string plotErr = "";
                bool plotOk = PlotToFile(doc, db, minPt, maxPt, useWindow, tempPng, out plotErr);

                if (!plotOk || !File.Exists(tempPng))
                {
                    ed.WriteMessage("\nAnarchy: Export failed: " + plotErr);
                    return;
                }

                byte[] bytes = CompressImage(tempPng, 4096, 90L);
                string b64 = Convert.ToBase64String(bytes);
                string json = "{\"type\":\"EXTERNAL_IMAGE_NODE\",\"image\":\"data:image/jpeg;base64," + b64 + "\",\"source\":\"autocad\"}";
                byte[] payload = Encoding.UTF8.GetBytes(json);

                var req = (HttpWebRequest)WebRequest.Create("http://localhost:14400/upload-view");
                req.Method = "POST";
                req.ContentType = "application/json";
                req.ContentLength = payload.Length;
                req.Timeout = 15000;
                using (var s = req.GetRequestStream()) { s.Write(payload, 0, payload.Length); }
                using (var resp = (HttpWebResponse)req.GetResponse()) { }

                try { File.Delete(tempPng); } catch { }
                ed.WriteMessage("\nAnarchy: Drawing sent to Builder successfully.");
            }
            catch (System.Exception ex)
            {
                ed.WriteMessage("\nAnarchy error: " + ex.GetType().Name + ": " + ex.Message);
            }
        }

        private bool PlotToFile(Document doc, Database db, Point3d minPt, Point3d maxPt, bool useWindow, string outPng, out string errMsg)
        {
            errMsg = "";
            var ed = doc.Editor;
            try
            {
                try { if (File.Exists(outPng)) File.Delete(outPng); } catch { }

                string outDir = Path.GetDirectoryName(outPng);
                string outBase = Path.GetFileNameWithoutExtension(outPng);

                // Get model space layout
                ObjectId layoutId = LayoutManager.Current.GetLayoutId("Model");
                if (layoutId.IsNull)
                    layoutId = LayoutManager.Current.GetLayoutId(LayoutManager.Current.CurrentLayout);

                // Find PNG plotter device
                var psv = PlotSettingsValidator.Current;
                var devices = psv.GetPlotDeviceList();
                string pngDevice = null;
                foreach (string d in devices)
                    if (d.ToLower().Contains("png")) { pngDevice = d; break; }
                if (pngDevice == null)
                    foreach (string d in devices)
                        if (d.ToLower().Contains("tif") || d.ToLower().Contains("bmp"))
                        { pngDevice = d; break; }
                if (pngDevice == null)
                {
                    var dl = new System.Collections.Generic.List<string>();
                    foreach (string d in devices) dl.Add(d);
                    errMsg = "No raster device. Available: " + string.Join(", ", dl.GetRange(0, Math.Min(5, dl.Count)));
                    return false;
                }

                // Build PlotSettings from scratch (no CopyFrom)
                var ps = new PlotSettings(true);
                psv.SetPlotConfigurationName(ps, pngDevice, null);

                // Get all media and pick largest one
                var media = psv.GetCanonicalMediaNameList(ps);
                string chosen = null;
                int chosenPx = 0;
                foreach (string m in media)
                {
                    // Try to parse pixel size from name like "4961x7016"
                    int px = 0;
                    var parts = m.Split('x', 'X');
                    if (parts.Length >= 2) { int.TryParse(parts[0].Trim(), out px); }
                    if (px == 0)
                    {
                        // fallback: prefer names with large numbers
                        string ml = m.ToLower();
                        if (ml.Contains("4961") || ml.Contains("3508") || ml.Contains("2480")) px = 4961;
                        else if (ml.Contains("a1")) px = 3000;
                        else if (ml.Contains("a2")) px = 2000;
                        else if (ml.Contains("a3")) px = 1500;
                        else if (ml.Contains("a4")) px = 1000;
                    }
                    if (px > chosenPx) { chosenPx = px; chosen = m; }
                    if (chosen == null) chosen = m; // at minimum take first
                }
                ed.WriteMessage("\nAnarchy: device=" + pngDevice + " media=" + (chosen ?? "none"));
                if (chosen != null) psv.SetCanonicalMediaName(ps, chosen);

                // Zoom to selection first, then use Display type (works with all PNG devices)
                System.Globalization.CultureInfo inv = System.Globalization.CultureInfo.InvariantCulture;
                if (useWindow)
                {
                    string p1 = minPt.X.ToString("F6", inv) + "," + minPt.Y.ToString("F6", inv);
                    string p2 = maxPt.X.ToString("F6", inv) + "," + maxPt.Y.ToString("F6", inv);
                    ed.Command("_ZOOM", "W", p1, p2);
                }
                else
                {
                    ed.Command("_ZOOM", "E");
                }
                // PlotType.Display exports exactly what's visible in viewport - works with all raster devices
                psv.SetPlotType(ps, Autodesk.AutoCAD.DatabaseServices.PlotType.Display);

                psv.SetPlotCentered(ps, true);
                psv.SetPlotRotation(ps, PlotRotation.Degrees000);
                psv.SetUseStandardScale(ps, true);
                psv.SetStdScaleType(ps, StdScaleType.ScaleToFit);

                var pi = new PlotInfo();
                pi.Layout = layoutId;
                pi.OverrideSettings = ps;
                try
                {
                    var piv = new PlotInfoValidator();
                    piv.MediaMatchingPolicy = MatchingPolicy.MatchEnabledCustom;
                    piv.Validate(pi);
                }
                catch { } // Validate may throw but plot can still succeed

                ed.WriteMessage("\nAnarchy: Starting plot engine...");
                using (var pe = PlotFactory.CreatePublishEngine())
                {
                    var prog = new PlotProgressDialog(false, 1, true);
                    prog.set_PlotMsgString(PlotMessageIndex.DialogTitle, "Anarchy Export");
                    prog.set_PlotMsgString(PlotMessageIndex.CancelJobButtonMessage, "Cancel");
                    prog.set_PlotMsgString(PlotMessageIndex.CancelSheetButtonMessage, "Cancel");
                    prog.set_PlotMsgString(PlotMessageIndex.SheetSetProgressCaption, "Exporting...");
                    prog.set_PlotMsgString(PlotMessageIndex.SheetProgressCaption, "Exporting...");
                    prog.LowerPlotProgressRange = 0;
                    prog.UpperPlotProgressRange = 100;
                    prog.PlotProgressPos = 0;
                    prog.IsVisible = false;
                    pe.BeginPlot(prog, null);
                    pe.BeginDocument(pi, doc.Name, null, 1, true, Path.Combine(outDir, outBase));
                    var ppi = new PlotPageInfo();
                    pe.BeginPage(ppi, pi, true, null);
                    pe.BeginGenerateGraphics(null);
                    pe.EndGenerateGraphics(null);
                    pe.EndPage(null);
                    pe.EndDocument(null);
                    pe.EndPlot(null);
                }

                System.Threading.Thread.Sleep(1500);

                if (File.Exists(outPng)) { ed.WriteMessage("\nAnarchy: File created: " + outPng); return true; }

                // Search broadly - plotter may name file differently
                string[] candidates = Directory.GetFiles(outDir, outBase + "*");
                ed.WriteMessage("\nAnarchy: Candidates=" + candidates.Length + " base=" + outBase);
                if (candidates.Length > 0)
                {
                    string found = candidates[0];
                    ed.WriteMessage("\nAnarchy: Found: " + found);
                    if (!found.Equals(outPng, StringComparison.OrdinalIgnoreCase))
                    {
                        using (var bmp = new Bitmap(found)) bmp.Save(outPng, ImageFormat.Png);
                        try { File.Delete(found); } catch { }
                    }
                    return File.Exists(outPng);
                }

                // Search any recently created PNG (plotter may use different naming)
                var allFiles = Directory.GetFiles(outDir, "*.png");
                if (allFiles.Length > 0)
                {
                    System.Array.Sort(allFiles, (a, b) => File.GetLastWriteTime(b).CompareTo(File.GetLastWriteTime(a)));
                    string newest = allFiles[0];
                    if ((System.DateTime.Now - File.GetLastWriteTime(newest)).TotalSeconds < 30)
                    {
                        ed.WriteMessage("\nAnarchy: Using recent PNG: " + newest);
                        File.Copy(newest, outPng, true);
                        return File.Exists(outPng);
                    }
                    ed.WriteMessage("\nAnarchy: Newest PNG too old: " + newest);
                }
                errMsg = "No output file found in " + outDir + " (searched: " + outBase + "*)";
                return false;
            }
            catch (System.Exception ex) { errMsg = ex.GetType().Name + ": " + ex.Message; return false; }
        }

        private Extents3d GetDrawingExtents(Database db)
        {
            try
            {
                db.UpdateExt(true);
                if (db.Extmin.X < db.Extmax.X && db.Extmin.Y < db.Extmax.Y)
                    return new Extents3d(db.Extmin, db.Extmax);
            }
            catch { }
            return new Extents3d(new Point3d(0, 0, 0), new Point3d(0, 0, 0));
        }

        private byte[] CompressImage(string pngPath, int maxDimension, long jpegQuality)
        {
            try
            {
                using (var src = new Bitmap(pngPath))
                {
                    int w = src.Width, h = src.Height;
                    if (w > maxDimension || h > maxDimension)
                    {
                        double scale = Math.Min((double)maxDimension / w, (double)maxDimension / h);
                        w = (int)(w * scale);
                        h = (int)(h * scale);
                    }

                    using (var resized = new Bitmap(src, new System.Drawing.Size(w, h)))
                    using (var ms = new MemoryStream())
                    {
                        var jpegEncoder = GetJpegEncoder();
                        if (jpegEncoder != null)
                        {
                            var encoderParams = new System.Drawing.Imaging.EncoderParameters(1);
                            encoderParams.Param[0] = new System.Drawing.Imaging.EncoderParameter(
                                System.Drawing.Imaging.Encoder.Quality, jpegQuality);
                            resized.Save(ms, jpegEncoder, encoderParams);
                        }
                        else
                        {
                            resized.Save(ms, ImageFormat.Png);
                        }
                        return ms.ToArray();
                    }
                }
            }
            catch
            {
                return File.ReadAllBytes(pngPath);
            }
        }

        private System.Drawing.Imaging.ImageCodecInfo GetJpegEncoder()
        {
            foreach (var codec in System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders())
                if (codec.FormatID == ImageFormat.Jpeg.Guid) return codec;
            return null;
        }

        [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
        [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
        [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
        [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumChildProc cb, IntPtr lp);
        [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT pt);
        [DllImport("user32.dll")] static extern int GetSystemMetrics(int nIndex);
        delegate bool EnumChildProc(IntPtr hwnd, IntPtr lp);
        [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }

        // Get viewport screen rect using AutoCAD doc.Window + Win32
        private System.Drawing.Rectangle GetDocViewportScreenRect(Document doc)
        {
            try
            {
                // doc.Window.Handle is the MDI child window
                IntPtr docHwnd = doc.Window.Handle;

                // Walk up to find the MDI client area, then find our doc window's screen pos
                // Use GetWindowRect on the doc window itself first
                RECT docR; GetWindowRect(docHwnd, out docR);

                // The actual drawing canvas is the largest grandchild
                // Search 2 levels deep for a large enough viewport child
                IntPtr bestHwnd = IntPtr.Zero; int bestArea = 0;
                EnumChildWindows(docHwnd, (child, lp) =>
                {
                    RECT cr; GetWindowRect(child, out cr);
                    int cw = cr.Right - cr.Left; int ch = cr.Bottom - cr.Top;
                    int area = cw * ch;
                    // Must be within bounds of doc window and reasonably large
                    if (area > bestArea && cw > 50 && ch > 50
                        && cr.Left >= docR.Left && cr.Top >= docR.Top
                        && cr.Right <= docR.Right + 5 && cr.Bottom <= docR.Bottom + 5)
                    { bestArea = area; bestHwnd = child; }
                    return true;
                }, IntPtr.Zero);

                RECT useR = bestHwnd != IntPtr.Zero ? (GetRect(bestHwnd)) : docR;
                int w = useR.Right - useR.Left; int h = useR.Bottom - useR.Top;
                if (w > 50 && h > 50)
                    return new System.Drawing.Rectangle(useR.Left, useR.Top, w, h);
            }
            catch { }
            return GetViewportScreenRect(); // fallback
        }

        private RECT GetRect(IntPtr hwnd)
        {
            RECT r; GetWindowRect(hwnd, out r); return r;
        }

        // Returns the SCREEN rectangle (absolute) of the AutoCAD drawing viewport
        private System.Drawing.Rectangle GetViewportScreenRect()
        {
            try
            {
                IntPtr mainHwnd = System.Diagnostics.Process.GetCurrentProcess().MainWindowHandle;
                RECT mainR; GetWindowRect(mainHwnd, out mainR);
                int mainW = mainR.Right - mainR.Left;
                int mainH = mainR.Bottom - mainR.Top;

                // Sample the center of the screen - should hit the drawing viewport
                int testX = mainR.Left + mainW / 2;
                int testY = mainR.Top + mainH / 2;
                IntPtr vpHwnd = WindowFromPoint(new POINT { X = testX, Y = testY });

                if (vpHwnd != IntPtr.Zero && vpHwnd != mainHwnd)
                {
                    RECT vr; GetWindowRect(vpHwnd, out vr);
                    int vw = vr.Right - vr.Left;
                    int vh = vr.Bottom - vr.Top;
                    // Must be a reasonably large window (not a button/toolbar)
                    if (vw > 200 && vh > 200)
                        return new System.Drawing.Rectangle(vr.Left, vr.Top, vw, vh);
                }

                // Fallback: find largest child of main window
                IntPtr bestHwnd = IntPtr.Zero; int bestArea = 0;
                EnumChildWindows(mainHwnd, (child, lp) =>
                {
                    RECT cr; GetWindowRect(child, out cr);
                    int area = (cr.Right - cr.Left) * (cr.Bottom - cr.Top);
                    if (area > bestArea && area < mainW * mainH) // not the main window itself
                    { bestArea = area; bestHwnd = child; }
                    return true;
                }, IntPtr.Zero);

                if (bestHwnd != IntPtr.Zero)
                {
                    RECT br; GetWindowRect(bestHwnd, out br);
                    return new System.Drawing.Rectangle(br.Left, br.Top, br.Right - br.Left, br.Bottom - br.Top);
                }
            }
            catch { }

            // Ultimate fallback: primary screen via Win32
            return new System.Drawing.Rectangle(0, 0, GetSystemMetrics(0), GetSystemMetrics(1));
        }

        private Bitmap CaptureAcadWindow()
        {
            // Capture the entire AutoCAD main window using PrintWindow
            IntPtr hwnd = System.Diagnostics.Process.GetCurrentProcess().MainWindowHandle;
            if (hwnd == IntPtr.Zero) return null;

            RECT r;
            GetWindowRect(hwnd, out r);
            int w = r.Right - r.Left;
            int h = r.Bottom - r.Top;
            if (w < 10 || h < 10) return null;

            var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                // Try PrintWindow first (works even if partially obscured)
                IntPtr hdc = g.GetHdc();
                bool ok = PrintWindow(hwnd, hdc, 0x00000002); // PW_RENDERFULLCONTENT
                g.ReleaseHdc(hdc);
                if (!ok)
                {
                    // Fallback: direct screen copy
                    g.CopyFromScreen(r.Left, r.Top, 0, 0, new System.Drawing.Size(w, h), CopyPixelOperation.SourceCopy);
                }
            }
            return bmp;
        }
    }
}
