# omarchy-theme-bridge

Keeps the Notion, Slack, Google Meet and Squint Opera GitLab web apps in Chromium
in step with the active Omarchy theme, including `omarchy-launch-webapp` app windows. When you run
`omarchy theme set`, open pages recolour within about a second, with no reload
and no Chromium restart. It can also switch Grok Build to its terminal theme,
so Grok follows your terminal's palette (see [Grok Build](#grok-build)).

This project was formerly named `omarchy-webapp-theme`, the same name as Scott
Jones's project credited below; it is a separate project.

It has three parts:

- **Helper** (`host/omarchy-theme-bridge-host`): a read-only Python script that
  Chromium starts through native messaging. It reads
  `~/.local/state/omarchy/current/theme/colors.toml` and `theme.name`, checks
  every value is a hex colour, and sends the palette on connect and after each
  theme change. It never writes files or runs commands, and ignores every
  request except `get`.
- **Transport** (`extension/background.js`, `extension/content/`): the
  extension keeps the helper connected, stores the last good palette and
  exposes it to Notion, Slack, Meet and GitLab pages as `--omarchy-*` CSS custom
  properties.
- **Adapters** (`extension/adapters/notion/`, `extension/adapters/slack/`,
  `extension/adapters/meet/`, `extension/adapters/gitlab/`): one
  CSS file per app that maps those properties onto the app's own colour tokens.
  Each can be turned off on the extension's options page.

## Setup

1. Preview every change. Nothing is written:

   ```bash
   ./install.sh --dry-run
   ```

2. Install. Choose one way to load the extension:

   - `./install.sh` leaves Omarchy's Chromium flags alone. Then, in each Chromium
     profile that opens Notion, Slack, Meet or GitLab, open `chrome://extensions`, turn on
     Developer mode, choose **Load unpacked** and select
     `~/.local/share/omarchy-theme-bridge/extension`. Web app launchers can
     name a profile with `--profile-directory` (see
     `~/.local/share/applications/*.desktop`); load it in each profile they use.
   - `./install.sh --load-extension-flag` also appends the extension to the
     existing `--load-extension=` line in `~/.config/chromium-flags.conf`, the
     same way Omarchy's own migrations add extensions. This covers every
     profile. Restart Chromium once afterwards. If that switch is indented,
     shares a line with other flags, is quoted or contains backslashes, or the
     file uses CRLF line endings, the installer leaves the file alone and says
     so, because adding a second switch would replace Omarchy's list.

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

   Google Meet needs no setting. It does not follow the desktop: when checked
   its pages were light and its call screen dark. With a dark Omarchy theme every
   Meet surface takes the palette, including the call screen, and Meet's
   error and success colours take the theme's red and green. With a light
   theme Meet's pages take the palette and the call screen stays Meet's dark
   grey, so captions and controls over video keep their contrast; a Meet
   page that is dark as a whole is left to Meet for the same reason.

   In GitLab at `git.squintopera.com`, choose **System** appearance in your
   preferences. The GitLab adapter applies while its mode matches Omarchy.
   After updating or reloading the extension, reload open GitLab pages once.

### Grok Build

Optional, and off unless you ask for it:

```bash
./install.sh --grok
```

Grok cannot load custom palettes, so this does not generate a theme. Grok
Build's built-in terminal theme uses the terminal's default foreground and
background and its 16-colour ANSI palette, and paints no backgrounds. Omarchy
reloads the Ghostty, Kitty and Alacritty palettes on every theme change, so
Grok recolours live in those terminals with no hook and no helper.

The installer sets two keys in `~/.grok/config.toml`: `theme = "terminal"` under
`[ui]` and `terminal_theme = true` under `[features]`. The terminal theme is
behind a rollout flag; without it Grok silently uses GrokNight. Only those two
keys change, and the installer records what it did in
`~/.local/share/omarchy-theme-bridge/grok-state.json`.

Restart open Grok sessions once after installing. To check, run `/theme` in
Grok: the Terminal row should be marked active. `GROK_THEME` and
`LC_GROK_THEME` override the config, so unset them if Grok keeps another theme.
Minimal mode (`--minimal`) ignores themes and already uses terminal colours.

Contrast depends on your terminal profile. If a theme's bright black (ANSI 8)
is very dark, Grok's dividers and dim text look faint.

