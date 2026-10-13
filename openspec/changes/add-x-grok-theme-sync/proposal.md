# Proposal

## Why

X and Grok.com currently retain their own colours when Omarchy changes theme. Extend the existing browser integration so both can follow the same palette as the supported web apps.

## What Changes

- Add independent adapters for `https://x.com/*` and `https://grok.com/*` using the existing palette transport.
- Map neutral interface colours while preserving authored content, media, status and meaning colours.
- Detect each app's untouched appearance markers, report mismatches and restore its colours when disabled.
- Add synthetic Chromium coverage for both modes, live updates, independent persistent switches, contrast and origin isolation.
- Document browser setup and distinguish Grok.com from the existing Grok Build terminal integration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-adapters`: add the two exact origins, independent controls and app-specific mapping and preservation requirements.

## Impact

New adapter directories, manifest entries, test fixtures, browser routing and documentation. Runtime permissions and dependencies, the native helper, palette transport and installer behaviour remain unchanged.
