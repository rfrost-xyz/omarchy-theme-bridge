#!/bin/bash
# Remove everything install.sh added for omarchy-webapp-theme.
# Usage: ./uninstall.sh [--dry-run]
set -euo pipefail

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SOURCE/scripts/common.sh"

DRY_RUN=0
for arg in "$@"; do
  case $arg in
  --dry-run) DRY_RUN=1 ;;
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

changed=0
# Flags first: the record of how the line was changed lives in $DATA_DIR.
if [[ -f $FLAGS_FILE ]]; then
  if ! plan=$(flags_edit remove); then
    echo "Could not read $FLAGS_FILE; nothing was removed." >&2
    exit 1
  fi
  if [[ $plan != unchanged ]]; then
    echo "Change: $FLAGS_FILE (only the --load-extension line):"
    echo "$plan"
    ((DRY_RUN)) || flags_edit remove --write >/dev/null
    changed=1
  fi
  if ! ((DRY_RUN)) && flags_edit mentions; then
    echo "$FLAGS_FILE still loads $EXTENSION_DIR on a line this script cannot edit safely." >&2
    echo "Remove that entry by hand, then rerun ./uninstall.sh. Installed files were kept so Chromium does not fail to load them." >&2
    exit 1
  fi
fi

if [[ -f $DATA_DIR/$MARKER ]]; then
  echo "Remove: $DATA_DIR/"
  ((DRY_RUN)) || rm -rf "$DATA_DIR"
  changed=1
elif [[ -e $DATA_DIR ]]; then
  echo "Skip: $DATA_DIR was not created by the installer."
fi

if [[ -f $MANIFEST_PATH ]] && /usr/bin/python3 -c 'import json, sys; sys.exit(0 if json.load(open(sys.argv[1])).get("path") == sys.argv[2] else 1)' "$MANIFEST_PATH" "$HOST_PATH" 2>/dev/null; then
  echo "Remove: $MANIFEST_PATH"
  ((DRY_RUN)) || rm -f "$MANIFEST_PATH"
  changed=1
elif [[ -e $MANIFEST_PATH ]]; then
  echo "Skip: $MANIFEST_PATH does not point at this installation."
fi

if ((DRY_RUN)); then
  echo "Dry run: nothing was changed."
elif ((changed)); then
  echo "Uninstalled. Restart Chromium to unload the extension, or remove it from chrome://extensions if it was loaded unpacked."
else
  echo "Nothing to remove."
fi
