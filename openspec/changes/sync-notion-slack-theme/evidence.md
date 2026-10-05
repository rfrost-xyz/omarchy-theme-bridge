# Evidence

Traceability from requirement to implementation, verification and result.
Commands run from the repository root on the development machine (Omarchy,
Hyprland 0.56.2, Chromium 153.0.8010.52, Python 3.14.7, Node 26.10.0).

## palette-helper

| Requirement / scenario | Implementation | Verification | Result |
| --- | --- | --- | --- |
| Read-only source: only palette data leaves | `host/omarchy-webapp-theme-host` `read_text`, `parse_raw`, `resolve` | `tests/host`: unknown keys, symlink to another file, symlink to a FIFO, invalid name | Pass |
| Read-only source: unsupported requests ignored | `main` request handling | `test_get_resends_and_other_requests_are_ignored` | Pass |
| Read-only source: no writes | whole helper | `test_never_writes_to_state_dir` | Pass |
| Validation and mode: valid palette | `resolve`, `normalise_hex` | `test_initial_palette_is_validated_and_normalised` | Pass |
| Mode fallback matches Omarchy | `resolve` (raw background, six-digit hex, R+G+B > 382; `theme_type`; `light.mode`) | `test_mode_falls_back_to_marker_then_luminance`, `test_mode_matches_omarchy_resolution` (8 cases, each cross-checked with `omarchy-theme-color --file … mode`) | Pass |
| Hand-written theme | `parse_raw` (skips unreadable lines, quoted or unquoted values), `ALIASES` | `test_accepts_the_forms_omarchy_accepts`, `test_ansi_slots_fill_background_and_foreground` | Pass |
| Missing reporting with grace, keep running | `Watcher.tick` | `test_missing_is_reported_after_grace_then_recovers`, `test_missing_at_start_is_reported_immediately` | Pass |
| Malformed then fixed | `load`, `Watcher.tick` | `test_malformed_then_fixed` | Pass |
| Live change, directory replacement | `signature`, `Watcher.tick` | `test_live_change`, `test_directory_replacement_sends_one_palette_and_no_missing` | Pass |
| Connection lifetime: framing, exit on EOF | `send`, `read_request`, `main` | `test_exits_when_stdin_closes` and every framed test | Pass |

## app-adapters

| Requirement / scenario | Implementation | Verification | Result |
| --- | --- | --- | --- |
| Minimal access: manifest audit | `extension/manifest.json` | `tests/extension`: permissions, matches, `js` and `css` per adapter, no host, optional or web-accessible entries, ID derived from key | Pass |
| Transport: initial load | `background.js`, `content/palette.js`, `content/colour.js` | e2e `initial load exposes palette properties` | Pass |
| Transport: live change incl. directory replacement, no reload | as above | e2e `live change and directory replacement reach open pages without reload`; live: Notion app window followed Tokyo Night to Catppuccin Latte without reload | Pass |
| Transport: helper reconnection (backoff) | `background.js` `schedule` | e2e `helper is relaunched after it is killed` | Pass |
| Transport: reconnection triggers | `background.js` `ensure`; `palette.js` load, `visibilitychange`, `focus` | e2e `a live worker reconnects at once on ensure…`, `opening a page wakes a stopped worker…`, `a page becoming visible wakes…`, `stopped service worker reconnects when a page regains attention`; each fails when its trigger is removed | Pass |
| Transport: extension reloaded | `palette.js` `alive`, `teardown` | e2e `tests/e2e/reload.test.mjs`; fails when teardown is disabled | Pass |
| Transport: browser restart | storage cache | e2e `cached palette applies after a browser restart, then refreshes` | Pass |
| Missing and malformed keep last palette | `background.js` status handling | e2e `missing palette …`, `malformed palette …` | Pass |
| Independent adapters | `options/`, `disabledAdapters` | e2e `adapters toggle independently and live from the options page` | Pass |
| Mode gating: Notion mismatch and match | `palette.js` `evaluate`, Notion `appMode` | e2e `notion: mode mismatch …`, `notion: chrome follows the palette …` | Pass |
| Mode gating: Slack mismatch remaps | `modePolicy: 'any'`, `data-omarchy-remap`, Slack remap CSS | e2e `slack: a different app mode keeps theming and remaps status colours` (dark palette, Slack light) and `slack: a light palette over Slack in Dark uses light controls and palette hues` (fails if `color-scheme: light` is wrong); live: user reported Slack correct under light and dark themes | Pass |
| Semantic mapping: surfaces, menus, dialogs, sidebars, code blocks | `adapters/notion/adapter.css`, `adapters/slack/adapter.css` | e2e `notion: chrome follows …` (search dialog modelled on Notion's real `.notion-dialog` with an inline background inside a `display: contents` theme wrapper, glass header, translucent borders), `slack: tokens follow …` (backdrop, inverted sidebar, selected sidebar row, rail, legacy link, `.c-menu` on `--dt_color-ctr-pry` with item, shortcut and highlighted row, tooltips and who-reacted popovers, your own reactions; badges, unread dots, white badge and shortcut hints keep Slack's values) | Pass |
| Preserved meaning: Notion chromatic families and button blue | Notion CSS exclusions | e2e asserts every chromatic token in the fixture, `--c-palUiBlu600`, opposite-theme container | Pass |
| Preserved meaning: Slack status colours while modes match; badges always | Slack CSS exclusions | e2e asserts error, success (text and background), warning (text and background), education, badge, presence while modes match, and badges under remap. Which token signed-in Slack uses for presence dots was not captured, so under remap presence may take the palette's green (stated in the spec and README) | Pass |
| Readable contrast | `colour.js` `derive`, both adapters | `tests/extension` derived values for 22 stock themes; e2e `contrast.test.mjs`: 22 themes × (Notion, Slack same mode, Slack opposite mode with remapped status text on its tint); a deliberately broken mapping was confirmed to fail | Pass |

