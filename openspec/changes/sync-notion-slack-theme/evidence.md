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
