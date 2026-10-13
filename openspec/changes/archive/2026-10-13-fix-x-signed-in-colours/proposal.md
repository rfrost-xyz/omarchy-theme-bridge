# Proposal

## Why

The signed-in X timeline uses fixed React Native neutral colours and inline body styles instead of the semantic tokens inspected on its public page. The adapter currently themes the root while the body, timeline and sidebar cards remain white.

## What Changes

- Translate a bounded set of X's native neutral colour declarations into palette variables in the X adapter.
- Keep app selectors and layout unchanged, preserve coloured meaning and media, and restore original declarations on disable or extension removal.
- Read the classic client's untouched inline body appearance and handle dynamically inserted neutral declarations.
- Add a synthetic signed-in-client fixture and regression coverage, update setup limitations and verify the installed correction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-adapters`: X's signed-in fixed neutral colours follow matching palettes through its app-specific reversible translation.

## Impact

Only the X adapter, its fixtures/tests and documentation change. Origin scope, permissions, other adapters, palette transport and the native helper stay unchanged. The correction is added to PR #11.
