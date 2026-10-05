"""flags.py must split lines exactly as Chromium's launcher (GLib) does.

Expected values were produced with GLib.shell_parse_argv on this machine.
"""

import importlib.util
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("flags", os.path.join(ROOT, "scripts", "flags.py"))
flags = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flags)

GLIB = {
    "--a --b": ["--a", "--b"],
    "#--load-extension=/x": [],
    "--x=a#b --load-extension=/c": ["--x=a#b", "--load-extension=/c"],
    '--x="a # b" --y': ["--x=a # b", "--y"],
    "--u='x' # trailing": ["--u=x"],
    "  --load-extension=/a": ["--load-extension=/a"],
    "--a=\\#b --c": ["--a=#b", "--c"],
    "--b'": [],
    '--q="a\\"b" --r': ['--q=a"b', "--r"],
    "x #y z": ["x"],
    "\t#c": ["#c"],
    "a\t#b": ["a", "#b"],
    '"x"#y': ["x#y"],
    "'a' #b": ["a"],
    "--l=1 \\#x": ["--l=1", "#x"],
}


class TokensTest(unittest.TestCase):
    def test_matches_glib(self):
        for line, expected in GLIB.items():
            with self.subTest(line=line):
                self.assertEqual(flags.tokens(line), expected)


if __name__ == "__main__":
    unittest.main()