### What the installer changes

| Path | Change |
| --- | --- |
| `~/.local/share/omarchy-theme-bridge/` | New: `extension/`, `bin/omarchy-theme-bridge-host`, an ownership marker and, after a flags edit, `flags-state.json` recording how the line was changed and, after a Grok edit, `grok-state.json` |
| `~/.config/chromium/NativeMessagingHosts/xyz.rfrost.omarchy_theme_bridge.json` | New: registers the helper for this extension's ID only |
| `~/.config/chromium-flags.conf` | Only with `--load-extension-flag`: this extension's path is appended to the last `--load-extension=` line (or one line is added). Only that line changes; line endings, the final newline, symlinks and permissions are kept. Rerunning never adds a duplicate. |
| `~/.grok/config.toml` | Only with `--grok`: sets `theme = "terminal"` under `[ui]` and `terminal_theme = true` under `[features]`, and nothing else. Skipped, with the file left untouched, if it uses CRLF line endings, multi-line strings, top-level dotted keys or inline tables for `ui` or `features`, duplicate headers, or is not valid TOML. |

Nothing else is touched: no `sudo`, no Omarchy files, themes, hooks or browser
policies, no other browsers and no other Grok settings. The dry run prints only
the lines that would change in the flags and Grok files, never the rest of
either.

## Removal

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

This removes the installed directory, the helper registration and this
extension's flags entry, leaving the flags file byte for byte as it was before
installing. If an Omarchy update has since added another extension to that
line, only this extension's entry is removed.

For Grok, each of the two keys is reverted only while it is still the line the
installer wrote. If nothing else changed, the file is restored byte for byte.
A theme you later picked in Grok is kept, and a `terminal_theme = true` that
existed before installing is never removed. A `config.toml` the installer
created is deleted once it is empty, and so is a `~/.grok/` it created if
nothing else is in it.

Restart Chromium, or remove an unpacked copy from `chrome://extensions`.
Running it again is harmless.

## Upgrading from omarchy-webapp-theme

Run `./install.sh` from this checkout with the switches you used before. It
migrates the old install: the old `--load-extension` entry is replaced by the
new path, the Grok record is carried over, and the old directory and helper
registration are removed (`--dry-run` lists each step). Restart Chromium once.
Profiles that loaded the extension unpacked show the old copy as missing:
remove it in `chrome://extensions` and load
`~/.local/share/omarchy-theme-bridge/extension` instead. Adapter switches carry
over because the extension ID is unchanged.

## Permissions

| Permission | Why |
| --- | --- |
| `nativeMessaging` | Talk to the read-only helper that reads the Omarchy palette. Only this extension's ID may start it. |
| `storage` | Keep the last good palette, helper status and adapter switches, so pages are coloured straight away after a restart. |
| Content scripts on `https://app.notion.com/*`, `https://app.slack.com/*`, `https://meet.google.com/*` and `https://git.squintopera.com/*` | Add the palette properties and adapter styles to those four apps. No other site is matched, and there are no host permissions, `tabs`, `scripting` or web-accessible resources. |

## How the adapters map colours

