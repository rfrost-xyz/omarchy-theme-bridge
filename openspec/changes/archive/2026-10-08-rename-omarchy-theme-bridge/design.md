# Design

## Context

See proposal.md. Legacy identifiers: directory `~/.local/share/omarchy-webapp-theme/`, marker `.installed-by-omarchy-webapp-theme`, host `xyz.rfrost.omarchy_webapp_theme` with manifest under `~/.config/chromium/NativeMessagingHosts/`, helper `omarchy-webapp-theme-host`, optional `flags-state.json` and `grok-state.json` in the directory, and an optional `--load-extension` entry for `~/.local/share/omarchy-webapp-theme/extension`.

## Goals / Non-Goals

One consistent name everywhere users and code see it, with a safe one-step migration. Not changing the extension ID, palette CSS custom properties (`--omarchy-*`), data attributes (`data-omarchy-*`), storage keys or Grok configuration.

## Decisions

- **Keep the manifest key.** The extension ID stays `pinjcoeajnkogbmcjjgkgjafpiiebheg`, so `chrome.storage` (adapter switches, cached palette) survives and the new host manifest still allows the same origin.
- **Legacy constants in `scripts/common.sh`.** `LEGACY_DATA_DIR`, `LEGACY_MARKER`, `LEGACY_MANIFEST_PATH`, `LEGACY_HOST_PATH`, `LEGACY_EXTENSION_DIR` and `LEGACY_FLAGS_STATE`, so install and uninstall share one migration function.
- **Migration order (installer, after planning, before writing the new directory):** only when the legacy directory carries the legacy marker. Remove the legacy flags entry using `scripts/flags.py remove` with the legacy extension path and legacy state, and remember that an entry existed so the new path is added as if `--load-extension-flag` were given. Move `grok-state.json` into the staging directory. Remove the legacy manifest only when its `path` points at the legacy helper. Remove the legacy directory last. If the legacy flags entry cannot be removed safely, stop before changing anything and explain, as the uninstaller does today.
- **Dry run** lists every legacy item it would remove or move.
- **Uninstaller** removes the new install and any marked legacy install with the same rules.
- **Unmarked legacy directory** is left alone and reported.
- **Repository.** Rename `rfrost-xyz/omarchy-webapp-theme` to `rfrost-xyz/omarchy-theme-bridge` (GitHub redirects the old URLs) and update the local remote. Archived changes under `openspec/changes/archive/` are history and keep the old name.

## Risks / Trade-offs

- Chromium profiles that loaded the extension unpacked point at the removed legacy path and show it as missing. The installer prints that the extension must be loaded again from the new path. Profiles using the flags line pick up the new path after a Chromium restart.
- Open pages keep the old content scripts until reloaded, as with any extension update.

## Migration Plan

Run `./install.sh` (with the same switches as before) from the renamed checkout, restart Chromium, and reload the unpacked extension from `~/.local/share/omarchy-theme-bridge/extension` if it was loaded that way.
