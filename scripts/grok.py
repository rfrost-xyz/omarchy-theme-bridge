#!/usr/bin/python3
"""Point Grok Build at the terminal theme, and put the configuration back.

Usage: grok.py (add|remove) CONFIG STATE_FILE [--write]

add sets theme = "terminal" in [ui] and terminal_theme = true in [features] of
CONFIG (normally ~/.grok/config.toml). remove reverts each key only while its
line is still exactly what add wrote.

Without --write it only prints the lines that would change, or "unchanged".
The file is edited line by line, so every other byte stays as it was. The file
is parsed with tomllib before and after, and an edit that would change
anything but the two keys is refused (exit 3, file untouched). STATE_FILE
records the original lines so remove restores them exactly. Writes go through
the resolved path, keep the file mode and replace the file atomically.
"""

import copy
import json
import os
import re
import sys
import tempfile
import tomllib

# (table, key, TOML text of the value, parsed value)
TARGETS = [
    ("ui", "theme", '"terminal"', "terminal"),
    ("features", "terminal_theme", "true", True),
]
MISSING = object()


class Refuse(Exception):
    pass


def body(line):
    return line.rstrip("\r\n")


def ending(line):
    return line[len(body(line)):]


def name_pattern(name):
    return r"(?:" + name + r"|\"" + name + r"\"|'" + name + r"')"


def header_pattern(table):
    return re.compile(r"^[ \t]*\[[ \t]*" + name_pattern(table) + r"[ \t]*\][ \t]*(?:#.*)?$")


def subtable_pattern(table):
    return re.compile(r"^[ \t]*\[\[?[ \t]*" + name_pattern(table) + r"[ \t]*\.")


ANY_HEADER = re.compile(r"^[ \t]*\[")


def find_headers(lines, table):
    pattern = header_pattern(table)
    return [index for index, line in enumerate(lines) if pattern.match(body(line))]


def section_end(lines, header):
    for index in range(header + 1, len(lines)):
        if ANY_HEADER.match(body(lines[index])):
            return index
    return len(lines)


def find_key(lines, start, end, key):
    pattern = re.compile(r"^[ \t]*" + name_pattern(key) + r"[ \t]*=")
    for index in range(start, end):
        if pattern.match(body(lines[index])):
            return index
    return None


def same(value, target):
    return type(value) is type(target) and value == target


def parse(text, what):
    try:
        return tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise Refuse(f"{what} is not valid TOML ({error})")


def check_shape(text):
    if "\r" in text:
        raise Refuse("the file uses CRLF line endings; convert it to LF first")
    if '"""' in text or "'''" in text:
        raise Refuse("the file has a multi-line string, which a line edit cannot safely skip")
    return parse(text, "the file")


def line_for(key, value):
    return f"{key} = {value}\n"


def add(lines, before, old_state):
    new = list(lines)
    keys = {}
    old_keys = (old_state or {}).get("keys", {})
    for table, key, value, target in TARGETS:
        label = f"{table}.{key}"
        headers = find_headers(new, table)
        if len(headers) > 1:
            raise Refuse(f"the file has more than one [{table}] table")
        current = before.get(table, {})
        if table in before and not isinstance(current, dict):
            raise Refuse(f"{table} is not a table")
        current = current.get(key, MISSING) if isinstance(current, dict) else MISSING
        if headers:
            header = headers[0]
            index = find_key(new, header + 1, section_end(new, header), key)
            if index is None and current is not MISSING:
                raise Refuse(f"{label} is set in a form this editor cannot change")
            if index is not None and same(current, target):
                old = old_keys.get(label)
                if old and old.get("action") != "kept" and body(new[index]) == body(old.get("written", "")):
                    keys[label] = old
                else:
                    keys[label] = {"action": "kept"}
            elif index is not None:
                written = f"{key} = {value}" + ending(new[index])
                keys[label] = {"action": "replaced", "original": new[index], "written": written}
                new[index] = written
            else:
                joined = ending(new[header]) == ""
                if joined:
                    new[header] += "\n"
                written = line_for(key, value)
                if joined:
                    written = body(written)
                keys[label] = {"action": "inserted", "written": written, "joined": joined}
                new.insert(header + 1, written)
        else:
            if table in before and not any(subtable_pattern(table).match(body(line)) for line in new):
                raise Refuse(f"{table} is set as a dotted key or inline table, which this editor cannot change")
            unterminated = bool(new) and ending(new[-1]) == ""
            if unterminated:
                new[-1] += "\n"
            separator = bool(new)
            if separator:
                new.append("\n")
            written = line_for(key, value)
            new.extend([f"[{table}]\n", written])
            keys[label] = {"action": "added-table", "written": written, "separator": separator, "unterminated": unterminated}
    return new, keys


