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
                ed.WriteMessage("\nAnarchy: Pick first corner (or Enter for full extents):");
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
                    minPt = new Point3d(Math.Min(res1.Value.X, res2.Value.X), Math.Min(res1.Value.Y, res2.Value.Y), 0);
                    maxPt = new Point3d(Math.Max(res1.Value.X, res2.Value.X), Math.Max(res1.Value.Y, res2.Value.Y), 0);
                    useWindow = true;
                }
                else
                {
                    Extents3d ext = GetDrawingExtents(db);
                    minPt = new Point3d(ext.MinPoint.X, ext.MinPoint.Y, 0);
                    maxPt = new Point3d(ext.MaxPoint.X, ext.MaxPoint.Y, 0);
                    useWindow = (minPt.X < maxPt.X && minPt.Y < maxPt.Y);
                }

                string tempPng = Path.Combine(Path.GetTempPath(), "anarchy_export.png");

                ed.WriteMessage("\nAnarchy: Exporting via PlotEngine...");
                string plotErr = "";
                bool plotOk = PlotToFile(doc, db, minPt, maxPt, useWindow, tempPng, out plotErr);

                if (!plotOk || !File.Exists(tempPng)) { ed.WriteMessage("\nAnarchy: Export failed: " + plotErr); return; }

                byte[] bytes = CompressImage(tempPng, 4096, 90L);
                string b64 = Convert.ToBase64String(bytes);
                string json = "{\"type\":\"EXTERNAL_IMAGE_NODE\",\"image\":\"data:image/jpeg;base64," + b64 + "\",\"source\":\"autocad\"}";
                byte[] payload = Encoding.UTF8.GetBytes(json);

                string token = "";
                try
                {
                    string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                    string tokenFile = Path.Combine(appData, "com.anarchyai.app", ".token");
                    if (File.Exists(tokenFile))
                    {
                        token = File.ReadAllText(tokenFile).Trim();
                    }
                }
                catch { }

                var req = (HttpWebRequest)WebRequest.Create("http://localhost:14400/upload-view");
                req.Method = "POST"; req.ContentType = "application/json";
                req.ContentLength = payload.Length; req.Timeout = 15000;
                if (!string.IsNullOrEmpty(token))
                {
                    req.Headers.Add("X-Anarchy-Token", token);
                }
                using (var s = req.GetRequestStream()) { s.Write(payload, 0, payload.Length); }
                using (var resp = (HttpWebResponse)req.GetResponse()) { }

                try { File.Delete(tempPng); } catch { }
                ed.WriteMessage("\nAnarchy: Drawing sent to Builder successfully.");
            }
            catch (Exception ex)
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

                ObjectId layoutId = LayoutManager.Current.GetLayoutId("Model");
                if (layoutId.IsNull)
                    layoutId = LayoutManager.Current.GetLayoutId(LayoutManager.Current.CurrentLayout);

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

                var ps = new PlotSettings(true);
                psv.SetPlotConfigurationName(ps, pngDevice, null);

                var media = psv.GetCanonicalMediaNameList(ps);
                string chosen = null; int chosenPx = 0;
                foreach (string m in media)
                {
                    int px = 0;
                    var parts = m.Split('x', 'X');
                    if (parts.Length >= 2) int.TryParse(parts[0].Trim(), out px);
                    if (px == 0) { string ml = m.ToLower();
                        if (ml.Contains("4961") || ml.Contains("3508") || ml.Contains("2480")) px = 4961;
                        else if (ml.Contains("a1")) px = 3000; else if (ml.Contains("a2")) px = 2000;
                        else if (ml.Contains("a3")) px = 1500; else if (ml.Contains("a4")) px = 1000; }
                    if (px > chosenPx) { chosenPx = px; chosen = m; }
                    if (chosen == null) chosen = m;
                }
                if (chosen != null) psv.SetCanonicalMediaName(ps, chosen);

                System.Globalization.CultureInfo inv = System.Globalization.CultureInfo.InvariantCulture;
                if (useWindow)
                {
                    string p1 = minPt.X.ToString("F6", inv) + "," + minPt.Y.ToString("F6", inv);
                    string p2 = maxPt.X.ToString("F6", inv) + "," + maxPt.Y.ToString("F6", inv);
                    ed.Command("_ZOOM", "W", p1, p2);
                }
                else
                    ed.Command("_ZOOM", "E");
                psv.SetPlotType(ps, Autodesk.AutoCAD.DatabaseServices.PlotType.Display);

                psv.SetPlotCentered(ps, true);
                psv.SetPlotRotation(ps, PlotRotation.Degrees000);
                psv.SetUseStandardScale(ps, true);
                psv.SetStdScaleType(ps, StdScaleType.ScaleToFit);

                var pi = new PlotInfo();
                pi.Layout = layoutId;
                pi.OverrideSettings = ps;
                try { var piv = new PlotInfoValidator(); piv.MediaMatchingPolicy = MatchingPolicy.MatchEnabledCustom; piv.Validate(pi); } catch { }

                using (var pe = PlotFactory.CreatePublishEngine())
                {
                    var prog = new PlotProgressDialog(false, 1, true);
                    prog.set_PlotMsgString(PlotMessageIndex.DialogTitle, "Anarchy Export");
                    prog.set_PlotMsgString(PlotMessageIndex.CancelJobButtonMessage, "Cancel");
                    prog.set_PlotMsgString(PlotMessageIndex.CancelSheetButtonMessage, "Cancel");
                    prog.set_PlotMsgString(PlotMessageIndex.SheetSetProgressCaption, "Exporting...");
                    prog.set_PlotMsgString(PlotMessageIndex.SheetProgressCaption, "Exporting...");
                    prog.LowerPlotProgressRange = 0; prog.UpperPlotProgressRange = 100;
                    prog.PlotProgressPos = 0; prog.IsVisible = false;
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
                if (File.Exists(outPng)) return true;
                string[] candidates = Directory.GetFiles(outDir, outBase + "*");
                if (candidates.Length > 0)
                {
                    string found = candidates[0];
                    if (!found.Equals(outPng, StringComparison.OrdinalIgnoreCase))
                    {
                        using (var bmp = new Bitmap(found)) bmp.Save(outPng, ImageFormat.Png);
                        try { File.Delete(found); } catch { }
                    }
                    return File.Exists(outPng);
                }
                var allFiles = Directory.GetFiles(outDir, "*.png");
                if (allFiles.Length > 0)
                {
                    System.Array.Sort(allFiles, (a, b) => File.GetLastWriteTime(b).CompareTo(File.GetLastWriteTime(a)));
                    string newest = allFiles[0];
                    if ((System.DateTime.Now - File.GetLastWriteTime(newest)).TotalSeconds < 30)
                    {
                        File.Copy(newest, outPng, true);
                        return File.Exists(outPng);
                    }
                }
                errMsg = "No output file in " + outDir;
                return false;
            }
            catch (Exception ex) { errMsg = ex.GetType().Name + ": " + ex.Message; return false; }
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
        [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
        [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumChildProc cb, IntPtr lp);
        [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT pt);
        [DllImport("user32.dll")] static extern int GetSystemMetrics(int nIndex);
        delegate bool EnumChildProc(IntPtr hwnd, IntPtr lp);
        [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }

        private System.Drawing.Rectangle GetDocViewportScreenRect(Document doc)
        {
            try
            {
                IntPtr docHwnd = doc.Window.Handle;
                RECT docR; GetWindowRect(docHwnd, out docR);
                IntPtr bestHwnd = IntPtr.Zero; int bestArea = 0;
                EnumChildWindows(docHwnd, (child, lp) => {
                    RECT cr; GetWindowRect(child, out cr);
                    int cw = cr.Right - cr.Left; int ch = cr.Bottom - cr.Top; int area = cw * ch;
                    if (area > bestArea && cw > 50 && ch > 50
                        && cr.Left >= docR.Left && cr.Top >= docR.Top
                        && cr.Right <= docR.Right + 5 && cr.Bottom <= docR.Bottom + 5)
                    { bestArea = area; bestHwnd = child; }
                    return true;
                }, IntPtr.Zero);
                RECT useR; GetWindowRect(bestHwnd != IntPtr.Zero ? bestHwnd : docHwnd, out useR);
                int w = useR.Right - useR.Left; int h = useR.Bottom - useR.Top;
                if (w > 50 && h > 50) return new System.Drawing.Rectangle(useR.Left, useR.Top, w, h);
            }
            catch { }
            return new System.Drawing.Rectangle(0, 0, GetSystemMetrics(0), GetSystemMetrics(1));
        }

        private Bitmap CaptureAcadWindow()
        {
            IntPtr hwnd = System.Diagnostics.Process.GetCurrentProcess().MainWindowHandle;
            if (hwnd == IntPtr.Zero) return null;
            RECT r; GetWindowRect(hwnd, out r);
            int w = r.Right - r.Left; int h = r.Bottom - r.Top;
            if (w < 10 || h < 10) return null;
            var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                IntPtr hdc = g.GetHdc();
                bool ok = PrintWindow(hwnd, hdc, 0x00000002);
                g.ReleaseHdc(hdc);
                if (!ok) g.CopyFromScreen(r.Left, r.Top, 0, 0, new System.Drawing.Size(w, h), CopyPixelOperation.SourceCopy);
            }
            return bmp;
        }
    }
}