Fixtures are synthetic. Notion token names and defaults come from Notion's
public logged-out stylesheet (version 23.13.20261005). Slack light values come
from Slack's public sign-in stylesheet; the structure of Slack's navigation
(inverted theme tokens over `.p-theme_background`) mirrors what was read from
the signed-in client. No workspace content is stored.

## installation

| Requirement / scenario | Implementation | Verification | Result |
| --- | --- | --- | --- |
| Dry runs list every file and write nothing | `install.sh`, `uninstall.sh` | `test_dry_run_writes_nothing_and_prints_only_changed_line`, `test_dry_runs_list_every_file_and_write_nothing`, `test_dry_run_never_prints_unrelated_lines` (snapshots include directories) | Pass |
| Install writes only planned files; manifest allows only the fixed ID | `install.sh`, `host_manifest` (JSON-encoded) | `test_default_install_leaves_flags_untouched` | Pass |
| Unsafe install path | `path_is_safe`, `require_absolute_dirs` | `test_unsafe_install_paths_never_reach_the_flags_file` (space, comma, apostrophe, double quote, backslash, `#`, tab; manifest and data removed afterwards), `test_relative_data_home_is_refused`, `test_relative_config_home_is_refused`, `test_quoted_list_is_not_edited` | Pass |
| Default install leaves flags byte-identical | `install.sh` | `test_default_install_leaves_flags_untouched` | Pass |
| Opt-in merge: single, idempotent, keeps lines, mode, symlink | `scripts/flags.py` `add` | `test_flag_merge_is_single_and_idempotent`, `test_flag_merge_follows_symlink`, `test_flag_added_when_no_load_extension_line`, `test_missing_flags_file_is_not_created`, `test_commented_switch_is_ignored` | Pass |
| Switch shares a line, is indented or carries whitespace | `occurrences`, `Refuse`, post-write check | `test_refuses_switch_that_is_indented_or_shares_a_line`, `test_switch_with_trailing_whitespace_is_refused` | Pass |
| Uninstall restores byte for byte; repeated uninstall no-op; foreign files kept | `scripts/flags.py` `add` (verbatim append) and `remove` (restores the recorded original), `flags-state.json` | `test_round_trip_is_byte_exact` (10 file shapes, including leading, trailing and middle empty items), `test_uninstall_restores_original_and_is_idempotent`, `test_foreign_files_are_left_alone` | Pass |
| Entry cannot be removed | `uninstall.sh`, `flags.py mentions` | `test_uninstall_keeps_files_when_entry_cannot_be_removed` | Pass |
| Manifest ownership and odd paths | `uninstall.sh` parses the manifest JSON (normalised); `common.sh` `normal_dir`; `flags.py` `tokens` mirrors GLib | `test_non_ascii_install_path_uninstalls_cleanly`, `test_line_with_unbalanced_quotes_is_not_edited`, `test_other_spelling_of_data_home_uninstalls_cleanly`, `test_hash_inside_a_word_is_not_a_comment`, `test_flags_tokens.py` (15 GLib-verified lines) | Pass |
| Uninstall dry run predicts refusal | `flags.py remove` exit 4 | `test_uninstall_dry_run_predicts_refusal` | Pass |
| Reinstall guidance | `install.sh` | `test_reinstall_says_reload_instead_of_restart` | Pass |

