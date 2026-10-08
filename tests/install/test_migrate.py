"""Migration from the former omarchy-webapp-theme install, against a temporary HOME.

The legacy install is built synthetically: the layout the old installer wrote
(directory, marker, helper, extension, native host manifest) plus the flags and
Grok records produced by scripts/flags.py and scripts/grok.py, whose behaviour
did not change in the rename.
"""

import json
import os
import shutil
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
GROK_CONFIG = '# my grok settings\nmodel = "grok-build"\n\n[ui]\ntheme = "GrokNight"  # picked in /theme\n\n[features]\nother_flag = false\n'


class MigrateTest(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp(prefix="omarchy-theme-bridge-migrate-")
        self.config = os.path.join(self.home, ".config")
        os.makedirs(os.path.join(self.config, "chromium"))
        self.flags = os.path.join(self.config, "chromium-flags.conf")
        self.write(self.flags, FLAGS)
        self.grok_config = os.path.join(self.home, ".grok", "config.toml")
        share = os.path.join(self.home, ".local", "share")
        self.data = os.path.join(share, "omarchy-theme-bridge")
        self.legacy = os.path.join(share, "omarchy-webapp-theme")
        hosts = os.path.join(self.config, "chromium", "NativeMessagingHosts")
        self.manifest = os.path.join(hosts, "xyz.rfrost.omarchy_theme_bridge.json")
        self.legacy_manifest = os.path.join(hosts, "xyz.rfrost.omarchy_webapp_theme.json")

    def tearDown(self):
        shutil.rmtree(self.home, ignore_errors=True)

    def write(self, path, text):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", newline="") as handle:
            handle.write(text)

    def read(self, path):
        with open(path, newline="") as handle:
            return handle.read()

    def script(self, name, *args):
        env = {"HOME": self.home, "PATH": os.environ["PATH"]}
        return subprocess.run([os.path.join(ROOT, name), *args], env=env, capture_output=True, text=True)

    def run_script(self, *args):
        result = self.script(*args)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def tool(self, name, *args):
        result = subprocess.run(["/usr/bin/python3", os.path.join(ROOT, "scripts", name), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def snapshot(self):
        files = {}
        for base, dirs, names in os.walk(self.home):
            for name in dirs:
                files[os.path.relpath(os.path.join(base, name), self.home) + "/"] = None
            for name in names:
                path = os.path.join(base, name)
                with open(path, "rb") as handle:
                    files[os.path.relpath(path, self.home)] = handle.read()
        return files

    def make_legacy(self, flags=False, grok=False, marker=True, manifest_path=None):
        bin_dir = os.path.join(self.legacy, "bin")
        os.makedirs(bin_dir)
        helper = os.path.join(bin_dir, "omarchy-webapp-theme-host")
        shutil.copy(os.path.join(ROOT, "host", "omarchy-theme-bridge-host"), helper)
        os.chmod(helper, 0o755)
        shutil.copytree(os.path.join(ROOT, "extension"), os.path.join(self.legacy, "extension"))
        if marker:
            self.write(os.path.join(self.legacy, ".installed-by-omarchy-webapp-theme"), "")
        self.write(self.legacy_manifest, json.dumps({
            "name": "xyz.rfrost.omarchy_webapp_theme",
            "path": manifest_path or helper,
            "type": "stdio",
            "allowed_origins": ["chrome-extension://pinjcoeajnkogbmcjjgkgjafpiiebheg/"],
        }))
        if flags:
            self.tool("flags.py", "add", self.flags, os.path.join(self.legacy, "extension"), os.path.join(self.legacy, "flags-state.json"), "--write")
        if grok:
            self.write(self.grok_config, GROK_CONFIG)
            self.tool("grok.py", "add", self.grok_config, os.path.join(self.legacy, "grok-state.json"), "--write")

    def test_migrates_a_flags_install(self):
        self.make_legacy(flags=True)
        self.assertIn(f"{self.legacy}/extension", self.read(self.flags))
        out = self.run_script("install.sh")
        self.assertEqual(self.read(self.flags), FLAGS.replace(OMARCHY_EXTENSIONS, f"{OMARCHY_EXTENSIONS},{self.data}/extension"))
        self.assertFalse(os.path.exists(self.legacy))
        self.assertFalse(os.path.exists(self.legacy_manifest))
        self.assertTrue(os.path.isfile(self.manifest))
        self.assertTrue(os.path.isfile(os.path.join(self.data, "extension", "manifest.json")))
        self.assertTrue(os.path.isfile(os.path.join(self.data, ".installed-by-omarchy-theme-bridge")))
        self.assertIn("load it again from", out)
        self.assertIn(f"{self.data}/extension", out)
        self.run_script("uninstall.sh")
        self.assertEqual(self.read(self.flags), FLAGS)
        self.assertFalse(os.path.exists(self.data))

    def test_migrates_a_flags_install_that_added_its_own_line(self):
        self.write(self.flags, "--ozone-platform=wayland\n")
        self.make_legacy(flags=True)
        self.run_script("install.sh")
        self.assertEqual(self.read(self.flags), f"--ozone-platform=wayland\n--load-extension={self.data}/extension\n")
        self.run_script("uninstall.sh")
        self.assertEqual(self.read(self.flags), "--ozone-platform=wayland\n")

    def test_migrates_without_a_flags_entry(self):
        self.make_legacy()
        out = self.run_script("install.sh")
        self.assertEqual(self.read(self.flags), FLAGS)
        self.assertFalse(os.path.exists(self.legacy))
        self.assertFalse(os.path.exists(self.legacy_manifest))
        self.assertTrue(os.path.isfile(self.manifest))
        self.assertFalse(os.path.exists(os.path.join(self.data, "flags-state.json")))
        self.assertIn("load it again from", out)

    def test_carries_the_grok_record(self):
        self.make_legacy(grok=True)
        themed = self.read(self.grok_config)
        self.assertNotEqual(themed, GROK_CONFIG)
        self.run_script("install.sh")
        self.assertEqual(self.read(self.grok_config), themed)
        self.assertTrue(os.path.isfile(os.path.join(self.data, "grok-state.json")))
        self.assertFalse(os.path.exists(self.legacy))
        self.run_script("uninstall.sh")
        self.assertEqual(self.read(self.grok_config), GROK_CONFIG)

    def test_carries_the_grok_record_when_grok_is_requested_again(self):
        self.make_legacy(flags=True, grok=True)
        themed = self.read(self.grok_config)
        self.run_script("install.sh", "--grok")
        self.assertEqual(self.read(self.grok_config), themed)
        self.run_script("uninstall.sh")
        self.assertEqual(self.read(self.grok_config), GROK_CONFIG)
        self.assertEqual(self.read(self.flags), FLAGS)

    def test_dry_run_lists_legacy_items_and_changes_nothing(self):
        self.make_legacy(flags=True, grok=True)
        before = self.snapshot()
        out = self.run_script("install.sh", "--dry-run")
        self.assertEqual(self.snapshot(), before)
        self.assertIn(f"Remove: {self.legacy}/", out)
        self.assertIn(f"Remove: {self.legacy_manifest}", out)
        self.assertIn(f"Move: {self.legacy}/grok-state.json to {self.data}/grok-state.json", out)
        self.assertIn(f"  - --load-extension={OMARCHY_EXTENSIONS},{self.legacy}/extension", out)
        self.assertIn(f"  + --load-extension={OMARCHY_EXTENSIONS},{self.data}/extension", out)
        self.assertNotIn("do-not-print", out)
        self.assertIn("Dry run: nothing was written.", out)

    def test_unmarked_legacy_directory_is_left_alone_and_reported(self):
        self.make_legacy(flags=True, marker=False)
        before = {k: v for k, v in self.snapshot().items() if "omarchy-webapp-theme" in k or k.endswith("chromium-flags.conf") or "omarchy_webapp_theme" in k}
        out = self.run_script("install.sh")
        after = {k: v for k, v in self.snapshot().items() if "omarchy-webapp-theme" in k or k.endswith("chromium-flags.conf") or "omarchy_webapp_theme" in k}
        self.assertEqual(after, before)
        self.assertIn("was not created by the legacy installer; leaving it alone", out)
        self.assertTrue(os.path.isfile(self.manifest))
        self.run_script("uninstall.sh")
        self.assertTrue(os.path.isdir(self.legacy))
        self.assertTrue(os.path.isfile(self.legacy_manifest))

    def test_unsafe_legacy_flags_entry_changes_nothing(self):
        self.make_legacy()
        self.write(self.flags, f"--ozone-platform=wayland --load-extension={self.legacy}/extension\n")
        before = self.snapshot()
        for args in ([], ["--dry-run"]):
            result = self.script("install.sh", *args)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("by hand", result.stderr)
            self.assertEqual(self.snapshot(), before)

    def test_read_only_flags_file_with_legacy_entry_changes_nothing(self):
        self.make_legacy(flags=True)
        os.chmod(self.flags, 0o444)
        before = self.snapshot()
        result = self.script("install.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.snapshot(), before)

    def test_legacy_manifest_pointing_elsewhere_is_kept(self):
        self.make_legacy(manifest_path="/opt/elsewhere/host")
        before = self.read(self.legacy_manifest)
        out = self.run_script("install.sh")
        self.assertEqual(self.read(self.legacy_manifest), before)
        self.assertIn("does not point at the legacy installation", out)
        self.assertFalse(os.path.exists(self.legacy))
        self.assertTrue(os.path.isfile(self.manifest))

    def test_uninstaller_removes_a_leftover_legacy_install(self):
        self.make_legacy(flags=True, grok=True)
        before = self.snapshot()
        out = self.run_script("uninstall.sh", "--dry-run")
        self.assertEqual(self.snapshot(), before)
        self.assertIn(f"Remove: {self.legacy}/", out)
        self.run_script("uninstall.sh")
        self.assertEqual(self.read(self.flags), FLAGS)
        self.assertEqual(self.read(self.grok_config), GROK_CONFIG)
        self.assertFalse(os.path.exists(self.legacy))
        self.assertFalse(os.path.exists(self.legacy_manifest))

    def test_uninstaller_removes_new_and_legacy_installs_together(self):
        self.run_script("install.sh", "--load-extension-flag")
        installed = self.read(self.flags)
        self.make_legacy()
        self.run_script("uninstall.sh")
        self.assertFalse(os.path.exists(self.data))
        self.assertFalse(os.path.exists(self.legacy))
        self.assertFalse(os.path.exists(self.manifest))
        self.assertEqual(self.read(self.flags), FLAGS)
        self.assertNotEqual(installed, FLAGS)

    def test_uninstaller_stops_before_removing_when_legacy_entry_is_unsafe(self):
        self.make_legacy()
        self.write(self.flags, f"--ozone-platform=wayland --load-extension={self.legacy}/extension\n")
        before = self.snapshot()
        result = self.script("uninstall.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.snapshot(), before)

    def test_both_entries_present_gives_no_unpacked_advice(self):
        self.make_legacy(flags=True)
        self.tool("flags.py", "add", self.flags, os.path.join(self.data, "extension"), os.path.join(self.home, "scratch-state.json"), "--write")
        out = self.run_script("install.sh")
        self.assertNotIn("load the extension unpacked", out)
        self.assertNotIn(f"{self.legacy}/extension", self.read(self.flags))
        self.assertIn(f"{self.data}/extension", self.read(self.flags))

    def test_uninstaller_leaves_flags_alone_when_our_entry_is_unsafe(self):
        self.make_legacy(flags=True)
        flags = f"  --load-extension={self.data}/extension\n" + self.read(self.flags)
        self.write(self.flags, flags)
        result = self.script("uninstall.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.read(self.flags), flags)
        self.assertTrue(os.path.exists(self.legacy))

    def test_repeated_runs_are_harmless(self):
        self.make_legacy(flags=True, grok=True)
        self.run_script("install.sh")
        once = self.snapshot()
        out = self.run_script("install.sh")
        self.assertEqual(self.snapshot(), once)
        self.assertNotIn("Legacy:", out)
        self.run_script("uninstall.sh")
        after = self.snapshot()
        self.assertIn("Nothing to remove.", self.run_script("uninstall.sh"))
        self.assertEqual(self.snapshot(), after)
        self.assertEqual(self.read(self.flags), FLAGS)
        self.assertEqual(self.read(self.grok_config), GROK_CONFIG)


if __name__ == "__main__":
    unittest.main()