def remove(lines, state, exists=True):
    new = list(lines)
    for table, key, _, _ in reversed(TARGETS):
        record = state.get("keys", {}).get(f"{table}.{key}")
        if not record or record.get("action") == "kept":
            continue
        headers = find_headers(new, table)
        if len(headers) != 1:
            continue
        header = headers[0]
        end = section_end(new, header)
        written = body(record.get("written", ""))
        index = next((i for i in range(header + 1, end) if body(new[i]) == written), None)
        if index is None:
            continue  # the user changed it since; keep their choice
        action = record["action"]
        if action == "replaced":
            original = record["original"]
            if index != len(new) - 1:
                original = body(original) + ending(new[index])
            new[index] = original
            continue
        del new[index]
        if action == "inserted":
            if record.get("joined") and header == len(new) - 1:
                new[header] = body(new[header])
        elif action == "added-table":
            end = section_end(new, header)
            if all(not line.strip() for line in new[header + 1:end]):
                del new[header]
                if record.get("separator") and header > 0 and new[header - 1] == "\n":
                    del new[header - 1]
                    header -= 1
                if record.get("unterminated") and header == len(new) and new:
                    new[-1] = body(new[-1])
    delete = exists and bool(state.get("created")) and not new
    return new, delete


def normalise(doc, labels):
    doc = copy.deepcopy(doc)
    for label in labels:
        table, key = label.split(".")
        if isinstance(doc.get(table), dict):
            doc[table].pop(key, None)
    for table, _, _, _ in TARGETS:
        if doc.get(table) == {}:
            del doc[table]
    return doc


def show(lines, new):
    import difflib

    old_bodies = [body(line) for line in lines]
    new_bodies = [body(line) for line in new]
    matcher = difflib.SequenceMatcher(None, old_bodies, new_bodies, autojunk=False)
    for tag, a0, a1, b0, b1 in matcher.get_opcodes():
        if tag == "equal":
            continue
        for line in old_bodies[a0:a1]:
            if line.strip():
                print("  - " + line)
        for line in new_bodies[b0:b1]:
            if line.strip():
                print("  + " + line)


def write_atomic(path, text, mode):
    target = os.path.realpath(path)
    directory = os.path.dirname(target)
    handle, temp = tempfile.mkstemp(prefix=".grok-config.", dir=directory)
    try:
        with os.fdopen(handle, "wb") as out:
            out.write(text.encode("utf-8"))
            out.flush()
            os.fsync(out.fileno())
        os.chmod(temp, mode)
        os.replace(temp, target)
    except BaseException:
        if os.path.exists(temp):
            os.unlink(temp)
        raise


def load_state(path):
    try:
        with open(path) as handle:
            state = json.load(handle)
    except (OSError, ValueError):
        return None
    return state if isinstance(state, dict) else None


def run(action, path, state_path, write):
    state = load_state(state_path)
    if action == "remove" and state is None:
        print("unchanged")
        return 0
    exists = os.path.exists(path)
    if os.path.islink(path) and not exists:
        raise Refuse("the configuration is a dangling symlink")
    if exists and not os.path.isfile(path):
        raise Refuse("the configuration is not a regular file")
    text = ""
    mode = 0o600
    if exists:
        try:
            with open(path, "rb") as handle:
                text = handle.read().decode("utf-8")
        except UnicodeDecodeError:
            raise Refuse("the file is not valid UTF-8")
        mode = os.stat(path).st_mode & 0o7777
        if not os.access(os.path.realpath(path), os.W_OK):
            raise Refuse("the file is not writable")
    lines = text.splitlines(keepends=True)
    directory = os.path.dirname(os.path.realpath(path))

    if action == "add":
        before = check_shape(text)
        new, keys = add(lines, before, state)
        delete = False
        if new != lines:
            after = parse("".join(new), "the edited file")
            expected = copy.deepcopy(before)
            for table, key, _, target in TARGETS:
                expected.setdefault(table, {})[key] = target
            if after != expected:
                raise Refuse("the edit would change more than the two keys")
        new_state = None
        if new != lines:
            new_state = {
                "created": bool((state or {}).get("created")) or not exists,
                "dir_created": bool((state or {}).get("dir_created")) or not os.path.isdir(directory),
                "keys": keys,
            }
    else:
        new, delete = remove(lines, state, exists)
        if new != lines or delete:
            if exists:
                before = check_shape(text)
                after = parse("".join(new), "the reverted file") if new else {}
                labels = list(state.get("keys", {}))
                if normalise(before, labels) != normalise(after, labels):
                    raise Refuse("the revert would change more than the two keys")
        new_state = None

    changed = new != lines or delete
    if not changed:
        print("unchanged")
        if write and action == "remove":
            remove_state(state_path)
        return 0
    show(lines, new)
    if delete:
        print(f"  - {path} (created by the installer, now empty)")
    if not write:
        return 0
    if action == "add":
        os.makedirs(directory, exist_ok=True)
        write_atomic(path, "".join(new), mode)
        os.makedirs(os.path.dirname(os.path.abspath(state_path)), exist_ok=True)
        with open(state_path, "w") as handle:
            json.dump(new_state, handle)
    else:
        if delete:
            os.remove(path)
            if state.get("dir_created"):
                try:
                    os.rmdir(os.path.dirname(path))
                except OSError:
                    pass
        else:
            write_atomic(path, "".join(new), mode)
        remove_state(state_path)
    return 0


def remove_state(state_path):
    try:
        os.remove(state_path)
    except FileNotFoundError:
        pass


def main(argv):
    if len(argv) < 4 or argv[1] not in ("add", "remove"):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    action, path, state_path = argv[1:4]
    try:
        return run(action, path, state_path, "--write" in argv[4:])
    except Refuse as error:
        print(f"Grok: not changed: {error}.", file=sys.stderr)
        return 3
    except OSError as error:
        print(f"Grok: could not edit {path}: {error}.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
