# Design

## Decisions

- **Run through `mise exec`.** The pin lives in `mise.toml`, so the gate runs
  `mise exec -- openspec` rather than relying on `PATH` order.
- **Check the running version.** With auto-install disabled, `mise exec` can
  fall back to an `openspec` on `PATH`. The gate compares
  `openspec --version` under `mise exec` with `mise current
  npm:@fission-ai/openspec` and fails on a mismatch, so it never validates
  with an unpinned version.
- **Archived validation.** Every archived change has all tasks ticked, so the
  gate also runs `openspec validate --archived --strict --no-interactive`.
- **No vendored skills.** The repository dropped its skill copies in #13.
  `openspec update --dry-run` under 2.1.1 reports no file in the repository
  would change; a real `openspec update` would only rewrite the global skills
  in `~/.agents/skills`, which are outside this repository.
