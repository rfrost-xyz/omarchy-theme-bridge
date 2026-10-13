## ADDED Requirements

### Requirement: Stale service worker reporting
The extension's service worker SHALL identify the build of its own code, including the scripts it imports, and on every start SHALL compare it with the build of the installed extension files. When they differ it SHALL record a stale-worker status that later helper connection and palette updates do not overwrite, and it SHALL keep delivering palettes as before. When they match it SHALL clear that status. The options page SHALL show the stale-worker status together with the fix: reload Omarchy Theme Bridge in `chrome://extensions` in that profile. The extension SHALL NOT reload itself.

#### Scenario: Worker older than the installed files
- **WHEN** Chromium starts an extension whose installed worker code has changed since the worker was registered
- **THEN** the stored status reports a stale worker, the options page names the reload in `chrome://extensions`, and the palette still reaches open pages

#### Scenario: Worker matches the installed files
- **WHEN** the worker that starts was built from the installed files
- **THEN** no stale-worker status is stored and the options page shows no reload notice

#### Scenario: Worker code changed without a new build marker
- **WHEN** the worker script or a script it imports changes and its build marker does not
- **THEN** the repository checks fail and report the expected marker
