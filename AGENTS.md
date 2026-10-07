# omarchy-webapp-theme

A minimal Chromium extension and read-only native helper that keep web apps in
step with the active Omarchy theme. Notion, Slack and Google Meet are the
supported apps; others may be added as separate adapters. See README.md for setup and
limitations.

## Boundaries

- Scope is Chromium on Omarchy and the web apps with an adapter: currently
  Notion (`app.notion.com`), Slack (`app.slack.com`) and Google Meet
  (`meet.google.com`). Add an app only as a
  new adapter with its own origin match; never widen to all sites. No other
  browsers, general stylesheet management or theme installation or switching.
- The native helper is read-only. It reads only the active theme's
  `colors.toml` and `theme.name` under `~/.local/state/omarchy/current`, sends
  only validated palette data and accepts only a `get` request. It never
  writes files or runs commands.
- Never break Omarchy or edit its managed configuration by default. Do not
  touch `/usr/share/omarchy`, managed browser policies, themes, hooks or
  templates. Editing `~/.config/chromium-flags.conf` is opt-in, appends to the
  existing `--load-extension=` list the way Omarchy's migrations do, and is
  fully reversed by the uninstaller.
- Extension permissions stay at `nativeMessaging` and `storage` plus content
  script matches for each adapter's origins. Justify any addition in the README.
- Keep palette transport (host, service worker, `content/palette.js`) separate
  from app styling (`extension/adapters/<app>/`). Adding an app means one
  adapter directory, one `content_scripts` entry and its tests, with no
  transport changes. Adapters map Omarchy variables onto each app's own
  semantic colour tokens; avoid layout or generated class selectors.
- Preserve meaning: leave Notion's authored block colour families to the app.
  Keep Slack's status, highlight and error colours while Slack's mode matches
  the palette; when it differs (Slack in the browser cannot follow the system),
  move them to readable palette hues. Always keep Slack's badge colours.
  Keep Meet's named colour families and gradients; leave Meet's dark call
  screen alone under light palettes.
- No runtime dependencies beyond system `python3` and Chromium. Tests use
  Node's built-in test runner, Python's `unittest` and a throwaway headless
  Chromium profile. Never read or write the live browser profile, live theme
  state or credentials in tests. Fixtures are synthetic.

## Checks

Run `./scripts/check` before committing. It runs every unit, installer and
headless browser test.
