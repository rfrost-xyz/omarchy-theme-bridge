# Proposal

## Why

The GitLab instance at git.squintopera.com currently keeps its own colours when Omarchy changes theme. An origin-scoped adapter will make its interface follow the same palette as the supported web apps.

## What Changes

- Add a GitLab adapter for `https://git.squintopera.com/*` using the instance's semantic colour tokens.
- Gate styling on GitLab's own light or dark mode, with System appearance recommended.
- Preserve status, pipeline, diff, syntax and authored label colours.
- Add synthetic Chromium coverage, stock-theme contrast checks and setup documentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-adapters`: extend the permitted origins, independent switches and semantic mapping to Squint Opera's GitLab instance.

## Impact

One adapter directory, one manifest entry, test fixtures and documentation. No runtime dependencies, transport changes, live profile changes or managed Omarchy configuration changes.
