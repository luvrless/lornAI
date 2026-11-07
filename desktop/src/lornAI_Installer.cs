using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using System.IO.Compression;
using System.Threading;

namespace LornAI.Installer
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }

    public class InstallerForm : Form
    {
        private TextBox _txtPath;
        private Button _btnBrowse;
        private Button _btnAction;
        private ProgressBar _progressBar;
        private Label _lblStatus;
        private Label _lblTitle;
        private Label _lblSub;
        private Panel _card;
        private bool _isCompleted = false;
        private string _installedExePath = "";

        public InstallerForm()
        {
            this.Text = "lornAI Desktop — Setup & Bootstrapper";
            this.Size = new Size(640, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(18, 17, 16);
            this.ForeColor = Color.FromArgb(245, 240, 235);
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            BuildUI();
        }

        private void BuildUI()
        {
            // Header
            _lblTitle = new Label();
            _lblTitle.Text = "lornAI Desktop";
            _lblTitle.Font = new Font("Georgia", 20f, FontStyle.Regular);
            _lblTitle.ForeColor = Color.FromArgb(245, 240, 235);
            _lblTitle.Location = new Point(36, 26);
            _lblTitle.AutoSize = true;
            this.Controls.Add(_lblTitle);

            _lblSub = new Label();
            _lblSub.Text = "Standalone AI Assistant by Frail • Self-Extracting Bootstrapper";
            _lblSub.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            _lblSub.ForeColor = Color.FromArgb(180, 172, 162);
            _lblSub.Location = new Point(38, 64);
            _lblSub.AutoSize = true;
            this.Controls.Add(_lblSub);

            // Container card
            _card = new Panel();
            _card.Location = new Point(36, 105);
            _card.Size = new Size(550, 245);
            _card.BackColor = Color.FromArgb(28, 27, 25);
            this.Controls.Add(_card);

            // Path Label
            Label lblPath = new Label();
            lblPath.Text = "Installation Location (Local files, configs & workspace):";
            lblPath.ForeColor = Color.FromArgb(220, 215, 205);
            lblPath.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblPath.Location = new Point(20, 18);
            lblPath.AutoSize = true;
            _card.Controls.Add(lblPath);

            // Default path
            string defaultPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\lornAI");

            _txtPath = new TextBox();
            _txtPath.Location = new Point(22, 46);
            _txtPath.Size = new Size(395, 28);
            _txtPath.BackColor = Color.FromArgb(16, 15, 14);
            _txtPath.ForeColor = Color.FromArgb(245, 240, 235);
            _txtPath.BorderStyle = BorderStyle.FixedSingle;
            _txtPath.Text = defaultPath;
            _card.Controls.Add(_txtPath);

            _btnBrowse = new Button();
            _btnBrowse.Text = "Browse...";
            _btnBrowse.Location = new Point(426, 44);
            _btnBrowse.Size = new Size(100, 30);
            _btnBrowse.BackColor = Color.FromArgb(45, 43, 40);
            _btnBrowse.ForeColor = Color.FromArgb(240, 235, 225);
            _btnBrowse.FlatStyle = FlatStyle.Flat;
            _btnBrowse.FlatAppearance.BorderColor = Color.FromArgb(70, 66, 62);
            _btnBrowse.Click += OnBrowseClick;
            _card.Controls.Add(_btnBrowse);

            // Status label
            _lblStatus = new Label();
            _lblStatus.Text = "Ready to install lornAI on this system.";
            _lblStatus.Location = new Point(20, 102);
            _lblStatus.Size = new Size(505, 24);
            _lblStatus.ForeColor = Color.FromArgb(217, 119, 87);
            _lblStatus.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            _card.Controls.Add(_lblStatus);

            // Progress bar
            _progressBar = new ProgressBar();
            _progressBar.Location = new Point(22, 134);
            _progressBar.Size = new Size(504, 16);
            _progressBar.Value = 0;
            _card.Controls.Add(_progressBar);

            // Info note
            Label lblNote = new Label();
            lblNote.Text = "Includes local models engine, offline UI, config manager & desktop shortcut.";
            lblNote.Location = new Point(20, 175);
            lblNote.Size = new Size(505, 40);
            lblNote.ForeColor = Color.FromArgb(130, 125, 118);
            lblNote.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            _card.Controls.Add(lblNote);

            // Action Button
            _btnAction = new Button();
            _btnAction.Text = "Install lornAI";
            _btnAction.Location = new Point(410, 375);
            _btnAction.Size = new Size(176, 44);
            _btnAction.BackColor = Color.FromArgb(217, 119, 87);
            _btnAction.ForeColor = Color.White;
            _btnAction.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            _btnAction.FlatStyle = FlatStyle.Flat;
            _btnAction.FlatAppearance.BorderSize = 0;
            _btnAction.Cursor = Cursors.Hand;
            _btnAction.Click += OnActionClick;
            this.Controls.Add(_btnAction);

            Button btnCancel = new Button();
            btnCancel.Text = "Exit";
            btnCancel.Location = new Point(298, 375);
            btnCancel.Size = new Size(100, 44);
            btnCancel.BackColor = Color.FromArgb(36, 34, 32);
            btnCancel.ForeColor = Color.FromArgb(180, 172, 162);
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.FlatAppearance.BorderColor = Color.FromArgb(60, 56, 52);
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);
        }

        private void OnBrowseClick(object sender, EventArgs e)
        {
            using (FolderBrowserDialog dlg = new FolderBrowserDialog())
            {
                dlg.Description = "Select installation folder for lornAI:";
                dlg.SelectedPath = _txtPath.Text;
                if (dlg.ShowDialog() == DialogResult.OK)
                {
                    _txtPath.Text = dlg.SelectedPath;
                }
            }
        }

        private void OnActionClick(object sender, EventArgs e)
        {
            if (_isCompleted)
            {
                // Launch the installed app!
                try
                {
                    if (File.Exists(_installedExePath))
                    {
                        Process.Start(new ProcessStartInfo(_installedExePath) { WorkingDirectory = Path.GetDirectoryName(_installedExePath) });
                    }
                }
                catch { }
                Application.Exit();
                return;
            }

            string targetDir = _txtPath.Text.Trim();
            if (string.IsNullOrEmpty(targetDir))
            {
                MessageBox.Show("Please specify an installation path.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            _btnAction.Enabled = false;
            _btnBrowse.Enabled = false;
            _txtPath.Enabled = false;

            Thread t = new Thread(() => PerformInstall(targetDir));
            t.IsBackground = true;
            t.Start();
        }

        private void SetStatus(string text, int progress)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => SetStatus(text, progress)));
                return;
            }
            _lblStatus.Text = text;
            _progressBar.Value = Math.Max(0, Math.Min(100, progress));
        }

        private void PerformInstall(string targetDir)
        {
            try
            {
                SetStatus("Preparing installation workspace...", 15);
                Thread.Sleep(300);

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                SetStatus("Extracting lornAI engine & desktop core...", 45);
                Thread.Sleep(300);

                // Extract embedded resource bundle
                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream stream = asm.GetManifestResourceStream("lornai_bundle.zip"))
                {
                    if (stream != null)
                    {
                        using (ZipArchive archive = new ZipArchive(stream))
                        {
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                if (string.IsNullOrEmpty(entry.Name)) continue; // Directory entry
                                string destFile = Path.Combine(targetDir, entry.FullName);
                                string destSubDir = Path.GetDirectoryName(destFile);
                                if (!Directory.Exists(destSubDir)) Directory.CreateDirectory(destSubDir);

                                entry.ExtractToFile(destFile, true);
                            }
                        }
                    }
                }

                SetStatus("Configuring local settings & data stores...", 70);
                Thread.Sleep(300);

                _installedExePath = Path.Combine(targetDir, "lornAI.exe");

                SetStatus("Creating Desktop and Start Menu shortcuts...", 88);
                Thread.Sleep(300);

                CreateShortcut("lornAI", _installedExePath, Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
                string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "lornAI");
                if (!Directory.Exists(startMenu)) Directory.CreateDirectory(startMenu);
                CreateShortcut("lornAI", _installedExePath, startMenu);

                SetStatus("Installation successfully completed!", 100);

                // Update UI on completion
                this.Invoke(new Action(() =>
                {
                    _isCompleted = true;
                    _btnAction.Text = "Launch lornAI";
                    _btnAction.BackColor = Color.FromArgb(225, 125, 90);
                    _btnAction.Enabled = true;
                    _lblStatus.Text = "Ready! lornAI has been installed successfully.";
                    _lblStatus.ForeColor = Color.FromArgb(120, 210, 150);
                }));
            }
            catch (Exception ex)
            {
                this.Invoke(new Action(() =>
                {
                    _lblStatus.Text = "Error during installation: " + ex.Message;
                    _lblStatus.ForeColor = Color.FromArgb(240, 100, 100);
                    _btnAction.Enabled = true;
                    _btnBrowse.Enabled = true;
                    _txtPath.Enabled = true;
                }));
            }
        }

        private void CreateShortcut(string shortcutName, string targetPath, string folderPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                object shell = Activator.CreateInstance(shellType);
                string shortcutAddress = Path.Combine(folderPath, shortcutName + ".lnk");
                object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutAddress });

                Type shortcutType = shortcut.GetType();
                shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
                shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { Path.GetDirectoryName(targetPath) });
                shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "lornAI Assistant by Frail" });
                shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            }
            catch { }
        }
    }
}
