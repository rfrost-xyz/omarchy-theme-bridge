# Proposal

## Why

Notion and Slack run as Chromium web apps on Omarchy, but keep their own colours
when the Omarchy theme changes. Existing projects either grant all-site access
and theme control (omarchy-theme-sync) or ship many app packs, brittle selectors
and UI automation (omarchy-webapp-theme). A small, read-only tool with one
adapter per app is easier to trust and maintain, and leaves room to add other
web apps one adapter at a time.

## What Changes

- Add a read-only native messaging helper that reads the active Omarchy palette,
  validates it, pushes it to the browser on connect and on every theme change,
  and reports missing or malformed palette files.
- Add a Manifest V3 extension limited to `app.notion.com` and `app.slack.com`.
  Its service worker keeps the helper connection, caches the last good palette
  and fans it out through extension storage. A generic content script exposes
  the palette as CSS custom properties.
- Add independent Notion and Slack adapters that map those properties onto each
  app's own semantic colour tokens, only while the app's own light or dark mode
  matches the palette, preserving authored and status colours.
- Add a per-user, Chromium-only installer and uninstaller with a dry run that
  shows every file and configuration change. Editing the Omarchy-managed
  Chromium flags file is opt-in.
- Add unit, installer and headless Chromium tests, plus setup, removal and
  limitation notes.

## Capabilities

### New Capabilities
- `palette-helper`: reading, validating, watching and transmitting the active Omarchy palette through a read-only native messaging helper.
- `app-adapters`: delivering the palette to Notion and Slack pages and mapping it onto each app's colour tokens, with per-app enablement and mode gating.
- `installation`: per-user Chromium installation, registration and removal without disturbing Omarchy or existing browser configuration.

### Modified Capabilities

None.

## Impact

- New repository content only: `host/`, `extension/`, `install.sh`,
  `uninstall.sh`, `tests/`, `scripts/check`, README.
- Runtime needs system `/usr/bin/python3` and Chromium. No packages are
  installed. Tests need Node (built-in test runner) and Chromium.
- On install: files under `~/.local/share/omarchy-webapp-theme/`, one
  manifest in `~/.config/chromium/NativeMessagingHosts/`, and optionally one
  path appended to `--load-extension=` in `~/.config/chromium-flags.conf`.
