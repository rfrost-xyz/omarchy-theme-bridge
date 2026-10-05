#!/usr/bin/python3
"""Add or remove one extension in Chromium's --load-extension list.

Usage: flags.py (add|remove) FLAGS_FILE EXTENSION_DIR STATE_FILE [--write]

Without --write it only prints the change. The file is edited byte for byte:
only the --load-extension line changes, line endings and the final newline
are kept, and the write goes through the resolved path so a symlink, owner and
mode survive. STATE_FILE records how the line was changed so removal restores
the original exactly.
"""

import json
import os
import shlex
import sys

SWITCH = "--load-extension="


class Refuse(Exception):
    pass


def split_lines(data):
    return data.splitlines(keepends=True)


def body(line):
    return line.rstrip("\r\n")


def ending(line):
    return line[len(body(line)):]


def tokens(line):
    """Split a line the way Chromium's launcher (GLib g_shell_parse_argv) does.

    A '#' starts a comment only at the start of a word, and a line that
    cannot be split (unbalanced quotes) is skipped, so it carries no switches.
    """
    quote = None
    escaped = False
    word_start = True
    for index, char in enumerate(line):
        if escaped:
            escaped = False
        elif quote:
            if char == quote:
                quote = None
            elif char == "\\" and quote == '"':
                escaped = True
        elif char == "\\":
            escaped = True
        elif char in "\"'":
            quote = char
        elif char == "#" and word_start:
            line = line[:index]
            break
        # GLib only starts a comment after a space or newline, not a tab.
        word_start = char in " \n" and not quote and not escaped
    lexer = shlex.shlex(line, posix=True)
    lexer.whitespace = " \t\n"  # GLib does not treat CR as whitespace
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        return list(lexer)
    except ValueError:
        return []


def occurrences(lines):
    """Yield (index, standalone) for each line carrying the switch."""
    for index, line in enumerate(lines):
        if any(token.startswith(SWITCH) for token in tokens(line)):
            text = body(line)
            # Quotes or backslashes make the launcher's value differ from the
            # raw text, so such a line is never edited.
            yield index, text.startswith(SWITCH) and not any(c.isspace() or c in "\"'\\" for c in text)


def entries(line):
    value = body(line)[len(SWITCH):]
    return [item for item in value.split(",") if item] if value else []


def same(a, b):
    return os.path.normpath(a) == os.path.normpath(b)


def add(lines, ext):
    found = list(occurrences(lines))
    if not found:
        state = {"action": "added-line", "final_newline": not lines or ending(lines[-1]) != ""}
        new = list(lines)
        if new and ending(new[-1]) == "":
            new[-1] += "\n"
        new.append(SWITCH + ext + "\n")
        return new, state, None, new[-1]
    index, standalone = found[-1]
    if "\r" in lines[index]:
        raise Refuse(
            "the flags file uses CRLF line endings, which Chromium's launcher passes "
            "through; convert it to LF or load the extension unpacked"
        )
    if not standalone:
        raise Refuse(
            "the last --load-extension switch shares a line, is indented or is quoted; "
            "edit it by hand or load the extension unpacked"
        )
    line = lines[index]
    current = entries(line)
    if any(same(item, ext) for item in current):
        return lines, None, None, None
    # Append verbatim so empty items (Omarchy's migrations can leave a leading
    # comma) survive, and record both bodies so removal restores the original.
    value = body(line)[len(SWITCH):]
    written = value + ("" if value == "" or value.endswith(",") else ",") + ext
    state = {"action": "appended", "original": value, "written": written}
    new_line = SWITCH + written + ending(line)
    new = list(lines)
    new[index] = new_line
    return new, state, line, new_line


def remove(lines, ext, state):
    new = list(lines)
    old_line = new_line = None
    for index, standalone in reversed(list(occurrences(lines))):
        if not standalone:
            continue
        line = lines[index]
        value = body(line)[len(SWITCH):]
        items = value.split(",")
        kept = [item for item in items if not (item and same(item, ext))]
        if kept == items:
            continue
        old_line = line
        state = state or {}
        if state.get("action") == "appended" and state.get("written") == value:
            restored = state.get("original", "")
        elif not any(kept) and state.get("action") != "appended":
            restored = None
        else:
            restored = ",".join(kept)
        if restored is not None:
            new_line = SWITCH + restored + ending(line)
            new[index] = new_line
        else:
            del new[index]
            if (state or {}).get("action") == "added-line" and state.get("final_newline") is False and index == len(new) and new:
                new[-1] = body(new[-1])
        break
    return new, old_line, new_line


def show(old_line, new_line):
    if old_line is not None:
        print("  - " + body(old_line))
    if new_line is not None:
        print("  + " + body(new_line))


def mentions(lines, ext):
    """True when any --load-extension token still names ext."""
    for line in lines:
        for token in tokens(line):
            if token.startswith(SWITCH) and any(same(item, ext) for item in token[len(SWITCH):].split(",")):
                return True
    return False


def main(argv):
    if len(argv) < 5 or argv[1] not in ("add", "remove", "mentions"):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    action, path, ext, state_path = argv[1:5]
    write = "--write" in argv[5:]
    with open(path, "rb") as handle:
        data = handle.read().decode("utf-8", "surrogateescape")
    lines = split_lines(data)
    if action == "mentions":
        return 0 if mentions(lines, ext) else 1
    try:
        if action == "add":
            new, state, old_line, new_line = add(lines, ext)
        else:
            try:
                with open(state_path) as handle:
                    state = json.load(handle)
            except (OSError, ValueError):
                state = None
            new, old_line, new_line = remove(lines, ext, state)
            if mentions(new, ext):
                print(f"Flags: {path} still loads {ext} on a line this script cannot edit safely.", file=sys.stderr)
                return 4
    except Refuse as error:
        print(f"Flags: not changed: {error}.", file=sys.stderr)
        return 3
    if new == lines:
        print("unchanged")
        return 0
    if action == "add":
        # The new line must be a clean single token naming ext exactly once.
        changed = [line for line in new if line not in lines and SWITCH in line]
        if len(changed) != 1 or any(not body(line).startswith(SWITCH) or any(c.isspace() for c in body(line)) or [same(i, ext) for i in entries(line)].count(True) != 1 for line in changed):
            print("Flags: not changed: the extension path cannot be written safely.", file=sys.stderr)
            return 3
    show(old_line, new_line)
    if write:
        with open(os.path.realpath(path), "r+b") as handle:
            handle.write("".join(new).encode("utf-8", "surrogateescape"))
            handle.truncate()
        if action == "add":
            with open(state_path, "w") as handle:
                json.dump(state, handle)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
