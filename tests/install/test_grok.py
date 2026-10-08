"""Run install.sh, uninstall.sh and scripts/grok.py against a temporary HOME."""

import json
import os
import shutil
import stat
import subprocess
import tempfile
import tomllib
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GROK_PY = os.path.join(ROOT, "scripts", "grok.py")

CONFIG = (
    "# my grok settings\n"
    "model = \"grok-build\"\n"
    "\n"
    "[ui]\n"
    "theme = \"GrokNight\"  # picked in /theme\n"
    "compact = true\n"
    "\n"
    "[features]\n"
    "other_flag = false\n"
    "\n"
    "[mcp]\n"
    "servers = [\"a\", \"b\"]\n"
)


class GrokTest(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp(prefix="omarchy-webapp-theme-grok-")
        self.grok_dir = os.path.join(self.home, ".grok")
        self.config = os.path.join(self.grok_dir, "config.toml")
        self.data = os.path.join(self.home, ".local", "share", "omarchy-webapp-theme")
        self.state = os.path.join(self.data, "grok-state.json")

    def tearDown(self):
        shutil.rmtree(self.home, ignore_errors=True)

    def env(self):
        return {"HOME": self.home, "PATH": os.environ["PATH"]}

    def run_script(self, *args, code=0):
        result = subprocess.run([os.path.join(ROOT, args[0]), *args[1:]], env=self.env(), capture_output=True, text=True)
        self.assertEqual(result.returncode, code, result.stdout + result.stderr)
        return result

    def grok(self, action, *extra, code=0, config=None, state=None):
        result = subprocess.run(
            ["/usr/bin/python3", GROK_PY, action, config or self.config, state or self.state, *extra],
            env=self.env(), capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, code, result.stdout + result.stderr)
        return result

    def write_config(self, text, mode=0o640):
        os.makedirs(self.grok_dir, exist_ok=True)
        with open(self.config, "w", newline="") as handle:
            handle.write(text)
        os.chmod(self.config, mode)

    def read(self, path):
        with open(path, newline="") as handle:
            return handle.read()

    def read_config(self):
        return self.read(self.config)

    def snapshot(self):
        files = {}
        for base, dirs, names in os.walk(self.home):
            for name in dirs:
                files[os.path.relpath(os.path.join(base, name), self.home) + "/"] = None
            for name in names:
                path = os.path.join(base, name)
                if os.path.islink(path):
                    files[os.path.relpath(path, self.home)] = None
                    continue
                with open(path, "rb") as handle:
                    files[os.path.relpath(path, self.home)] = handle.read()
        return files

    def grok_files(self):
        return {k: v for k, v in self.snapshot().items() if k.startswith(".grok")}

    def test_existing_config_changes_only_two_lines(self):
        self.write_config(CONFIG)
        out = self.run_script("install.sh", "--grok").stdout
        text = self.read_config()
        old, new = CONFIG.splitlines(), text.splitlines()
        self.assertEqual(len(new), len(old) + 1)
        changed = [line for line in new if line not in old]
        self.assertEqual(changed, ['theme = "terminal"', "terminal_theme = true"])
        self.assertEqual([line for line in old if line not in new], ['theme = "GrokNight"  # picked in /theme'])
        expected = tomllib.loads(CONFIG)
        expected["ui"]["theme"] = "terminal"
        expected["features"]["terminal_theme"] = True
        self.assertEqual(tomllib.loads(text), expected)
        self.assertEqual(stat.S_IMODE(os.stat(self.config).st_mode), 0o640)
        self.assertIn("restart open Grok sessions", out)
        self.assertIn("GROK_THEME", out)
        self.assertTrue(os.path.isfile(self.state))

    def test_no_config_is_created_with_only_the_two_tables(self):
        self.run_script("install.sh", "--grok")
        self.assertEqual(self.read_config(), '[ui]\ntheme = "terminal"\n\n[features]\nterminal_theme = true\n')
        self.run_script("uninstall.sh")
        self.assertFalse(os.path.exists(self.config))
        self.assertFalse(os.path.exists(self.grok_dir))

    def test_created_file_is_kept_when_user_added_to_it(self):
        self.run_script("install.sh", "--grok")
        with open(self.config, "a") as handle:
            handle.write("\n[mcp]\nx = 1\n")
        self.run_script("uninstall.sh")
        self.assertEqual(tomllib.loads(self.read_config()), {"mcp": {"x": 1}})

    def test_existing_grok_dir_survives_uninstall(self):
        os.makedirs(self.grok_dir)
        self.run_script("install.sh", "--grok")
        self.run_script("uninstall.sh")
        self.assertEqual(os.listdir(self.grok_dir), [])

    def test_default_install_leaves_grok_alone(self):
        out = self.run_script("install.sh").stdout
        self.assertFalse(os.path.exists(self.grok_dir))
        self.assertIn(f"Grok: {self.config} is not changed.", out)
        self.assertNotIn("restart open Grok", out)
        self.write_config(CONFIG)
        before = self.grok_files()
        self.run_script("install.sh")
        self.assertEqual(self.grok_files(), before)

    def test_dry_run_writes_nothing_and_prints_only_grok_lines(self):
        for config in (None, CONFIG):
            if config:
                self.write_config(config)
            before = self.snapshot()
            out = self.run_script("install.sh", "--dry-run", "--grok").stdout
            self.assertEqual(self.snapshot(), before)
            self.assertIn('  + theme = "terminal"', out)
            self.assertIn("  + terminal_theme = true", out)
            self.assertIn("Dry run: nothing was written.", out)
            for private in ("model", "compact", "other_flag", "servers", "my grok"):
                self.assertNotIn(private, out)
        self.assertIn('  - theme = "GrokNight"  # picked in /theme', out)

    def test_direct_dry_run_prints_changed_lines_or_unchanged(self):
        self.write_config(CONFIG)
        out = self.grok("add").stdout
        self.assertEqual(out.splitlines(), ['  - theme = "GrokNight"  # picked in /theme', '  + theme = "terminal"', "  + terminal_theme = true"])
        self.assertEqual(self.read_config(), CONFIG)
        self.grok("add", "--write")
        self.assertEqual(self.grok("add").stdout, "unchanged\n")

    def test_rerun_is_idempotent_and_keeps_the_record(self):
        self.write_config(CONFIG)
        self.run_script("install.sh", "--grok")
        text, files = self.read_config(), self.grok_files()
        with open(self.state, "rb") as handle:
            record = handle.read()
        out = self.run_script("install.sh", "--grok").stdout
        self.assertIn("already uses the terminal theme", out)
        self.assertEqual(self.read_config(), text)
        self.assertEqual(self.grok_files(), files)
        with open(self.state, "rb") as handle:
            self.assertEqual(handle.read(), record)
        self.run_script("uninstall.sh")
        self.assertEqual(self.read_config(), CONFIG)

    def test_unsafe_shapes_are_refused_and_install_still_succeeds(self):
        shapes = {
            "dotted key": 'ui.theme = "dark"\n',
            "dotted features": "features.terminal_theme = false\n[ui]\ntheme = 'x'\n",
            "inline table": 'ui = { theme = "dark" }\n',
            "crlf": '[ui]\r\ntheme = "dark"\r\n',
            "multi-line string": 'note = """\nhello\n"""\n[ui]\ntheme = "dark"\n',
            "multi-line literal": "note = '''\nhello\n'''\n",
            "duplicate header": '[ui]\ntheme = "dark"\n[features]\na = 1\n[ui]\nb = 1\n',
            "invalid toml": "[ui\ntheme = \n",
        }
        for name, text in shapes.items():
            with self.subTest(name):
                shutil.rmtree(self.grok_dir, ignore_errors=True)
                self.write_config(text)
                before = self.grok_files()
                result = self.run_script("install.sh", "--grok")
                self.assertEqual(self.grok_files(), before)
                self.assertIn("Grok: not changed", result.stderr)
                self.assertIn("is not changed", result.stdout)
                self.assertNotIn("restart open Grok", result.stdout)
                self.assertTrue(os.path.isfile(self.data + "/extension/manifest.json"))
                self.assertFalse(os.path.exists(self.state))
                self.grok("add", "--write", code=3)
                self.assertEqual(self.grok_files(), before)
                self.run_script("uninstall.sh")

    def test_uninstall_restores_bytes_mode_and_symlink(self):
        target = os.path.join(self.home, "dotfiles", "grok.toml")
        os.makedirs(os.path.dirname(target))
        os.makedirs(self.grok_dir)
        with open(target, "w", newline="") as handle:
            handle.write(CONFIG.rstrip("\n"))
        os.chmod(target, 0o600)
        os.symlink(target, self.config)
        self.run_script("install.sh", "--grok")
        self.assertTrue(os.path.islink(self.config))
        self.assertEqual(os.readlink(self.config), target)
        self.assertEqual(stat.S_IMODE(os.stat(target).st_mode), 0o600)
        self.assertIn("terminal_theme = true", self.read(target))
        self.run_script("uninstall.sh")
        self.assertTrue(os.path.islink(self.config))
        self.assertEqual(self.read(target), CONFIG.rstrip("\n"))
        self.assertEqual(stat.S_IMODE(os.stat(target).st_mode), 0o600)

    def test_round_trip_is_byte_exact_for_awkward_files(self):
        cases = [
            "",
            "[ui]",
            "[ui]\n",
            "[features]\nother = 1",
            "[ui] # header comment\ntheme = 'dark'",
            "\n\n[other]\nx = 1\n\n\n",
            "[ui.colors]\nfoo = 1\n",
            "[ui]\ntheme = \"terminal\"\n[features]\nterminal_theme = true\n",
            "[\"ui\"]\n  \"theme\" = \"dark\"\n[features]\n",
        ]
        for text in cases:
            with self.subTest(text=text):
                shutil.rmtree(self.grok_dir, ignore_errors=True)
                self.write_config(text)
                self.grok("add", "--write")
                after = tomllib.loads(self.read_config())
                self.assertEqual(after["ui"]["theme"], "terminal")
                self.assertIs(after["features"]["terminal_theme"], True)
                self.grok("remove", "--write")
                self.assertEqual(self.read_config(), text)
                self.assertFalse(os.path.exists(self.state))

    def test_user_changed_theme_is_kept_while_flag_reverts(self):
        self.write_config(CONFIG)
        self.run_script("install.sh", "--grok")
        with open(self.config) as handle:
            text = handle.read()
        with open(self.config, "w") as handle:
            handle.write(text.replace('theme = "terminal"', 'theme = "Nord"'))
        self.run_script("uninstall.sh")
        doc = tomllib.loads(self.read_config())
        self.assertEqual(doc["ui"]["theme"], "Nord")
        self.assertNotIn("terminal_theme", doc["features"])
        self.assertEqual(doc["features"]["other_flag"], False)

    def test_preexisting_values_are_never_removed(self):
        original = '[ui]\ntheme = "terminal"\n\n[features]\nterminal_theme = true\n'
        self.write_config(original)
        out = self.run_script("install.sh", "--grok").stdout
        self.assertIn("already uses the terminal theme", out)
        self.assertEqual(self.read_config(), original)
        self.run_script("uninstall.sh")
        self.assertEqual(self.read_config(), original)
        # Only the flag was already set: the theme is ours, the flag is not.
        self.write_config('[ui]\ntheme = "dark"\n[features]\nterminal_theme = true\n')
        self.run_script("install.sh", "--grok")
        self.run_script("uninstall.sh")
        self.assertEqual(self.read_config(), '[ui]\ntheme = "dark"\n[features]\nterminal_theme = true\n')

    def test_uninstall_dry_run_writes_nothing(self):
        self.write_config(CONFIG)
        self.run_script("install.sh", "--grok")
        before = self.snapshot()
        out = self.run_script("uninstall.sh", "--dry-run").stdout
        self.assertEqual(self.snapshot(), before)
        self.assertIn('  + theme = "GrokNight"  # picked in /theme', out)
        self.assertNotIn("compact", out)
        self.assertIn("Dry run: nothing was changed.", out)

    def test_uninstall_survives_deleted_created_config(self):
        self.run_script("install.sh", "--grok")
        os.remove(self.config)
        self.run_script("uninstall.sh")
        self.assertFalse(os.path.exists(self.state))
        self.assertFalse(os.path.exists(self.data))

    def test_dry_run_never_prints_unrelated_unterminated_last_line(self):
        self.write_config('[ui]\ntheme="a"\n[mcp]\napi_key = "sk-secret"')
        out = self.grok("add").stdout
        self.assertNotIn("sk-secret", out)
        out = self.run_script("install.sh", "--dry-run", "--grok").stdout
        self.assertNotIn("sk-secret", out)
        self.grok("add", "--write")
        self.assertNotIn("sk-secret", self.grok("remove").stdout)

    def test_restore_of_unterminated_original_keeps_later_lines(self):
        self.write_config('[ui]\ntheme = "x"')
        self.grok("add", "--write")
        with open(self.config, "a", newline="") as handle:
            handle.write("[mcp]\nx=1\n")
        self.grok("remove", "--write")
        self.assertEqual(self.read_config(), '[ui]\ntheme = "x"\n[mcp]\nx=1\n')

    def test_write_failure_after_plan_still_completes_install(self):
        self.write_config(CONFIG)
        os.chmod(self.grok_dir, 0o555)
        try:
            out = self.run_script("install.sh", "--grok").stdout
        finally:
            os.chmod(self.grok_dir, 0o755)
        self.assertIn("Installed.", out)
        self.assertIn("is not changed", out)
        self.assertEqual(self.read_config(), CONFIG)

    def test_repeated_uninstall_is_harmless(self):
        self.write_config(CONFIG)
        self.run_script("install.sh", "--grok")
        self.run_script("uninstall.sh")
        self.assertEqual(self.read_config(), CONFIG)
        out = self.run_script("uninstall.sh").stdout
        self.assertIn("Nothing to remove.", out)
        self.assertEqual(self.read_config(), CONFIG)

    def test_no_state_means_no_change(self):
        self.write_config(CONFIG.replace("GrokNight", "terminal") + "")
        self.assertEqual(self.grok("remove").stdout, "unchanged\n")
        self.grok("remove", "--write")
        self.assertIn("terminal", self.read_config())

    def test_uninstall_stops_when_grok_config_became_unsafe(self):
        self.write_config(CONFIG)
        self.run_script("install.sh", "--grok")
        with open(self.config, newline="") as handle:
            text = handle.read()
        with open(self.config, "w", newline="") as handle:
            handle.write(text.replace("\n", "\r\n"))
        result = self.run_script("uninstall.sh", code=1)
        self.assertIn("by hand", result.stderr)
        self.assertTrue(os.path.isfile(self.state))
        self.assertTrue(os.path.isdir(self.data))

    def test_reinstall_carries_the_record_across_staging(self):
        self.write_config(CONFIG)
        self.run_script("install.sh", "--grok")
        self.run_script("install.sh")
        self.assertTrue(os.path.isfile(self.state))
        self.run_script("uninstall.sh")
        self.assertEqual(self.read_config(), CONFIG)


if __name__ == "__main__":
    unittest.main()
