# Shared paths and helpers for install.sh and uninstall.sh. Sourced, not run.
# shellcheck shell=bash

NAME=omarchy-webapp-theme
HOST_NAME=xyz.rfrost.omarchy_webapp_theme
HOST_FILE=omarchy-webapp-theme-host
EXTENSION_ID=pinjcoeajnkogbmcjjgkgjafpiiebheg
MARKER=.installed-by-omarchy-webapp-theme

CONFIG_DIR=${XDG_CONFIG_HOME:-$HOME/.config}
DATA_DIR=${XDG_DATA_HOME:-$HOME/.local/share}/$NAME
EXTENSION_DIR=$DATA_DIR/extension
HOST_PATH=$DATA_DIR/bin/$HOST_FILE
MANIFEST_PATH=$CONFIG_DIR/chromium/NativeMessagingHosts/$HOST_NAME.json
FLAGS_FILE=$CONFIG_DIR/chromium-flags.conf

host_manifest() {
  cat <<JSON
{
  "name": "$HOST_NAME",
  "description": "Read-only Omarchy palette for omarchy-webapp-theme",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
JSON
}

# Print the flags file with our extension appended to the last
# --load-extension= list (Chromium honours only the last one), or a new line
# when there is none. Other lines are untouched.
flags_with_extension() {
  awk -v ext="$EXTENSION_DIR" '
    { line[NR] = $0 }
    /^--load-extension=/ { last = NR }
    END {
      for (i = 1; i <= NR; i++) {
        if (i == last) {
          list = substr(line[i], 18); n = split(list, items, ","); found = 0
          for (j = 1; j <= n; j++) { sub(/\/+$/, "", items[j]); if (items[j] == ext) found = 1 }
          print found ? line[i] : (list == "" ? "--load-extension=" ext : line[i] "," ext)
        } else print line[i]
      }
      if (!last) print "--load-extension=" ext
    }' "$1"
}

# Print the flags file with our extension removed from every
# --load-extension= list, dropping a line that only held our entry.
flags_without_extension() {
  awk -v ext="$EXTENSION_DIR" '
    /^--load-extension=/ {
      n = split(substr($0, 18), items, ","); out = ""; changed = 0
      for (j = 1; j <= n; j++) {
        item = items[j]; bare = item; sub(/\/+$/, "", bare)
        if (bare == ext) { changed = 1; continue }
        out = out (out == "" ? "" : ",") item
      }
      if (!changed) { print; next }
      if (out != "") print "--load-extension=" out
      next
    }
    { print }' "$1"
}

flags_loads_extension() {
  [[ -f $1 ]] && [[ $(flags_with_extension "$1") == "$(cat "$1")" ]] && grep -q '^--load-extension=' "$1"
}

# Show only the changed lines, never surrounding context: the flags file can
# hold unrelated settings that should not be echoed.
show_line_change() {
  diff --unchanged-line-format= --old-line-format='  - %L' --new-line-format='  + %L' "$1" <(printf '%s\n' "$2") || true
}

# Rewrite a file's contents in place, so a symlink, owner and mode survive.
write_in_place() {
  local target
  target=$(readlink -f "$1")
  printf '%s\n' "$2" >"$target"
}
