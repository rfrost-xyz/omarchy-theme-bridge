## Why

Chromium keeps running an extension's previously registered service worker
after the installed files change, including across browser restarts. On
13 October 2026 the work Chromium profile on enceladus was still running the
worker from before the 8 October rename, which asked for the deleted native
host `xyz.rfrost.omarchy_webapp_theme`. Slack and Notion kept a stale palette
for five days with no visible sign. The installer told the user that a
restart would pick up updated files, which is not true for the worker.

## What Changes

- The service worker carries a build marker covering its own script and the
  scripts it imports. When it starts, it compares that marker with the
  marker in the installed `background.js` and records a stale-worker status
  when they differ. A matching worker clears that status.
- The options page shows the stale-worker status with the fix: reload
  Omarchy Theme Bridge in `chrome://extensions` in that profile.
- A unit check fails when the worker code changes without a new marker, and
  prints the expected value.
- Installer messages and the README stop claiming a Chromium restart applies
  an update, and tell the user to reload the extension in each profile that
  uses it after an update or migration.
- The headless test harness no longer kills a restarted browser three seconds
  after a restart, and can load a copy of the extension.

Out of scope: reloading the extension automatically. In headless Chromium,
`chrome.runtime.reload()` removes an extension loaded with `--load-extension`
instead of reloading it, so self-reload could leave a profile with no
extension at all. Workers registered before this change do not contain the
check and need one manual reload.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-adapters`: adds stale service worker detection and reporting to the
  extension.
- `installation`: adds update guidance that names the per-profile reload and
  does not claim a restart is enough.

## Impact

- `extension/background.js`, `extension/options/options.js`
- `install.sh`, `README.md`
- `tests/extension/extension.test.mjs`, `tests/e2e/browser.mjs`, a new
  headless test, `tests/install/test_install.py`
- No new permissions, origins, helper changes or runtime dependencies.
