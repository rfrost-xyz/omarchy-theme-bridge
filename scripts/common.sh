# Shared paths and helpers for install.sh and uninstall.sh. Sourced, not run.
# shellcheck shell=bash

NAME=omarchy-theme-bridge
HOST_NAME=xyz.rfrost.omarchy_theme_bridge
HOST_FILE=omarchy-theme-bridge-host
EXTENSION_ID=pinjcoeajnkogbmcjjgkgjafpiiebheg
MARKER=.installed-by-omarchy-theme-bridge

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
    "description": "Read-only Omarchy palette for omarchy-theme-bridge",
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

# Add or remove a --load-extension entry for the extension at $3, recording
# changes in state file $4, in flags file $2. Prints only the changed line, or
# "unchanged"; pass --write to apply. See scripts/flags.py.
flags_edit_at() {
  /usr/bin/python3 "$SOURCE/scripts/flags.py" "$1" "$2" "$3" "$4" "${@:5}"
}

# The same for this installation's own extension and flags file.
flags_edit() {
  flags_edit_at "$1" "$FLAGS_FILE" "$EXTENSION_DIR" "$FLAGS_STATE" "${@:2}"
}

# True when the native host manifest $1 points at the helper $2.
manifest_points_at() {
  /usr/bin/python3 -c 'import json, os, sys; sys.exit(0 if os.path.normpath(json.load(open(sys.argv[1])).get("path", "")) == os.path.normpath(sys.argv[2]) else 1)' "$1" "$2" 2>/dev/null
}

GROK_CONFIG=$HOME/.grok/config.toml
GROK_STATE=$DATA_DIR/grok-state.json

# Point Grok at the terminal theme, or put its configuration back. Prints only
# the changed lines, or "unchanged"; pass --write to apply. See scripts/grok.py.
grok_edit_at() {
  /usr/bin/python3 "$SOURCE/scripts/grok.py" "$1" "$GROK_CONFIG" "$2" "${@:3}"
}
grok_edit() {
  grok_edit_at "$1" "$GROK_STATE" "${@:2}"
}

# Legacy install under the former name omarchy-webapp-theme. Only a directory
# carrying the legacy ownership marker is ours to migrate or remove.
LEGACY_NAME=omarchy-webapp-theme
LEGACY_DATA_DIR=$(normal_dir "${XDG_DATA_HOME:-$HOME/.local/share}")/$LEGACY_NAME
LEGACY_MARKER=.installed-by-omarchy-webapp-theme
LEGACY_EXTENSION_DIR=$LEGACY_DATA_DIR/extension
LEGACY_HOST_PATH=$LEGACY_DATA_DIR/bin/omarchy-webapp-theme-host
LEGACY_MANIFEST_PATH=$CONFIG_DIR/chromium/NativeMessagingHosts/xyz.rfrost.omarchy_webapp_theme.json
LEGACY_FLAGS_STATE=$LEGACY_DATA_DIR/flags-state.json
LEGACY_GROK_STATE=$LEGACY_DATA_DIR/grok-state.json

# Sets LEGACY_FOUND=1 when a marked legacy install exists. An unmarked legacy
# directory is left alone and reported.
LEGACY_FOUND=0
legacy_detect() {
  LEGACY_FOUND=0
  if [[ -f $LEGACY_DATA_DIR/$LEGACY_MARKER ]]; then
    LEGACY_FOUND=1
  elif [[ -e $LEGACY_DATA_DIR ]]; then
    echo "Skip: $LEGACY_DATA_DIR exists but was not created by the legacy installer; leaving it alone."
  fi
}

# Plan removal of the legacy --load-extension entry. Sets LEGACY_FLAGS_PLAN to
# the planned change ("unchanged" when the file has no legacy entry). Returns 1
# after explaining when the entry cannot be edited safely.
LEGACY_FLAGS_PLAN=unchanged
legacy_flags_plan() {
  LEGACY_FLAGS_PLAN=unchanged
  [[ -f $FLAGS_FILE ]] || return 0
  local status=0
  LEGACY_FLAGS_PLAN=$(flags_edit_at remove "$FLAGS_FILE" "$LEGACY_EXTENSION_DIR" "$LEGACY_FLAGS_STATE") || status=$?
  if ((status == 3 || status == 4)); then
    echo "Remove the legacy --load-extension entry for $LEGACY_EXTENSION_DIR from $FLAGS_FILE by hand, then rerun. Nothing was changed." >&2
    return 1
  elif ((status != 0)); then
    echo "Could not read $FLAGS_FILE; nothing was changed." >&2
    return 1
  fi
}

# List (mode "list") or perform (mode "apply") the removal of the legacy native
# host manifest, only while it points at the legacy helper, and then of the
# legacy directory.
legacy_files() {
  if [[ -f $LEGACY_MANIFEST_PATH ]] && manifest_points_at "$LEGACY_MANIFEST_PATH" "$LEGACY_HOST_PATH"; then
    if [[ $1 == list ]]; then
      echo "Remove: $LEGACY_MANIFEST_PATH"
    else
      rm -f "$LEGACY_MANIFEST_PATH"
    fi
  elif [[ $1 == list && -e $LEGACY_MANIFEST_PATH ]]; then
    echo "Skip: $LEGACY_MANIFEST_PATH does not point at the legacy installation."
  fi
  if [[ $1 == list ]]; then
    echo "Remove: $LEGACY_DATA_DIR/"
  else
    rm -rf "$LEGACY_DATA_DIR"
  fi
}
