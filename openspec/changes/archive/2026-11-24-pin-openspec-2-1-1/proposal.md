# Proposal

## Why

`scripts/check` ran whichever `openspec` was on `PATH` and skipped validation
when `SKIP_OPENSPEC=1` was set, so the gate could pass without running, or
under a different OpenSpec version on each machine. The team standard pins
OpenSpec 2.1.1 and requires strict validation that cannot be skipped.

## What Changes

- Add `mise.toml` pinning `npm:@fission-ai/openspec` to 2.1.1, with
  `OPENSPEC_TELEMETRY=0`.
- `scripts/check` runs `openspec validate --all --strict --no-interactive`
  and `openspec validate --archived --strict --no-interactive` through
  `mise exec`. It fails with a clear message when `mise` is missing or the
  running OpenSpec is not the pinned version. **BREAKING** for local use:
  `SKIP_OPENSPEC=1` no longer skips validation.
- `openspec/config.yaml` gains apply and archive guidance naming
  `./scripts/check`.
- `AGENTS.md` gains a short Specs paragraph pointing at `openspec/` and
  `openspec/config.yaml`.
- `README.md` drops the `SKIP_OPENSPEC=1` note and lists `mise` for the checks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is tooling only; no extension, helper or installer behaviour
changes, so the change sets `skip_specs: true`.

## Impact

`mise.toml`, `scripts/check`, `openspec/config.yaml`, `AGENTS.md`,
`README.md`. Running the checks now needs `mise` with OpenSpec 2.1.1
installed (or auto-install enabled). The repository vendors no OpenSpec
skills; they stay global in `~/.agents/skills`.
