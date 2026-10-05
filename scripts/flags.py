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
    try:
        return shlex.split(line, comments=True)
    except ValueError:
        return line.split()


def occurrences(lines):
    """Yield (index, standalone) for each line carrying the switch."""
    for index, line in enumerate(lines):
        if any(token.startswith(SWITCH) for token in tokens(line)):
            yield index, body(line).startswith(SWITCH) and len(tokens(line)) == 1 and " " not in body(line)


def entries(line):
    value = body(line)[len(SWITCH):]
    return [item for item in value.split(",") if item] if value else []


def same(a, b):
    return a.rstrip("/") == b.rstrip("/")


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
    if not standalone:
        raise Refuse(
            "the last --load-extension switch shares a line or is indented; "
            "edit it by hand or load the extension unpacked"
        )
    line = lines[index]
    current = entries(line)
    if any(same(item, ext) for item in current):
        return lines, None, None, None
    state = {"action": "appended", "was_empty": not current}
    new_line = SWITCH + ",".join(current + [ext]) + ending(line)
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
        current = entries(line)
        kept = [item for item in current if not same(item, ext)]
        if kept == current:
            continue
        old_line = line
        if kept or (state or {}).get("was_empty"):
            new_line = SWITCH + ",".join(kept) + ending(line)
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


def main(argv):
    if len(argv) < 5 or argv[1] not in ("add", "remove"):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    action, path, ext, state_path = argv[1:5]
    write = "--write" in argv[5:]
    with open(path, "rb") as handle:
        data = handle.read().decode("utf-8", "surrogateescape")
    lines = split_lines(data)
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
    except Refuse as error:
        print(f"Flags: not changed: {error}.", file=sys.stderr)
        return 3
    if new == lines:
        print("unchanged")
        return 0
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
