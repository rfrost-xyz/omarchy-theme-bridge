#!/bin/bash
# Per-user installer for omarchy-theme-bridge (Chromium, and Grok on opt-in).
# Usage: ./install.sh [--dry-run] [--load-extension-flag] [--grok]
set -euo pipefail

SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SOURCE/scripts/common.sh"

DRY_RUN=0
FLAG=0
GROK=0
for arg in "$@"; do
  case $arg in
  --dry-run) DRY_RUN=1 ;;
  --load-extension-flag) FLAG=1 ;;
  --grok) GROK=1 ;;
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

# A marked install under the former name is migrated; its flags entry is
# replaced by ours, so the entry counts as a request for --load-extension-flag.
legacy_detect
LEGACY_FLAG_ENTRY=0
if ((LEGACY_FOUND)); then
  legacy_flags_plan || exit 1
  if [[ $LEGACY_FLAGS_PLAN != unchanged ]]; then
    LEGACY_FLAG_ENTRY=1
    FLAG=1
  fi
fi

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

FLAG_PRESENT=0
if ((FLAG)); then
  # With a legacy entry, plan our addition against the file as it will look
  # once that entry is gone, using a scratch copy.
  flags_view=$FLAGS_FILE
  if ((LEGACY_FLAG_ENTRY)); then
    scratch=$(mktemp "${TMPDIR:-/tmp}/omarchy-theme-bridge-flags.XXXXXX")
    flags_view=$scratch
    trap 'rm -f "$scratch"' EXIT
    cp "$FLAGS_FILE" "$flags_view"
    flags_edit_at remove "$flags_view" "$LEGACY_EXTENSION_DIR" "$LEGACY_FLAGS_STATE" --write >/dev/null
  fi
  if [[ ! -f $FLAGS_FILE ]]; then
    echo "Flags: $FLAGS_FILE does not exist, so it is not created. Load the extension unpacked instead."
    FLAG=0
  elif ! plan=$(flags_edit_at add "$flags_view" "$EXTENSION_DIR" "$FLAGS_STATE"); then
    FLAG=0
  elif [[ $plan == unchanged ]]; then
    echo "Flags: $FLAGS_FILE already loads $EXTENSION_DIR"
    FLAG=0
    FLAG_PRESENT=1
  else
    echo "Flags: $FLAGS_FILE (only the --load-extension line changes):"
    if ((LEGACY_FLAG_ENTRY)); then
      # Net change: the line as it is now, and as it will be.
      grep '^  - ' <<<"$LEGACY_FLAGS_PLAN" || true
      grep '^  + ' <<<"$plan" || true
    else
      echo "$plan"
    fi
    echo "  $FLAGS_STATE (records the change so uninstall can restore the line exactly)"
  fi
elif ((! LEGACY_FLAG_ENTRY)); then
  echo "Flags: $FLAGS_FILE is not changed."
fi
if [[ -n ${scratch:-} ]]; then
  rm -f "$scratch"
  trap - EXIT
fi
if ((LEGACY_FLAG_ENTRY && !FLAG && FLAG_PRESENT)); then
  echo "Flags: $FLAGS_FILE (only the legacy --load-extension entry is removed):"
  echo "$LEGACY_FLAGS_PLAN"
elif ((LEGACY_FLAG_ENTRY && !FLAG)); then
  echo "Flags: $FLAGS_FILE (only the legacy --load-extension entry is removed; load the extension unpacked from $EXTENSION_DIR):"
  echo "$LEGACY_FLAGS_PLAN"
fi

GROK_REQUESTED=$GROK
if ((GROK)); then
  status=0
  plan=$(grok_edit add) || status=$?
  if ((status != 0)); then
    echo "Grok: $GROK_CONFIG is not changed; the rest of the install continues without it."
    GROK=0
    GROK_REQUESTED=0
  elif [[ $plan == unchanged ]]; then
    echo "Grok: $GROK_CONFIG already uses the terminal theme."
    GROK=0
  else
    if [[ -f $GROK_CONFIG ]]; then
      echo "Grok: $GROK_CONFIG (only the theme and terminal_theme lines change):"
    else
      echo "Grok: $GROK_CONFIG does not exist and is created with only these lines:"
    fi
    echo "$plan"
    echo "  $GROK_STATE (records the change so uninstall can restore the file exactly)"
  fi
else
  echo "Grok: $GROK_CONFIG is not changed."
fi

if ((LEGACY_FOUND)); then
  echo "Legacy: migrating the install made under the former name $LEGACY_NAME:"
  if [[ -f $LEGACY_GROK_STATE ]]; then
    if [[ -f $GROK_STATE ]]; then
      echo "  Skip: $LEGACY_GROK_STATE (the existing $GROK_STATE is kept)"
    else
      echo "  Move: $LEGACY_GROK_STATE to $GROK_STATE (so uninstall can still revert Grok's configuration)"
    fi
  fi
  legacy_files list | sed 's/^/  /'
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
if [[ -f $GROK_STATE ]]; then
  cp "$GROK_STATE" "$staging/"
elif ((LEGACY_FOUND)) && [[ -f $LEGACY_GROK_STATE ]]; then
  cp "$LEGACY_GROK_STATE" "$staging/"
fi
rm -rf "$DATA_DIR"
mkdir -p "$(dirname "$DATA_DIR")"
mv "$staging" "$DATA_DIR"
trap - EXIT

mkdir -p "$(dirname "$MANIFEST_PATH")"
host_manifest >"$MANIFEST_PATH.tmp.$$"
mv "$MANIFEST_PATH.tmp.$$" "$MANIFEST_PATH"

if ((LEGACY_FLAG_ENTRY)); then
  flags_edit_at remove "$FLAGS_FILE" "$LEGACY_EXTENSION_DIR" "$LEGACY_FLAGS_STATE" --write >/dev/null
fi
if ((FLAG)); then
  flags_edit add --write >/dev/null
fi
# The legacy directory goes last: it held the records the steps above used.
if ((LEGACY_FOUND)); then
  legacy_files apply
fi

if ((GROK)); then
  grok_edit add --write >/dev/null || {
    echo "Grok: $GROK_CONFIG is not changed; the rest of the install is complete without it."
    GROK_REQUESTED=0
  }
fi

echo "Installed."
if ((FLAG)); then
  echo "Restart Chromium once so it reads the new flag. Later theme changes need no restart."
elif [[ -f $FLAGS_FILE ]] && flags_edit mentions 2>/dev/null; then
  echo "Chromium already loads it: reload Omarchy Theme Bridge in chrome://extensions (or restart Chromium) to pick up updated files."
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
if ((GROK_REQUESTED)); then
  echo "Grok: restart open Grok sessions. Its colours now follow the terminal palette, so they change with the Omarchy theme. Setting GROK_THEME overrides the configuration."
fi
if ((LEGACY_FOUND)); then
  echo "Migrated from $LEGACY_NAME: its files and native host were removed. If you loaded the extension unpacked, remove the old entry in chrome://extensions and load it again from $EXTENSION_DIR."
fi
echo "Set Notion to use the system appearance so it switches between light and dark with the Omarchy theme. Slack and Google Meet are themed in either of their modes."
