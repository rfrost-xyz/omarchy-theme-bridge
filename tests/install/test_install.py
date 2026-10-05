"""Run install.sh and uninstall.sh against a temporary HOME."""

import json
import os
import shutil
import stat
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OMARCHY_EXTENSIONS = "/usr/share/omarchy/default/chromium/extensions/copy-url,/usr/share/omarchy/default/chromium/extensions/yt-dlp"
FLAGS = (
    "--ozone-platform=wayland\n"
    f"--load-extension={OMARCHY_EXTENSIONS}\n"
    "--example-private-setting=do-not-print\n"
)
EXTENSION_ID = "pinjcoeajnkogbmcjjgkgjafpiiebheg"


class InstallTest(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp(prefix="omarchy-webapp-theme-home-")
        self.config = os.path.join(self.home, ".config")
        os.makedirs(os.path.join(self.config, "chromium"))
        self.flags = os.path.join(self.config, "chromium-flags.conf")
        with open(self.flags, "w") as handle:
            handle.write(FLAGS)
        os.chmod(self.flags, 0o640)
        self.data = os.path.join(self.home, ".local", "share", "omarchy-webapp-theme")
        self.manifest = os.path.join(self.config, "chromium", "NativeMessagingHosts", "xyz.rfrost.omarchy_webapp_theme.json")

    def tearDown(self):
        shutil.rmtree(self.home, ignore_errors=True)

    def run_script(self, *args):
        env = {"HOME": self.home, "PATH": os.environ["PATH"]}
        result = subprocess.run([os.path.join(ROOT, args[0]), *args[1:]], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def snapshot(self):
        files = {}
        for base, _, names in os.walk(self.home):
            for name in names:
                path = os.path.join(base, name)
                with open(path, "rb") as handle:
                    files[os.path.relpath(path, self.home)] = handle.read()
        return files

    def flags_text(self):
        with open(self.flags) as handle:
            return handle.read()

    def test_dry_run_writes_nothing_and_prints_only_changed_line(self):
        before = self.snapshot()
        out = self.run_script("install.sh", "--dry-run", "--load-extension-flag")
        self.assertEqual(self.snapshot(), before)
        self.assertIn(self.manifest, out)
        self.assertIn(f"  + --load-extension={OMARCHY_EXTENSIONS},{self.data}/extension", out)
        self.assertNotIn("do-not-print", out)
        self.assertNotIn("ozone", out)
        self.assertIn("Dry run: nothing was written.", out)

    def test_default_install_leaves_flags_untouched(self):
        out = self.run_script("install.sh")
        self.assertEqual(self.flags_text(), FLAGS)
        self.assertIn("Load unpacked", out)
        with open(self.manifest) as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["allowed_origins"], [f"chrome-extension://{EXTENSION_ID}/"])
        self.assertEqual(manifest["path"], os.path.join(self.data, "bin", "omarchy-webapp-theme-host"))
        self.assertTrue(os.access(manifest["path"], os.X_OK))
        self.assertTrue(os.path.isfile(os.path.join(self.data, "extension", "manifest.json")))
        written = sorted(self.snapshot())
        outside = [p for p in written if not p.startswith(".local/share/omarchy-webapp-theme/")]
        self.assertEqual(outside, [".config/chromium-flags.conf", os.path.relpath(self.manifest, self.home)])

    def test_flag_merge_is_single_and_idempotent(self):
        self.run_script("install.sh", "--load-extension-flag")
        self.run_script("install.sh", "--load-extension-flag")
        lines = self.flags_text().splitlines()
        self.assertEqual(lines[0], "--ozone-platform=wayland")
        self.assertEqual(lines[2], "--example-private-setting=do-not-print")
        load = [l for l in lines if l.startswith("--load-extension=")]
        self.assertEqual(load, [f"--load-extension={OMARCHY_EXTENSIONS},{self.data}/extension"])
        self.assertEqual(stat.S_IMODE(os.stat(self.flags).st_mode), 0o640)

    def test_flag_merge_follows_symlink(self):
        real = os.path.join(self.home, "dotfiles-chromium-flags.conf")
        shutil.move(self.flags, real)
        os.symlink(real, self.flags)
        self.run_script("install.sh", "--load-extension-flag")
        self.assertTrue(os.path.islink(self.flags))
        with open(real) as handle:
            self.assertIn(f"{self.data}/extension", handle.read())
        self.run_script("uninstall.sh")
        self.assertTrue(os.path.islink(self.flags))
        with open(real) as handle:
            self.assertEqual(handle.read(), FLAGS)

    def test_flag_added_when_no_load_extension_line(self):
        with open(self.flags, "w") as handle:
            handle.write("--ozone-platform=wayland\n")
        self.run_script("install.sh", "--load-extension-flag")
        self.assertEqual(self.flags_text(), f"--ozone-platform=wayland\n--load-extension={self.data}/extension\n")
        self.run_script("uninstall.sh")
        self.assertEqual(self.flags_text(), "--ozone-platform=wayland\n")

    def test_missing_flags_file_is_not_created(self):
        os.remove(self.flags)
        out = self.run_script("install.sh", "--load-extension-flag")
        self.assertFalse(os.path.exists(self.flags))
        self.assertIn("does not exist", out)

    def test_uninstall_restores_original_and_is_idempotent(self):
        before = self.snapshot()
        self.run_script("install.sh", "--load-extension-flag")
        self.assertIn("Remove:", self.run_script("uninstall.sh", "--dry-run"))
        self.run_script("uninstall.sh")
        after = self.snapshot()
        after.pop(os.path.relpath(self.manifest, self.home), None)
        self.assertEqual(after, before)
        self.assertFalse(os.path.exists(self.data))
        self.assertFalse(os.path.exists(self.manifest))
        self.assertIn("Nothing to remove.", self.run_script("uninstall.sh"))
        self.assertEqual(self.flags_text(), FLAGS)

    def test_foreign_files_are_left_alone(self):
        os.makedirs(self.data)
        with open(os.path.join(self.data, "keep"), "w") as handle:
            handle.write("x")
        env = {"HOME": self.home, "PATH": os.environ["PATH"]}
        result = subprocess.run([os.path.join(ROOT, "install.sh")], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(os.path.exists(os.path.join(self.data, "keep")))
        os.makedirs(os.path.dirname(self.manifest))
        with open(self.manifest, "w") as handle:
            handle.write('{"path": "/elsewhere"}')
        self.run_script("uninstall.sh")
        self.assertTrue(os.path.exists(os.path.join(self.data, "keep")))
        self.assertTrue(os.path.exists(self.manifest))


if __name__ == "__main__":
    unittest.main()
