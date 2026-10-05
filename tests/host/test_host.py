"""Drive the native host over its framed stdio against a temporary state dir."""

import json
import os
import select
import shutil
import struct
import subprocess
import tempfile
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HOST = os.path.join(ROOT, "host", "omarchy-webapp-theme-host")

DARK = """mode = "dark"
accent = "#7AA2F7"
background = "#1a1b26"
foreground = "#a9b1d6"
red = "#f7768e"
"""
LIGHT_NO_MODE = """accent = "#1e66f5"
background = "#eff1f5"
foreground = "#4c4f69"
"""


class Host:
    def __init__(self, state):
        env = dict(os.environ, OMARCHY_PALETTE_STATE_DIR=state)
        self.proc = subprocess.Popen(
            [HOST], stdin=subprocess.PIPE, stdout=subprocess.PIPE, env=env
        )

    def read(self, timeout=4.0):
        out = self.proc.stdout
        ready, _, _ = select.select([out], [], [], timeout)
        if not ready:
            return None
        header = out.read(4)
        if len(header) < 4:
            return None
        (length,) = struct.unpack("=I", header)
        return json.loads(out.read(length))

    def quiet(self, seconds):
        """Return any message sent within `seconds`, or None."""
        return self.read(timeout=seconds)

    def write(self, payload):
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.proc.stdin.write(struct.pack("=I", len(data)) + data)
        self.proc.stdin.flush()

    def close(self):
        if self.proc.poll() is None:
            self.proc.kill()
        self.proc.wait()
        self.proc.stdin.close()
        self.proc.stdout.close()


