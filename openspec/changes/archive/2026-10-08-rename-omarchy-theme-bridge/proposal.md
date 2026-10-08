# Proposal

## Why

The project now themes Grok Build as well as Chromium web apps, so `omarchy-webapp-theme` no longer describes it. `omarchy-theme-hook` and `omarchy-theme-sync` are taken by existing Omarchy projects (the latter is credited in the README), and this project does not use Omarchy hooks. Rename it to `omarchy-theme-bridge` throughout, and migrate existing installs so nobody is left with two copies or a dangling native host.

## What Changes

- Rename the project, install directory (`~/.local/share/omarchy-theme-bridge/`), helper (`omarchy-theme-bridge-host`), native messaging host (`xyz.rfrost.omarchy_theme_bridge`), ownership marker, extension display name ("Omarchy Theme Bridge"), content script global and palette style element ID. The extension ID stays the same because it derives from the manifest key, so stored settings carry over.
- The installer migrates a legacy `omarchy-webapp-theme` install: it removes the legacy flags entry and re-adds the new path when the legacy install had one, carries the Grok record across, removes the legacy native host manifest and the legacy directory.
- The uninstaller also removes a leftover legacy install.
- Rename the GitHub repository and local checkout. Archived OpenSpec changes keep their historical names.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `installation`: new install paths, and migration of a legacy install.

## Impact

Identifiers across the extension, helper, installer, tests and documentation. Users who loaded the extension unpacked must load it again from the new path once. No permission, transport, adapter or Grok configuration changes.
