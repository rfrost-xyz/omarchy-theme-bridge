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

FLAGS_STATE=$DATA_DIR/flags-state.json

# Add or remove our --load-extension entry. Prints only the changed line, or
# "unchanged"; pass --write to apply. See scripts/flags.py.
flags_edit() {
  /usr/bin/python3 "$SOURCE/scripts/flags.py" "$1" "$FLAGS_FILE" "$EXTENSION_DIR" "$FLAGS_STATE" "${@:2}"
}
