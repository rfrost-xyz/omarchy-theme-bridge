# Tasks

## 1. Rename

- [x] 1.1 Rename identifiers in the extension, helper (file move), installer scripts, tests, README, AGENTS.md and `openspec/config.yaml` and canonical specs; keep the manifest key, `--omarchy-*` properties, `data-omarchy-*` attributes, storage keys and archived changes unchanged. Verify `./scripts/check`.

## 2. Migration

- [x] 2.1 Add legacy constants and a shared migration in `scripts/common.sh`, call it from `install.sh` (dry run, implied flags re-add, Grok record carried) and `uninstall.sh`; add synthetic installer tests for every migration and legacy removal scenario.

## 3. Integration and review

- [x] 3.1 Run `./scripts/check` and strict validation, record evidence, resolve independent review findings, rename the GitHub repository and update the remote.

## Workflow follow-up

- Synchronise specifications, archive the completed change and publish a review-ready PR.
