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
if [[ -f $DATA_DIR/$MARKER ]]; then
  echo "Remove: $DATA_DIR/"
  ((DRY_RUN)) || rm -rf "$DATA_DIR"
  changed=1
elif [[ -e $DATA_DIR ]]; then
  echo "Skip: $DATA_DIR was not created by the installer."
fi

if [[ -f $MANIFEST_PATH ]] && grep -qF "\"path\": \"$HOST_PATH\"" "$MANIFEST_PATH"; then
  echo "Remove: $MANIFEST_PATH"
  ((DRY_RUN)) || rm -f "$MANIFEST_PATH"
  changed=1
elif [[ -e $MANIFEST_PATH ]]; then
  echo "Skip: $MANIFEST_PATH does not point at this installation."
fi

if [[ -f $FLAGS_FILE ]]; then
  flags_new=$(flags_without_extension "$FLAGS_FILE")
  if [[ $flags_new != "$(cat "$FLAGS_FILE")" ]]; then
    echo "Change: $FLAGS_FILE (only the --load-extension line):"
    show_line_change "$FLAGS_FILE" "$flags_new"
    ((DRY_RUN)) || write_in_place "$FLAGS_FILE" "$flags_new"
    changed=1
  fi
fi

if ((DRY_RUN)); then
  echo "Dry run: nothing was changed."
elif ((changed)); then
  echo "Uninstalled. Restart Chromium to unload the extension, or remove it from chrome://extensions if it was loaded unpacked."
else
  echo "Nothing to remove."
fi
