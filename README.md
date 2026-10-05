# omarchy-webapp-theme

Keeps the Notion and Slack web apps in Chromium in step with the active Omarchy
theme, including `omarchy-launch-webapp` app windows. When you run
`omarchy theme set`, open pages recolour within about a second, with no reload
and no Chromium restart.

It has three parts:

- **Helper** (`host/omarchy-webapp-theme-host`): a read-only Python script that
  Chromium starts through native messaging. It reads
  `~/.local/state/omarchy/current/theme/colors.toml` and `theme.name`, checks
  every value is a hex colour, and sends the palette on connect and after each
  theme change. It never writes files or runs commands, and ignores every
  request except `get`.
- **Transport** (`extension/background.js`, `extension/content/`): the
  extension keeps the helper connected, stores the last good palette and
  exposes it to Notion and Slack pages as `--omarchy-*` CSS custom properties.
- **Adapters** (`extension/adapters/notion/`, `extension/adapters/slack/`): one
  CSS file per app that maps those properties onto the app's own colour tokens.
  Each can be turned off on the extension's options page.

## Setup

1. Preview every change. Nothing is written:

   ```bash
   ./install.sh --dry-run
   ```

2. Install. Choose one way to load the extension:

   - `./install.sh` leaves Omarchy's Chromium flags alone. Then, in each Chromium
     profile that opens Notion or Slack, open `chrome://extensions`, turn on
     Developer mode, choose **Load unpacked** and select
     `~/.local/share/omarchy-webapp-theme/extension`. Web app launchers can
     name a profile with `--profile-directory` (see
     `~/.local/share/applications/*.desktop`); load it in each profile they use.
   - `./install.sh --load-extension-flag` also appends the extension to the
     existing `--load-extension=` line in `~/.config/chromium-flags.conf`, the
     same way Omarchy's own migrations add extensions. This covers every
     profile. Restart Chromium once afterwards. If that switch is indented or
     shares a line with other flags, the installer leaves the file alone and
     says so, because adding a second switch would replace Omarchy's list.

3. In Notion (Settings, Appearance), choose **Use system setting**. Omarchy
   sets the desktop colour scheme for each theme, Chromium passes it to pages,
   and Notion switches between light and dark itself. The Notion adapter only
   recolours Notion while its mode matches the Omarchy theme, because Notion's
   authored block colours are tuned per mode; if they differ, the options page
   says so.

   Slack in the browser only offers Light or Dark (following the system is a
   desktop-app feature), so the Slack adapter themes Slack in either mode. When
   Slack's mode differs from the Omarchy theme, its error, success, warning and
   tip colours switch to the theme's own red, green, yellow and blue, adjusted
   to stay readable.

### What the installer changes

| Path | Change |
| --- | --- |
| `~/.local/share/omarchy-webapp-theme/` | New: `extension/`, `bin/omarchy-webapp-theme-host`, an ownership marker and, after a flags edit, `flags-state.json` recording how the line was changed |
| `~/.config/chromium/NativeMessagingHosts/xyz.rfrost.omarchy_webapp_theme.json` | New: registers the helper for this extension's ID only |
| `~/.config/chromium-flags.conf` | Only with `--load-extension-flag`: this extension's path is appended to the last `--load-extension=` line (or one line is added). Only that line changes; line endings, the final newline, symlinks and permissions are kept. Rerunning never adds a duplicate. |

Nothing else is touched: no `sudo`, no Omarchy files, themes, hooks or browser
policies, and no other browsers. The dry run prints only the flags line that
would change, never the rest of the file.

## Removal

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

This removes the installed directory, the helper registration and this
extension's flags entry, leaving the flags file byte for byte as it was before
installing.
Restart Chromium, or remove an unpacked copy from `chrome://extensions`.
Running it again is harmless.

## Permissions

| Permission | Why |
| --- | --- |
| `nativeMessaging` | Talk to the read-only helper that reads the Omarchy palette. Only this extension's ID may start it. |
| `storage` | Keep the last good palette, helper status and adapter switches, so pages are coloured straight away after a restart. |
| Content scripts on `https://app.notion.com/*` and `https://app.slack.com/*` | Add the palette properties and adapter styles to those two apps. No other site is matched, and there are no host permissions, `tabs`, `scripting` or web-accessible resources. |

## How the adapters map colours

Adapters only assign the apps' own CSS variables; they do not restyle layout
classes. Overrides apply to the page root and to theme containers in the same
mode, so deliberately opposite-mode elements such as tooltips keep the app's
styling.

- **Notion**: surfaces (`--c-bac*`, `--c-popBac`), text and icons
  (`--c-tex*`, `--c-ico*`), borders, hover and selection washes, code block
  backgrounds, the Ctrl+K search and other frosted popovers, the translucent
  grey ramp, the neutral grey block family, link blue and the selection tint. Authored block colours (red, blue, yellow and the other chromatic
  families), the primary button blue (it sits under white labels), shadows and
  error rings are left as Notion draws them.
