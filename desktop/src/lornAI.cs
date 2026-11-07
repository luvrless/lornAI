using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using Microsoft.Win32;

namespace LornAI.Desktop
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // Enable modern browser emulation (IE11/Edge) for the WebBrowser control
            try
            {
                string appName = Path.GetFileName(Application.ExecutablePath);
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION"))
                {
                    if (key != null) key.SetValue(appName, 11001, RegistryValueKind.DWord);
                }
            }
            catch { }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public class MainForm : Form
    {
        private HttpListener _listener;
        private Thread _serverThread;
        private WebBrowser _browser;
        private int _port = 4178;
        private string _appDir;

        public MainForm()
        {
            this.Text = "lornAI — by Frail";
            this.Width = 1260;
            this.Height = 840;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(20, 19, 18);
            this.ForeColor = Color.FromArgb(245, 240, 235);

            // Determine app directory
            _appDir = AppDomain.CurrentDomain.BaseDirectory;
            if (!File.Exists(Path.Combine(_appDir, "index.html")))
            {
                string localApp = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\lornAI");
                if (File.Exists(Path.Combine(localApp, "index.html")))
                {
                    _appDir = localApp;
                }
            }

            StartLocalServer();

            _browser = new WebBrowser();
            _browser.Dock = DockStyle.Fill;
            _browser.ScriptErrorsSuppressed = true;
            _browser.IsWebBrowserContextMenuEnabled = false;
            this.Controls.Add(_browser);

            _browser.Navigate(string.Format("http://127.0.0.1:{0}/", _port));
        }

        private void StartLocalServer()
        {
            int attempts = 0;
            while (attempts < 10)
            {
                try
                {
                    _listener = new HttpListener();
                    _listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", _port));
                    _listener.Start();
                    break;
                }
                catch
                {
                    _port++;
                    attempts++;
                }
            }

            _serverThread = new Thread(ServerWorker);
            _serverThread.IsBackground = true;
            _serverThread.Start();
        }

        private void ServerWorker()
        {
            while (_listener != null && _listener.IsListening)
            {
                try
                {
                    HttpListenerContext ctx = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem((state) => HandleRequest(ctx));
                }
                catch
                {
                    break;
                }
            }
        }

        private void HandleRequest(HttpListenerContext ctx)
        {
            try
            {
                string rawUrl = ctx.Request.Url.AbsolutePath.TrimStart('/');
                if (string.IsNullOrEmpty(rawUrl)) rawUrl = "index.html";

                string filePath = Path.Combine(_appDir, rawUrl.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(filePath))
                {
                    byte[] data = File.ReadAllBytes(filePath);
                    string ext = Path.GetExtension(filePath).ToLower();
                    string mime = "application/octet-stream";
                    if (ext == ".html" || ext == ".htm") mime = "text/html; charset=utf-8";
                    else if (ext == ".css") mime = "text/css; charset=utf-8";
                    else if (ext == ".js") mime = "application/javascript; charset=utf-8";
                    else if (ext == ".json") mime = "application/json; charset=utf-8";
                    else if (ext == ".svg") mime = "image/svg+xml";
                    else if (ext == ".png") mime = "image/png";

                    ctx.Response.ContentType = mime;
                    ctx.Response.ContentLength64 = data.Length;
                    ctx.Response.AddHeader("Access-Control-Allow-Origin", "*");
                    ctx.Response.OutputStream.Write(data, 0, data.Length);
                }
                else
                {
                    ctx.Response.StatusCode = 404;
                    byte[] notFound = Encoding.UTF8.GetBytes("File Not Found");
                    ctx.Response.OutputStream.Write(notFound, 0, notFound.Length);
                }
            }
            catch { }
            finally
            {
                try { ctx.Response.Close(); } catch { }
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            try
            {
                if (_listener != null && _listener.IsListening)
                {
                    _listener.Stop();
                    _listener.Close();
                }
            }
            catch { }
        }
    }
}
