# Design

## Context

Observed on the target machine (Omarchy, Chromium 153):

- `omarchy theme set` stages a theme, then runs `rm -rf current/theme`,
  `mv next-theme current/theme` and rewrites `current/theme.name` under
  `~/.local/state/omarchy`. `colors.toml` holds flat `key = "#rrggbb"` pairs and
  usually `mode = "light"|"dark"`.
- `omarchy-theme-set-gnome` sets `org.gnome.desktop.interface color-scheme`, and
  the managed policy sets `BrowserColorScheme: device`, so Chromium's
  `prefers-color-scheme` follows the desktop mode. Notion's logged-out shell
  switched between `notion-dark-theme` and light from `prefers-color-scheme`
  alone. Whether the logged-in apps do depends on each app's appearance setting.
- Omarchy loads its own extensions through one `--load-extension=` line in
  `~/.config/chromium-flags.conf`, and its migrations append to that line.
  Chromium honours only the last `--load-extension` switch.
- `omarchy-launch-webapp` starts the same Chromium binary with `--app=URL`
  (Slack with `--profile-directory=Profile 1`), so app windows share flags and
  native messaging hosts with normal windows.
- Notion exposes about 740 colour tokens (`--c-*`, `--ca-*`, `--cd-*`) on
  `:root, .notion-light-theme` and `.notion-dark-theme` (version
  23.13.20261005). Slack's shared kit exposes `--dt_color-content-*`,
  `--dt_color-base-*`, `--dt_color-surf-*` and `--dt_color-otl-*` on
  `:root, .sk-client-theme--light`. Slack's logged-in client tokens
  (`--sk_*` triplets, `--dt_color-theme-*`) could not be observed without a
  session and come from omarchy-webapp-theme's reference mappings.

Prior art: omarchy-theme-sync (MIT, Bjarne Oeverli) for the push protocol, the
parent-directory watch and reconnect loop; omarchy-webapp-theme (MIT, Scott
Jones) for which Notion and Slack tokens are worth mapping. Code is written
fresh; both are credited in the README.

## Goals / Non-Goals

**Goals:**
- Two origins, two permissions, two adapters, one read-only helper.
- Adding another web app later needs only a new adapter directory, a
  `content_scripts` entry and tests. The helper, service worker and palette
  script stay unchanged and app-agnostic.
- Each adapter is one CSS file of token assignments plus a few lines of mode
  detection, so an app change usually means editing one file.

**Non-Goals:**
- Faking `prefers-color-scheme`, clicking app preferences or styling layout
  classes.
- Theming public `notion.site` pages, `www.notion.so` marketing pages or Slack
  sign-in pages.
- Packaging, Web Store publication or other Chromium-family browsers.

## Decisions

### Helper: Python standard library, polling on the stdin `select` tick

`host/omarchy-webapp-theme-host` runs on `/usr/bin/python3` with no imports outside
the standard library. Its main loop waits on stdin with a 0.5 s timeout, so one
thread handles `get` requests, EOF exit and the watch. Each tick computes a
signature from `theme.name` and `colors.toml` (inode, size, mtime). A change is
sent only after the signature is stable for two ticks, which absorbs Omarchy's
remove-then-move swap. Absence is reported only after 2 s.

Alternatives: `inotifywait` (no package on this system requires inotify-tools,
so it may be removed) and ctypes inotify (more code for a negligible gain).
Polling a few `stat` calls twice a second is cheap and survives directory
replacement by construction.

Parsing follows `omarchy-theme-color`: lines it cannot read are skipped,
quoted and unquoted values and legacy `bg`, `fg` and `colorN` names are
accepted, and mode is resolved with the same precedence and threshold
(`mode`, `theme_type`, `light.mode`, R+G+B > 382) so the palette mode always
agrees with the desktop colour scheme that drives the apps. It reads at most
64 KiB of a regular file, whitelists the Omarchy colour keys and requires
`#rgb` or `#rrggbb`. The theme name must match
`[a-z0-9][a-z0-9-]{0,63}`. `OMARCHY_PALETTE_STATE_DIR` overrides the state
directory for tests only.

### Transport: service worker to `chrome.storage.local`

The service worker owns `chrome.runtime.connectNative`. Messages are written to
storage as `palette` (last good) and `hostStatus`. Content scripts read storage
on load and listen to `storage.onChanged`. This needs no `tabs` permission and
gives cold starts an immediate palette.

An open native port keeps the worker alive. When the helper dies the worker
retries with 1 s to 30 s backoff. If Chromium stops the idle worker during
backoff, content scripts send `ensure` on load, `visibilitychange` and `focus`,
which wakes the worker and reconnects. This avoids the `alarms` permission.

### Palette properties

`content/palette.js` writes one `<style id="omarchy-webapp-theme-palette">` under
`documentElement` with `--omarchy-<key>` for each colour, `--omarchy-<key>-rgb`
triplets for the core colours, a neutral ramp `--omarchy-mix-<n>`
(background towards foreground), `--omarchy-accent-text` (accent adjusted to
4.5:1 on the background) and `--omarchy-<hue>-text` for red, green, yellow,
blue, magenta, cyan and orange (4.5:1 on the surfaces and on an 18% tint of
the hue). These are generic palette helpers, not app styling.
It also sets `data-omarchy-mode` on `<html>`.

### Adapters

