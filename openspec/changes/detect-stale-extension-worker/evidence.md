# Evidence

## Incident (13 October 2026, enceladus, read-only copies)

- `Profile 1` extension storage: `hostStatus` "Specified native messaging
  host not found." from Chromium start (16:42) to 19:44; Slack and Notion
  adapters active against a cached light palette. `Default` connected on every
  theme change.
- `Profile 1/Service Worker/ScriptCache` named `xyz.rfrost.omarchy_webapp_theme`;
  `Default` named `xyz.rfrost.omarchy_theme_bridge`. Installed files matched the
  repository. `Profile 1` loaded the extension through the flags line
  (location 8), `Default` as Load unpacked (location 4).
- After the user reloaded the extension in `Profile 1`, a new script cache
  entry appeared and `hostStatus` read `connected` (`vulkanite`).

## Experiments (headless Chromium 152.0.7977.82, throwaway profile)

Recorded in design.md. A changed `background.js` kept the old worker across
restarts and across version changes up and down; `fetch` of the worker's own
URL returned the file on disk; `chrome.runtime.reload()` unloaded the
`--load-extension` extension, with or without `--disable-extensions-except`.
Reading the installed file with `fetch` was verified only for an extension
loaded with `--load-extension` in headless Chromium 152; Load unpacked was not
exercised. If `fetch` were served from the worker cache there, the check could
miss staleness but could not report a false one.
Seven consecutive restarts with four-second holds succeeded once the harness
stopped killing restarted browsers.

## Requirement trace

| Scenario | Implementation | Verification |
| --- | --- | --- |
| Worker older than the installed files | `WORKER_BUILD` and `checkBuild()` in `extension/background.js`; `workerStatus` key; notice in `extension/options/options.js` | `tests/e2e/worker.test.mjs`: stale status with running and installed markers, options notice, palette still reaches a Notion page across a theme change, status survives connection updates. Fails with the check disabled (timed out, last `null`) |
| Worker matches the installed files | `checkBuild()` on start and on page `ensure` removes `workerStatus` | Same test: a seeded stale status clears when a page connects; status clears after restart once files match |
| Worker code changed without a new build marker | Unit test recomputing the marker | `tests/extension/extension.test.mjs`; fails with the expected value when `background.js` or `content/colour.js` changes |
| Reinstall while Chromium loads the extension | `install.sh` `RELOAD` message | `test_reinstall_says_reload_instead_of_restart` |
| Legacy migration through the flags file | `UPDATE` set for legacy installs; "Then reload" line | `test_migrates_a_flags_install` |
| First install | No update notice without a prior marker; restart notice when the flags file already names the directory | `test_first_install_has_no_update_reload_notice` (with and without the flag), `test_first_install_with_flags_already_naming_it_says_restart`; unpacked update in `test_unpacked_reinstall_says_reload`; unpacked legacy migration in `test_unpacked_migration_says_load_again_only` |

## Review and verification

- One independent review round: no high findings, one medium (a first
  install whose flags file already named the extension got the update
  reload notice). Fixed, together with the low findings: contradictory
  unpacked legacy migration text, the check now also runs when a page asks
  the worker to connect, the harness waits for a killed browser to release
  its profile, and the first-start assertion now proves a status clears.
  Load unpacked coverage is noted above as unverified.
- `./scripts/check` after the fixes: 18 helper, 73 installer, 29 extension
  unit and 81 headless Chromium tests, zero failures or skips; strict
  OpenSpec validation passed 5 items. Log: `/tmp/stale-worker-check.log`.
- `tests/e2e/worker.test.mjs` passed three consecutive runs alone after the
  fixes, and fails with the check disabled.
