## 1. Pin and gate

- [x] 1.1 Add `mise.toml` pinning OpenSpec 2.1.1 with telemetry off; verify `mise exec -- openspec --version` prints 2.1.1.
- [x] 1.2 Make `scripts/check` run strict `--all` and `--archived` validation through `mise exec`, failing when `mise` is missing or the version differs from the pin; remove `SKIP_OPENSPEC`. Verify each failure path and the pass.
- [x] 1.3 Confirm `openspec update` from 2.1.1 changes no file in the repository.

## 2. Guidance

- [x] 2.1 Add apply and archive guidance naming `./scripts/check` to `openspec/config.yaml`, a Specs paragraph to `AGENTS.md`, and update the README's check notes; verify the guidance appears in `openspec instructions apply`.

## 3. Verify delivery

- [x] 3.1 Run `./scripts/check` in full and obtain independent review.
