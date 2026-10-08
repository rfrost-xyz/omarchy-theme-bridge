# Tasks

## 1. Grok configuration

- [ ] 1.1 Add `scripts/grok.py` (add/remove, dry-run output, parse-checked line edit, refusals, state record, atomic symlink- and mode-preserving writes) and the `GROK_CONFIG`, `GROK_STATE` and `grok_edit` definitions in `scripts/common.sh`.
- [ ] 1.2 Add `--grok` to `install.sh` (dry run, staging carries `grok-state.json`, messages) and Grok reversal to `uninstall.sh`; extend the shell syntax check if new scripts are added.
- [ ] 1.3 Add synthetic installer tests in `tests/install/test_grok.py` covering every `grok-theme` scenario and the modified installation dry run; verify with `python3 -m unittest discover -s tests/install`.

## 2. Scope and documentation

- [ ] 2.1 Update `AGENTS.md`, the `context` in `openspec/config.yaml` and `README.md` (scope, setup, installer table, removal, limitations: `GROK_THEME`, minimal mode, terminal profile contrast, rollout flag).

## 3. Integration and review

- [ ] 3.1 Run `./scripts/check` and strict OpenSpec validation, record requirement-to-test evidence in `evidence.md`, and resolve independent review findings.
