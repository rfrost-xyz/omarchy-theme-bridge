#!/bin/bash
# Per-user, Chromium-only installer for omarchy-webapp-theme.
# Usage: ./install.sh [--dry-run] [--load-extension-flag]
set -euo pipefail

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SOURCE/scripts/common.sh"

DRY_RUN=0
FLAG=0
for arg in "$@"; do
  case $arg in
  --dry-run) DRY_RUN=1 ;;
  --load-extension-flag) FLAG=1 ;;
  -h | --help)
    sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "Unknown option: $arg" >&2
    exit 2
    ;;
  esac
done

[[ -x /usr/bin/python3 ]] || { echo "System python3 (/usr/bin/python3) is required." >&2; exit 1; }
if [[ -e $DATA_DIR && ! -f $DATA_DIR/$MARKER ]]; then
  echo "$DATA_DIR exists but was not created by this installer; leaving it alone." >&2
  exit 1
fi

file_count=$(find "$SOURCE/extension" -type f | wc -l)
echo "Files:"
echo "  $DATA_DIR/extension/ ($file_count files, copied from extension/)"
echo "  $HOST_PATH"
echo "  $MANIFEST_PATH (allows only chrome-extension://$EXTENSION_ID/)"

flags_new=""
if ((FLAG)); then
  if [[ ! -f $FLAGS_FILE ]]; then
    echo "Flags: $FLAGS_FILE does not exist, so it is not created. Load the extension unpacked instead."
    FLAG=0
  else
    flags_new=$(flags_with_extension "$FLAGS_FILE")
    if [[ $flags_new == "$(cat "$FLAGS_FILE")" ]]; then
      echo "Flags: $FLAGS_FILE already loads $EXTENSION_DIR"
      FLAG=0
    else
      echo "Flags: $FLAGS_FILE (only the --load-extension line changes):"
      show_line_change "$FLAGS_FILE" "$flags_new"
    fi
  fi
else
  echo "Flags: $FLAGS_FILE is not changed."
fi

if ((DRY_RUN)); then
  echo "Dry run: nothing was written."
  exit 0
fi

staging="$DATA_DIR.new.$$"
trap 'rm -rf "$staging"' EXIT
mkdir -p "$staging/bin"
cp -R "$SOURCE/extension" "$staging/extension"
install -m 0755 "$SOURCE/host/$HOST_FILE" "$staging/bin/$HOST_FILE"
touch "$staging/$MARKER"
rm -rf "$DATA_DIR"
mkdir -p "$(dirname "$DATA_DIR")"
mv "$staging" "$DATA_DIR"
trap - EXIT

mkdir -p "$(dirname "$MANIFEST_PATH")"
host_manifest >"$MANIFEST_PATH.tmp.$$"
mv "$MANIFEST_PATH.tmp.$$" "$MANIFEST_PATH"

if ((FLAG)); then
  write_in_place "$FLAGS_FILE" "$flags_new"
fi

echo "Installed."
if flags_loads_extension "$FLAGS_FILE"; then
  echo "Restart Chromium once so it reads the new flag. Later theme changes need no restart."
else
  cat <<EOF
Load the extension once in each Chromium profile that opens Notion or Slack
(Slack's web app uses "Profile 1" on Omarchy):
  1. Open chrome://extensions and turn on Developer mode.
  2. Choose "Load unpacked" and select $EXTENSION_DIR
Or rerun with --load-extension-flag and restart Chromium once.
EOF
fi
echo "Set Notion and Slack to follow the system appearance so their light or dark mode matches the Omarchy theme."
