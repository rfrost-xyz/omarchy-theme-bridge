## Context

See proposal.md for the incident. The extension is loaded unpacked, either
through Omarchy's `--load-extension` flags line or "Load unpacked", always
from `~/.local/share/omarchy-theme-bridge/extension` with the fixed ID
`pinjcoeajnkogbmcjjgkgjafpiiebheg` and manifest version `0.1.0`. Content
scripts and the manifest are read from disk whenever Chromium loads the
extension. The service worker script and its `importScripts` imports are
served from Chromium's service worker script cache once registered.

Evidence on enceladus (Chromium, read-only copies of profile data):
`Profile 1/Service Worker/ScriptCache` held a worker naming
`xyz.rfrost.omarchy_webapp_theme` while the installed `background.js` named
`xyz.rfrost.omarchy_theme_bridge`; `Default` held the current one. Reloading
the extension in `chrome://extensions` in `Profile 1` replaced the cached
worker and the helper connected at once.

Experiments in a throwaway headless Chromium 152 profile with
`--load-extension` on a copy of the extension:

| Step | Worker that ran |
| --- | --- |
| Change `background.js`, restart (twice) | old |
| Raise `version` to `0.1.0.500`, restart | old (`getManifest().version` was new) |
| Change script, lower version to `0.1.0.100`, restart | old |
| Change script, raise version to `0.1.0.600` and `0.1.0.601` | old |
| `fetch(chrome.runtime.getURL('background.js'))` from the old worker | returned the new file |
| `chrome.runtime.reload()` | extension unloaded and did not return |

The headless harness also killed every restarted browser three seconds after
a restart: its shutdown timer read `this.proc` when it fired, by which time
it named the new process. Early experiment runs that hung or briefly showed
a new worker were caused by that and are discounted.

## Goals / Non-Goals

**Goals:**
- Make a stale worker visible, with the exact fix, without new permissions.
- Stop the installer and README from promising that a restart applies an
  update.
- Keep palette delivery working while stale, as before.

**Non-Goals:**
- Replacing the stale worker automatically.
- Detecting workers registered before this change; they lack the check.
- Any change to the helper, adapters or content script transport.

## Decisions

**Build marker in the worker source, enforced by a unit check.**
`background.js` declares `const WORKER_BUILD = '<12 hex digits>'`, the first
12 hex digits of SHA-256 over `background.js` with the marker value blanked,
followed by each `importScripts` file in order. The extension unit tests
recompute it and fail with the expected value when it is out of date. Because
any change to an imported file must change `background.js`, comparing only
`background.js` is enough at runtime.
Alternatives: stamping the marker at install time keeps the source free of
hashes but makes the installed worker differ from the repository and leaves
unpacked development loads unchecked; a hand-maintained counter is easy to
forget.

**Compare against the file on disk with `fetch`.** On every worker start,
and whenever an app page asks the worker to connect (page load, focus or
visibility), the worker fetches its own `background.js` with `cache: 'no-store'`, extracts
the marker and compares. Extension resources are read from disk, as the
experiment showed, so this needs no permission. A failed fetch or a missing
marker leaves the status unchanged.

**Separate `workerStatus` storage key.** `hostStatus` is rewritten on every
connect, disconnect and palette, which would erase a stale flag. A separate
key keeps the two independent; the options page shows it above the helper
line only when stale.

**No self-reload.** `chrome.runtime.reload()` removed a `--load-extension`
extension in headless Chromium, and no headed display is available to show
that headed Chromium differs. A missing extension is worse than a visible
stale one.

**Rejected: version stamping.** The originally proposed fix (an install-time
fourth version component) was disproved by the table above.

**Installer wording.** Any run over an existing marked install, or a legacy
migration, ends with the per-profile reload instruction, and the
"(or restart Chromium)" alternative is removed. A first install keeps its
existing instructions.

## Risks / Trade-offs

- [Pre-change workers cannot report] → The README and installer give the
  reload instruction on every update; the PR notes iapetus may need one
  manual reload.
- [Developers forget the marker] → `./scripts/check` fails and prints the
  value to paste.
- [Status only visible in the options page] → It is the existing diagnostic
  surface; adding toolbar UI would need an `action` and is out of scope.
- [Hash collision in 48 bits] → Negligible for a single repository's history.

## Migration Plan

Reinstall with `./install.sh`, then reload the extension in
`chrome://extensions` in each profile once. Later updates report a stale
worker in the options page if a profile was missed. Rollback is reinstalling
the previous revision; the extra storage key is ignored by older code.
