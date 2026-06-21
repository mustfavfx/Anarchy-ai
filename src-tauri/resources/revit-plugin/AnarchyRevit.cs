using System;
using System.IO;
using System.Net;
using System.Text;
using System.Reflection;
using System.Windows.Media.Imaging;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB;
using Autodesk.Revit.Attributes;

namespace AnarchyRevit
{
    public class AnarchyApp : IExternalApplication
    {
        public Result OnStartup(UIControlledApplication app)
        {
            try
            {
                string tabName = "Anarchy";
                try { app.CreateRibbonTab(tabName); } catch { }

                RibbonPanel panel = null;
                foreach (RibbonPanel p in app.GetRibbonPanels(tabName))
                {
                    if (p.Name == "Send") { panel = p; break; }
                }
                if (panel == null) panel = app.CreateRibbonPanel(tabName, "Send");

                string asmPath = Assembly.GetExecutingAssembly().Location;
                string asmDir = Path.GetDirectoryName(asmPath);
                string iconPath = Path.Combine(asmDir, "AnarchyLogo_32.png");

                PushButtonData btnData = new PushButtonData(
                    "AnarchySendView",
                    "Send to\nAnarchy",
                    asmPath,
                    "AnarchyRevit.SendViewCommand");
                btnData.ToolTip = "Send current Revit view to Anarchy AI Builder";

                if (File.Exists(iconPath))
                {
                    var img = new BitmapImage(new Uri(iconPath));
                    btnData.LargeImage = img;
                    btnData.Image = img;
                }

                panel.AddItem(btnData);
            }
            catch (Exception) { }
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication app)
        {
            return Result.Succeeded;
        }
    }

    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class SendViewCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                UIDocument uidoc = commandData.Application.ActiveUIDocument;
                Document doc = uidoc.Document;
                View view = doc.ActiveView;

                string tempPath = Path.Combine(Path.GetTempPath(), "anarchy_revit_view.png");
                if (File.Exists(tempPath))
                {
                    try { File.Delete(tempPath); } catch { }
                }

                string baseName = Path.Combine(Path.GetTempPath(), "anarchy_revit_view");

                ImageExportOptions opts = new ImageExportOptions();
                opts.ExportRange = ExportRange.SetOfViews;
                opts.SetViewsAndSheets(new System.Collections.Generic.List<ElementId> { view.Id });
                opts.FilePath = baseName;
                opts.HLRandWFViewsFileType = ImageFileType.PNG;
                opts.ShadowViewsFileType = ImageFileType.PNG;
                opts.ImageResolution = ImageResolution.DPI_150;
                opts.PixelSize = 1600;
                opts.ZoomType = ZoomFitType.FitToPage;
                opts.FitDirection = FitDirectionType.Horizontal;

                doc.ExportImage(opts);

                string found = null;
                string dir = Path.GetTempPath();
                foreach (string f in Directory.GetFiles(dir, "anarchy_revit_view*.png"))
                {
                    found = f;
                    break;
                }
                if (found == null)
                {
                    TaskDialog.Show("Anarchy", "Failed to export view image.");
                    return Result.Failed;
                }

                byte[] bytes = File.ReadAllBytes(found);
                string b64 = Convert.ToBase64String(bytes);
                string dataUrl = "data:image/png;base64," + b64;

                string json = "{\"type\":\"EXTERNAL_IMAGE_NODE\",\"image\":\"" + dataUrl + "\",\"source\":\"revit\"}";
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

                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://localhost:14400/upload-view");
                req.Method = "POST";
                req.ContentType = "application/json";
                req.ContentLength = payload.Length;
                req.Timeout = 5000;
                if (!string.IsNullOrEmpty(token))
                {
                    req.Headers.Add("X-Anarchy-Token", token);
                }
                using (Stream s = req.GetRequestStream()) { s.Write(payload, 0, payload.Length); }
                using (var resp = (HttpWebResponse)req.GetResponse()) { }

                try { File.Delete(found); } catch { }
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Anarchy", "Failed to send view: " + ex.Message);
                return Result.Failed;
            }
        }
    }
}
