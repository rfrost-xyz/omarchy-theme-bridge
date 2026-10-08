# Evidence

## Grok behaviour (Grok Build 1.0.46, 2026-10-08)

- Embedded documentation (`06-theming.md`) describes the `terminal` theme and its rollout flag `[features] terminal_theme` / `GROK_TERMINAL_THEME`. Grok cannot load custom palettes; bundled `.tmTheme` files cannot be replaced.
- In a pseudo-terminal with a throwaway `HOME`: `theme = "terminal"` without the flag emitted 1,316 truecolour background sequences and an OSC 12 cursor colour (GrokNight fallback). With the flag: none of either, only default and ANSI indexed colours.
- After `./install.sh --grok` in a throwaway `HOME`, launching Grok again emitted no truecolour sequences.
- Omarchy chain: `~/.config/ghostty/config` includes `~/.local/state/omarchy/current/theme/ghostty.conf`; `omarchy-restart-terminal` signals Ghostty and Kitty and touches the Alacritty config on theme change.
- On first launch Grok appends its own `[marketplace]` table to `config.toml`. The uninstaller keeps it and reverts only the installer's lines (checked for an existing file and for an installer-created file; the latter keeps a leading blank line, valid TOML).

## Requirement traceability

| Requirement / scenario | Implementation | Verification |
| --- | --- | --- |
| Grok follows the terminal palette / existing configuration, no configuration, idempotent rerun | `scripts/grok.py` add, `install.sh --grok` | `tests/install/test_grok.py`: existing tables with other keys (two lines change, parsed document differs only in the two keys), created file, rerun unchanged |
| Default install leaves Grok alone | `install.sh` without `--grok` | Test asserts `~/.grok` absent and unchanged |
| Dry run (grok-theme and modified installation) | Plan output in `grok.py` and `install.sh` | Tests assert nothing written and only Grok lines printed, including an unterminated unrelated last line that must not be printed |
| Unsafe Grok configuration left alone | Shape checks and tomllib before/after equality guard | Tests for dotted key, inline table, CRLF, multi-line string, duplicate header, invalid TOML; install completes; write failure after planning also completes the install |
| Reversible Grok configuration / restore, user picked another theme, pre-existing flag kept | `grok.py` remove, `uninstall.sh` before data directory removal | Tests for byte, mode and symlink restoration, created file removal, user theme kept with flag reverted, pre-existing `terminal_theme = true` kept, deleted created config, unterminated original line, repeated and dry-run uninstall |

## Validation

`./scripts/check` passed: shell and Python syntax, helper suite, installer suite (53 tests), extension unit tests, 53 headless Chromium tests and strict OpenSpec validation (4 items).

## Review

Implementation by two Sonnet workers under an Opus-orchestrated workflow; independent Opus adversarial review ran grok.py and the installers against throwaway configurations. Findings: one high (uninstall crashed when an installer-created config had been deleted), three medium (dry run printed an unrelated unterminated last line; a Grok write failure aborted the install; restoring an unterminated original line glued it to later content). All four fixed with regression tests. Low findings on documentation wording and README structure fixed; remaining low: the config is written before the state record, so a failure writing the state leaves an unrecorded edit (accepted: both are written in the same directory tree the installer just created).
