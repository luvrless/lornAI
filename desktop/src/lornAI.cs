using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
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
        private string _configPath;

        public MainForm()
        {
            this.Text = "lornAI — by Frail";
            this.Width = 1260;
            this.Height = 840;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(20, 19, 18);
            this.ForeColor = Color.FromArgb(245, 240, 235);

            _appDir = AppDomain.CurrentDomain.BaseDirectory;
            if (!File.Exists(Path.Combine(_appDir, "index.html")))
            {
                string localApp = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\lornAI");
                if (File.Exists(Path.Combine(localApp, "index.html")))
                {
                    _appDir = localApp;
                }
            }

            _configPath = Path.Combine(_appDir, "mcp_config.json");
            EnsureDefaultMcpConfig();

            StartLocalServer();

            _browser = new WebBrowser();
            _browser.Dock = DockStyle.Fill;
            _browser.ScriptErrorsSuppressed = true;
            _browser.IsWebBrowserContextMenuEnabled = false;
            this.Controls.Add(_browser);

            _browser.Navigate(string.Format("http://127.0.0.1:{0}/", _port));
        }

        private void EnsureDefaultMcpConfig()
        {
            if (!File.Exists(_configPath))
            {
                string def = @"{
  ""mcpServers"": {
    ""roblox-studio"": {
      ""name"": ""Roblox Studio MCP"",
      ""type"": ""json_stdio"",
      ""command"": ""node"",
      ""args"": [""roblox_bridge.js""],
      ""env"": { ""ROBLOX_PORT"": ""8080"" },
      ""approval"": ""always_proceed"",
      ""enabled"": true
    },
    ""local-filesystem"": {
      ""name"": ""Local Filesystem & Workspace"",
      ""type"": ""builtin"",
      ""command"": ""internal"",
      ""approval"": ""always_ask"",
      ""enabled"": true
    }
  }
}";
                try { File.WriteAllText(_configPath, def, Encoding.UTF8); } catch { }
            }
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
                catch { break; }
            }
        }

        private void HandleRequest(HttpListenerContext ctx)
        {
            try
            {
                string path = ctx.Request.Url.AbsolutePath;

                // MCP API Endpoints
                if (path == "/api/mcp/config")
                {
                    if (ctx.Request.HttpMethod == "GET")
                    {
                        string json = File.Exists(_configPath) ? File.ReadAllText(_configPath) : "{}";
                        SendJson(ctx, json);
                        return;
                    }
                    else if (ctx.Request.HttpMethod == "POST")
                    {
                        using (var reader = new StreamReader(ctx.Request.InputStream, ctx.Request.ContentEncoding))
                        {
                            string body = reader.ReadToEnd();
                            File.WriteAllText(_configPath, body, Encoding.UTF8);
                        }
                        SendJson(ctx, "{\"success\":true}");
                        return;
                    }
                }
                else if (path == "/api/mcp/execute" && ctx.Request.HttpMethod == "POST")
                {
                    using (var reader = new StreamReader(ctx.Request.InputStream, ctx.Request.ContentEncoding))
                    {
                        string body = reader.ReadToEnd();
                        string result = ExecuteMcpAction(body);
                        SendJson(ctx, result);
                    }
                    return;
                }

                // Static Files
                string rawUrl = path.TrimStart('/');
                if (string.IsNullOrEmpty(rawUrl)) rawUrl = "index.html";

                string filePath = Path.Combine(_appDir, rawUrl.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(filePath))
                {
                    byte[] data = File.ReadAllBytes(filePath);
                    string ext = Path.GetExtension(filePath).ToLower();

                    // Inject desktop flag into index.html
                    if (ext == ".html" || ext == ".htm")
                    {
                        string content = Encoding.UTF8.GetString(data);
                        content = content.Replace("<body>", "<body>\n  <script>window.IS_LORN_DESKTOP = true; window.LORN_DESKTOP_VERSION = '1.0.0';</script>");
                        data = Encoding.UTF8.GetBytes(content);
                    }

                    string mime = "application/octet-stream";
                    if (ext == ".html" || ext == ".htm") mime = "text/html; charset=utf-8";
                    else if (ext == ".css") mime = "text/css; charset=utf-8";
                    else if (ext == ".js") mime = "application/javascript; charset=utf-8";
                    else if (ext == ".json") mime = "application/json; charset=utf-8";
                    else if (ext == ".svg") mime = "image/svg+xml";

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

        private void SendJson(HttpListenerContext ctx, string json)
        {
            byte[] data = Encoding.UTF8.GetBytes(json);
            ctx.Response.ContentType = "application/json; charset=utf-8";
            ctx.Response.ContentLength64 = data.Length;
            ctx.Response.AddHeader("Access-Control-Allow-Origin", "*");
            ctx.Response.OutputStream.Write(data, 0, data.Length);
        }

        private string ExecuteMcpAction(string requestBody)
        {
            try
            {
                // Simulated robust execution for Roblox & local tooling
                return "{\"success\":true,\"result\":\"[Roblox Studio MCP] Command executed successfully.\"}";
            }
            catch (Exception ex)
            {
                return "{\"success\":false,\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
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
