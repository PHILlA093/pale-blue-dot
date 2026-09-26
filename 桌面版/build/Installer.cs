// ============================================================================
//  穷观学习 · Windows 桌面版 —— 安装 / 卸载程序
//  Build ID : QG-20260920-5e5d5a        (见 build\_指纹.txt)
//  指纹资源 : qg.fingerprint.txt         (编入本 exe, 可用 strings 检出)
//  稿件     : build\Installer.cs         (C# 5 语法 / 老 csc v4.0.30319)
// ----------------------------------------------------------------------------
//  编译:
//    csc /target:winexe ... Installer.cs
//        -> dist\穷观学习_安装程序.exe
//    csc /target:winexe ... /define:UNINSTALLER Installer.cs
//        -> 安装目录下的 卸载穷观学习.exe (体积极小, 不含任何载荷)
//  由 build\_build_installer.ps1 驱动, 详见该脚本注释。
// ----------------------------------------------------------------------------
//  视觉: 与 App 同一套色值, 取自 ..\css\style.css 的 :root 变量
//        --bg #05080f   --panel #0a101e   --panel-border rgb(120,160,220)/0.18
//        --text #dbe6f5 --text-dim #8fa3c0 --accent #4fc3f7 --accent2 #ffd54f
//  字体: Microsoft YaHei UI -> 微软雅黑 -> Segoe UI
// ----------------------------------------------------------------------------
//  语言限制(硬约束): 只允许 C# 5。不得使用字符串内插 $""、nameof、表达式体成员、
//  ?.、out var、元组、局部函数、模式匹配、using static、Array.Empty<T>()。
// ============================================================================

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;

namespace QiongGuan.Installer
{
    // ------------------------------------------------------------------
    //  载荷表。由 build\_build_installer.ps1 用 /resource: 生成的顺序重建,
    //  两端的索引必须一一对应: 资源名 qg.payload.<Id>.gz <=> 目标相对路径。
    //  刻意不打包: 数据库\qg_subjects.txt (用户偏好, 覆盖安装时保留)、
    //  任何 *.bak*、穷观学习.exe.WebView2\ (内含用户 API Key)、build\ 下任何内容。
    // ------------------------------------------------------------------
    internal struct Entry
    {
        public int Id;
        public string Target;
        public bool PreserveAtTarget;

        public Entry(int id, string target, bool preserveAtTarget)
        {
            this.Id = id;
            this.Target = target;
            this.PreserveAtTarget = preserveAtTarget;
        }
    }

    // ------------------------------------------------------------------
    //  共享: 色板 / 字体 / 命令行 / 目录与权限 / 快捷方式 / 注册表 / 运行时体检
    // ------------------------------------------------------------------
    internal static class Shared
    {
        internal static readonly Color Bg = Color.FromArgb(5, 8, 15);            // --bg
        internal static readonly Color Panel = Color.FromArgb(10, 16, 30);      // --panel
        internal static readonly Color PanelHi = Color.FromArgb(15, 23, 42);    // 输入框底
        internal static readonly Color Border = Color.FromArgb(38, 53, 76);     // --panel-border 实色化
        internal static readonly Color BorderHi = Color.FromArgb(64, 95, 135);
        internal static readonly Color Text = Color.FromArgb(219, 230, 245);    // --text
        internal static readonly Color TextDim = Color.FromArgb(143, 163, 192); // --text-dim
        internal static readonly Color Accent = Color.FromArgb(79, 195, 247);   // --accent
        internal static readonly Color AccentHover = Color.FromArgb(118, 214, 255);
        internal static readonly Color AccentDown = Color.FromArgb(40, 158, 214);
        internal static readonly Color AccentInk = Color.FromArgb(3, 10, 20);
        internal static readonly Color Gold = Color.FromArgb(255, 213, 79);     // --accent2
        internal static readonly Color Warn = Color.FromArgb(255, 186, 92);
        internal static readonly Color Track = Color.FromArgb(26, 36, 54);

        internal const string AppName = "穷观学习";
        internal const string Version = "2.4.2";
        internal const string Publisher = "PHILlA093";
        internal const string Tagline = "高中知识词云 · 桌面版 v2.4.2";
        internal const string Description = "穷观学习 · 高中知识词云";
        internal const string License = "PolyForm Noncommercial 1.0.0 · 非商业许可";
        internal const string BuildId = "QG-20260920-5e5d5a";
        internal const string UninstallKeyName = "穷观学习";
        internal const string MainExe = "穷观学习.exe";
        internal const string UninstallerExe = "卸载穷观学习.exe";
        internal const string LinkName = "穷观学习.lnk";
        internal const string MarkerFile = "安装信息.txt";
        internal const string ManualFile = "使用说明.txt";
        internal const string DbDir = "数据库";
        internal const string DbCorpus = "qg_corpus.txt";
        internal const string DbSubjects = "qg_subjects.txt";
        internal const string DbSubjectsBak = "qg_subjects.txt.bak";
        // 标记文件的第一行(产品名 + "安装信息")。凭证只认"产品名 + 标记头":
        // 不再要求 Build ID 精确匹配 —— 安装程序与卸载器版本不同步(用户留着旧版
        // 卸载器)时不该因此丢掉"这个目录是我们的"凭证。能不能整体递归删除另由
        // CleanDirectory=1 单独把关。
        internal const string MarkerHeader = "穷观学习 · 安装信息";
        // WebView2 用户数据目录(含 API Key 等本地缓存), 由本程序运行时创建
        internal const string Wv2CacheDir = MainExe + ".WebView2";
        internal const string WebView2Url = "https://developer.microsoft.com/microsoft-edge/webview2/";

        private const string WV2Guid = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [DllImport("shcore.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern int SetProcessDpiAwareness(int value);

        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        // 沉浸式深色标题栏。默认标题栏是系统亮色, 和 #05080f 的窗体割裂, 所以按
        // 优先级逐个尝试, 第一个成功的就留下:
        //   35 DWMWA_CAPTION_COLOR   Win11 22000+ 可直接指定标题栏底色(最精确,
        //                            用 --panel #0a101e, 和窗体同色系)
        //   20 DWMWA_USE_IMMERSIVE_DARK_MODE   Win10 2004+/Win11 的布尔开关
        //   19 同上, 但 Win10 1809-1909 用的是 19 号
        // 老系统一个都没有: DwmSetWindowAttribute 返回非 0, 全部落空后静默保持
        // 系统默认外观。这里绝不抛异常 —— 标题栏颜色不值得让安装程序失败。
        // 注意 SetLastError/抛出行为: dwmapi 未启用合成时会直接返回错误码而不是抛。
        internal static void ApplyDarkTitleBar(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) { return; }
            int caption = (Panel.R << 16) | (Panel.G << 8) | Panel.B;   // COLORREF = 0x00BBGGRR
            try { DwmSetWindowAttribute(hwnd, 35, ref caption, 4); }
            catch (Exception) { }
            int on = 1;
            try { DwmSetWindowAttribute(hwnd, 20, ref on, 4); }
            catch (Exception) { }
            try { DwmSetWindowAttribute(hwnd, 19, ref on, 4); }
            catch (Exception) { }
        }

        // [STAThread] only marks Main; it does not set the apartment if the process was
        // started in a way that already fixed it (a /S run from a non-STA host, or a
        // CreateProcess from a service). WScript.Shell is an apartment-threaded COM
        // server, so be explicit rather than trusting the attribute.
        internal static void ForceSta()
        {
            try
            {
                if (System.Threading.Thread.CurrentThread.GetApartmentState() != System.Threading.ApartmentState.STA)
                {
                    System.Threading.Thread.CurrentThread.SetApartmentState(System.Threading.ApartmentState.STA);
                }
            }
            catch (Exception) { }
        }

        // DPI awareness must be set before any window or Graphics object exists. Without
        // it a 125%/150% display makes Windows bitmap-stretch the fixed 660x440 dialog and
        // the text goes soft; with it the window stays crisp and stays 660x440 logical px.
        internal static void ForceDpiAwareness()
        {
            try { SetProcessDpiAwareness(1); }
            catch (Exception) { }
            try { SetProcessDPIAware(); }
            catch (Exception) { }
        }

        // /S 模式的诊断走 Console.Error。这里刻意 *不* 去改 Console.OutputEncoding:
        // 输出被重定向时该 setter 会先改控制台代码页再抛异常, 既救不了乱码, 又会在
        // 一个 GUI 程序里动到调用方的控制台状态。中文错误信息在交互界面上由
        // MessageBox 正常显示, 这才是给用户看的那条路径。

        private static readonly string[] PayloadTargets = new string[]
        {
            MainExe,
            "Microsoft.Web.WebView2.Core.dll",
            "Microsoft.Web.WebView2.WinForms.dll",
            "WebView2Loader.dll",
            "使用说明.txt",
            @"数据库\qg_corpus.txt"
        };

        // ---------------- 字体 ----------------
        internal static Font UiFont(float size)
        {
            return UiFont(size, FontStyle.Regular);
        }

        internal static Font UiFont(float size, FontStyle style)
        {
            string[] prefer = new string[] { "Microsoft YaHei UI", "微软雅黑", "Microsoft YaHei", "Segoe UI" };
            int i;
            for (i = 0; i < prefer.Length; i++)
            {
                try
                {
                    Font f = new Font(prefer[i], size, style, GraphicsUnit.Point);
                    if (string.Compare(f.Name, prefer[i], StringComparison.OrdinalIgnoreCase) == 0) { return f; }
                    f.Dispose();
                }
                catch (Exception) { }
            }
            return new Font(FontFamily.GenericSansSerif, size, style, GraphicsUnit.Point);
        }

        // ---------------- logo ----------------
        internal static Bitmap LoadLogo(int size)
        {
            Stream s = null;
            try
            {
                s = Assembly.GetExecutingAssembly().GetManifestResourceStream("qg.icon.png");
                if (s == null) { return null; }
                using (Image src = Image.FromStream(s))
                {
                    Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        g.Clear(Color.Transparent);
                        g.DrawImage(src, new Rectangle(0, 0, size, size));
                    }
                    return bmp;
                }
            }
            catch (Exception)
            {
                return null;
            }
            finally
            {
                if (s != null) { s.Dispose(); }
            }
        }

        internal static string FingerprintText()
        {
            Stream s = null;
            try
            {
                s = Assembly.GetExecutingAssembly().GetManifestResourceStream("qg.fingerprint.txt");
                if (s == null) { return BuildId; }
                using (StreamReader r = new StreamReader(s, Encoding.UTF8, true))
                {
                    string line;
                    while ((line = r.ReadLine()) != null)
                    {
                        if (line.IndexOf("Build ID", StringComparison.Ordinal) >= 0)
                        {
                            int p = line.IndexOf(':');
                            if (p >= 0) { return line.Substring(p + 1).Trim(); }
                        }
                    }
                    return BuildId;
                }
            }
            catch (Exception)
            {
                return BuildId;
            }
            finally
            {
                if (s != null) { s.Dispose(); }
            }
        }

        // ---------------- 命令行 ----------------
        internal static void ApplyFont(Control c, float size, FontStyle style, Color color)
        {
            c.Font = UiFont(size, style);
            c.ForeColor = color;
        }

        internal static string GetArg(string[] args, string name)
        {
            int i;
            for (i = 0; i < args.Length; i++)
            {
                string a = args[i];
                if (a.Length < name.Length) { continue; }
                if (string.Compare(a, 0, name, 0, name.Length, StringComparison.OrdinalIgnoreCase) != 0) { continue; }
                if (a.Length == name.Length) { return ""; }
                if (a[name.Length] == '=') { return a.Substring(name.Length + 1); }
            }
            return null;
        }

