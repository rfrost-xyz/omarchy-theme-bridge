# Shared paths and helpers for install.sh and uninstall.sh. Sourced, not run.
# shellcheck shell=bash

NAME=omarchy-webapp-theme
HOST_NAME=xyz.rfrost.omarchy_webapp_theme
HOST_FILE=omarchy-webapp-theme-host
EXTENSION_ID=pinjcoeajnkogbmcjjgkgjafpiiebheg
MARKER=.installed-by-omarchy-webapp-theme

# Normalise absolute bases (trailing or doubled slashes, dot segments) so every
# spelling of a directory produces the same paths; relative ones are refused
# by install.sh.
normal_dir() {
  if [[ $1 == /* ]]; then realpath -ms -- "$1"; else printf '%s\n' "$1"; fi
}
CONFIG_DIR=$(normal_dir "${XDG_CONFIG_HOME:-$HOME/.config}")
DATA_DIR=$(normal_dir "${XDG_DATA_HOME:-$HOME/.local/share}")/$NAME
EXTENSION_DIR=$DATA_DIR/extension
HOST_PATH=$DATA_DIR/bin/$HOST_FILE
MANIFEST_PATH=$CONFIG_DIR/chromium/NativeMessagingHosts/$HOST_NAME.json
FLAGS_FILE=$CONFIG_DIR/chromium-flags.conf

# XDG directories must be absolute; refuse rather than write relative to
# wherever the script happens to run.
require_absolute_dirs() {
  if [[ $CONFIG_DIR != /* ]]; then
    echo "The configuration directory must be an absolute path (check XDG_CONFIG_HOME): $CONFIG_DIR" >&2
    exit 1
  fi
  if [[ $DATA_DIR != /* ]]; then
    echo "The install directory must be an absolute path (check XDG_DATA_HOME): $DATA_DIR" >&2
    exit 1
  fi
}

host_manifest() {
  /usr/bin/python3 - "$HOST_NAME" "$HOST_PATH" "$EXTENSION_ID" <<'PY'
import json, sys
name, path, ext = sys.argv[1:4]
print(json.dumps({
    "name": name,
    "description": "Read-only Omarchy palette for omarchy-webapp-theme",
    "path": path,
    "type": "stdio",
    "allowed_origins": [f"chrome-extension://{ext}/"],
}, indent=2))
PY
}

# Chromium's flags launcher splits on whitespace with shell quoting, and the
# flag value is a comma list, so the install path must avoid those characters.
path_is_safe() {
  [[ $1 == /* && $1 != *[[:space:],\'\"\\\#]* && $1 != *[[:cntrl:]]* ]]
}

FLAGS_STATE=$DATA_DIR/flags-state.json

# Add or remove our --load-extension entry. Prints only the changed line, or
# "unchanged"; pass --write to apply. See scripts/flags.py.
flags_edit() {
  /usr/bin/python3 "$SOURCE/scripts/flags.py" "$1" "$FLAGS_FILE" "$EXTENSION_DIR" "$FLAGS_STATE" "${@:2}"
}

GROK_CONFIG=$HOME/.grok/config.toml
GROK_STATE=$DATA_DIR/grok-state.json

# Point Grok at the terminal theme, or put its configuration back. Prints only
# the changed lines, or "unchanged"; pass --write to apply. See scripts/grok.py.
grok_edit() {
  /usr/bin/python3 "$SOURCE/scripts/grok.py" "$1" "$GROK_CONFIG" "$GROK_STATE" "${@:2}"
}
