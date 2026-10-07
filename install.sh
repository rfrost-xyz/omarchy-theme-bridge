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

require_absolute_dirs
if ((FLAG)) && ! path_is_safe "$EXTENSION_DIR"; then
  echo "Flags: $EXTENSION_DIR contains spaces, commas, quotes or other characters the flags file cannot hold; load the extension unpacked instead." >&2
  FLAG=0
fi

file_count=$(find "$SOURCE/extension" -type f | wc -l)
echo "Files:"
echo "  $DATA_DIR/extension/ ($file_count files, copied from extension/)"
echo "  $HOST_PATH"
echo "  $DATA_DIR/$MARKER (marks the directory as this installer's)"
echo "  $MANIFEST_PATH (allows only chrome-extension://$EXTENSION_ID/)"

if ((FLAG)); then
  if [[ ! -f $FLAGS_FILE ]]; then
    echo "Flags: $FLAGS_FILE does not exist, so it is not created. Load the extension unpacked instead."
    FLAG=0
  elif ! plan=$(flags_edit add); then
    FLAG=0
  elif [[ $plan == unchanged ]]; then
    echo "Flags: $FLAGS_FILE already loads $EXTENSION_DIR"
    FLAG=0
  else
    echo "Flags: $FLAGS_FILE (only the --load-extension line changes):"
    echo "$plan"
    echo "  $FLAGS_STATE (records the change so uninstall can restore the line exactly)"
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
[[ -f $FLAGS_STATE ]] && cp "$FLAGS_STATE" "$staging/"
rm -rf "$DATA_DIR"
mkdir -p "$(dirname "$DATA_DIR")"
mv "$staging" "$DATA_DIR"
trap - EXIT

mkdir -p "$(dirname "$MANIFEST_PATH")"
host_manifest >"$MANIFEST_PATH.tmp.$$"
mv "$MANIFEST_PATH.tmp.$$" "$MANIFEST_PATH"

if ((FLAG)); then
  flags_edit add --write >/dev/null
fi

echo "Installed."
if ((FLAG)); then
  echo "Restart Chromium once so it reads the new flag. Later theme changes need no restart."
elif [[ -f $FLAGS_FILE ]] && flags_edit mentions 2>/dev/null; then
  echo "Chromium already loads it: reload Omarchy Webapp Theme in chrome://extensions (or restart Chromium) to pick up updated files."
else
  cat <<EOF
Load the extension once in each Chromium profile that opens Notion, Slack or Google Meet.
Your launchers' --profile-directory flags (~/.local/share/applications/*.desktop)
show which profiles they use:
  1. Open chrome://extensions and turn on Developer mode.
  2. Choose "Load unpacked" and select $EXTENSION_DIR
Or rerun with --load-extension-flag and restart Chromium once.
EOF
fi
echo "Set Notion to use the system appearance so it switches between light and dark with the Omarchy theme. Slack and Google Meet are themed in either of their modes."
