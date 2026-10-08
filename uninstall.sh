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

require_absolute_dirs

changed=0
# Flags first: the record of how the line was changed lives in $DATA_DIR.
if [[ -f $FLAGS_FILE ]]; then
  status=0
  plan=$(flags_edit remove) || status=$?
  if ((status == 3)); then
    echo "Remove this extension's --load-extension entry by hand, then rerun ./uninstall.sh. Installed files were kept." >&2
    exit 1
  elif ((status == 4)); then
    echo "Remove that entry by hand, then rerun ./uninstall.sh. Installed files were kept so Chromium does not fail to load them." >&2
    exit 1
  elif ((status != 0)); then
    echo "Could not read $FLAGS_FILE; nothing was removed." >&2
    exit 1
  fi
  if [[ $plan != unchanged ]]; then
    echo "Change: $FLAGS_FILE (only the --load-extension line):"
    echo "$plan"
    ((DRY_RUN)) || flags_edit remove --write >/dev/null
    changed=1
  fi
fi

# Grok before $DATA_DIR is removed, for the same reason.
if [[ -f $DATA_DIR/$MARKER && -f $GROK_STATE ]]; then
  status=0
  plan=$(grok_edit remove) || status=$?
  if ((status == 3)); then
    echo "Restore the theme and terminal_theme lines in $GROK_CONFIG by hand, then rerun ./uninstall.sh. Installed files were kept." >&2
    exit 1
  elif ((status != 0)); then
    echo "Could not update $GROK_CONFIG; nothing more was removed." >&2
    exit 1
  fi
  if [[ $plan != unchanged ]]; then
    echo "Change: $GROK_CONFIG (only the theme and terminal_theme lines):"
    echo "$plan"
    ((DRY_RUN)) || grok_edit remove --write >/dev/null
    changed=1
  fi
fi

if [[ -f $DATA_DIR/$MARKER ]]; then
  echo "Remove: $DATA_DIR/"
  ((DRY_RUN)) || rm -rf "$DATA_DIR"
  changed=1
elif [[ -e $DATA_DIR ]]; then
  echo "Skip: $DATA_DIR was not created by the installer."
fi

if [[ -f $MANIFEST_PATH ]] && /usr/bin/python3 -c 'import json, os, sys; sys.exit(0 if os.path.normpath(json.load(open(sys.argv[1])).get("path", "")) == os.path.normpath(sys.argv[2]) else 1)' "$MANIFEST_PATH" "$HOST_PATH" 2>/dev/null; then
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
