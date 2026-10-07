# Proposal

## Why

Google Meet runs as a Chromium web app on Omarchy next to Notion and Slack,
but keeps Google's own light pages and grey call screen when the Omarchy
theme changes. The adapter design was built so another app could be added as
one more adapter, without touching the palette transport.

## What Changes

- Add a Google Meet adapter (`extension/adapters/meet/`) that maps the Omarchy
  palette onto Meet's Material 3 system colour tokens and its legacy Google
  colour variables, matched only on `https://meet.google.com/*`.
- Meet ignores the system appearance: its home, pre-join and error pages are
  light and its call screen is always dark. Under a light palette the adapter
  themes the light pages and leaves the call screen dark, so video captions,
  controls and scrims keep their contrast over video. Under a dark palette it
  themes every Meet surface, including the call screen, and moves the light
  pages' error and success colours onto readable palette hues.
- Leave Meet's named colour families (avatar and label colours), its AI
  and premium gradients to Meet.
- Add a synthetic Meet fixture, adapter and contrast tests, and update the
  manifest audit, README, installer messages and project instructions.
- Split requirements longer than OpenSpec 1.14's 500-character limit, which
  makes strict validation (and so `./scripts/check`) fail on `main`. The
  wording moves into separate requirements; behaviour is unchanged. The
  semantic mapping requirement also gains "or generated class names", which
  the project instructions already require and every adapter follows.
- Keep the e2e profile to the extension under test, so external extensions
  registered by other packages (1Password) cannot open tabs that hide test
  pages.

## Capabilities

### New Capabilities

### Modified Capabilities
- `app-adapters`: extension access gains the Meet origin; independent adapters, mode gating, preserved meaning and contrast cover Meet. Slack's mode handling and preserved colours become their own requirements.
- `palette-helper`: mode resolution becomes its own requirement (editorial).
- `installation`: clean removal is reworded to fit the length limit (editorial).

## Impact

- `extension/manifest.json`: one `content_scripts` entry for
  `https://meet.google.com/*`. No new permissions.
- No changes to the helper, service worker, `content/palette.js` or
  `content/colour.js`.
- Installation is unchanged apart from its closing messages.
