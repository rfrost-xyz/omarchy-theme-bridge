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
     `~/.local/share/omarchy-webapp-theme/extension`. Omarchy's Slack launcher
     uses `Profile 1`, so do this there as well as in the default profile.
   - `./install.sh --load-extension-flag` also appends the extension to the
     existing `--load-extension=` line in `~/.config/chromium-flags.conf`, the
     same way Omarchy's own migrations add extensions. This covers every
     profile. Restart Chromium once afterwards.

3. In Notion (Settings, Appearance) and Slack (Preferences, Themes), choose to
   follow the system setting. Omarchy sets the desktop colour scheme for each
   theme, Chromium passes it to pages, and the apps then switch between light
   and dark themselves. The extension only recolours an app while the app's own
   mode matches the Omarchy theme. If they differ, it leaves the app alone and
   the options page says so.

### What the installer changes

| Path | Change |
| --- | --- |
| `~/.local/share/omarchy-webapp-theme/` | New: `extension/`, `bin/omarchy-webapp-theme-host` and an ownership marker |
| `~/.config/chromium/NativeMessagingHosts/xyz.rfrost.omarchy_webapp_theme.json` | New: registers the helper for this extension's ID only |
| `~/.config/chromium-flags.conf` | Only with `--load-extension-flag`: this extension's path is appended to the last `--load-extension=` line (or one line is added). The file is edited in place, so symlinks and permissions are kept. Rerunning never adds a duplicate. |

Nothing else is touched: no `sudo`, no Omarchy files, themes, hooks or browser
policies, and no other browsers. The dry run prints only the flags line that
would change, never the rest of the file.

## Removal

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

This removes the installed directory, the helper registration and this
extension's flags entry (dropping the line only if nothing else was on it).
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
  backgrounds, the neutral grey block family and the interface blue. Authored
  block colours (red, blue, yellow and the other chromatic families), shadows
  and error rings are left as Notion draws them.
- **Slack**: `--dt_color-content-*`, `-base-*`, `-surf-*` and `-otl-*`
  neutrals, the link and mention colour (`hgl-1`), the legacy `--sk_*`
  triplets and the sidebar `--dt_color-theme-*` tokens. Success and presence
  (`hgl-2`), highlights (`hgl-3`), important and error (`imp`), education and
  badge colours stay Slack's.

The transport also provides generic helpers every adapter can use:
`--omarchy-mix-<n>` (background blended n% towards foreground),
`--omarchy-text`, `-text-secondary`, `-text-tertiary` and `-accent-text`
(adjusted to 4.5:1 or 3:1 against the main surfaces), `--omarchy-accent-ink`
and an `-rgb` triplet for each.

## Adding another web app

1. Create `extension/adapters/<id>/adapter.js` that registers
   `{ id, appMode() }`, returning `'light'`, `'dark'` or `null` from the app's
   own theme marker.
2. Create `extension/adapters/<id>/adapter.css` scoped to
   `html[data-omarchy-adapters~="<id>"]`, assigning the app's colour variables.
3. Add one `content_scripts` entry for the app's origin to `manifest.json`,
   loading `content/colour.js`, `content/palette.js` and the adapter.
4. Add a synthetic fixture and tests under `tests/e2e/`.

The helper, service worker and options page need no changes. The options page
lists adapters from the manifest.

## Development

```bash
./scripts/check
```

This runs shell syntax checks, the helper tests (Python `unittest`), the
installer tests (temporary `HOME`), the extension unit tests and the headless
Chromium tests (`node --test`), and strict OpenSpec validation. The browser
tests use a throwaway profile, the real extension and helper, a temporary
Omarchy state directory and synthetic pages served on the real origins through
the DevTools protocol. They cover theme changes, directory replacement, helper
and service worker restarts, missing and malformed palettes, adapter toggles,
mode gating, preserved colours and a contrast matrix over every stock theme in
`/usr/share/omarchy/themes`. They never touch your browser profile or theme.

Requirements: system `/usr/bin/python3` and Chromium at run time; Node for the
tests.

## Known limitations

- **Live behaviour in the signed-in apps is not yet verified.** Tests use
  synthetic pages. Notion's token names and defaults were taken from Notion's
  public stylesheet (version 23.13.20261005). Slack's `--dt_color-*` tokens were
  seen on its public sign-in page, but `--sk_*` and `--dt_color-theme-*` (the
  sidebar) exist only in the signed-in client and come from
  omarchy-webapp-theme's reference mappings.
- **Light and dark switching depends on the apps.** In a throwaway Chromium app
  window, `prefers-color-scheme` matched the desktop's `prefer-dark` setting.
  Whether Notion and Slack follow a live change depends on each app's "follow
  system" setting, which has not been checked in the signed-in apps. Until an
  app matches, the extension leaves it uncoloured instead of forcing a mode.
- **App changes**: if Notion or Slack rename their colour variables, the
  affected areas fall back to the app's own colours rather than breaking.
- **Origins**: only `app.notion.com` and `app.slack.com`. Public `notion.site`
  pages and older `www.notion.so` links that do not redirect to
  `app.notion.com` are not coloured.
- **Flags file**: if an Omarchy update rewrites `~/.config/chromium-flags.conf`
  and drops the entry, rerun `./install.sh --load-extension-flag`.
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