Adapters live in `extension/adapters/<id>/` and the options page derives its
list from the manifest's `content_scripts`, so adding one does not touch the
transport. Each adapter registers `{ id, appMode() }` and ships `adapter.css` whose rules
are scoped to `html[data-omarchy-adapters~="<id>"]`. The core adds the id when
the adapter is enabled, a palette exists and `appMode()` equals the palette
mode. It removes the id otherwise. A `MutationObserver` on the `class`
attribute of `<html>` and `<body>` re-runs the check, and a two-second re-check
while the page is visible catches theme classes set deeper in the tree without
a subtree observer. Overrides apply to `<html>`, `<body>` and nested theme
containers whose mode matches the palette (guarded by `data-omarchy-mode`), so
deliberately opposite-mode elements such as tooltips keep the app's colours.

- Content scripts tear themselves down (observers, interval, style element and
  attributes) once the extension context is invalidated, because Chromium does
  not re-inject them into open tabs after a reload.
- Notion: `appMode()` reads `notion-dark-theme` on `<body>`. CSS assigns
  surfaces, text, icons, borders, popovers, sidebar selection, neutral `gra`
  family, UI blue and code block backgrounds with `!important`. Chromatic block
  families are untouched. The frosted "wax paper" and glass washes (Ctrl+K
  search, floating headers) and the translucent grey ramp are mapped too;
  scrims are not.
- Slack: `appMode()` reads the first `sk-client-theme--dark|light` class in
  the document. Without one the mode is unknown and the adapter stays off,
  rather than guessing from colours. CSS assigns
  `--dt_color-content-pry|sec|ter`, `-base-pry|sec|ter`, `-otl-*` neutrals,
  `-hgl-1` link accent, and the `--sk_*` foreground and background triplets.
  `hgl-2`, `hgl-3`, `imp`, `education` and presence tokens are untouched
  while modes match. Live inspection of the signed-in client showed that
  navigation uses the `--dt_color-theme-*-inv-*` variants and a translucent
  sidebar over `.p-theme_background`, which Slack paints from its raw grey
  palette (`--dt_color-plt-gray-10`). That theme hook gets the palette
  background directly rather than remapping Slack's shared grey palette.
  Slack's inverse pair (`--dt_color-base-inv-*`, `--dt_color-content-inv-*`,
  `--sk_inverted_*`) is shared by tooltips and by badges, unread dots, menu
  highlights and danger items on saturated fills, so it stays Slack's
  globally; only `.c-tooltip__tip` (tooltips and the who-reacted popover)
  and `.c-reaction--reacted` (your own reactions) override it locally. These
  three component hooks are the only class selectors in the adapters.

### Mode policy per adapter, never mode forcing

The chain gsettings, then Chromium, then `prefers-color-scheme`, then the app
does the light and dark switching where the app can follow the system. Notion
can, so its adapter (default `match` policy) applies only when modes agree; a
mismatch is reported instead of a light palette over dark authored block
colours. Slack in the browser offers only Light and Dark (its "follow system"
option exists only in the desktop app, confirmed live), so its adapter
registers `modePolicy: 'any'`. When modes differ the core adds
`data-omarchy-remap~="slack"` and the Slack CSS moves its meaning colours onto
the palette's readable hues and sets `color-scheme` to the palette's mode.
Clicking Slack's own Light/Dark control was rejected as brittle.

### Fixed extension ID

The manifest carries a public `key`, giving a stable ID for the helper's
`allowed_origins`. The private key is discarded.

### Installer

`install.sh` copies `extension/` and the helper into
`~/.local/share/omarchy-webapp-theme/`, writes
`~/.config/chromium/NativeMessagingHosts/xyz.rfrost.omarchy_webapp_theme.json`
and, only with `--load-extension-flag`, merges the path into the flags file
through `scripts/flags.py`. It finds the switch by shell-style tokens as
Chromium's launcher does, refuses when the last switch is indented or shares a
line, rewrites only that line on the exact bytes through the resolved path, and
records in `flags-state.json` whether it appended to a list (and whether the
list was empty) or added the line, so the uninstaller can restore the original
byte for byte. The
dry run prints file paths and only the changed flags line. `uninstall.sh`
reverses each step and is idempotent. Without the flag the README explains
"Load unpacked" for each profile that opens Notion or Slack.

### Tests

- `tests/host/`: Python `unittest` drives the helper as a subprocess over its
  framed stdio with a temporary state directory.
- `tests/extension/`: `node --test` for palette maths and manifest audit.
- `tests/install/`: shell-driven tests against a temporary `HOME` with a
  synthetic flags file.
- `tests/e2e/`: a throwaway headless Chromium with a temporary
  `--user-data-dir`, the extension loaded, the helper registered in that
  directory and `OMARCHY_PALETTE_STATE_DIR` pointing at fixture themes. CDP
  `Fetch` serves synthetic Notion and Slack pages on the real origins. It covers
  initial load, live change, directory replacement, helper kill, worker stop,
  missing and malformed palettes, adapter toggles, mode gating, preserved
  colours and a contrast matrix over all stock Omarchy themes found under
  `/usr/share/omarchy/themes` (read only).

## Risks / Trade-offs

- [Notion or Slack rename tokens] → Adapters only assign variables, so a rename
  degrades to the app's own colours. Token lists are documented per adapter.
- [Slack client tokens unverified without a session] → Marked as unverified in
  README limitations until checked live.
- [Apps pinned to Light or Dark] → Mode gating leaves them untouched and reports
  the mismatch.
- [Omarchy rewrites the flags file] → The flag merge is optional, mirrors
  Omarchy's own append pattern and is restored by rerunning the installer.
- [Polling latency] → Up to about 1 s after Omarchy finishes its swap, which is
  within the theme switch's own duration.

## Migration Plan

Install with `./install.sh --dry-run`, then `./install.sh` with or without
`--load-extension-flag`, and restart Chromium once. Roll back with
`./uninstall.sh` and a Chromium restart.
