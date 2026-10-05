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
        for base, dirs, names in os.walk(self.home):
            for name in dirs:
                files[os.path.relpath(os.path.join(base, name), self.home) + "/"] = None
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
        outside = [p for p in written if not p.startswith(".local/share/omarchy-webapp-theme/") and not p.endswith("/")]
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
        after = {k: v for k, v in self.snapshot().items() if not k.endswith("/")}
        after.pop(os.path.relpath(self.manifest, self.home), None)
        self.assertEqual(after, {k: v for k, v in before.items() if not k.endswith("/")})
        self.assertFalse(os.path.exists(self.data))
        self.assertFalse(os.path.exists(self.manifest))
        self.assertIn("Nothing to remove.", self.run_script("uninstall.sh"))
        self.assertEqual(self.flags_text(), FLAGS)

    def write_flags(self, data):
        with open(self.flags, "wb") as handle:
            handle.write(data)

    def read_flags(self):
        with open(self.flags, "rb") as handle:
            return handle.read()

    def test_round_trip_is_byte_exact(self):
        ext = f"{self.data}/extension".encode()
        cases = {
            "no final newline": b"--a\n--load-extension=/x,/y",
            "trailing blank lines": b"--load-extension=/x\n--b\n\n\n",
            "crlf": b"--a\r\n--load-extension=/x\r\n--b\r\n",
            "empty list": b"--load-extension=\n--b\n",
            "no switch, no final newline": b"--a\n--b",
            "empty file": b"",
            "trailing slash entry kept": b"--load-extension=/x/\n",
            "leading empty item": b"--load-extension=,/usr/share/omarchy/a\n",
            "trailing empty item": b"--load-extension=/a,\n",
            "empty item in the middle": b"--load-extension=/a,,/b\n",
        }
        for label, original in cases.items():
            with self.subTest(label):
                self.write_flags(original)
                self.run_script("install.sh", "--load-extension-flag")
                after_install = self.read_flags()
                self.assertIn(ext, after_install)
                self.assertEqual(after_install.count(b"--load-extension="), max(1, original.count(b"--load-extension=")))
                self.run_script("install.sh", "--load-extension-flag")
                self.assertEqual(self.read_flags(), after_install, "reinstall is idempotent")
                self.run_script("uninstall.sh")
                self.assertEqual(self.read_flags(), original)

    def test_dry_run_never_prints_unrelated_lines(self):
        self.write_flags(b"--secret=1\n--load-extension=/x\n--other=SECRET")
        out = self.run_script("install.sh", "--dry-run", "--load-extension-flag")
        self.assertNotIn("SECRET", out)
        self.assertNotIn("secret", out)
        self.assertIn("  - --load-extension=/x\n", out)

    def test_refuses_switch_that_is_indented_or_shares_a_line(self):
        for original in (
            f"  --load-extension={OMARCHY_EXTENSIONS}\n".encode(),
            f"--ozone-platform=wayland --load-extension={OMARCHY_EXTENSIONS}\n".encode(),
        ):
            with self.subTest(original=original):
                self.write_flags(original)
                env = {"HOME": self.home, "PATH": os.environ["PATH"]}
                result = subprocess.run([os.path.join(ROOT, "install.sh"), "--load-extension-flag"], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("shares a line, is indented or is quoted", result.stderr)
                self.assertIn("Load unpacked", result.stdout)
                self.assertEqual(self.read_flags(), original)
                self.run_script("uninstall.sh")

    def test_commented_switch_is_ignored(self):
        self.write_flags(b"# --load-extension=/old\n--a\n")
        self.run_script("install.sh", "--load-extension-flag")
        self.assertEqual(self.read_flags(), f"# --load-extension=/old\n--a\n--load-extension={self.data}/extension\n".encode())
        self.run_script("uninstall.sh")
        self.assertEqual(self.read_flags(), b"# --load-extension=/old\n--a\n")

    def run_env(self, extra, *args):
        env = {"HOME": self.home, "PATH": os.environ["PATH"], **extra}
        return subprocess.run([os.path.join(ROOT, args[0]), *args[1:]], env=env, capture_output=True, text=True)

    def test_dry_runs_list_every_file_and_write_nothing(self):
        before = self.snapshot()
        out = self.run_script("install.sh", "--dry-run", "--load-extension-flag")
        self.assertIn(".installed-by-omarchy-webapp-theme", out)
        self.assertIn("flags-state.json", out)
        self.assertEqual(self.snapshot(), before)
        self.run_script("install.sh", "--load-extension-flag")
        installed = self.snapshot()
        self.run_script("uninstall.sh", "--dry-run")
        self.assertEqual(self.snapshot(), installed)

    def test_unsafe_install_paths_never_reach_the_flags_file(self):
        for name in ("my data", "a,b", "o'brien", 'say"hi', "back\\slash", "hash#tag", "tab\there"):
            with self.subTest(name=name):
                data_home = os.path.join(self.home, name)
                result = self.run_env({"XDG_DATA_HOME": data_home}, "install.sh", "--load-extension-flag")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("load the extension unpacked", result.stderr)
                self.assertEqual(self.flags_text(), FLAGS)
                with open(self.manifest) as handle:
                    self.assertEqual(json.load(handle)["path"], os.path.join(data_home, "omarchy-webapp-theme", "bin", "omarchy-webapp-theme-host"))
                self.assertEqual(self.run_env({"XDG_DATA_HOME": data_home}, "uninstall.sh").returncode, 0)
                self.assertFalse(os.path.exists(self.manifest))
                self.assertFalse(os.path.exists(os.path.join(data_home, "omarchy-webapp-theme")))

    def test_relative_data_home_is_refused(self):
        result = self.run_env({"XDG_DATA_HOME": "relative/share"}, "install.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("absolute path", result.stderr)

    def test_switch_with_trailing_whitespace_is_refused(self):
        for original in (b"--load-extension=/a\t\n", b"--load-extension=/a\t#note\n", b"--load-extension=/a \n"):
            with self.subTest(original=original):
                self.write_flags(original)
                result = self.run_env({}, "install.sh", "--load-extension-flag")
                self.assertIn("shares a line, is indented or is quoted", result.stderr)
                self.assertEqual(self.read_flags(), original)
                self.run_script("uninstall.sh")

    def test_uninstall_keeps_files_when_entry_cannot_be_removed(self):
        self.run_script("install.sh", "--load-extension-flag")
        text = self.flags_text().replace("--load-extension=", "  --load-extension=")
        with open(self.flags, "w") as handle:
            handle.write(text)
        result = self.run_env({}, "uninstall.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Remove that entry by hand", result.stderr)
        self.assertTrue(os.path.isdir(self.data))
        self.assertEqual(self.flags_text(), text)

    def test_reinstall_says_reload_instead_of_restart(self):
        self.run_script("install.sh", "--load-extension-flag")
        out = self.run_script("install.sh", "--load-extension-flag")
        self.assertIn("reload Omarchy Webapp Theme in chrome://extensions", out)

    def test_non_ascii_install_path_uninstalls_cleanly(self):
        data_home = os.path.join(self.home, "zoë")
        self.assertEqual(self.run_env({"XDG_DATA_HOME": data_home}, "install.sh").returncode, 0)
        self.assertTrue(os.path.exists(self.manifest))
        result = self.run_env({"XDG_DATA_HOME": data_home}, "uninstall.sh")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(os.path.exists(self.manifest))
        self.assertFalse(os.path.exists(os.path.join(data_home, "omarchy-webapp-theme")))

    def test_line_with_unbalanced_quotes_is_not_edited(self):
        original = b"--load-extension=/a\n--load-extension=/b'\n"
        self.write_flags(original)
        self.run_script("install.sh", "--load-extension-flag")
        lines = self.read_flags().splitlines()
        self.assertEqual(lines[1], b"--load-extension=/b'")
        self.assertEqual(lines[0], f"--load-extension=/a,{self.data}/extension".encode())
        self.run_script("uninstall.sh")
        self.assertEqual(self.read_flags(), original)

    def test_hash_inside_a_word_is_not_a_comment(self):
        original = b"--load-extension=/a\n--homepage=https://x/#/ --load-extension=/b\n"
        self.write_flags(original)
        result = self.run_env({}, "install.sh", "--load-extension-flag")
        self.assertIn("shares a line, is indented or is quoted", result.stderr)
        self.assertEqual(self.read_flags(), original)

    def test_other_spelling_of_data_home_uninstalls_cleanly(self):
        share = os.path.join(self.home, ".local", "share")
        self.assertEqual(self.run_env({"XDG_DATA_HOME": share + "//"}, "install.sh", "--load-extension-flag").returncode, 0)
        self.assertIn(f"{self.data}/extension", self.flags_text())
        result = self.run_env({}, "uninstall.sh")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.flags_text(), FLAGS)
        self.assertFalse(os.path.exists(self.manifest))

    def test_uninstall_dry_run_predicts_refusal(self):
        self.run_script("install.sh", "--load-extension-flag")
        text = self.flags_text().replace("--load-extension=", "--ozone-platform=wayland --load-extension=")
        with open(self.flags, "w") as handle:
            handle.write(text)
        result = self.run_env({}, "uninstall.sh", "--dry-run")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Remove that entry by hand", result.stderr)
        self.assertNotIn("Remove:", result.stdout)

    def test_relative_config_home_is_refused(self):
        for script in ("install.sh", "uninstall.sh"):
            with self.subTest(script=script):
                result = self.run_env({"XDG_CONFIG_HOME": "cfg"}, script)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("XDG_CONFIG_HOME", result.stderr)

    def test_quoted_list_is_not_edited(self):
        original = f'--load-extension="/opt/a,{self.data}/extension"\n'.encode()
        self.write_flags(original)
        result = self.run_env({}, "install.sh", "--load-extension-flag")
        self.assertIn("shares a line, is indented or is quoted", result.stderr)
        self.assertEqual(self.read_flags(), original)

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