class HostTest(unittest.TestCase):
    def setUp(self):
        self.state = tempfile.mkdtemp(prefix="omarchy-state-")
        self.write_theme("tokyo-night", DARK)
        self.host = None

    def tearDown(self):
        if self.host:
            self.host.close()
        shutil.rmtree(self.state, ignore_errors=True)

    def write_theme(self, name, colours, directory=None):
        theme = directory or os.path.join(self.state, "theme")
        os.makedirs(theme, exist_ok=True)
        with open(os.path.join(theme, "colors.toml"), "w") as handle:
            handle.write(colours)
        if directory is None:
            with open(os.path.join(self.state, "theme.name"), "w") as handle:
                handle.write(name + "\n")

    def start(self):
        self.host = Host(self.state)
        return self.host

    def test_initial_palette_is_validated_and_normalised(self):
        message = self.start().read()
        self.assertEqual(message["type"], "palette")
        self.assertEqual(message["name"], "tokyo-night")
        self.assertEqual(message["mode"], "dark")
        self.assertEqual(message["colors"]["accent"], "#7aa2f7")
        self.assertEqual(set(message["colors"]), {"accent", "background", "foreground", "red"})

    def test_mode_falls_back_to_marker_then_luminance(self):
        self.write_theme("latte", LIGHT_NO_MODE)
        self.assertEqual(self.start().read()["mode"], "light")
        self.host.close()
        dark_no_mode = DARK.replace('mode = "dark"\n', "")
        self.write_theme("x", dark_no_mode)
        open(os.path.join(self.state, "theme", "light.mode"), "w").close()
        self.host = Host(self.state)
        self.assertEqual(self.host.read()["mode"], "light")

    def test_mode_matches_omarchy_resolution(self):
        cases = [
            ('background = "#c8b89a"\nforeground = "#222222"\naccent = "#335599"\n', "light"),
            ('background = "#a0a0a0"\nforeground = "#000000"\naccent = "#335599"\n', "light"),
            ('background = "#7f7f7f"\nforeground = "#ffffff"\naccent = "#335599"\n', "dark"),
            ('theme_type = "light"\n' + DARK.replace('mode = "dark"\n', ""), "light"),
            ('mode = "sepia"\n' + LIGHT_NO_MODE, "dark"),
            ('background = "#fff"\nforeground = "#000000"\naccent = "#335599"\n', "dark"),
            ('mode\t= "light"\nbackground = "#000000"\nforeground = "#ffffff"\naccent = "#335599"\n', "dark"),
            ('background = "rgb(255,255,255)"\ncolor0 = "#ffffff"\nforeground = "#000000"\naccent = "#335599"\n', "dark"),
        ]
        for colours, expected in cases:
            with self.subTest(colours=colours):
                self.write_theme("x", colours)
                host = Host(self.state)
                try:
                    self.assertEqual(host.read()["mode"], expected)
                finally:
                    host.close()

    def test_accepts_the_forms_omarchy_accepts(self):
        self.write_theme(
            "hand-written",
            "# hand-written theme\n[colors]\nbg = '#101010'\nfg = #eeeeee\ncolor4 = \"#3366ff\" # blue\n"
            "not a key value line\nmode = light\n",
        )
        message = self.start().read()
        self.assertEqual(message["type"], "palette")
        self.assertEqual(message["mode"], "light")
        self.assertEqual(message["colors"]["background"], "#101010")
        self.assertEqual(message["colors"]["foreground"], "#eeeeee")
        self.assertEqual(message["colors"]["accent"], "#3366ff")
        self.assertEqual(message["colors"]["blue"], "#3366ff")

    def test_ansi_slots_fill_background_and_foreground(self):
        self.write_theme("ansi", 'color0 = "#000000"\ncolor7 = "#cccccc"\naccent = "#ff8800"\n')
        colours = self.start().read()["colors"]
        self.assertEqual((colours["background"], colours["foreground"]), ("#000000", "#cccccc"))

    def test_unknown_keys_and_invalid_values_are_dropped(self):
        self.write_theme(
            "x",
            DARK + 'secret = "#123456"\nblue = "not a colour"\ngreen = "#12345"\nbanner = "hello"\n',
        )
        colours = self.start().read()["colors"]
        self.assertNotIn("secret", colours)
        self.assertNotIn("blue", colours)
        self.assertNotIn("green", colours)
        self.assertNotIn("hello", json.dumps(colours))

    def test_symlink_to_other_file_leaks_nothing(self):
        target = os.path.join(self.state, "private.txt")
        with open(target, "w") as handle:
            handle.write("token = super-secret-value\n")
        colours = os.path.join(self.state, "theme", "colors.toml")
        os.remove(colours)
        os.symlink(target, colours)
        message = self.start().read()
        self.assertEqual(message, {"type": "status", "state": "malformed"})

    def test_symlink_to_fifo_does_not_block(self):
        fifo = os.path.join(self.state, "pipe")
        os.mkfifo(fifo)
        colours = os.path.join(self.state, "theme", "colors.toml")
        os.remove(colours)
        os.symlink(fifo, colours)
        self.assertEqual(self.start().read(), {"type": "status", "state": "malformed"})

    def test_invalid_theme_name_is_withheld(self):
        with open(os.path.join(self.state, "theme.name"), "w") as handle:
            handle.write("../../etc\n")
        self.assertIsNone(self.start().read()["name"])

    def test_get_resends_and_other_requests_are_ignored(self):
        host = self.start()
        host.read()
        host.write({"type": "set-theme", "name": "white"})
        host.write({"type": "install-theme"})
        host.write(b"not json")
        self.assertIsNone(host.quiet(1.2))
        host.write({"type": "get"})
        self.assertEqual(host.read()["type"], "palette")

    def test_live_change(self):
        host = self.start()
        host.read()
        self.write_theme("white", LIGHT_NO_MODE.replace("#eff1f5", "#ffffff"))
        message = host.read()
        self.assertEqual(message["name"], "white")
        self.assertEqual(message["colors"]["background"], "#ffffff")
        self.assertIsNone(host.quiet(1.5))

    def test_directory_replacement_sends_one_palette_and_no_missing(self):
        host = self.start()
        host.read()
        staged = os.path.join(self.state, "next-theme")
        self.write_theme("latte", LIGHT_NO_MODE, directory=staged)
        theme = os.path.join(self.state, "theme")
        shutil.rmtree(theme)
        time.sleep(0.3)
        os.rename(staged, theme)
        with open(os.path.join(self.state, "theme.name"), "w") as handle:
            handle.write("latte\n")
        message = host.read()
        self.assertEqual(message["type"], "palette")
        self.assertEqual(message["name"], "latte")
        self.assertIsNone(host.quiet(2.5))

    def test_missing_is_reported_after_grace_then_recovers(self):
        host = self.start()
        host.read()
        shutil.rmtree(os.path.join(self.state, "theme"))
        self.assertIsNone(host.quiet(1.5))
        self.assertEqual(host.read(), {"type": "status", "state": "missing"})
        self.write_theme("tokyo-night", DARK)
        self.assertEqual(host.read()["type"], "palette")

    def test_missing_at_start_is_reported_immediately(self):
        shutil.rmtree(os.path.join(self.state, "theme"))
        self.assertEqual(self.start().read(timeout=1), {"type": "status", "state": "missing"})

    def test_malformed_then_fixed(self):
        host = self.start()
        host.read()
        self.write_theme("x", 'background = "#000000"\nforeground = "#ffffff"\n')
        self.assertEqual(host.read(), {"type": "status", "state": "malformed"})
        self.write_theme("x", "this is [not toml\n")
        self.assertIsNone(host.quiet(1.5))
        self.write_theme("tokyo-night", DARK)
        self.assertEqual(host.read()["type"], "palette")

    def test_exits_when_stdin_closes(self):
        host = self.start()
        host.read()
        host.proc.stdin.close()
        self.assertEqual(host.proc.wait(timeout=3), 0)

    def test_never_writes_to_state_dir(self):
        before = sorted(os.walk(self.state))
        host = self.start()
        host.read()
        host.write({"type": "get"})
        host.read()
        host.proc.stdin.close()
        host.proc.wait(timeout=3)
        self.assertEqual(sorted(os.walk(self.state)), before)


if __name__ == "__main__":
    unittest.main()
