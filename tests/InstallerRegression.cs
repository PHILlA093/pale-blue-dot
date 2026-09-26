// Compile with Installer.cs, /define:UNINSTALLER and /main:QiongGuan.Installer.InstallerRegression.
// Exercises deletion helpers only inside a newly-created temporary fixture. No registry or real uninstall.
using System;
using System.IO;
using System.Text;

namespace QiongGuan.Installer
{
    internal static class InstallerRegression
    {
        private static void Require(bool value, string message)
        {
            if (!value) throw new Exception(message);
        }

        public static int Main()
        {
            string tempRoot = Path.GetFullPath(Path.GetTempPath());
            string fixture = Path.Combine(tempRoot, "QGInstallerRegression_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(fixture);
            try
            {
                File.WriteAllText(Path.Combine(fixture, Shared.MarkerFile), Shared.MarkerHeader + "\n" + Shared.AppName + "\nCleanDirectory=1\n", Encoding.UTF8);
                string reason;
                Require(Uninstaller.FullWipeAllowed(fixture, out reason), "empty owned fixture should pass the original gate");
                string profile = Path.Combine(fixture, Shared.Wv2CacheDir);
                Directory.CreateDirectory(profile);
                string note = Path.Combine(profile, "test-personal-note.txt");
                File.WriteAllText(note, "keep note and mock settings");
                Require(!Uninstaller.FullWipeAllowed(fixture, out reason), "profile must block full-directory deletion");
                string db = Path.Combine(fixture, Shared.DbDir);
                Directory.CreateDirectory(db);
                string personal = Path.Combine(db, Shared.DbSubjects);
                string personalBackup = Path.Combine(db, Shared.DbSubjectsBak);
                File.WriteAllText(personal, "keep corpus index");
                File.WriteAllText(personalBackup, "keep backup");
                File.WriteAllText(Path.Combine(db, Shared.DbCorpus), "disposable shipped corpus");
                string app = Path.Combine(fixture, Shared.MainExe);
                File.WriteAllText(app, "disposable shipped application");
                string unrelated = Path.Combine(fixture, "unrelated-document.txt");
                File.WriteAllText(unrelated, "never delete unrelated files");
                Uninstaller.DeleteKnownFiles(fixture);
                Require(File.ReadAllText(note) == "keep note and mock settings", "profile lost");
                Require(File.Exists(personal), "personal index lost");
                Require(File.Exists(personalBackup), "personal backup lost");
                Require(File.Exists(unrelated), "unrelated file lost");
                Require(!File.Exists(app), "shipped application not removed");
                Require(!File.Exists(Path.Combine(db, Shared.DbCorpus)), "shipped corpus not removed");
                Console.WriteLine("PASS: profile blocks full wipe; known-file cleanup preserves notes, settings, backups and unrelated files.");
                return 0;
            }
            finally
            {
                string resolved = Path.GetFullPath(fixture);
                if (!resolved.StartsWith(tempRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                    || !Path.GetFileName(resolved).StartsWith("QGInstallerRegression_", StringComparison.Ordinal))
                    throw new Exception("Refusing fixture cleanup outside the temporary test directory");
                Directory.Delete(resolved, true);
            }
        }
    }
}
