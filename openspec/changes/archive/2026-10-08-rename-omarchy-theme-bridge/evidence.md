# Evidence

## Name

`omarchy-theme-sync` was planned first but four GitHub repositories already use it, including `omacom/omarchy-theme-sync`, which the README credits. The owner chose `omarchy-theme-bridge`; a GitHub search on 2026-10-08 found no repository with that name.

## Requirement traceability

| Requirement / scenario | Implementation | Verification |
| --- | --- | --- |
| Transparent per-user install (new paths) | `scripts/common.sh` names, renamed helper, extension host constant | Installer suite and headless Chromium suite (host name shared by `background.js`, installer manifest and e2e harness) |
| Clean removal / legacy install left over | `uninstall.sh` legacy steps; legacy flags write deferred until our own entry is known removable | `test_migrate.py`: leftover legacy removal, new and legacy together, unsafe legacy entry, unsafe new entry leaves flags untouched |
| Legacy install migration / flags install | `legacy_*` helpers, `install.sh` implied flag | `test_migrate.py` flags migration (own line and shared line), both entries present without contradictory advice |
| Migrate the Grok record | Staging copies legacy `grok-state.json` | Tests with and without `--grok` again; uninstall restores Grok bytes |
| Migration dry run | Planned output for each legacy step | Snapshot test: nothing changes |
| Unmarked legacy directory | `legacy_detect` | Test: left alone and reported |

End-to-end: the pre-rename installer (`feat/grok-terminal-theme`) installed with `--load-extension-flag --grok` into a throwaway `HOME`; the new installer's dry run listed the net flags change and each legacy step; the install replaced the flags entry, carried `grok-state.json`, removed the legacy manifest and directory; the uninstaller restored the flags file and Grok configuration byte for byte and left no files.

## Validation

`./scripts/check` passed: helper (18), installer (69), extension unit (28), headless Chromium (53) and strict OpenSpec validation (5 items).

## Review

Rename and migration by Sonnet workers under an Opus-orchestrated workflow; independent Opus adversarial review built real legacy installs from the previous branch. Findings: one medium (name clash with the credited `omacom/omarchy-theme-sync`), resolved by the owner choosing `omarchy-theme-bridge`. Lows fixed with regression tests: the uninstaller wrote the legacy flags edit before checking our own entry; contradictory unpacked-loading advice when both entries were present; README lacked upgrade instructions.
