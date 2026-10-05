# Tasks

## 1. Read-only palette helper

- [x] 1.1 Implement `host/omarchy-webapp-theme-host` (framing, whitelist parsing, mode resolution, `get` handling, EOF exit); verify with `python3 -m unittest discover tests/host` covering valid, mode fallback, unknown keys, symlinked non-palette file and ignored requests
- [x] 1.2 Add the stable-signature watch with the missing grace period; verify with helper tests for live change, Omarchy-style directory replacement (one palette, no missing status), missing then restored, malformed then fixed, and exit on stdin close

## 2. Extension transport

- [x] 2.1 Add `extension/manifest.json` with fixed `key`, `nativeMessaging` and `storage` only, and the two origin matches; verify with a `node --test` manifest audit that also derives the extension ID from the key
- [x] 2.2 Implement the service worker (native port, storage of palette and status, backoff, `ensure` handling) and `content/palette.js` (palette properties, derived helpers, `ensure` on load, visibility and focus); verify palette maths with `node --test tests/extension`
- [x] 2.3 Build the headless Chromium harness in `tests/e2e/` (temporary profile, helper registration, CDP Fetch fixtures, fixture state directory); verify initial load, live change, directory replacement, helper kill and worker stop recovery, missing and malformed palettes

## 3. Adapter core and Notion adapter

- [x] 3.1 Implement the adapter registry, mode gating and options page toggles with status; verify in e2e that toggling an adapter adds and removes it live and that a mode mismatch leaves it inactive and is reported
- [x] 3.2 Implement `adapters/notion/` (mode detection and token CSS); verify in e2e against a synthetic Notion fixture using Notion's token names: mapped surfaces, text, menus, dialogs, sidebar and code blocks follow the palette, and authored red block colours stay unchanged

## 4. Slack adapter

- [x] 4.1 Implement `adapters/slack/` (mode detection and token CSS); verify in e2e against a synthetic Slack fixture: mapped content, base, outline and link tokens follow the palette, triplet tokens stay valid in `rgba()`, and important, success, warning and presence colours stay unchanged

## 5. Contrast and colour scheme checks

- [x] 5.1 Add an e2e contrast matrix over every stock Omarchy theme for both adapters; verify all thresholds in the `app-adapters` spec pass
- [x] 5.2 Check in a throwaway headful Chromium profile that `prefers-color-scheme` reflects the current desktop colour scheme, and record the result and the live-switch limitation in the README

## 6. Installation

- [x] 6.1 Implement `install.sh` (dry run, copy, manifest, opt-in flags merge) and `uninstall.sh`; verify with `tests/install/` against a temporary `HOME`: dry run writes nothing, default install leaves the flags file byte-identical, repeated flag merges add one entry, symlink and mode are kept, uninstall restores the original and is idempotent
- [x] 6.2 Write the README (setup, removal, permissions explained, exact files changed, adding an adapter, known limitations, credits) and `scripts/check`; verify `./scripts/check` passes end to end

## 7. Live verification (requires user approval)

- [x] 7.1 With approval, install into the live Chromium and check Notion and Slack app-mode windows under light and dark Omarchy themes with live switching, sidebars, navigation, menus and dialogs, fixing what the live apps reveal; record results, what was not inspected live, and read only computed styles or transient captures
