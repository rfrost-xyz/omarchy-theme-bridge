# Evidence

No spec-level behaviour changes (`skip_specs: true`); each task maps to its
check below. All runs used OpenSpec 2.1.1 through `mise exec`.

| Task | Implementation | Verification |
| --- | --- | --- |
| 1.1 | `mise.toml` | `mise exec -- openspec --version` printed `2.1.1`; `OPENSPEC_TELEMETRY` was `0` inside `mise exec`. |
| 1.2 | `scripts/check` | Openspec section run alone in a scratch copy: passes on the repository; exits 1 with "mise not found" when `mise` is not on `PATH`; with the scratch copy re-pinned to an uninstalled 2.0.99, auto-install off and a stub `openspec` printing 2.1.0 on `PATH`, exits 1 with "openspec 2.1.0 is not the 2.0.99 pinned"; exits 1 on an untrusted `mise.toml`; exits 1 when an archived change has an unticked task; `SKIP_OPENSPEC=1` no longer skips. |
| 1.3 | none | `openspec update --dry-run`: "No file in this folder would change." The repository vendors no OpenSpec skills. |
| 2.1 | `openspec/config.yaml`, `AGENTS.md`, `README.md` | `openspec instructions apply` and `openspec instructions archive` each return the new `operationGuidance` line. |
| 3.1 | all | Independent review approved with nits only; two doc nits fixed. `./scripts/check` passed in full: helper 18, installer 73, extension unit 30, headless Chromium 82, `validate --all --strict` 5 of 5, `validate --archived --strict` 8 of 8. |