## Colour scheme preference (task 5.2)

Throwaway headful Chromium 153 `--app` window, temporary profile, desktop
`color-scheme` `prefer-dark`: `prefers-color-scheme: dark` matched. Managed
policy here sets `BrowserColorScheme: device`. Live: switching Omarchy to
Catppuccin Latte set `prefer-light`, and the signed-in Notion app window
switched to light by itself. Slack's web Preferences offer only Light and Dark
(the "follow your computer's settings" option is desktop-only), which led to
Slack's `modePolicy: 'any'`.

## Live verification (task 7.1)

Approved by the user on 2026-10-05. `./install.sh --load-extension-flag`
appended only our path to the single `--load-extension=` line (mode 644 kept);
the file is not tracked by mise dot. After one Chromium restart, Chromium
loaded the extension and started the helper for
`chrome-extension://pinjcoeajnkogbmcjjgkgjafpiiebheg/`. Notion and Slack ran
as `omarchy-launch-webapp` app windows in `Profile 1`.

- Notion: followed light and dark themes live (user observed). The Ctrl+K
  search stayed grey; fixed by mapping the frosted and glass tokens. After
  reloading the extension the user confirmed it themed ("Yes, themed").
- Slack: messages followed the palette (screen sample `#071012` against
  palette `#060f12`) but navigation did not. Read-only diagnostics of computed
  styles (no message content) showed `sk-client-theme--dark` on `<body>`, the
  adapter active, navigation on `--dt_color-theme-*-inv-*` tokens and a
  backdrop on `.p-theme_background`. After the fix the rail sampled `#060d10`
  and the sidebar `#171c1e`. Under light themes Slack stayed in its Dark mode;
  after adding the remap policy the user reported Slack correct in light and
  dark themes. The who-reacted popover was then reported white: a diagnostic
  showed tooltips use Slack's inverted tokens, which were mapped to a literal
  inverse. They now use a raised palette surface, and your own reactions an
  accent tint; the user confirmed ("Looks right"). Review round 4 showed the
  global inverse mapping also recoloured badges, unread dots and menu
  highlights, so it was narrowed to `.c-tooltip__tip` and
  `.c-reaction--reacted`; the user rechecked ("Seems okay").
- Slack right-click menu: dark with dim text under light themes and Slack
  grey under dark ones. A diagnostic showed `.c-menu` on
  `--dt_color-ctr-pry`; the container family and the menu highlight are now
  mapped, and the user confirmed it in light and dark themes.
- Slack selected sidebar row: Slack's own selection colour. A diagnostic
  showed `--dt_color-theme-base-hgl-1` with `--dt_color-theme-content-hgl-1`;
  now an accent tint with palette text, confirmed by the user.
- Not inspected individually in the live apps: code blocks and authored or
  status colours (covered by the automated suites only). Screen captures were
  viewed and deleted immediately; none are kept.

## Independent review

- Round 1 (safety, correctness, tests, then a refuting verifier): flags
  editing, helper parsing and mode, Notion button blue, orphaned content
  scripts, `ensure` test, README adapter steps and profile wording, silent
  OpenSpec skip and committed bytecode. All fixed.
- Round 2: unsafe install paths, uninstall with an unremovable entry, raw-value
  mode resolution, whitespace in the switch line, Slack legacy link contrast,
  untested load and visibility triggers, incomplete preserved-colour
  assertions, order-dependent transport tests, dry-run file list and stale
  traceability. All fixed.
- Round 3: manifest ownership for non-ASCII paths, flags lines with
  unbalanced quotes, Notion translucent borders and washes, a tautological
  search fixture, presence wording under remap and the untested
  light-over-dark Slack direction. All fixed. Its Notion search findings
  repeated the earlier user report, which the user had since resolved.
- Round 4: global inverse and inverse-highlight remaps that broke badges,
  dots and menu highlights; `#` mid-word treated as a comment (now matches
  GLib, with a parity test); different spellings of the install path; uninstall
  dry run not predicting refusal; broader unsafe-path coverage. All fixed.
- Round 5: empty list items lost on install and uninstall (Omarchy's
  migrations can create a leading comma), quoted lists duplicating the entry,
  relative `XDG_CONFIG_HOME`, order-dependent transport tests, missing Slack
  border and remap-badge assertions, and stale comments and docs. All fixed;
  the flags record now stores the exact original and written values.

## Full check

`./scripts/check` (125 s): helper 17 OK, installer 26 OK, extension unit
28/28, headless Chromium 41/41, `openspec validate --all --strict` passed.
`shellcheck` is not available on this host, so shell scripts are checked with
`bash -n` and the installer tests.