Adapters only assign the apps' own CSS variables; they do not restyle layout
classes. In Notion, overrides apply to the page root and to theme containers in
the same mode, so deliberately opposite-mode elements keep Notion's styling.
Slack's handling of tooltips, reactions and its two modes is described below.

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
  the `-inv-` variants; the selected row is an accent tint) and the window backdrop `.p-theme_background`, because
  Slack paints it from its shared grey palette. Tooltips (including the
  who-reacted popover, `.c-tooltip__tip`) and your own reactions
  (`.c-reaction--reacted`) get a raised surface and an accent tint locally;
  Slack's inverse colours elsewhere (badges, unread dots, danger items)
  stay Slack's. These three component hooks are the only class selectors. While Slack's mode matches the theme, success and presence
  (`hgl-2`), highlights (`hgl-3`), important and error (`imp`), education and
  badge colours stay Slack's; otherwise the first four take the palette's
  hues (so anything Slack draws in its success green, possibly including
  presence, takes the palette's green). Badges always stay Slack's.
- **Google Meet**: the Material 3 system tokens `--gm3-sys-color-*` (surfaces
  and surface containers, text, outlines, primary and secondary as the accent
  with the theme background as ink on fills, inverse surfaces for snackbars)
  with their `-rgb` triplets, the neutral grey family
  `--ws-sys-color-extended-grey-*`, and the older `--gm-*` and `--hotlane-*`
  variables. Under a dark palette the tokens are set on every element,
  because the call screen and surfaces over video redeclare them on
  containers with generated class names; under a light palette only on the
  page, so those containers keep Meet's dark colours. Error and tertiary
  (success) move to the palette's red and green only while Meet's mode (read
  from a token the adapter never sets) differs from the palette's. Meet's
  named colour families (avatars, labels), AI and premium gradients and
  fixed colours stay Meet's.

- **GitLab** (only `git.squintopera.com`): semantic `--gl-*` surfaces,
  text, links, borders, application chrome, navigation, menus and neutral
  buttons and form controls. Overrides also apply to explicit theme scopes
  in the same mode. Primitive colour ramps, status and pipeline colours,
  diff additions and deletions, syntax highlighting, authored labels,
  confirmation and danger button fills, and opposite-mode scopes stay GitLab's.
  Select **System** appearance in GitLab's preferences so its mode follows
  Omarchy. In a mismatched fixed mode, the adapter waits and reports the mismatch.

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
  including its Ctrl+K search. Slack's messages, sidebar, rail, selected row,
  right-click menu, tooltips and reactions followed light and dark themes; its
  tokens were confirmed by reading computed styles. Slack dialogs and Notion
  code blocks were not inspected live. Automated tests use synthetic pages built from
  the apps' public stylesheets, so a future app update can still drift.
- **Google Meet** (checked 2026-10-07, signed out, in a throwaway profile):
  the pre-join prompt and its buttons followed light and dark palettes. The
  signed-in home page and the call screen could not be reached without an
  account and a live meeting, so they are unverified; the call screen's
  backdrop may be a fixed colour rather than a token. The "can't join" page
  paints its own backdrop and headings with fixed colours, so it stays
  white behind a themed dialog. Under a dark palette the adapter sets its
  tokens on every element: on a 5,000-element page a full style
  recalculation took about 16 ms instead of 8 ms, and every element that
  restyles costs more. The cost during a call has not been measured; turn
  the Meet adapter off on the options page if calls feel slower.
- **GitLab** (2026-10-07): tokens and representative consumers were inspected
  in the public stylesheets served by `git.squintopera.com`. Synthetic tests
  cover light and dark pages, live updates, mode gating, independent toggling,
  preserved meaning colours and stock-theme contrast. Signed-in project,
  merge request and pipeline pages have not been checked live. Fixed colours
  outside the semantic tokens retain GitLab's styling.
- **Light and dark switching**: Notion follows the desktop only when set to
  use the system setting; until then the Notion adapter leaves it uncoloured.
  Slack in the browser cannot follow the desktop, so it stays in its chosen
  mode with the palette applied and status colours remapped.
- **Slack's own colours**: a few things Slack draws with fixed colours (some
  icons, images and illustrations) keep their Slack look, especially when
  Slack's mode differs from the theme's.
- **App changes**: if Notion, Slack, Meet or GitLab rename their colour variables, the
  affected areas fall back to the app's own colours rather than breaking.
- **Origins**: only `app.notion.com`, `app.slack.com`, `meet.google.com` and `git.squintopera.com`. Public `notion.site`
  pages and older `www.notion.so` links that do not redirect to
  `app.notion.com` are not coloured.
- **Grok Build** (1.0.46): the terminal theme follows the terminal, so it only
  tracks Omarchy in terminals that reload their palette on theme change
  (Ghostty, Kitty and Alacritty). Other terminals keep the colours they were
  started with. The rollout flag is Grok's, not ours; if a Grok update renames
  the keys, Grok may fall back to GrokNight. Grok's own colour choices that sit
  outside the 16-colour palette are not themed.
- **Flags file**: if an Omarchy update rewrites `~/.config/chromium-flags.conf`
  and drops the entry, rerun `./install.sh --load-extension-flag`.
- **Extension reloads**: Chromium does not re-inject content scripts into tabs
  that are already open. After reinstalling or reloading the extension, open
  Notion, Slack, Meet and GitLab windows drop back to the apps' own colours until reloaded.
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