- **Slack**: `--dt_color-content-*`, `-base-*`, `-surf-*`, `-otl-*` and
  `-ctr-*` (menus, including the right-click menu) neutrals, the menu
  highlight, the link and mention colour (`hgl-1`), the legacy `--sk_*`
  triplets, the workspace theme tokens `--dt_color-theme-*` (navigation uses
  the `-inv-` variants) and the window backdrop `.p-theme_background`, because
  Slack paints it from its shared grey palette. Tooltips (including the
  who-reacted popover, `.c-tooltip__tip`) and your own reactions
  (`.c-reaction--reacted`) get a raised surface and an accent tint locally;
  Slack's inverse colours elsewhere (badges, unread dots, menu highlights)
  stay Slack's. These three component hooks are the only class selectors. While Slack's mode matches the theme, success and presence
  (`hgl-2`), highlights (`hgl-3`), important and error (`imp`), education and
  badge colours stay Slack's; otherwise the first four take the palette's
  hues (so anything Slack draws in its success green, possibly including
  presence, takes the palette's green). Badges always stay Slack's.

The transport also provides generic helpers every adapter can use:
`--omarchy-mix-<n>` (background blended n% towards foreground),
`--omarchy-text`, `-text-secondary`, `-text-tertiary`, `-accent-text` and
`-<hue>-text` for red, green, yellow, blue, magenta, cyan and orange (adjusted
to 4.5:1, or 3:1 for tertiary, against the main surfaces), `--omarchy-accent-ink`
and an `-rgb` triplet for each.

## Adding another web app

1. Create `extension/adapters/<id>/adapter.js` that registers
   `{ id, appMode() }`, returning `'light'`, `'dark'` or `null` from the app's
   own theme marker. Add `modePolicy: 'any'` only if the app cannot follow the
   system appearance; the page then also gets `data-omarchy-remap~="<id>"`
   while the modes differ, for CSS that moves meaning colours onto the
   palette.
2. Create `extension/adapters/<id>/adapter.css` scoped to
   `html[data-omarchy-adapters~="<id>"]`, assigning the app's colour variables.
3. Add one `content_scripts` entry for the app's origin to `manifest.json`
   with `"js": ["content/colour.js", "content/palette.js",
   "adapters/<id>/adapter.js"]`, `"css": ["adapters/<id>/adapter.css"]` and
   `"run_at": "document_start"`.
4. Add a synthetic fixture and tests under `tests/e2e/`.

The helper, service worker and options page need no changes. The options page
lists adapters from the manifest.

## Development

```bash
./scripts/check
```

This runs shell syntax checks, the helper tests (Python `unittest`), the
installer tests (temporary `HOME`), the extension unit tests and the headless
Chromium tests (`node --test`), and strict OpenSpec validation (set `SKIP_OPENSPEC=1` where OpenSpec is not
installed). The browser
tests use a throwaway profile, the real extension and helper, a temporary
Omarchy state directory and synthetic pages served on the real origins through
the DevTools protocol. They cover theme changes, directory replacement, helper
and service worker restarts, missing and malformed palettes, adapter toggles,
mode gating, preserved colours and a contrast matrix over every stock theme in
`/usr/share/omarchy/themes`. They never touch your browser profile or theme.

Requirements: system `/usr/bin/python3` and Chromium at run time; Node for the
tests.

## Known limitations

- **What was checked live** (2026-10-05, Chromium 153 app windows, signed-in
  apps): Notion followed light and dark Omarchy themes without reloading,
  including its Ctrl+K search; Slack's messages, sidebar, rail and dialogs
  followed light and dark themes. Slack's navigation tokens were confirmed by
  reading its computed styles. Automated tests use synthetic pages built from
  the apps' public stylesheets, so a future app update can still drift.
- **Light and dark switching**: Notion follows the desktop only when set to
  use the system setting; until then the Notion adapter leaves it uncoloured.
  Slack in the browser cannot follow the desktop, so it stays in its chosen
  mode with the palette applied and status colours remapped.
- **Slack's own colours**: a few things Slack draws with fixed colours (some
  icons, images and illustrations) keep their Slack look, especially when
  Slack's mode differs from the theme's.
- **App changes**: if Notion or Slack rename their colour variables, the
  affected areas fall back to the app's own colours rather than breaking.
- **Origins**: only `app.notion.com` and `app.slack.com`. Public `notion.site`
  pages and older `www.notion.so` links that do not redirect to
  `app.notion.com` are not coloured.
- **Flags file**: if an Omarchy update rewrites `~/.config/chromium-flags.conf`
  and drops the entry, rerun `./install.sh --load-extension-flag`.
- **Extension reloads**: Chromium does not re-inject content scripts into tabs
  that are already open. After reinstalling or reloading the extension, open
  Notion and Slack windows drop back to the apps' own colours until reloaded.
- **Hand-written themes**: the helper reads `colors.toml` the way
  `omarchy-theme-color` does, including legacy `bg`, `fg` and `colorN` names
  and the same light or dark rule, so it agrees with the desktop's colour
  scheme. If no accent is set it uses `blue`.
- **Latency**: the helper checks the theme twice a second and waits for it to
  settle, so pages update about a second after Omarchy finishes switching.

## Credits

The design draws on two MIT-licensed projects, without copying their code:
[omarchy-theme-sync](https://github.com/omacom/omarchy-theme-sync) by Bjarne
Oeverli (native messaging push protocol, parent-directory watching and
reconnection) and
[omarchy-webapp-theme](https://github.com/scottjones/omarchy-webapp-theme) by
Scott Jones (which Notion and Slack tokens are worth mapping, and which to
leave alone).