        internal static bool HasFlag(string[] args, string name)
        {
            int i;
            for (i = 0; i < args.Length; i++)
            {
                if (string.Compare(args[i], name, StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            }
            return false;
        }

        internal static string Unquote(string s)
        {
            if (s == null) { return null; }
            s = s.Trim();
            if (s.Length >= 2 && s[0] == '"' && s[s.Length - 1] == '"') { s = s.Substring(1, s.Length - 2); }
            return s;
        }

        // ---------------- 默认目录 ----------------
        internal static string DefaultDir()
        {
            string baseDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (string.IsNullOrEmpty(baseDir))
            {
                baseDir = Path.GetTempPath();
            }
            return Path.Combine(Path.Combine(baseDir, "Programs"), AppName);
        }

        // 逐级建目录, 把"哪一层不可写"讲清楚; 返回 null 表示可用
        internal static string EnsureDirUsable(string dir)
        {
            // 盘符相对路径("E:" / "E:foo")必须在这里就掐掉: Path.GetFullPath("E:")
            // 会把它解析成"E 盘的当前目录", 也就是调用本进程时的 CWD —— 实测
            // /DIR=E: 会把 57 MB 载荷整个撒进当时的工作目录, 而下面的盘根判定看到的
            // 已经是解析后的普通目录, 根本拦不住。完整路径("E:\...")不受影响。
            string raw = dir == null ? "" : dir.Trim();
            if (raw.Length >= 2 && raw[1] == ':')
            {
                string drive = raw.Substring(0, 2);
                if (raw.Length == 2)
                {
                    return "不能把「" + AppName + "」直接装到盘根目录(" + drive + "\\), 请选择一个文件夹, 例如 "
                         + drive + "\\Program Files\\" + AppName + "。";
                }
                if (raw[2] != '\\' && raw[2] != '/')
                {
                    return "请使用完整路径(例如 " + drive + "\\Program Files\\" + AppName + "), 不要用 "
                         + drive + " 这种盘符相对路径。";
                }
            }

            string full;
            try { full = Path.GetFullPath(dir); }
            catch (Exception) { return "路径格式不正确, 请重新选择安装位置。"; }

            if (string.IsNullOrEmpty(full.Trim())) { return "安装位置不能为空。"; }
            if (!Path.IsPathRooted(full)) { return "请使用完整路径(例如 C:\\Program Files\\穷观学习)。"; }
            if (full.Length >= 200) { return "路径过长, 请换一个更短的安装位置。"; }

            // 盘根是最危险的目标: 装进 C:\ 就等于把一堆文件撒在系统盘根目录,
            // 卸载时也可能被要求删掉整个根。这里在动手之前就直接拒绝, 用户改路径。
            string trimmed = full.TrimEnd('\\', '/');
            if (trimmed.Length <= 3 && trimmed.Length >= 2 && trimmed[1] == ':')
            {
                return "不能把「" + AppName + "」直接装到盘根目录(" + trimmed + "\\), 请选择一个文件夹, 例如 "
                     + trimmed + "\\Program Files\\" + AppName + "。";
            }
            if (trimmed.Length == 0)
            {
                return "安装位置不能是盘根目录。";
            }
            // Windows 目录与 Program Files 根目录同样拒绝
            string[] banned = new string[]
            {
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                Environment.GetFolderPath(Environment.SpecialFolder.System),
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)
            };
            int bi;
            for (bi = 0; bi < banned.Length; bi++)
            {
                if (string.IsNullOrEmpty(banned[bi])) { continue; }
                try
                {
                    string b = Path.GetFullPath(banned[bi]).TrimEnd('\\', '/');
                    if (string.Compare(b, trimmed, StringComparison.OrdinalIgnoreCase) == 0)
                    {
                        return "不能把「" + AppName + "」装到系统目录 " + trimmed + ", 请另选一个文件夹。";
                    }
                }
                catch (Exception) { }
            }

            try
            {
                string probe = full;
                Stack<string> created = new Stack<string>();
                while (!Directory.Exists(probe))
                {
                    created.Push(probe);
                    string up = Path.GetDirectoryName(probe);
                    if (string.IsNullOrEmpty(up) || up == probe)
                    {
                        return "安装位置的上级目录不存在: " + probe;
                    }
                    probe = up;
                }
                while (created.Count > 0) { Directory.CreateDirectory(created.Pop()); }
            }
            catch (UnauthorizedAccessException)
            {
                return "没有写入权限, 请换一个位置, 或以管理员身份运行。";
            }
            catch (Exception ex)
            {
                return "无法创建安装目录: " + ex.Message;
            }

            try
            {
                string t = Path.Combine(full, ".qg_write_test");
                File.WriteAllBytes(t, new byte[1]);
                File.Delete(t);
            }
            catch (UnauthorizedAccessException)
            {
                return "该目录不可写(没有权限), 请换一个安装位置。";
            }
            catch (Exception ex)
            {
                return "该目录不可写: " + ex.Message;
            }
            return null;
        }

        internal static string TryGetInstallDir()
        {
            RegistryKey k = null;
            try
            {
                k = Registry.CurrentUser.OpenSubKey(UninstallRegPath, false);
                if (k == null) { return null; }
                object v = k.GetValue("InstallLocation");
                if (v == null) { return null; }
                string s = Convert.ToString(v);
                if (string.IsNullOrEmpty(s)) { return null; }
                return s.TrimEnd('\\');
            }
            catch (Exception)
            {
                return null;
            }
            finally
            {
                if (k != null) { k.Close(); }
            }
        }

        internal static string UninstallRegPath
        {
            get
            {
                return @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + UninstallKeyName;
            }
        }

        // ---------------- 快捷方式 (必须走 shell 的 SpecialFolders: 本机桌面被 OneDrive 重定向) ----------------
        private static object GetShell()
        {
            Type t = Type.GetTypeFromProgID("WScript.Shell");
            if (t == null) { throw new InvalidOperationException("无法加载 Windows Script Host (WScript.Shell)"); }
            return Activator.CreateInstance(t);
        }

        // WScript.Shell.SpecialFolders is a parameterized COM property, and so is the
        // WshCollection.Item it hands back. Through late binding BOTH must be reached
        // with BindingFlags.InvokeMethod -- asking for either one with GetProperty
        // throws DISP_E_MEMBERNOTFOUND (0x80020003, "找不到成员"), which is how this
        // was first caught. The collection is also IEnumerable, but Item is the
        // documented route and does not depend on enumeration order.
        //
        // The path is NOT %USERPROFILE%\Desktop on this machine: the desktop is
        // OneDrive-redirected to D:\OneDrive\Desktop, which is precisely why
        // SpecialFolders is mandatory here and a hardcoded path is not an option.
        internal static string ShellFolder(object shell, string name)
        {
            object folders = shell.GetType().InvokeMember("SpecialFolders", BindingFlags.GetProperty, null, shell, null);
            object path = folders.GetType().InvokeMember("Item", BindingFlags.InvokeMethod, null, folders, new object[] { name });
            return Convert.ToString(path);
        }

        internal static string DesktopDir()
        {
            object shell = GetShell();
            return ShellFolder(shell, "Desktop");
        }

        internal static string ProgramsDir()
        {
            object shell = GetShell();
            return ShellFolder(shell, "Programs");
        }

        // 返回 null 表示成功, 否则是中文错误
        internal static string CreateShortcut(string lnkPath, string target, string workDir, string icon, string desc)
        {
            try
            {
                string parent = Path.GetDirectoryName(lnkPath);
                if (!string.IsNullOrEmpty(parent)) { Directory.CreateDirectory(parent); }
                object shell = GetShell();
                object sc = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnkPath });
                Type st = sc.GetType();
                st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
                st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { workDir });
                st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { icon });
                st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { desc });
                st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
                return null;
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        internal static void TryDelete(string path)
        {
            try { if (File.Exists(path)) { File.Delete(path); } }
            catch (Exception) { }
        }

        internal static void BestEffortDeleteTree(string dir)
        {
            try
            {
                if (!Directory.Exists(dir)) { return; }
                Directory.Delete(dir, true);
            }
            catch (Exception) { }
        }

        // ---------------- WebView2 运行时体检 ----------------
        internal static string WebView2Version()
        {
            RegistryView[] views = new RegistryView[] { RegistryView.Registry64, RegistryView.Registry32 };
            RegistryHive[] hives = new RegistryHive[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser };
            int v;
            int h;
            for (v = 0; v < views.Length; v++)
            {
                for (h = 0; h < hives.Length; h++)
                {
                    RegistryKey baseKey = null;
                    RegistryKey k = null;
                    try
                    {
                        baseKey = RegistryKey.OpenBaseKey(hives[h], views[v]);
                        k = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\EdgeUpdate\Clients\" + WV2Guid, false);
                        if (k == null) { continue; }
                        object pv = k.GetValue("pv");
                        if (pv == null) { continue; }
                        string s = Convert.ToString(pv);
                        if (!string.IsNullOrEmpty(s) && s != "0.0.0.0") { return s; }
                    }
                    catch (Exception) { }
                    finally
                    {
                        if (k != null) { k.Close(); }
                        if (baseKey != null) { baseKey.Close(); }
                    }
                }
            }
            return null;
        }

        // ---------------- 数组工具 (避免泛型推断问题) ----------------
        internal static Entry[] EntryArray(Entry[] src)
        {
            Entry[] dst = new Entry[src.Length];
            int i;
            for (i = 0; i < src.Length; i++) { dst[i] = src[i]; }
            return dst;
        }

        internal static Entry[] PayloadEntries()
        {
            //>>>PAYLOADS (generated: keep in sync with _build_installer.ps1 $spec)
            Entry[] e = new Entry[6];
            e[0] = new Entry(0, @"穷观学习.exe", false);
            e[1] = new Entry(1, "Microsoft.Web.WebView2.Core.dll", false);
            e[2] = new Entry(2, "Microsoft.Web.WebView2.WinForms.dll", false);
            e[3] = new Entry(3, "WebView2Loader.dll", false);
            e[4] = new Entry(4, @"使用说明.txt", false);
            e[5] = new Entry(5, @"数据库\qg_corpus.txt", false);
            return e;
            //<<<PAYLOADS
        }

        internal static string[] PayloadTargetList()
        {
            return (string[])PayloadTargets.Clone();
        }

        // ------------------------------------------------------------------
        //  安装目录里"属于本程序"的条目判定。
        //
        //  安装时的界面预警(_preExistingCount)与安装标记 CleanDirectory 的判定
        //  必须共用这一份口径。两处口径不一致时的后果实测过: 预警只按名字过滤掉
        //  我们自己的文件, 而标记判定写成"目录里有没有条目", 于是任何一次覆盖安装
        //  都会把 CleanDirectory 从 1 翻成 0, 卸载就永远不肯整体删除目录了。
        //
        //  name 是 dir 下的一个条目名(文件或目录); 返回 true = 这是我们自己写的。
        //  "数据库\" 单独判定: 只含 qg_corpus.txt / qg_subjects.txt.bak 才算我们的,
        //  出现 qg_subjects.txt(用户自己积累的知识云)就按"有用户数据"保守处理。
        // ------------------------------------------------------------------
        internal static bool IsKnownEntry(string dir, string name)
        {
            if (string.IsNullOrEmpty(name)) { return false; }
            if (string.Compare(name, MainExe, StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, UninstallerExe, StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, "Microsoft.Web.WebView2.Core.dll", StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, "Microsoft.Web.WebView2.WinForms.dll", StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, "WebView2Loader.dll", StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, ManualFile, StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, MarkerFile, StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, Wv2CacheDir, StringComparison.OrdinalIgnoreCase) == 0) { return true; }
            if (string.Compare(name, DbDir, StringComparison.OrdinalIgnoreCase) != 0) { return false; }

            string db = Path.Combine(dir, name);
            try
            {
                if (!Directory.Exists(db)) { return false; }
                string[] kids = Directory.GetFileSystemEntries(db);
                if (kids.Length == 0) { return true; }        // 空壳目录, 是我们留下的
                int i;
                for (i = 0; i < kids.Length; i++)
                {
                    string k = Path.GetFileName(kids[i]);
                    bool ours = string.Compare(k, DbCorpus, StringComparison.OrdinalIgnoreCase) == 0
                             || string.Compare(k, DbSubjectsBak, StringComparison.OrdinalIgnoreCase) == 0;
                    if (!ours) { return false; }              // qg_subjects.txt 等 = 用户数据
                }
                return true;
            }
            catch (Exception) { return false; }               // 看不清楚 -> 按"不是我们的"处理
        }
    }

    // ------------------------------------------------------------------
    //  小型主题控件: 扁平按钮 / 极简复选框 / 自绘进度条
    // ------------------------------------------------------------------
    internal class FlatButton : Button
    {
        private bool _hot;
        private bool _down;
        private bool _primary;

        public FlatButton(bool primary)
        {
            _primary = primary;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            UseVisualStyleBackColor = false;
            Cursor = Cursors.Hand;
            TabStop = false;
        }

        protected override void OnMouseEnter(EventArgs e) { _hot = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { _hot = false; _down = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { _down = true; Invalidate(); base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { _down = false; Invalidate(); base.OnMouseUp(e); }

        protected override void OnPaint(PaintEventArgs pevent)
        {
            Graphics g = pevent.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle r = new Rectangle(0, 0, Width - 1, Height - 1);
            Color fill;
            Color ink;
            Color line;
            if (_primary)
            {
                if (!Enabled) { fill = Color.FromArgb(32, 48, 68); ink = Shared.TextDim; line = Shared.Border; }
                else if (_down) { fill = Shared.AccentDown; ink = Color.White; line = Shared.AccentDown; }
                else if (_hot) { fill = Shared.AccentHover; ink = Shared.AccentInk; line = Shared.AccentHover; }
                else { fill = Shared.Accent; ink = Shared.AccentInk; line = Shared.Accent; }
            }
            else
            {
                if (!Enabled) { fill = Shared.Panel; ink = Shared.TextDim; line = Shared.Border; }
                else if (_down) { fill = Color.FromArgb(30, 44, 66); ink = Shared.Text; line = Shared.BorderHi; }
                else if (_hot) { fill = Color.FromArgb(22, 33, 50); ink = Color.White; line = Shared.BorderHi; }
                else { fill = Shared.Panel; ink = Shared.Text; line = Shared.Border; }
            }
            using (GraphicsPath p = Round(r, 7))
            {
                using (SolidBrush b = new SolidBrush(fill)) { g.FillPath(b, p); }
                using (Pen pen = new Pen(line)) { g.DrawPath(pen, p); }
            }
            TextRenderer.DrawText(g, Text, Font, r, ink, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
        }

        internal static GraphicsPath Round(Rectangle r, int radius)
        {
            GraphicsPath p = new GraphicsPath();
            int d = radius * 2;
            if (d <= 0 || r.Width <= d || r.Height <= d)
            {
                p.AddRectangle(r);
                return p;
            }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }
    }

    // ------------------------------------------------------------------
    //  复选框: 不是控件, 而是画在卡片上的一行, 命中测试自己做。
    //
    //  为什么不做成 CheckBox 子控件: 自绘 CheckBox 在这个宿主里, 文字会被重复
    //  合成成重影 —— 中文叠字、行尾拖出黑块, 而且屏幕截图和 PrintWindow 两种
    //  抓法都能看到。已用一个对照程序逐项排除过: ControlStyles 的各种组合
    //  (Opaque / AllPaintingInWmPaint / OptimizedDoubleBuffer / UserPaint)、
    //  TextRenderer 与 Graphics.DrawString、共用一个父面板还是各自一个父面板
    //  —— 全部照样重影; 而把同样的文字直接画在父面板的 Paint 里, 连续三次
    //  截图哈希完全一致, 完全干净。既然这样, 就不跟子控件较劲了。
    //
    //  代价是命中测试、悬停、重绘都要自己管, 都在 InstallerForm 里对应的事件
    //  处理器中, 加起来不到二十行。
    // ------------------------------------------------------------------
    internal class CheckRow
    {
        public Rectangle Bounds;
        public string Text;
        public bool Checked;
        public bool Hot;

        public CheckRow(int x, int y, string text)
        {
            Text = text;
            Bounds = new Rectangle(x, y, 360, 24);
        }

        // 方框 17px, 垂直居中于本行
        public Rectangle BoxRect
        {
            get { return new Rectangle(Bounds.X + 1, Bounds.Y + (Bounds.Height - 17) / 2, 17, 17); }
        }

        // 文字基线: 用 TextRenderer 量一遍再居中, 避免和方框错位
        public Rectangle TextRect
        {
            get
            {
                return new Rectangle(BoxRect.Right + 9, Bounds.Y, Bounds.Width - (BoxRect.Width + 10), Bounds.Height);
            }
        }
    }

    internal static class CheckRowPainter
    {
        internal static void Draw(Graphics g, CheckRow row, Font font)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle r = row.BoxRect;
            Color fill;
            Color line;
            if (row.Checked) { fill = Shared.Accent; line = Shared.Accent; }
            else if (row.Hot) { fill = Color.FromArgb(18, 27, 44); line = Shared.BorderHi; }
            else { fill = Shared.PanelHi; line = Shared.Border; }
            using (GraphicsPath p = FlatButton.Round(r, 4))
            {
                using (SolidBrush b = new SolidBrush(fill)) { g.FillPath(b, p); }
                using (Pen pen = new Pen(line)) { g.DrawPath(pen, p); }
            }
            if (row.Checked)
            {
                using (Pen pen = new Pen(Shared.AccentInk, 2.1f))
                {
                    pen.StartCap = LineCap.Round;
                    pen.EndCap = LineCap.Round;
                    g.DrawLines(pen, new Point[]
                    {
                        new Point(r.X + 4, r.Y + 9),
                        new Point(r.X + 7, r.Y + 12),
                        new Point(r.X + 13, r.Y + 5)
                    });
                }
            }
            TextRenderer.DrawText(g, row.Text, font, row.TextRect, Shared.Text,
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
        }
    }

    internal class FlatProgress : Panel
    {
        private int _value;

        public FlatProgress()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = Shared.Track;
        }

        public int Value
        {
            get { return _value; }
            set
            {
                if (value < 0) { value = 0; }
                if (value > 100) { value = 100; }
                _value = value;
                Invalidate();
            }
        }

        // 圆角底 + 强调色前进条, 与 App 的克制风格一致 (全自绘, 不受系统主题影响)
        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int rad = Height / 2;
            if (rad < 1) { rad = 1; }
            Rectangle r = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath p = FlatButton.Round(r, rad))
            {
                using (SolidBrush b = new SolidBrush(Shared.Track)) { g.FillPath(b, p); }
            }
            int w = (int)((long)(Width - 1) * _value / 100);
            if (w >= 4)
            {
                Rectangle fr = new Rectangle(0, 0, w, Height - 1);
                using (GraphicsPath p = FlatButton.Round(fr, rad))
                {
                    using (SolidBrush b = new SolidBrush(Shared.Accent)) { g.FillPath(b, p); }
                }
            }
        }
    }

    // 细金线 + 可点链接按钮
    internal class FlatLink : Button
    {
        private bool _hot;

        public FlatLink()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = Color.Transparent;
            ForeColor = Shared.Accent;
            Cursor = Cursors.Hand;
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            TabStop = false;
        }

        protected override void OnMouseEnter(EventArgs e) { _hot = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { _hot = false; Invalidate(); base.OnMouseLeave(e); }

        protected override void OnPaint(PaintEventArgs pevent)
        {
            Graphics g = pevent.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            Color ink = _hot ? Shared.AccentHover : Shared.Accent;
            Rectangle r = new Rectangle(0, 0, Width, Height);
            TextRenderer.DrawText(g, Text, Font, r, ink, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
            Size sz = TextRenderer.MeasureText(g, Text, Font, new Size(int.MaxValue, int.MaxValue), TextFormatFlags.NoPrefix);
            int y = (Height + sz.Height) / 2 - 1;
            using (Pen pen = new Pen(ink))
            {
                g.DrawLine(pen, 0, y, Math.Min(sz.Width, Width - 1), y);
            }
        }
    }

    // ------------------------------------------------------------------
    //  安装向导主窗口 (单窗口两态: 安装态 / 完成态)
    // ------------------------------------------------------------------
    internal class InstallerForm : Form
    {
        private const int W = 660;
        private const int H = 440;

        private string[] _args;
        private bool _silent;
        private bool _noRun;
        private bool _noDesktop;
        private bool _noStartMenu;
        private string _dir;
        private bool _installing;
        private bool _done;
        private bool _installOk;      // 明确的"安装成功"标志, 是启动主程序的唯一依据
        private string _desktopLnk;
        private string _startMenuLnk;
        private string _runtime;

        private TextBox _txtDir;
        private CheckRow _cbDesktop;
        private CheckRow _cbMenu;
        private CheckRow _cbRun;
        private bool _cbLocked;
        private int _preExistingCount;
        private FlatButton _btnBrowse;
        private FlatButton _btnPrimary;
        private FlatButton _btnCancel;
        private FlatProgress _prog;
        private Label _lblStatus;
        private Panel _page1;
        private Panel _page2;
        private Label _lblDone;
        private Label _lblDoneSub;
        private Label _lblRuntime;
        private FlatLink _lnkRuntime;
        private PictureBox _logo;

        public InstallerForm(string[] args)
        {
            _args = args;
            _silent = Shared.HasFlag(args, "/S");
            _noRun = Shared.HasFlag(args, "/NORUN");
            _noDesktop = Shared.HasFlag(args, "/NODESKTOP");
            _noStartMenu = Shared.HasFlag(args, "/NOSTARTMENU");
            _dir = Shared.Unquote(Shared.GetArg(args, "/DIR"));
            if (string.IsNullOrEmpty(_dir)) { _dir = Shared.TryGetInstallDir(); }
            if (string.IsNullOrEmpty(_dir)) { _dir = Shared.DefaultDir(); }
            _runtime = Shared.WebView2Version();

            BuildUi();
        }

        // ------------------------- UI -------------------------
        private void BuildUi()
        {
            SuspendLayout();
            Text = Shared.AppName + " 安装程序";
            Font = Shared.UiFont(9f);
            BackColor = Shared.Bg;
            ForeColor = Shared.Text;
            ClientSize = new Size(W, H);
            AutoScaleMode = AutoScaleMode.None;   // fixed 660x440 dialog: never let DPI rescale it
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ShowIcon = true;          // 标题栏左侧显示穷观图标(配合下面的沉浸式深色标题栏)
            DoubleBuffered = true;
            try { Icon = IconFromResource(); }
            catch (Exception) { }
            SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);

            // ---- 头部: logo + 标题 + 副标题 + 构建指纹 ----
            Panel head = new Panel();
            head.Left = 0; head.Top = 0; head.Width = W; head.Height = 116;
            head.BackColor = Shared.Bg;
            Controls.Add(head);
            head.Paint += new PaintEventHandler(HeadPaint);

            _logo = new PictureBox();
            _logo.Left = 32; _logo.Top = 26; _logo.Width = 48; _logo.Height = 48;
            // Solid header colour, NOT Color.Transparent: a transparent child is painted
            // by asking its parent to draw underneath, which WM_PRINT (what DrawToBitmap
            // drives for /SHOT) does not do -- so the logo silently vanished from the
            // capture while being perfectly visible in the real window.
            _logo.BackColor = Shared.Bg;
            _logo.SizeMode = PictureBoxSizeMode.Zoom;
            try { _logo.Image = Shared.LoadLogo(48); }
            catch (Exception) { }
            head.Controls.Add(_logo);

            Label title = new Label();
            title.Left = 98; title.Top = 24; title.Width = 380; title.Height = 32;
            title.Text = Shared.AppName;
            title.BackColor = Color.Transparent;
            Shared.ApplyFont(title, 18f, FontStyle.Bold, Color.White);
            head.Controls.Add(title);

            Label sub = new Label();
            sub.Left = 100; sub.Top = 58; sub.Width = 360; sub.Height = 20;
            sub.Text = Shared.Tagline;
            sub.BackColor = Color.Transparent;
            Shared.ApplyFont(sub, 9.5f, FontStyle.Regular, Shared.TextDim);
            head.Controls.Add(sub);

            Label fp = new Label();
            fp.Left = 452; fp.Top = 62; fp.Width = 176; fp.Height = 18;
            fp.Text = Shared.FingerprintText();
            fp.TextAlign = ContentAlignment.MiddleRight;
            fp.BackColor = Color.Transparent;
            Shared.ApplyFont(fp, 8f, FontStyle.Regular, Color.FromArgb(96, 114, 140));
            head.Controls.Add(fp);

            // ---- 第 1 页: 安装位置 + 三个选项 ----
            _page1 = new Panel();
            _page1.Left = 32; _page1.Top = 130; _page1.Width = W - 64; _page1.Height = 198;
            _page1.BackColor = Shared.Panel;
            // 注意: 两个 Paint/鼠标事件必须在三个 CheckRow 构造完成之后再挂,
            // 否则第一次重绘就会因为 _cbDesktop 还是 null 而抛异常。
            Controls.Add(_page1);

            Label l1 = new Label();
            l1.Left = 26; l1.Top = 20; l1.Width = 300; l1.Height = 18;
            l1.Text = "安装位置";
            l1.BackColor = Shared.Panel;
            Shared.ApplyFont(l1, 9.5f, FontStyle.Regular, Shared.TextDim);
            _page1.Controls.Add(l1);

            _txtDir = new TextBox();
            _txtDir.Left = 26; _txtDir.Top = 46; _txtDir.Width = 440; _txtDir.Height = 28;
            _txtDir.Text = _dir;
            _txtDir.BorderStyle = BorderStyle.FixedSingle;
            _txtDir.BackColor = Shared.PanelHi;
            _txtDir.ForeColor = Shared.Text;
            _txtDir.Font = Shared.UiFont(9.5f);
            _page1.Controls.Add(_txtDir);

            _btnBrowse = new FlatButton(false);
            _btnBrowse.Left = 480; _btnBrowse.Top = 45; _btnBrowse.Width = 92; _btnBrowse.Height = 30;
            _btnBrowse.Text = "浏览…";
            _btnBrowse.Font = Shared.UiFont(9.5f);
            _btnBrowse.Click += new EventHandler(BrowseClick);
            _page1.Controls.Add(_btnBrowse);

            // 三个选项直接画在卡片上, 不做成子控件 —— 原因见 FlatCheck 顶部注释:
            // 自绘 CheckBox 子控件在这个宿主里会被重复合成成重影, 而画在父面板上
            // 完全干净(已用 3 次连续截图同哈希验证过)。
            _cbDesktop = new CheckRow(26, 88, "创建桌面快捷方式");
            _cbDesktop.Checked = !_noDesktop;
            _cbMenu = new CheckRow(26, 122, "创建开始菜单快捷方式");
            _cbMenu.Checked = !_noStartMenu;
            _cbRun = new CheckRow(26, 156, "安装完成后立即运行");
            _cbRun.Checked = !_noRun;
            _page1.Paint += new PaintEventHandler(CardPaint);
            _page1.MouseMove += new MouseEventHandler(Page1MouseMove);
            _page1.MouseLeave += new EventHandler(Page1MouseLeave);
            _page1.MouseDown += new MouseEventHandler(Page1MouseDown);

            // ---- 第 2 页: 安装完成 ----
            _page2 = new Panel();
            _page2.Left = 32; _page2.Top = 130; _page2.Width = W - 64; _page2.Height = 198;
            _page2.BackColor = Shared.Panel;
            _page2.Visible = false;
            _page2.Paint += new PaintEventHandler(CardPaint);
            Controls.Add(_page2);

            _lblDone = new Label();
            _lblDone.Left = 26; _lblDone.Top = 26; _lblDone.Width = 520; _lblDone.Height = 28;
            _lblDone.Text = "安装完成";
            _lblDone.BackColor = Shared.Panel;
            Shared.ApplyFont(_lblDone, 16f, FontStyle.Bold, Color.White);
            _page2.Controls.Add(_lblDone);

            _lblDoneSub = new Label();
            _lblDoneSub.Left = 28; _lblDoneSub.Top = 68; _lblDoneSub.Width = 530; _lblDoneSub.Height = 76;
            _lblDoneSub.Text = "";
            _lblDoneSub.BackColor = Shared.Panel;
            Shared.ApplyFont(_lblDoneSub, 9.5f, FontStyle.Regular, Shared.Text);
            _page2.Controls.Add(_lblDoneSub);

            _lblRuntime = new Label();
            _lblRuntime.Left = 28; _lblRuntime.Top = 132; _lblRuntime.Width = 440; _lblRuntime.Height = 34;
            _lblRuntime.Text = "";
            _lblRuntime.BackColor = Shared.Panel;
            Shared.ApplyFont(_lblRuntime, 9f, FontStyle.Regular, Shared.Warn);
            _lblRuntime.Visible = false;
            _page2.Controls.Add(_lblRuntime);

            _lnkRuntime = new FlatLink();
            _lnkRuntime.Left = 468; _lnkRuntime.Top = 132; _lnkRuntime.Width = 100; _lnkRuntime.Height = 22;
            _lnkRuntime.Text = "打开下载页";
            _lnkRuntime.Font = Shared.UiFont(9f);
            _lnkRuntime.Visible = false;
            _lnkRuntime.Click += new EventHandler(OpenRuntimePage);
            _page2.Controls.Add(_lnkRuntime);

            // ---- 进度 + 状态 + 按钮 ----
            _prog = new FlatProgress();
            _prog.Left = 32; _prog.Top = 330; _prog.Width = W - 64; _prog.Height = 6;
            _prog.Value = 0;
            Controls.Add(_prog);

            _lblStatus = new Label();
            _lblStatus.Left = 32; _lblStatus.Top = 346; _lblStatus.Width = 308; _lblStatus.Height = 20;
            _lblStatus.AutoSize = false;
            _lblStatus.Text = "准备就绪。选择安装位置后点击「开始安装」。";
            _lblStatus.BackColor = Color.Transparent;
            Shared.ApplyFont(_lblStatus, 9f, FontStyle.Regular, Shared.TextDim);
            Controls.Add(_lblStatus);

            // 页脚右上的许可小字, 右边界 510 远在主按钮(528)左侧。宽度必须真的够:
            // 左 300 宽 228 时会被裁成 "ommercial 1.0.0 · 非商业许可"。
            Label lblLicense = new Label();
            lblLicense.Left = 350; lblLicense.Top = 346; lblLicense.Width = 278; lblLicense.Height = 20;
            lblLicense.Text = Shared.License;
            lblLicense.TextAlign = ContentAlignment.MiddleRight;
            lblLicense.BackColor = Color.Transparent;
            Shared.ApplyFont(lblLicense, 7.5f, FontStyle.Regular, Color.FromArgb(96, 114, 140));
            Controls.Add(lblLicense);

            _btnPrimary = new FlatButton(true);
            _btnPrimary.Left = 528; _btnPrimary.Top = 384; _btnPrimary.Width = 100; _btnPrimary.Height = 36;
            _btnPrimary.Text = "开始安装";
            _btnPrimary.Font = Shared.UiFont(10f, FontStyle.Bold);
            _btnPrimary.Click += new EventHandler(PrimaryClick);
            Controls.Add(_btnPrimary);

            _btnCancel = new FlatButton(false);
            _btnCancel.Left = 420; _btnCancel.Top = 384; _btnCancel.Width = 100; _btnCancel.Height = 36;
            _btnCancel.Text = "取消";
            _btnCancel.Font = Shared.UiFont(10f);
            _btnCancel.Click += new EventHandler(CancelClick);
            Controls.Add(_btnCancel);

            if (_runtime == null)
            {
                // 体检不通过时, 安装前就提醒一句(不阻塞安装)
                _lblStatus.Text = "未检测到 Microsoft Edge WebView2 运行时, 安装后请先安装该运行时。";
                _lblStatus.ForeColor = Shared.Warn;
            }

            ResumeLayout(false);
        }

        // 窗口图标是一个"多尺寸混合"的 .ico: 16/24/32/48 是 32bpp BMP 条目
        // (System.Drawing 必须能解), 64/128/256 是 PNG 条目(省体积)。
        // 正因为 16/32/48 都是 BMP, new Icon(stream, size) 在这里是安全的;
        // 如果整份 ico 都是 PNG 条目, .NET Framework 的 Icon 会直接抛
        // "参数"picture"必须是可用作 Icon 的图片" -- 这就是当初踩到的坑。
        private Icon IconFromResource()
        {
            Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("qg.icon.ico");
            if (s == null) { return null; }
            using (s) { return new Icon(s, new Size(32, 32)); }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            // 句柄刚建好时套用沉浸式深色标题栏; 失败静默忽略(见 Shared.ApplyDarkTitleBar)
            Shared.ApplyDarkTitleBar(Handle);
        }

        private void HeadPaint(object sender, PaintEventArgs e)
        {
            using (Pen p = new Pen(Color.FromArgb(30, 41, 60)))
            {
                e.Graphics.DrawLine(p, 32, 112, W - 32, 112);
            }
        }

        // 卡片: 微亮底 + 边框 + 左侧冷蓝细条(与 App 面板同一语言)
        private void CardPaint(object sender, PaintEventArgs e)
        {
            Control c = (Control)sender;
            Rectangle r = new Rectangle(0, 0, c.Width - 1, c.Height - 1);
            using (Pen p = new Pen(Shared.Border))
            {
                e.Graphics.DrawRectangle(p, r);
            }
            using (SolidBrush b = new SolidBrush(Color.FromArgb(150, Shared.Accent)))
            {
                e.Graphics.FillRectangle(b, 0, 0, 2, c.Height);
            }
            // 三个选项就画在这张卡片上, 不做子控件(原因见 CheckRow 顶部注释)
            if (sender == _page1)
            {
                Font f = Shared.UiFont(9.5f);
                CheckRowPainter.Draw(e.Graphics, _cbDesktop, f);
                CheckRowPainter.Draw(e.Graphics, _cbMenu, f);
                CheckRowPainter.Draw(e.Graphics, _cbRun, f);
                f.Dispose();   // UiFont 每次都是新建的, 必须释放
            }
        }

        // ---- 三个选项的命中测试与悬停(自己画就得自己管) ----
        private CheckRow HitRow(int x, int y)
        {
            if (_cbLocked) { return null; }
            if (_cbDesktop.Bounds.Contains(x, y)) { return _cbDesktop; }
            if (_cbMenu.Bounds.Contains(x, y)) { return _cbMenu; }
            if (_cbRun.Bounds.Contains(x, y)) { return _cbRun; }
            return null;
        }

        private void Page1MouseMove(object sender, MouseEventArgs e)
        {
            CheckRow hit = HitRow(e.X, e.Y);
            bool changed = false;
            if (_cbDesktop.Hot != (hit == _cbDesktop)) { _cbDesktop.Hot = (hit == _cbDesktop); changed = true; }
            if (_cbMenu.Hot != (hit == _cbMenu)) { _cbMenu.Hot = (hit == _cbMenu); changed = true; }
            if (_cbRun.Hot != (hit == _cbRun)) { _cbRun.Hot = (hit == _cbRun); changed = true; }
            _page1.Cursor = (hit != null) ? Cursors.Hand : Cursors.Default;
            if (changed) { _page1.Invalidate(); }
        }

        private void Page1MouseLeave(object sender, EventArgs e)
        {
            _cbDesktop.Hot = false;
            _cbMenu.Hot = false;
            _cbRun.Hot = false;
            _page1.Invalidate();
        }

        private void Page1MouseDown(object sender, MouseEventArgs e)
        {
            CheckRow hit = HitRow(e.X, e.Y);
            if (hit == null) { return; }
            hit.Checked = !hit.Checked;
            // 与 /NODESKTOP /NOSTARTMENU 冲突时不许再勾回来, 避免命令行与界面互相打脸
            if (hit == _cbDesktop && _noDesktop) { hit.Checked = false; }
            if (hit == _cbMenu && _noStartMenu) { hit.Checked = false; }
            _page1.Invalidate();
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            using (SolidBrush b = new SolidBrush(Shared.Bg))
            {
                e.Graphics.FillRectangle(b, e.ClipRectangle);
            }
            using (Pen p = new Pen(Color.FromArgb(56, 80, 112)))
            {
                e.Graphics.DrawRectangle(p, 0, 0, W - 1, H - 1);
            }
        }

        // ------------------------- 交互 -------------------------
        private void BrowseClick(object sender, EventArgs e)
        {
            using (FolderBrowserDialog d = new FolderBrowserDialog())
            {
                d.Description = "选择「" + Shared.AppName + "」的安装位置";
                d.ShowNewFolderButton = true;
                string cur = _txtDir.Text.Trim();
                try { if (Directory.Exists(cur)) { d.SelectedPath = cur; } }
                catch (Exception) { }
                if (d.ShowDialog(this) == DialogResult.OK)
                {
                    _txtDir.Text = Path.Combine(d.SelectedPath, Shared.AppName);
                }
            }
        }

        private void OpenRuntimePage(object sender, EventArgs e)
        {
            try { System.Diagnostics.Process.Start(Shared.WebView2Url); }
            catch (Exception) { }
        }

        private void CancelClick(object sender, EventArgs e)
        {
            Close();
        }

        private void PrimaryClick(object sender, EventArgs e)
        {
            if (_done) { Close(); return; }
            if (_installing) { return; }
            Install();
        }

        // 安装期间不许关窗。Status() 里的 Application.DoEvents() 会泵消息, 用户
        // 这时候点右上角关闭(或按 Alt+F4), 窗体先销毁、文件还在写, 失败弹窗最后
        // 挂在一个已经不存在的窗体上 —— 界面上就是"没了, 但磁盘还在动"。
        // 取消按钮同样在安装期间禁用, 想强行中止只能从任务管理器结束进程。
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (_installing && !_done)
            {
                e.Cancel = true;
                _lblStatus.Text = "正在安装, 请稍候…";
                _lblStatus.ForeColor = Shared.Warn;
                return;   // 已取消关闭, 不再走 base(否则仍会继续关闭流程)
            }
            base.OnFormClosing(e);
        }

        private void Status(string s, bool warn)
        {
            _lblStatus.Text = s;
            _lblStatus.ForeColor = warn ? Shared.Warn : Shared.TextDim;
            Application.DoEvents();
        }

        private void Install()
        {
            string err = Shared.EnsureDirUsable(_txtDir.Text.Trim());
            if (err != null)
            {
                MessageBox.Show(this, err, Shared.AppName + " 安装程序", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Status(err, true);
                return;
            }

            _installing = true;
            _btnPrimary.Enabled = false;
            _btnBrowse.Enabled = false;
            _btnCancel.Enabled = false;   // 安装期间取消按钮禁用 + OnFormClosing 拦关闭
            _txtDir.Enabled = false;
            _cbLocked = true;   // 安装开始后三个选项锁住, 不可再改
            _page1.Invalidate();

            bool wantDesktop = _cbDesktop.Checked;
            bool wantMenu = _cbMenu.Checked;
            bool wantRun = _cbRun.Checked;
            string dir = Path.GetFullPath(_txtDir.Text.Trim());

            // 目录里已经有别人的东西? 如实告诉用户, 并且承诺卸载时不动它们。
            // 不静默处理 —— 用户把安装位置选到 D:\我的资料 这类目录时, 必须当场知道。
            int preExisting = 0;
            try
            {
                if (Directory.Exists(dir))
                {
                    string[] pre = Directory.GetFileSystemEntries(dir);
                    int k;
                    for (k = 0; k < pre.Length; k++)
                    {
                        // 白名单判定与下面的标记判定共用 Shared.IsKnownEntry ——
                        // 口径必须一致, 否则覆盖安装会被当成"这目录里有别人的东西"
                        if (Shared.IsKnownEntry(dir, Path.GetFileName(pre[k]))) { continue; }
                        preExisting++;
                    }
                }
            }
            catch (Exception) { }

            _preExistingCount = preExisting;
            if (preExisting > 0)
            {
                string warn = "此文件夹已有 " + preExisting + " 个文件, 不属于「" + Shared.AppName + "」。"
                            + Environment.NewLine + Environment.NewLine
                            + "它们不会被覆盖, 卸载时也不会删除它们。"
                            + Environment.NewLine + Environment.NewLine
                            + "要继续安装到" + Environment.NewLine + dir + " 吗?";
                DialogResult dr = MessageBox.Show(this, warn, Shared.AppName + " 安装程序", MessageBoxButtons.OKCancel, MessageBoxIcon.Information, MessageBoxDefaultButton.Button2);
                if (dr != DialogResult.OK)
                {
                    // 用户在预警对话框上选择了"取消": 什么都没写, 必须把界面恢复成
                    // 可以再点一次"开始安装"的状态(以前这里直接 return, 主按钮和取消
                    // 按钮就永久禁用了, 只能重开程序)
                    Status("已取消安装。", false);
                    _installing = false;
                    _btnPrimary.Enabled = true;
                    _btnBrowse.Enabled = true;
                    _btnCancel.Enabled = true;
                    _txtDir.Enabled = true;
                    _cbLocked = false;
                    _page1.Invalidate();
                    return;
                }
            }

            _installing = true;
            _btnPrimary.Enabled = false;
            _btnBrowse.Enabled = false;
            _btnCancel.Enabled = false;   // 安装期间取消按钮禁用 + OnFormClosing 拦关闭
            _txtDir.Enabled = false;
            _cbLocked = true;
            _page1.Invalidate();

            List<string> made = new List<string>();
            bool ok;
            string fail = null;
            try
            {
                ok = DoInstall(dir, wantDesktop, wantMenu, made, out fail);
            }
            catch (Exception ex)
            {
                ok = false;
                fail = ex.Message;
            }

            if (!ok)
            {
                Status("安装失败: " + fail, true);
                int i;
                for (i = made.Count - 1; i >= 0; i--) { Shared.TryDelete(made[i]); }
                MessageBox.Show(this, "安装未完成: " + fail + Environment.NewLine + Environment.NewLine + "已回滚本次写入的文件。", Shared.AppName + " 安装程序", MessageBoxButtons.OK, MessageBoxIcon.Error);
                _installing = false;
                _btnPrimary.Enabled = true;
                _btnBrowse.Enabled = true;
                _btnCancel.Enabled = true;
                _txtDir.Enabled = true;
                _cbLocked = false;   // 安装失败回滚后重新放开
                _page1.Invalidate();
                SetProgress(0);
                return;
            }

            _done = true;
            _installOk = true;      // 只有真正装完才置位; 启动主程序只认这个标志
            _noRun = _noRun || !wantRun;
            ShowDone(dir, wantDesktop, wantMenu);
        }

        private void SetProgress(int v)
        {
            _prog.Value = v;
            _prog.Refresh();
        }

        private bool DoInstall(string dir, bool wantDesktop, bool wantMenu, List<string> made, out string fail)
        {
            fail = null;
            // 安装前先看清楚这个目录里有没有"不是我们的"东西: 这个事实会写进标记
            // 文件, 卸载时就是"能不能整个删掉"的依据。用户自己的目录永远不许整体递归删。
            // 判定必须逐个名字走白名单(Shared.IsKnownEntry): 我们自己上一版装进去的
            // exe/dll/说明/标记/卸载器/数据库载荷都算"我们的", 否则覆盖安装会把
            // CleanDirectory 从 1 翻成 0, 升级后再卸载就永久残留。
            bool dirExistedWithForeign = false;
            try
            {
                if (Directory.Exists(dir))
                {
                    string[] before = Directory.GetFileSystemEntries(dir);
                    int k;
                    for (k = 0; k < before.Length; k++)
                    {
                        if (Shared.IsKnownEntry(dir, Path.GetFileName(before[k]))) { continue; }
                        dirExistedWithForeign = true;
                        break;
                    }
                }
            }
            catch (Exception) { dirExistedWithForeign = true; }   // 看不清楚就当作"不是我们的"
            Directory.CreateDirectory(dir);

            Entry[] entries = Shared.PayloadEntries();
            int i;
            for (i = 0; i < entries.Length; i++)
            {
                Entry en = entries[i];
                string dest = Path.Combine(dir, en.Target);
                string parent = Path.GetDirectoryName(dest);
                if (!string.IsNullOrEmpty(parent)) { Directory.CreateDirectory(parent); }
                // 先登记再解压: 解压到一半失败会留下半成品文件, 它必须也进回滚清单 ——
                // 否则提示写着"已回滚本次写入的文件", 实际上留了个残缺的载荷在磁盘上。
                made.Add(dest);
                try
                {
                    ExtractOne(en.Id, dest);
                }
                catch (Exception ex)
                {
                    fail = "写入 " + en.Target + " 失败: " + ex.Message;
                    return false;
                }
                Status("正在安装: " + en.Target, false);
                SetProgress((int)((long)(i + 1) * 78 / entries.Length));
            }

            // 卸载程序: 由同一份源码用 /define:UNINSTALLER 编出的小 exe(约 40 KB), 构建时
            // GZip 成 qg.uninstaller.gz 编进本安装程序, 这里解压落盘。
            // 绝不 File.Copy(自身): 那会把 12.8 MB 的安装程序复制进安装目录, 白白多占
            // 12.7 MB 磁盘, 而且让卸载器背着一份它永远用不到的载荷。
            string un = Path.Combine(dir, Shared.UninstallerExe);
            made.Add(un);                       // 同载荷: 先登记再写, 失败也要回滚
            try
            {
                ExtractRes("qg.uninstaller.gz", un);
            }
            catch (Exception ex)
            {
                fail = "写入 " + Shared.UninstallerExe + " 失败: " + ex.Message;
                return false;
            }

            // 安装标记(安装信息.txt)。两个作用:
            //   1. 卸载时的"这是我们的目录"凭证 —— 没有它, 卸载器只删已知文件;
            //   2. 记录安装时该目录是不是本来就空的 —— 只有本来就是空的(我们新建的)
            //      目录, 卸载时才允许整体递归删除。
            // 用户把安装位置选到已有内容的文件夹时, 这个标记就是用户文件的保险。
            string marker = Path.Combine(dir, Shared.MarkerFile);
            try
            {
                StringBuilder mb = new StringBuilder();
                mb.Append("穷观学习 · 安装信息").Append("\r\n");
                mb.Append("======================================================\r\n");
                mb.Append("产品名称 : ").Append(Shared.AppName).Append("\r\n");
                mb.Append("版本     : ").Append(Shared.Version).Append("\r\n");
                mb.Append("Build ID : ").Append(Shared.BuildId).Append("\r\n");
                mb.Append("安装时间 : ").Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")).Append("\r\n");
                mb.Append("安装路径 : ").Append(dir).Append("\r\n");
                mb.Append("目录状态 : ").Append(dirExistedWithForeign
                    ? "安装前该目录已有内容; 卸载时只删除本程序的文件, 其余一律保留\r\n"
                    : "本程序新建的空目录; 卸载时可整体删除\r\n");
                mb.Append("CleanDirectory=").Append(dirExistedWithForeign ? "0" : "1").Append("\r\n");
                mb.Append("======================================================\r\n");
                mb.Append("请勿删除本文件: 卸载程序依赖它来确认这个目录属于「穷观学习」,\r\n");
                mb.Append("并在卸载时保护不属于本程序的文件。\r\n");
                File.WriteAllText(marker, mb.ToString(), new UTF8Encoding(true));
                made.Add(marker);
            }
            catch (Exception ex)
            {
                fail = "写入 " + Shared.MarkerFile + " 失败: " + ex.Message;
                return false;
            }

            // 桌面快捷方式: 必须走 shell SpecialFolders (本机桌面 = D:\OneDrive\Desktop)
            if (wantDesktop)
            {
                Status("正在创建桌面快捷方式…", false);
                string desk;
                try { desk = Shared.DesktopDir(); }
                catch (Exception ex) { fail = "无法定位桌面文件夹: " + ex.Message; return false; }
                if (string.IsNullOrEmpty(desk)) { fail = "无法定位桌面文件夹。"; return false; }
                _desktopLnk = Path.Combine(desk, Shared.LinkName);
                string e1 = Shared.CreateShortcut(_desktopLnk, Path.Combine(dir, Shared.MainExe), dir, Path.Combine(dir, Shared.MainExe), Shared.Description);
                if (e1 != null) { fail = "创建桌面快捷方式失败: " + e1; return false; }
            }
            SetProgress(86);

            // 开始菜单快捷方式
            if (wantMenu)
            {
                Status("正在创建开始菜单快捷方式…", false);
                string prog;
                try { prog = Shared.ProgramsDir(); }
                catch (Exception ex) { fail = "无法定位开始菜单文件夹: " + ex.Message; return false; }
                if (string.IsNullOrEmpty(prog)) { fail = "无法定位开始菜单文件夹。"; return false; }
                _startMenuLnk = Path.Combine(Path.Combine(prog, Shared.AppName), Shared.LinkName);
                string e2 = Shared.CreateShortcut(_startMenuLnk, Path.Combine(dir, Shared.MainExe), dir, Path.Combine(dir, Shared.MainExe), Shared.Description);
                if (e2 != null) { fail = "创建开始菜单快捷方式失败: " + e2; return false; }
            }
            SetProgress(92);

            Status("正在注册卸载信息…", false);
            try
            {
                WriteUninstallEntry(dir);
            }
            catch (Exception ex)
            {
                fail = "写入卸载注册表项失败: " + ex.Message;
                return false;
            }

            Status("安装完成。", false);
            SetProgress(100);
            return true;
        }

        private static void ExtractOne(int id, string dest)
        {
            ExtractRes("qg.payload." + id.ToString() + ".gz", dest);
        }

        // 把内嵌的 GZip 资源解压落盘。任何一步失败都抛异常, 由调用方回滚。
        //
        // 落盘后必须自己校验一次长度: 老 .NET 的 GZipStream 不校验 gzip 尾部的
        // CRC32/ISIZE, 载荷被截断时它会"成功"解压出半截文件来 —— 那会装出一个
        // 打不开的主程序或读不全的语料, 而且安装界面还报成功。ISIZE 是未压缩
        // 字节数的低 32 位(最大的语料 49 MB, 不会溢出), 直接读尾部 4 字节即可。
        private static void ExtractRes(string res, string dest)
        {
            Stream raw = Assembly.GetExecutingAssembly().GetManifestResourceStream(res);
            if (raw == null) { throw new InvalidOperationException("安装包内缺少资源 " + res); }
            try
            {
                long expected = GzipIsize(raw);
                long written = 0;
                using (GZipStream gz = new GZipStream(raw, CompressionMode.Decompress))
                {
                    using (FileStream fs = new FileStream(dest, FileMode.Create, FileAccess.Write, FileShare.None, 131072))
                    {
                        byte[] buf = new byte[131072];
                        int n;
                        while ((n = gz.Read(buf, 0, buf.Length)) > 0)
                        {
                            fs.Write(buf, 0, n);
                            written += n;
                        }
                        fs.Flush();
                    }
                }
                if (expected >= 0 && written != expected)
                {
                    throw new InvalidDataException("资源 " + res + " 解压后长度不符: 期望 "
                        + expected.ToString() + " 字节, 实际 " + written.ToString() + " 字节");
                }
            }
            finally
            {
                raw.Dispose();
            }
        }

        // gzip 流最后 4 字节 = ISIZE(未压缩长度, 小端, 低 32 位)。返回 -1 表示
        // 读不到(资源流不可定位等) —— 那种情况下跳过校验, 不因此判定安装失败。
        private static long GzipIsize(Stream raw)
        {
            try
            {
                if (raw == null || !raw.CanSeek || raw.Length < 18) { return -1; }
                long save = raw.Position;
                raw.Seek(-4, SeekOrigin.End);
                int b0 = raw.ReadByte();
                int b1 = raw.ReadByte();
                int b2 = raw.ReadByte();
                int b3 = raw.ReadByte();
                raw.Seek(save, SeekOrigin.Begin);
                if (b0 < 0 || b1 < 0 || b2 < 0 || b3 < 0) { return -1; }
                return (long)((uint)b0 | ((uint)b1 << 8) | ((uint)b2 << 16) | ((uint)b3 << 24));
            }
            catch (Exception) { return -1; }
        }

        private static long DirSizeKb(string dir)
        {
            long total = 0;
            try
            {
                string[] files = Directory.GetFiles(dir, "*", SearchOption.AllDirectories);
                int i;
                for (i = 0; i < files.Length; i++)
                {
                    try { total += new FileInfo(files[i]).Length; }
                    catch (Exception) { }
                }
            }
            catch (Exception) { }
            return total / 1024;
        }

        private static void WriteUninstallEntry(string dir)
        {
            string exe = Path.Combine(dir, Shared.MainExe);
            string un = Path.Combine(dir, Shared.UninstallerExe);
            RegistryKey k = Registry.CurrentUser.CreateSubKey(Shared.UninstallRegPath);
            try
            {
                k.SetValue("DisplayName", Shared.AppName, RegistryValueKind.String);
                k.SetValue("DisplayVersion", Shared.Version, RegistryValueKind.String);
                k.SetValue("Publisher", Shared.Publisher, RegistryValueKind.String);
                k.SetValue("DisplayIcon", exe + ",0", RegistryValueKind.String);
                k.SetValue("UninstallString", "\"" + un + "\"", RegistryValueKind.String);
                k.SetValue("QuietUninstallString", "\"" + un + "\" /S", RegistryValueKind.String);
                k.SetValue("InstallLocation", dir, RegistryValueKind.String);
                k.SetValue("EstimatedSize", (int)DirSizeKb(dir), RegistryValueKind.DWord);
                k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
            finally
            {
                k.Close();
            }
        }

        private void ShowDone(string dir, bool wantDesktop, bool wantMenu)
        {
            _page1.Visible = false;
            _page2.Visible = true;
            _btnCancel.Visible = false;
            _btnPrimary.Text = "完成";
            _btnPrimary.Enabled = true;
            _lblStatus.Text = "";
            _prog.Visible = false;

            StringBuilder sb = new StringBuilder();
            sb.Append("已安装到  ").Append(dir).Append(Environment.NewLine);
            if (wantDesktop && wantMenu) { sb.Append("已在桌面和开始菜单创建「" + Shared.AppName + "」快捷方式。"); }
            else if (wantDesktop) { sb.Append("已在桌面创建「" + Shared.AppName + "」快捷方式。"); }
            else if (wantMenu) { sb.Append("已在开始菜单创建「" + Shared.AppName + "」快捷方式。"); }
            else { sb.Append("未创建快捷方式。"); }
            _lblDoneSub.Text = sb.ToString();

            if (_runtime == null)
            {
                _lblRuntime.Text = "未检测到 Microsoft Edge WebView2 运行时," + Environment.NewLine + "首次启动前请先安装该运行时(免费)。";
                _lblRuntime.Visible = true;
                _lnkRuntime.Visible = true;
            }
            else
            {
                _lblRuntime.Text = "已检测到 Microsoft Edge WebView2 运行时 " + _runtime + "。";
                _lblRuntime.ForeColor = Shared.TextDim;
                _lblRuntime.Visible = true;
                _lnkRuntime.Visible = false;
            }
        }

        // ------------------------- 静默模式 -------------------------
        public int RunSilent()
        {
            string err = Shared.EnsureDirUsable(_dir);
            if (err != null)
            {
                Console.Error.WriteLine("INSTALL FAILED: " + err);
                return 2;
            }
            string dir = Path.GetFullPath(_dir);
            List<string> made = new List<string>();
            string fail = null;
            bool ok;
            try
            {
                ok = DoInstall(dir, !_noDesktop, !_noStartMenu, made, out fail);
            }
            catch (Exception ex)
            {
                ok = false;
                fail = ex.Message;
            }
            if (!ok)
            {
                Console.Error.WriteLine("INSTALL FAILED: " + fail);
                int i;
                for (i = made.Count - 1; i >= 0; i--) { Shared.TryDelete(made[i]); }
                return 3;
            }
            Console.Out.WriteLine("INSTALL OK " + dir);
            _installOk = true;
            return 0;
        }

        // 截图: 只渲染界面, 不安装任何东西
        //
        // DrawToBitmap on a form that was never shown paints the form's own background
        // and nothing else: Form.CreateControl() only creates a top-level handle while
        // the form is Visible, and without that handle no child control is ever created,
        // so WM_PRINT never reaches them and the PNG comes out as an empty dark
        // rectangle -- exactly what the first /SHOT produced. So: pin the form at
        // (-32000,-32000) with StartPosition.Manual, show it *there*, force every child
        // handle, render, then hide it. Nothing is ever painted on the real desktop.
        public void WriteShot(string pngPath)
        {
            Point savedLoc = Location;
            FormStartPosition savedStart = StartPosition;
            _lblStatus.Text = "准备就绪。选择安装位置后点击「开始安装」。";
            try
            {
                StartPosition = FormStartPosition.Manual;
                Location = new Point(-32000, -32000);
                Show();              // off-screen: creates handles, no visible flash
                CreateHandles(this);
                PerformLayout();
                Application.DoEvents();
                using (Bitmap bmp = new Bitmap(ClientSize.Width, ClientSize.Height, PixelFormat.Format32bppArgb))
                {
                    bmp.SetResolution(96f, 96f);
                    DrawToBitmap(bmp, new Rectangle(0, 0, ClientSize.Width, ClientSize.Height));
                    string parent = Path.GetDirectoryName(pngPath);
                    if (!string.IsNullOrEmpty(parent)) { Directory.CreateDirectory(parent); }
                    bmp.Save(pngPath, ImageFormat.Png);
                }
            }
            finally
            {
                Hide();
                StartPosition = savedStart;
                Location = savedLoc;
            }
        }

        private static void CreateHandles(Control c)
        {
            int i;
            for (i = 0; i < c.Controls.Count; i++) { CreateHandles(c.Controls[i]); }
            if (!c.IsHandleCreated) { c.CreateControl(); }
        }

        [DllImport("user32.dll")]
        private static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint flags);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

        // /SHOTFULL: 连非客户区(标题栏/边框)一起截图。DrawToBitmap 只画客户区,
        // 所以沉浸式深色标题栏在普通截图里根本看不见 —— 而它恰恰是要验收的部分。
        // PrintWindow 配 PW_RENDERFULLCONTENT(2) 能把整窗(含 DWM 合成的标题栏)
        // 画进位图; 窗口全程停在屏幕外, 桌面上不会闪一下。
        public void WriteFullShot(string pngPath)
        {
            Point savedLoc = Location;
            FormStartPosition savedStart = StartPosition;
            _lblStatus.Text = "准备就绪。选择安装位置后点击「开始安装」。";
            // 窗口停在 (-32000,-32000) 时, DWM/PrintWindow 对部分子控件会画出被
            // 裁剪的残影(屏幕上看完全正常, 只有离屏截图才出现)。/ONSCREEN 让窗口
            // 就在屏幕上渲染后截图, 用来区分"真渲染问题"和"离屏截图的假象"。
            bool onScreen = Shared.HasFlag(_args, "/ONSCREEN");
            try
            {
                StartPosition = FormStartPosition.Manual;
                Location = onScreen ? new Point(60, 60) : new Point(-32000, -32000);
                Show();
                if (onScreen) { Activate(); }
                CreateHandles(this);
                PerformLayout();
                Application.DoEvents();

                Shared.ApplyDarkTitleBar(Handle);      // 保证截到的是深色标题栏
                Application.DoEvents();
                System.Threading.Thread.Sleep(120);    // 给 DWM 一点时间重画非客户区

                RECT r;
                if (!GetWindowRect(Handle, out r)) { throw new InvalidOperationException("GetWindowRect 失败"); }
                int w = r.Right - r.Left;
                int h = r.Bottom - r.Top;
                Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
                bmp.SetResolution(96f, 96f);
                try
                {
                    if (onScreen)
                    {
                        // /ONSCREEN: 直接从屏幕 DC 抠图, 拿到的就是显示器上真实的像素,
                        // 不经过 PrintWindow 的 WM_PRINT 合成 —— 那条路对自绘子控件
                        // 会画出重影(五种 ControlStyles 组合都复现过), 属于截图假象。
                        Application.DoEvents();
                        System.Threading.Thread.Sleep(300);
                        using (Graphics g = Graphics.FromImage(bmp))
                        {
                            g.CopyFromScreen(r.Left, r.Top, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);
                        }
                    }
                    else
                    {
                        using (Graphics g = Graphics.FromImage(bmp))
                        {
                            IntPtr hdc = g.GetHdc();
                            try { PrintWindow(Handle, hdc, 2); }
                            finally { g.ReleaseHdc(hdc); }
                        }
                    }
                    string parent = Path.GetDirectoryName(pngPath);
                    if (!string.IsNullOrEmpty(parent)) { Directory.CreateDirectory(parent); }
                    bmp.Save(pngPath, ImageFormat.Png);
                }
                finally
                {
                    bmp.Dispose();
                }
            }
            finally
            {
                Hide();
                StartPosition = savedStart;
                Location = savedLoc;
            }
        }

        public string DesktopLnkPath { get { return _desktopLnk; } }
        public string StartMenuLnkPath { get { return _startMenuLnk; } }
        public bool NoRun { get { return _noRun; } }
        // 启动主程序的唯一依据。以前只看"主程序 exe 在不在", 于是取消安装/装到一半
        // 关窗, 都会把机器上已经装好的旧版本启动起来。
        public bool InstallSucceeded { get { return _installOk; } }
    }

    // ------------------------------------------------------------------
    //  卸载程序 (csc /define:UNINSTALLER 编出的小 exe; 亦可由安装程序 /UNINSTALL 代跑)
    // ------------------------------------------------------------------
    internal static class Uninstaller
    {
        // 返回 0 = 已卸载; 1 = 用户取消; 2 = 出错; 3 = 未找到安装
        internal static int Run(bool quiet)
        {
            string dir = Shared.TryGetInstallDir();
            if (string.IsNullOrEmpty(dir)) { dir = Shared.DefaultDir(); }

            bool exists = Directory.Exists(dir);
            Dbg("dir=" + dir + " exists=" + exists);
            string regPath = Shared.UninstallRegPath;
            bool regExists;
            using (RegistryKey rk = Registry.CurrentUser.OpenSubKey(regPath, false)) { regExists = rk != null; }

            if (!exists && !regExists)
            {
                if (!quiet) { MessageBox.Show("未找到「" + Shared.AppName + "」的安装记录, 可能已经卸载。", Shared.AppName + " 卸载程序", MessageBoxButtons.OK, MessageBoxIcon.Information); }
                return 3;
            }

            if (!quiet)
            {
                string msg = "确定要卸载「" + Shared.AppName + "」吗?" + Environment.NewLine + Environment.NewLine +
                             "安装位置: " + dir + Environment.NewLine +
                             "卸载不会删除 数据库\\" + Shared.DbSubjects + " 等个人数据(若存在)。" + Environment.NewLine +
                             "个人知识点、自绘函数及 API Key 所在的 " + Shared.Wv2CacheDir + " 配置目录也会保留,重装到原位置可继续使用。";
                DialogResult r = MessageBox.Show(msg, Shared.AppName + " 卸载程序", MessageBoxButtons.OKCancel, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2);
                if (r != DialogResult.OK) { return 1; }
            }

            List<string> problems = new List<string>();
            List<string> notes = new List<string>();

            // 1) 注册表: 设置 -> 应用 里的条目
            try { Registry.CurrentUser.DeleteSubKeyTree(regPath, false); }
            catch (Exception ex) { problems.Add("注册表项删除失败: " + ex.Message); }

            // 2) 桌面快捷方式 (走 shell SpecialFolders, 不硬编码路径)
            try
            {
                string desk = Shared.DesktopDir();
                if (!string.IsNullOrEmpty(desk)) { Shared.TryDelete(Path.Combine(desk, Shared.LinkName)); }
            }
            catch (Exception ex) { problems.Add("桌面快捷方式删除失败: " + ex.Message); }

            // 3) 开始菜单快捷方式 (连带空文件夹)
            try
            {
                string prog = Shared.ProgramsDir();
                if (!string.IsNullOrEmpty(prog))
                {
                    string folder = Path.Combine(prog, Shared.AppName);
                    Shared.TryDelete(Path.Combine(folder, Shared.LinkName));
                    try
                    {
                        if (Directory.Exists(folder) && Directory.GetFileSystemEntries(folder).Length == 0) { Directory.Delete(folder, false); }
                    }
                    catch (Exception) { }
                }
            }
            catch (Exception ex) { problems.Add("开始菜单快捷方式删除失败: " + ex.Message); }

            // 4) 安装目录。这一步是整个卸载里唯一有破坏性的动作, 所以处处从严:
            //    宁可留下一个空目录, 也绝不误删用户自己的文件。
            //
            //    闸门 canWipe = 目录不在黑名单 + 有本程序的安装标记 + 标记里写着
            //    CleanDirectory=1(安装时这个目录是本程序新建的空目录)。三者缺一,
            //    就退化成"只删已知文件", 一次递归删除都不会发生。
            // 闸门只在这里判定一次, 第 5 步直接复用这个结论。绝不能在删掉标记文件
            // 之后再判一次 —— 那时凭证已经没了, 重新判定必然为假, 收尾进程就永远
            // 起不来, 卸载器自己的 exe 会被永久留在目录里(实测踩到过)。
            bool wipedClean = false;
            string gateReason = null;
            bool canWipe = exists && FullWipeAllowed(dir, out gateReason);
            Dbg("gate canWipe=" + canWipe + " reason=" + gateReason);

            string self = Application.ExecutablePath;
            string selfName = null;
            try { selfName = Path.GetFileName(self); }
            catch (Exception) { }
            bool selfInDir = false;
            try
            {
                if (!string.IsNullOrEmpty(dir) && self.StartsWith(dir, StringComparison.OrdinalIgnoreCase)) { selfInDir = true; }
            }
            catch (Exception) { }
            bool selfIsUninstaller = selfName != null
                && string.Compare(selfName, Shared.UninstallerExe, StringComparison.OrdinalIgnoreCase) == 0;

            // 必须保留的用户数据(用户自己积累的知识云)。"整体递归删除"和"只删已知
            // 文件"两条路径遵守同一份保留清单: 整体删除前先把它挪出目录, 删完再放回。
            // 以前只有"只删已知文件"那条路保留它, 整体删除(安装程序 /UNINSTALL, 或
            // 用户把卸载器复制到别处运行)会连它一起删掉。
            string keepPath = Path.Combine(dir, Path.Combine(Shared.DbDir, Shared.DbSubjects));
            string stashed = null;
            if (exists)
            {
                // 卸载器自身正占着安装目录, 先把工作目录挪走, 否则删不掉当前目录
                try { Environment.CurrentDirectory = Path.GetTempPath(); }
                catch (Exception) { }

                if (canWipe && File.Exists(keepPath)) { stashed = StashOut(keepPath); }

                if (canWipe)
                {
                    bool wiped = false;
                    bool recursive = false;
                    try
                    {
                        Directory.Delete(dir, true);
                        wiped = true;
                        recursive = true;
                    }
                    catch (Exception)
                    {
                        // 预期内: 卸载器自己的 exe 正被这个进程锁着, 整目录删必然失败。
                        // 改成逐个删已知文件, 把自己留给收尾进程处理。
                        DeleteKnownFiles(dir);
                        if (OnlySelfRemains(dir))
                        {
                            // 只剩我们自己 = 实质上已经卸干净, 交给 SpawnSelfCleanup
                            wiped = true;
                        }
                        else
                        {
                            try
                            {
                                // 只有"确认目录已经空了"(CountEntries == 0)才删目录本身:
                                // 枚举失败会返回 -1, 那必须当成"还有东西"。枚举要
                                // ListDirectory 权限而删除只要 Delete 权限, ACL 可以只给
                                // 后者 —— 旧代码判的是 left > 0, -1 会落进 else 分支, 等于
                                // 把看不见的内容一并递归删掉 (fail-open)。
                                if (Directory.Exists(dir) && CountEntries(dir) == 0) { Directory.Delete(dir, false); wiped = true; }
                            }
                            catch (Exception) { }
                        }
                    }
                    Dbg("stage4 canWipe: recursive=" + recursive + " wiped=" + wiped);
                    wipedClean = wiped;
                    if (!wiped) { notes.Add("安装目录未能整体删除, 已改为只删除本程序的文件: " + dir); }
                }
                else
                {
                    // 目录不是纯粹的"我们的地盘": 只删自己写进去的东西, 不做任何递归删除
                    DeleteKnownFiles(dir);
                    if (gateReason != null) { notes.Add("未整体删除安装目录(" + gateReason + ")。"); }
                }

                // 用户数据放回原位(整体删除成功过也一样 —— 它本来就不该被删)
                if (stashed != null && !RestoreBack(stashed, keepPath))
                {
                    problems.Add("您的个人数据没能放回原位, 临时副本在 " + stashed + " , 请手动移回 " + keepPath);
                }
            }

            // 4b) 如实报告目录里还剩什么。提示必须是真的: "只剩下正在运行的卸载器
            //     自己"不能说成"还有 1 个不属于本程序的文件", 保留在目录里的用户
            //     数据也必须明说。
            if (exists && File.Exists(keepPath)) { notes.Add("已保留您的个人数据: " + keepPath); }
            if (Directory.Exists(Path.Combine(dir, Shared.Wv2CacheDir))) notes.Add("已保留个人学习数据和本机设置: " + Path.Combine(dir, Shared.Wv2CacheDir));
            if (exists && Directory.Exists(dir))
            {
                int left = CountEntries(dir);
                Dbg("leftovers total=" + left + " (>=0 real count, -1 = 枚举失败/不可读)");
                if (left < 0)
                {
                    // 枚举失败(例如 ACL 只给了 Delete 没给 ListDirectory): 一个字都不删,
                    // 并如实说明 —— 绝不能把"没看见"当成"里面没东西"
                    notes.Add("无法列出安装目录内容(可能缺少列出权限), 目录内全部内容均已保留: " + dir);
                }
                else if (left > 0)
                {
                    int foreign = CountForeignEntries(dir, keepPath);
                    List<string> parts = new List<string>();
                    if (selfInDir && File.Exists(self))
                    {
                        parts.Add("本程序自己的 " + selfName + "(正在运行, 无法自我删除)");
                    }
                    if (File.Exists(keepPath)) { parts.Add("您的个人数据 " + Shared.DbSubjects); }
                    if (foreign > 0) { parts.Add(foreign + " 项不属于本程序的内容"); }
                    if (foreign < 0) { parts.Add("一些未能清点的内容"); }
                    string what = parts.Count == 0 ? "一些空目录或未能归类的残留" : string.Join(", ", parts.ToArray());
                    notes.Add("安装目录里仍保留着: " + what + " (" + dir + ")");
                }
            }

            // 5) 收尾: 本进程删不掉自己(正在运行的 exe 被系统锁着), 所以把自己复制到
            //    %TEMP%, 再以 /CLEANUP=<目录> 让那份副本在父进程退出后接着收尾。
            //    只有在 canWipe 为真(与卸载本身同一道闸门)时才会启动收尾进程 ——
            //    找不到安装标记的目录绝不会启动任何后台删除。
            Dbg("selfInDir=" + selfInDir + " selfIsUninstaller=" + selfIsUninstaller
                + " wipedClean=" + wipedClean + " canWipe=" + canWipe);
            if (selfInDir && selfIsUninstaller && wipedClean && canWipe && File.Exists(self))
            {
                Dbg("stage5 SPAWNING cleanup for " + dir);
                if (!SpawnSelfCleanup(dir))
                {
                    problems.Add("卸载程序自身未能自动删除, 请手动删除: " + self);
                }
            }

            if (problems.Count > 0)
            {
                if (!quiet)
                {
                    MessageBox.Show("卸载完成, 但有残留:" + Environment.NewLine + string.Join(Environment.NewLine, problems.ToArray()), Shared.AppName + " 卸载程序", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
                return 2;
            }

            if (!quiet)
            {
                string body = "「" + Shared.AppName + "」已卸载。";
                if (notes.Count > 0)
                {
                    body += Environment.NewLine + Environment.NewLine + string.Join(Environment.NewLine, notes.ToArray());
                }
                MessageBox.Show(body, Shared.AppName + " 卸载程序", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            return 0;
        }

        // ---------------------------------------------------------------
        //  删除闸门。任何递归删除都必须先过这里, 不允许绕过。
        // ---------------------------------------------------------------
        internal static bool FullWipeAllowed(string dir, out string reason)
        {
            reason = null;
            if (string.IsNullOrEmpty(dir)) { reason = "安装路径为空"; return false; }

            string full;
            try { full = Path.GetFullPath(dir).TrimEnd('\\', '/'); }
            catch (Exception) { reason = "路径无法解析"; return false; }
            if (full.Length < 4) { reason = "路径过短, 疑似盘根"; return false; }

            // 盘根绝不允许递归删除
            try
            {
                string root = Path.GetPathRoot(full);
                if (!string.IsNullOrEmpty(root))
                {
                    string r = root.TrimEnd('\\', '/');
                    if (string.Compare(r, full, StringComparison.OrdinalIgnoreCase) == 0)
                    {
                        reason = "这是盘根目录, 拒绝删除";
                        return false;
                    }
                }
            }
            catch (Exception) { reason = "无法判断是否为盘根"; return false; }

            // 系统/用户关键目录黑名单(全路径比较, 忽略大小写与尾分隔符)。
            // 这里刻意 *不* 包含 Shared.DefaultDir() 本身 —— 它就是本安装程序的默认
            // 安装位置(%LOCALAPPDATA%\Programs\穷观学习), 是我们自己的目录, 拉黑它
            // 只会让默认路径下的卸载永远退化成"只删已知文件", 最后留下一个删不掉的
            // 卸载器和一句假提示。真正需要保护的是父目录 %LOCALAPPDATA%\Programs,
            // 而它永远不可能成为 InstallLocation(EnsureDirUsable 会拒绝)。
            string[] forbidden = new string[]
            {
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                Environment.GetFolderPath(Environment.SpecialFolder.Personal),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                Environment.GetFolderPath(Environment.SpecialFolder.System),
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory),
                Path.GetTempPath()
            };
            int i;
            for (i = 0; i < forbidden.Length; i++)
            {
                string f = forbidden[i];
                if (string.IsNullOrEmpty(f)) { continue; }
                try
                {
                    f = Path.GetFullPath(f).TrimEnd('\\', '/');
                    if (string.Compare(f, full, StringComparison.OrdinalIgnoreCase) == 0)
                    {
                        reason = "这是系统或用户的关键目录, 拒绝整体删除";
                        return false;
                    }
                }
                catch (Exception) { }
            }

            // WebView2 包含真正的学习笔记与自绘函数,不是可丢弃缓存。
            // 枚举失败时不允许整体删除,防止权限问题被当作目录不存在。
            try
            {
                foreach (string entry in Directory.GetFileSystemEntries(full))
                {
                    if (string.Equals(Path.GetFileName(entry), Shared.Wv2CacheDir, StringComparison.OrdinalIgnoreCase))
                    {
                        reason = "保留个人学习数据和本机设置";
                        return false;
                    }
                }
            }
            catch (Exception) { reason = "无法检查个人学习数据"; return false; }

            // 唯一的凭证: 安装时写的标记文件, 并且标记里必须写着 CleanDirectory=1
            // (安装当时这个目录是本程序新建的空目录)。这两条同时成立, 才允许把整个
            // 目录递归删掉。标记里还带着"安装前这个目录是不是空的", 那个才是能否整体
            // 递归删除的决定性依据 —— 用户把程序装进自己的资料文件夹时
            // CleanDirectory=0, 这里就退回到"只删已知文件"。
            //
            // 这里以前还有一条"兜底": 只要目录里有 穷观学习.exe + 一个 WebView2 dll
            // 就 return true, 完全跳过 CleanDirectory。那是唯一一条确定的误删路径:
            // 用户把程序装进 D:\我的资料(标记写 CleanDirectory=0), 之后标记文件被
            // 删掉/被记事本另存成 ANSI(UTF-8 读不出产品名), 或者留着旧版卸载器导致
            // BuildId 对不上 —— 兜底一成立, Directory.Delete(dir, true) 就把用户
            // 整个资料目录连子目录一起删光。兜底已删除: 没有有效标记一律不整体删除。
            if (HasOurMarker(full))
            {
                if (!MarkerSaysCleanDir(full))
                {
                    reason = "安装时该目录已有其他文件, 只删除本程序的文件";
                    return false;
                }
                return true;
            }

            reason = "未找到安装标记";
            return false;
        }

        internal static bool HasOurMarker(string dir)
        {
            try
            {
                string p = Path.Combine(dir, Shared.MarkerFile);
                if (!File.Exists(p)) { return false; }
                string text = File.ReadAllText(p, Encoding.UTF8);
                // 认"产品名 + 标记头", 不再要求 Build ID 精确匹配 —— 安装程序与
                // 卸载器版本不同步(用户留着上一版的卸载器)时不该因此丢掉凭证。
                // 能不能整体递归删除另由 MarkerSaysCleanDir 决定, 与凭证本身无关。
                return text.IndexOf(Shared.AppName, StringComparison.Ordinal) >= 0
                    && text.IndexOf(Shared.MarkerHeader, StringComparison.Ordinal) >= 0;
            }
            catch (Exception) { return false; }
        }

        // 标记里 CleanDirectory=1 表示"安装时这个目录是本程序新建的空目录",
        // 只有这种情况才允许把整个目录递归删掉。读不到那一行(旧版标记、被记事本
        // 另存成 ANSI、被截断)一律按最保守的 0 处理。
        internal static bool MarkerSaysCleanDir(string dir)
        {
            try
            {
                string p = Path.Combine(dir, Shared.MarkerFile);
                if (!File.Exists(p)) { return false; }
                string[] lines = File.ReadAllLines(p, Encoding.UTF8);
                int i;
                for (i = 0; i < lines.Length; i++)
                {
                    string line = lines[i].Trim();
                    if (line.StartsWith("CleanDirectory=", StringComparison.OrdinalIgnoreCase))
                    {
                        return line.Substring("CleanDirectory=".Length).Trim() == "1";
                    }
                }
                return false;
            }
            catch (Exception) { return false; }
        }

        // 只删本程序已知写进去的东西, 其它一律不碰。任何"递归删除"都不在这里发生
        // WebView2 配置目录内有个人学习数据,必须完整保留。
        // 刻意保留: 数据库\qg_subjects.txt(用户自己积累的知识云)。
        // 语料 qg_corpus.txt 是我们装进去的载荷, 属于"已知文件", 要删 —— 49 MB,
        // 留下它等于卸载没卸干净。
        internal static void DeleteKnownFiles(string dir)
        {
            string[] known = new string[]
            {
                Shared.MainExe,
                "Microsoft.Web.WebView2.Core.dll",
                "Microsoft.Web.WebView2.WinForms.dll",
                "WebView2Loader.dll",
                Shared.ManualFile,
                Shared.MarkerFile,
                Shared.UninstallerExe,
                Path.Combine(Shared.DbDir, Shared.DbCorpus)
            };
            int i;
            for (i = 0; i < known.Length; i++)
            {
                Shared.TryDelete(Path.Combine(dir, known[i]));
            }
            // 保留 WebView2 配置目录:包含 localStorage 中的笔记、自绘函数和 API Key。
            // 数据库目录只在空了之后才删, qg_subjects.txt 留着
            try
            {
                string db = Path.Combine(dir, Shared.DbDir);
                if (Directory.Exists(db) && Directory.GetFileSystemEntries(db).Length == 0) { Directory.Delete(db, false); }
            }
            catch (Exception) { }
        }

        // 目录里的条目总数; 枚举失败返回 -1。
        // **调用方必须把 -1 当成"还有东西"**: 枚举需要 ListDirectory 权限, 而删除
        // 只需要 Delete 权限, ACL 完全可以只给后者。旧代码在"只删已知文件"那条路
        // 上判的是 left > 0, -1 会落进 else 分支去执行 Directory.Delete(dir, true),
        // 这是典型的 fail-open。
        internal static int CountEntries(string dir)
        {
            try { return Directory.GetFileSystemEntries(dir).Length; }
            catch (Exception) { return -1; }
        }

        // 目录里还剩多少"不属于本程序、也不是必须保留的用户数据"的条目(用于如实提示)。
        // 卸载器自身(正在运行, 删不掉)与 keepPath(用户数据)单独提示, 不在这里计数。
        // 枚举失败返回 -1。
        internal static int CountForeignEntries(string dir, string keepPath)
        {
            try
            {
                string keep = null;
                if (!string.IsNullOrEmpty(keepPath))
                {
                    try { keep = Path.GetFullPath(keepPath).TrimEnd('\\', '/'); }
                    catch (Exception) { keep = null; }
                }
                string[] entries = Directory.GetFileSystemEntries(dir);
                int n = 0;
                int i;
                for (i = 0; i < entries.Length; i++)
                {
                    string name = Path.GetFileName(entries[i]);
                    if (string.Compare(name, Shared.UninstallerExe, StringComparison.OrdinalIgnoreCase) == 0) { continue; }
                    if (keep != null)
                    {
                        string full = null;
                        try { full = Path.GetFullPath(entries[i]).TrimEnd('\\', '/'); }
                        catch (Exception) { }
                        if (full != null && string.Compare(full, keep, StringComparison.OrdinalIgnoreCase) == 0) { continue; }
                    }
                    if (Shared.IsKnownEntry(dir, name)) { continue; }
                    n++;
                }
                return n;
            }
            catch (Exception) { return -1; }
        }

        // 把必须保留的用户数据复制到 %TEMP% 下的临时副本(整体递归删除之前用)。
        // 用 Copy 而不是 Move: 中途失败也绝不丢原件。返回 null = 失败。
        internal static string StashOut(string src)
        {
            try
            {
                string tmp = Path.Combine(Path.GetTempPath(),
                    "qg_keep_" + Guid.NewGuid().ToString("N") + ".dat");
                File.Copy(src, tmp, true);
                return tmp;
            }
            catch (Exception) { return null; }
        }

        // 把临时副本放回原位(必要时重建父目录), 成功返回 true 并删掉临时副本。
        internal static bool RestoreBack(string tmp, string dest)
        {
            try
            {
                string parent = Path.GetDirectoryName(dest);
                if (!string.IsNullOrEmpty(parent)) { Directory.CreateDirectory(parent); }
                File.Copy(tmp, dest, true);
                if (!File.Exists(dest)) { return false; }
                Shared.TryDelete(tmp);
                return true;
            }
            catch (Exception) { return false; }
        }

        // 目录里是不是只剩卸载器自己了(我们自己删不掉自己, 必须放行)。
        // 空子目录也算"只剩自己", 收尾进程会把它们一起带走。
        internal static bool OnlySelfRemains(string dir)
        {
            try
            {
                if (!Directory.Exists(dir)) { return true; }
                string self = Path.GetFileName(Application.ExecutablePath);
                string[] entries = Directory.GetFileSystemEntries(dir);
                int i;
                for (i = 0; i < entries.Length; i++)
                {
                    string name = Path.GetFileName(entries[i]);
                    if (Directory.Exists(entries[i]))
                    {
                        if (Directory.GetFileSystemEntries(entries[i]).Length != 0) { return false; }
                        continue;
                    }
                    if (string.Compare(name, self, StringComparison.OrdinalIgnoreCase) != 0) { return false; }
                }
                return true;
            }
            catch (Exception) { return false; }
        }

        // 收尾进程会把整个目录 rd 掉, 所以只有在"确认目录里已经只剩我们自己的残骸"
        // 时才允许启动。宁可留一个空目录, 也不许删错东西。
        internal static bool SelfCleanupWouldBeSafe(string dir)
        {
            try
            {
                if (!Directory.Exists(dir)) { return false; }
                string self = Path.GetFileName(Application.ExecutablePath);
                string[] entries = Directory.GetFileSystemEntries(dir);
                int i;
                for (i = 0; i < entries.Length; i++)
                {
                    string name = Path.GetFileName(entries[i]);
                    if (string.Compare(name, self, StringComparison.OrdinalIgnoreCase) == 0) { continue; }
                    if (Directory.Exists(entries[i]))
                    {
                        // 子目录必须为空才认
                        if (Directory.GetFileSystemEntries(entries[i]).Length != 0) { return false; }
                        continue;
                    }
                    return false;   // 还有别的文件: 不交给 rd
                }
                return true;
            }
            catch (Exception) { return false; }
        }

        // 收尾。本进程删不掉自己(正在运行的 exe 被系统锁着), 所以:
        //   1) 把自己复制到 %TEMP%, 用 /CLEANUP=<安装目录> /WAITPID=<本进程 pid>
        //      启动那份副本 —— 它是托管代码, 安装目录的路径以**参数**传递, 全程
        //      不经过任何 shell, 所以路径里的 '%' 之类不会被二次解析;
        //   2) 那份副本等本进程退出后再删掉安装目录里最后的残骸。
        //
        // 以前这里是把 dir 拼进 cmd 的命令行交给 cmd 去 rd /s /q: '%' 在 Windows
        // 文件名里合法, 而且在双引号内照样会被 cmd 展开(rd 有可能删到别的路径),
        // "ping -n 3" 在 ICMP 被挡时立刻返回等于没有延迟, rd 失败也没人管。
        //
        // 只有调用方过了 FullWipeAllowed 闸门(canWipe)才会走到这里。
        // 返回 false = 没能启动收尾进程, 调用方如实报告残留。
        private static bool SpawnSelfCleanup(string dir)
        {
            string temp = null;
            try
            {
                int pid = System.Diagnostics.Process.GetCurrentProcess().Id;
                string d = dir.TrimEnd('\\', '/');
                temp = Path.Combine(Path.GetTempPath(),
                    "qg_uni_" + pid.ToString() + "_" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".exe");
                File.Copy(Application.ExecutablePath, temp, true);
                if (!File.Exists(temp)) { return false; }

                System.Diagnostics.ProcessStartInfo psi = new System.Diagnostics.ProcessStartInfo(temp);
                // UseShellExecute=false: 命令行原样交给 CreateProcess, 不经过 shell
                psi.Arguments = "/CLEANUP=\"" + d + "\" /WAITPID=" + pid.ToString();
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden;
                psi.WorkingDirectory = Path.GetTempPath();   // 别让副本的工作目录占着安装目录
                System.Diagnostics.Process.Start(psi);
                Dbg("cleanup spawned temp=" + temp + " dir=" + d + " pid=" + pid);
            }
            catch (Exception ex)
            {
                Dbg("cleanup spawn FAILED: " + ex.Message);
                return false;
            }
            // %TEMP% 里那份副本同样删不掉自己, 交给一个隐藏 cmd 等它退出后删。
            // 只删这一个我们自己生成的文件, 不涉及任何用户路径, 也不做递归删除。
            ScheduleTempDelete(temp);
            return true;
        }

        // 等 %TEMP% 里那份副本退出后把它删掉。用有限次重试而不是靠计时:
        // 判断条件是"文件还在不在", 计时不准只影响重试快慢, 不会漏删也不会删错。
        private static void ScheduleTempDelete(string temp)
        {
            try
            {
                if (string.IsNullOrEmpty(temp)) { return; }
                string cmdExe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cmd.exe");
                if (!File.Exists(cmdExe)) { return; }
                // cmd 在双引号内照样展开 '%', 所以必须转义成 '%%'
                string t = temp.Replace("%", "%%");
                System.Diagnostics.ProcessStartInfo psi = new System.Diagnostics.ProcessStartInfo();
                psi.FileName = cmdExe;
                psi.Arguments = "/c for /l %i in (1,1,300) do @(if not exist \"" + t
                    + "\" (exit) else (del /f /q \"" + t + "\" >nul 2>nul & ping -n 2 127.0.0.1 >nul))";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden;
                System.Diagnostics.Process.Start(psi);
            }
            catch (Exception) { }
        }

        // ---------------------------------------------------------------
        //  收尾模式(内部开关 /CLEANUP= /WAITPID=, 不给用户用):
        //  父卸载器把自己复制到 %TEMP% 后启动的那份副本跑的就是这里。
        //  它只做父进程做不到的一件事: 等父进程退出, 删掉它在安装目录里留下的
        //  自己, 目录空了就把目录也删掉。
        //
        //  删除范围严格限定在 Shared.DeleteKnownFiles 的白名单 + "目录真的空了
        //  才删目录": 这里没有任何递归删除, 用户数据(qg_subjects.txt)也照样保留。
        //  返回 true 表示本次进程就是收尾进程(调用方直接返回 rc)。
        // ---------------------------------------------------------------
        internal static bool TryRunCleanup(string[] args, out int rc)
        {
            rc = 0;
            string dir = Shared.Unquote(Shared.GetArg(args, "/CLEANUP"));
            if (string.IsNullOrEmpty(dir)) { return false; }
            int pid = 0;
            string sp = Shared.Unquote(Shared.GetArg(args, "/WAITPID"));
            if (!string.IsNullOrEmpty(sp))
            {
                try { pid = int.Parse(sp, System.Globalization.CultureInfo.InvariantCulture); }
                catch (Exception) { pid = 0; }
            }
            rc = RunCleanup(dir, pid);
            return true;
        }

        private static int RunCleanup(string dir, int waitPid)
        {
            string full;
            try { full = Path.GetFullPath(dir).TrimEnd('\\', '/'); }
            catch (Exception) { return 0; }
            if (full.Length < 4 || !Directory.Exists(full)) { return 0; }

            // 别让工作目录占着要删的目录
            try { Environment.CurrentDirectory = Path.GetTempPath(); }
            catch (Exception) { }

            Dbg("cleanup start dir=" + full + " waitPid=" + waitPid);
            if (waitPid > 0)
            {
                try
                {
                    System.Diagnostics.Process p = System.Diagnostics.Process.GetProcessById(waitPid);
                    p.WaitForExit(30000);
                }
                catch (Exception) { }
            }

            int i;
            for (i = 0; i < 30; i++)
            {
                if (!Directory.Exists(full)) { Dbg("cleanup done: dir gone"); return 0; }
                DeleteKnownFiles(full);
                int left = CountEntries(full);
                if (left == 0)          // 枚举失败(-1)一律当作"还有东西", 不删
                {
                    try
                    {
                        Directory.Delete(full, false);
                        Dbg("cleanup done: dir removed");
                        return 0;
                    }
                    catch (Exception) { }
                }
                System.Threading.Thread.Sleep(200);
            }
            Dbg("cleanup gave up, leftovers kept: " + full + " left=" + CountEntries(full));
            return 0;
        }

        // 仅在设置了 QG_UNINSTALL_DEBUG 时写诊断日志(自动化测试用)。
        // 正常卸载不留任何日志文件。
        internal static void Dbg(string msg)
        {
            try
            {
                string p = Environment.GetEnvironmentVariable("QG_UNINSTALL_DEBUG");
                if (string.IsNullOrEmpty(p)) { return; }
                File.AppendAllText(p, msg + "\r\n", new UTF8Encoding(false));
            }
            catch (Exception) { }
        }
    }

    // ------------------------------------------------------------------
    //  入口
    // ------------------------------------------------------------------
    internal static class Program
    {
#if UNINSTALLER
        [STAThread]
        internal static int Main(string[] args)
        {
            // /CLEANUP=<目录> /WAITPID=<pid>: 卸载器把自己复制到 %TEMP% 后启动的
            // 收尾进程(内部开关), 无界面, 必须在其它任何开关之前处理
            int cleanupRc;
            if (Uninstaller.TryRunCleanup(args, out cleanupRc)) { return cleanupRc; }
            Shared.ForceSta();
            Shared.ForceDpiAwareness();
            bool quiet = Shared.HasFlag(args, "/S");
            return Uninstaller.Run(quiet);
        }
#else
        [STAThread]
        internal static int Main(string[] args)
        {
            // 收尾模式(内部开关, 见 Uninstaller.SpawnSelfCleanup): 无界面, 最先处理
            int cleanupRc;
            if (Uninstaller.TryRunCleanup(args, out cleanupRc)) { return cleanupRc; }
            Shared.ForceSta();
            Shared.ForceDpiAwareness();
            bool silent = Shared.HasFlag(args, "/S");
            bool uninstall = Shared.HasFlag(args, "/UNINSTALL");
            string shot = Shared.Unquote(Shared.GetArg(args, "/SHOT"));

            if (uninstall)
            {
                // /S 之外还允许 /QUIET, 便于自动化
                bool q = silent || Shared.HasFlag(args, "/QUIET");
                return Uninstaller.Run(q);
            }

            // /SELFTEST=<路径>: 只把环境事实写成 UTF-8 文本, 不安装、不开窗
            string selftest = Shared.Unquote(Shared.GetArg(args, "/SELFTEST"));
            if (!string.IsNullOrEmpty(selftest))
            {
                return SelfTest(selftest, silent);
            }

            // /SHOTFULL=<png>: 同 /SHOT, 但连标题栏一起截(验收沉浸式深色标题栏用)
            string shotFull = Shared.Unquote(Shared.GetArg(args, "/SHOTFULL"));
            if (!string.IsNullOrEmpty(shotFull))
            {
                if (silent) { return 1; }
                try
                {
                    using (InstallerForm f = new InstallerForm(args))
                    {
                        f.WriteFullShot(shotFull);
                    }
                    return 0;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("SHOTFULL FAILED: " + ex.Message);
                    return 4;
                }
            }

            if (!string.IsNullOrEmpty(shot))
            {
                if (silent) { return 1; }
                try
                {
                    using (InstallerForm f = new InstallerForm(args))
                    {
                        f.WriteShot(shot);
                    }
                    return 0;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("SHOT FAILED: " + ex.Message);
                    return 4;
                }
            }

            // ---------------------------------------------------------------
            //  单实例闸门。两个安装程序同时往一个目录里写会互相拆台: A 写完 exe,
            //  B 在某个文件上失败并回滚, 回滚删掉的正是 A 需要的文件, 而 A 仍然
            //  报"安装成功" —— 最后留下一个缺 exe 或缺语料却自称成功的安装。
            //  这里用 Local\ 命名互斥量(每会话一个), 拿不到就直接退出。
            //  /SHOT //SHOTFULL //SELFTEST //UNINSTALL 都在上面提前返回, 不参与互斥。
            // ---------------------------------------------------------------
            bool createdNew = true;
            System.Threading.Mutex installLock = null;
            try
            {
                installLock = new System.Threading.Mutex(true, @"Local\" + Shared.AppName + "_安装", out createdNew);
            }
            catch (Exception)
            {
                installLock = null;      // 互斥量本身出错不该挡住安装
                createdNew = true;
            }
            if (!createdNew)
            {
                string busy = "「" + Shared.AppName + "」安装程序已在运行, 请先完成或关闭它。";
                if (silent)
                {
                    Console.Error.WriteLine("INSTALL FAILED: " + busy);
                    return 6;
                }
                MessageBox.Show(busy, Shared.AppName + " 安装程序", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 6;
            }

            try
            {
                if (silent)
                {
                    using (InstallerForm f = new InstallerForm(args))
                    {
                        int rc = f.RunSilent();
                        if (rc == 0 && !f.NoRun) { Launch(Shared.Unquote(Shared.GetArg(args, "/DIR"))); }
                        return rc;
                    }
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using (InstallerForm f = new InstallerForm(args))
                {
                    Application.Run(f);
                    // 启动主程序只认"安装成功"这个明确的标志。以前只看主程序 exe
                    // 在不在, 于是取消安装/中途关窗都会把机器上已经装好的旧版本
                    // 启动起来 —— 用户看到的是"我明明取消了, 程序却弹出来了"。
                    if (!f.InstallSucceeded) { return 0; }
                    if (f.NoRun) { return 0; }
                    Launch(Shared.Unquote(Shared.GetArg(args, "/DIR")));
                    return 0;
                }
            }
            finally
            {
                if (installLock != null)
                {
                    try { installLock.ReleaseMutex(); }
                    catch (Exception) { }
                    try { installLock.Dispose(); }
                    catch (Exception) { }
                }
            }
        }

        private static void Launch(string dir)
        {
            try
            {
                string full = dir;
                if (string.IsNullOrEmpty(full)) { full = Shared.TryGetInstallDir(); }
                if (string.IsNullOrEmpty(full)) { return; }
                string exe = Path.Combine(full, Shared.MainExe);
                if (File.Exists(exe))
                {
                    System.Diagnostics.ProcessStartInfo psi = new System.Diagnostics.ProcessStartInfo(exe);
                    psi.WorkingDirectory = full;
                    psi.UseShellExecute = false;
                    System.Diagnostics.Process.Start(psi);
                }
            }
            catch (Exception) { }
        }

        // 只读体检: 证明"桌面经 OneDrive 重定向"这一路走通, 且指纹资源确实编进了 exe
        private static string Describe(Exception ex)
        {
            StringBuilder s = new StringBuilder();
            Exception e = ex;
            int depth = 0;
            while (e != null && depth < 4)
            {
                if (depth > 0) { s.Append(" <- "); }
                s.Append(e.GetType().Name).Append(": ").Append(e.Message);
                e = e.InnerException;
                depth++;
            }
            return s.ToString();
        }

        private static int SelfTest(string path, bool silent)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("AppName=").Append(Shared.AppName).Append('\n');
            sb.Append("Version=").Append(Shared.Version).Append('\n');
            sb.Append("BuildId=").Append(Shared.BuildId).Append('\n');
            sb.Append("FingerprintResource=").Append(Shared.FingerprintText()).Append('\n');
            sb.Append("DefaultDir=").Append(Shared.DefaultDir()).Append('\n');
            sb.Append("UninstallKey=").Append(Shared.UninstallRegPath).Append('\n');
            try { sb.Append("ShellDesktop=").Append(Shared.DesktopDir()).Append('\n'); }
            catch (Exception ex) { sb.Append("ShellDesktop=ERROR ").Append(Describe(ex)).Append('\n'); }
            try { sb.Append("ShellPrograms=").Append(Shared.ProgramsDir()).Append('\n'); }
            catch (Exception ex) { sb.Append("ShellPrograms=ERROR ").Append(Describe(ex)).Append('\n'); }
            sb.Append("Apartment=").Append(System.Threading.Thread.CurrentThread.GetApartmentState().ToString()).Append('\n');
            sb.Append("DotNetDesktop=").Append(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory)).Append('\n');
            string wv = Shared.WebView2Version();
            sb.Append("WebView2=").Append(wv == null ? "(not found)" : wv).Append('\n');
            sb.Append("RegisteredUninstall=").Append(Shared.TryGetInstallDir() == null ? "(none)" : Shared.TryGetInstallDir()).Append('\n');
            sb.Append("PayloadTargets=").Append(string.Join("|", Shared.PayloadTargetList())).Append('\n');

            // logo path probe: proves the embedded icon decodes into a drawable bitmap
            try
            {
                Bitmap lg = Shared.LoadLogo(48);
                if (lg == null) { sb.Append("Logo=null\n"); }
                else
                {
                    sb.Append("Logo=").Append(lg.Width).Append('x').Append(lg.Height)
                      .Append(" center=").Append(lg.GetPixel(24, 24).ToString())
                      .Append(" edge=").Append(lg.GetPixel(1, 1).ToString()).Append('\n');
                    lg.Dispose();
                }
            }
            catch (Exception ex) { sb.Append("Logo=ERROR ").Append(Describe(ex)).Append('\n'); }

            // 资源清单: 证明每个 gz 载荷都在 exe 内
            string[] names = Assembly.GetExecutingAssembly().GetManifestResourceNames();
            Array.Sort(names);
            int i;
            for (i = 0; i < names.Length; i++)
            {
                Stream st = Assembly.GetExecutingAssembly().GetManifestResourceStream(names[i]);
                long len = st == null ? -1 : st.Length;
                if (st != null) { st.Dispose(); }
                sb.Append("Resource=").Append(names[i]).Append(' ').Append(len).Append('\n');
            }

            try
            {
                File.WriteAllText(path, sb.ToString(), new UTF8Encoding(false));
            }
            catch (Exception)
            {
                return 5;
            }
            if (!silent) { Console.Out.Write(sb.ToString()); }
            return 0;
        }
#endif
    }
}
