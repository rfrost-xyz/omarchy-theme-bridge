# Evidence

Traceability from requirement to implementation, verification and result.
Commands run from the repository root on the development machine (Omarchy,
Chromium 153.0.8010.52, Python 3.14.7, Node 26.10.0).

## palette-helper

| Requirement / scenario | Implementation | Verification | Result |
| --- | --- | --- | --- |
| Read-only source: only palette data leaves | `host/omarchy-webapp-theme-host` `parse_palette`, `read_text` | `tests/host` unknown keys, symlink to other file, symlink to FIFO, invalid name | Pass |
| Read-only source: unsupported requests ignored | `main` request handling | `test_get_resends_and_other_requests_are_ignored` | Pass |
| Read-only source: no writes | whole helper | `test_never_writes_to_state_dir` | Pass |
| Validation and mode: valid palette, mode fallback | `load`, `normalise_hex`, `luminance` | `test_initial_palette_is_validated_and_normalised`, `test_mode_falls_back_to_marker_then_luminance` | Pass |
| Missing reporting with grace, keep running | `Watcher.tick` | `test_missing_is_reported_after_grace_then_recovers`, `test_missing_at_start_is_reported_immediately` | Pass |
| Malformed then fixed | `load`, `Watcher.tick` | `test_malformed_then_fixed` | Pass |
| Live change, directory replacement | `signature`, `Watcher.tick` | `test_live_change`, `test_directory_replacement_sends_one_palette_and_no_missing` | Pass |
| Connection lifetime: framing, exit on EOF | `send`, `read_request`, `main` | `test_exits_when_stdin_closes`, all framed tests | Pass |

`python3 -m unittest discover -s tests/host`: 14 tests, OK.

## app-adapters

| Requirement / scenario | Implementation | Verification | Result |
| --- | --- | --- | --- |
| Minimal access: manifest audit | `extension/manifest.json` | `tests/extension` manifest tests (permissions, matches, no host or optional permissions, ID from key) | Pass |
| Transport: initial load | `background.js`, `content/palette.js`, `content/colour.js` | e2e `initial load exposes palette properties` | Pass |
| Transport: live change (incl. directory replacement), no reload | as above | e2e `live change and directory replacement reach open pages without reload` | Pass |
| Transport: helper reconnection | `background.js` backoff and `ensure` | e2e `helper is relaunched after it is killed`, `stopped service worker reconnects when a page regains attention` | Pass |
| Transport: browser restart | storage cache | e2e `cached palette applies after a browser restart, then refreshes` | Pass |
| Missing and malformed keep last palette | `background.js` status handling | e2e `missing palette ...`, `malformed palette ...` | Pass |
| Independent adapters | `options/`, `disabledAdapters` | e2e `adapters toggle independently and live from the options page` | Pass |
| Mode gating: mismatch and matching | `palette.js` `evaluate`, adapter `appMode` | e2e `notion: mode mismatch ...`, `slack: switching the app appearance re-evaluates gating` | Pass |
| Semantic mapping: menus, dialogs, sidebars, code blocks | `adapters/notion/adapter.css`, `adapters/slack/adapter.css` | e2e `notion: chrome follows the palette ...`, `slack: tokens follow the palette ...` | Pass |
| Preserved meaning: Notion authored colours, Slack status colours | adapter CSS exclusions | same e2e tests (red and blue families, opposite-theme container; error, success, highlight, badge, presence) | Pass |
| Readable contrast (derived values) | `colour.js` `derive` | `tests/extension` derived text for each of 22 stock themes | Pass |
| Readable contrast: matrix | adapters plus `derive` | e2e `tests/e2e/contrast.test.mjs`: 22 stock themes, both adapters, primary, secondary, tertiary, link, menu, dialog, code, sidebar, grey block, default text on Notion's authored red, blue and yellow backgrounds, and Slack important and success text on light surfaces. A deliberately broken mapping was confirmed to fail (1.17:1). | Pass |

Fixtures are synthetic. Notion token names and default values come from Notion's
public logged-out stylesheet (version 23.13.20261005). Slack light values come
from Slack's public sign-in stylesheet; Slack dark, `--sk_*` and
`--dt_color-theme-*` values are stand-ins because the signed-in client was not
observable without an account session.

## installation

| Requirement / scenario | Implementation | Verification | Result |
| --- | --- | --- | --- |
| Dry run writes nothing, prints only changed line | `install.sh`, `scripts/common.sh` | `test_dry_run_writes_nothing_and_prints_only_changed_line` | Pass |
| Install writes only planned files, manifest allows only fixed ID | `install.sh` | `test_default_install_leaves_flags_untouched` | Pass |
| Default install leaves flags byte-identical | `install.sh` | `test_default_install_leaves_flags_untouched` | Pass |
| Opt-in flag merge single, idempotent, keeps lines, mode and symlink | `flags_with_extension`, `write_in_place` | `test_flag_merge_is_single_and_idempotent`, `test_flag_merge_follows_symlink`, `test_flag_added_when_no_load_extension_line`, `test_missing_flags_file_is_not_created` | Pass |
| Uninstall restores original, repeated uninstall is a no-op, foreign files kept | `uninstall.sh`, `flags_without_extension` | `test_uninstall_restores_original_and_is_idempotent`, `test_foreign_files_are_left_alone` | Pass |

`python3 -m unittest discover -s tests/install`: 8 tests, OK.

## Colour scheme preference (task 5.2)

Throwaway headful Chromium 153 `--app` window, temporary profile, desktop
`org.gnome.desktop.interface color-scheme` = `prefer-dark`:
`matchMedia('(prefers-color-scheme: dark)')` = true, light = false. Managed
policy on this machine sets `BrowserColorScheme: device`. Live switching and the
signed-in apps' response were not tested (would change the desktop setting).

## Full check

`./scripts/check` (49 s): helper 14 OK, installer 8 OK, extension unit 28/28,
headless Chromium 36/36, `openspec validate --all --strict` passed.
`shellcheck` is not available on this host (mise shim without a version), so
shell scripts are checked with `bash -n` and the installer tests only.
