using System;
using System.IO;
using System.Net;
using System.Text;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Input;
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.EditorInput;
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
                {
                    ComponentManager.ItemInitialized += OnComponentInit;
                }
                else
                {
                    AddRibbonTab();
                }
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
            {
                if (t.Id == "ANARCHY_TAB") return;
            }

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
        [CommandMethod("ANARCHYSEND")]
        public void SendToAnarchy()
        {
            var doc = Application.DocumentManager.MdiActiveDocument;
            if (doc == null) return;
            var ed = doc.Editor;
            try
            {
                string tempPath = Path.Combine(Path.GetTempPath(), "anarchy_view.bmp");
                string tempPng  = Path.Combine(Path.GetTempPath(), "anarchy_autocad_view.png");
                if (File.Exists(tempPath)) File.Delete(tempPath);
                if (File.Exists(tempPng))  File.Delete(tempPng);

                doc.SendStringToExecute(
                    "_SAVEIMG\n" + tempPath + "\nBMP\n\n",
                    true, false, false);

                int waited = 0;
                while (!File.Exists(tempPath) && waited < 50)
                {
                    System.Threading.Thread.Sleep(100);
                    waited++;
                }

                if (!File.Exists(tempPath))
                {
                    ed.WriteMessage("\nAnarchy: SAVEIMG did not produce a file.");
                    return;
                }

                using (var bmp = new Bitmap(tempPath))
                    bmp.Save(tempPng, ImageFormat.Png);
                try { File.Delete(tempPath); } catch { }

                byte[] bytes = File.ReadAllBytes(tempPng);
                string b64 = Convert.ToBase64String(bytes);
                string json = "{\"type\":\"EXTERNAL_IMAGE_NODE\",\"image\":\"data:image/png;base64," + b64 + "\"}";
                byte[] payload = Encoding.UTF8.GetBytes(json);

                var req = (HttpWebRequest)WebRequest.Create("http://localhost:14400/upload-view");
                req.Method = "POST";
                req.ContentType = "application/json";
                req.ContentLength = payload.Length;
                req.Timeout = 10000;
                using (var s = req.GetRequestStream()) { s.Write(payload, 0, payload.Length); }
                using (var resp = (HttpWebResponse)req.GetResponse()) { }

                try { File.Delete(tempPng); } catch { }
                ed.WriteMessage("\nAnarchy: View sent to Builder.");
            }
            catch (Exception ex)
            {
                ed.WriteMessage("\nAnarchy error: " + ex.Message);
            }
        }
    }
}
