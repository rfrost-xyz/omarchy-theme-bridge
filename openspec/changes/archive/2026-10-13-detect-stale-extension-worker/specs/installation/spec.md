## ADDED Requirements

### Requirement: Update guidance
When the installer updates or migrates an existing install, it SHALL tell the user to reload Omarchy Theme Bridge in `chrome://extensions` in each Chromium profile that uses it, and SHALL NOT state that restarting Chromium applies the updated files.

#### Scenario: Reinstall while Chromium loads the extension
- **WHEN** the installer runs again over its own install and the flags file already loads the extension
- **THEN** it tells the user to reload the extension in `chrome://extensions` in each profile, says a restart alone keeps the previous background script, and does not offer a restart as an alternative

#### Scenario: Legacy migration through the flags file
- **WHEN** the installer migrates a legacy install whose flags entry it replaces
- **THEN** besides restarting Chromium for the new flag, it tells the user to reload the extension in `chrome://extensions` in each profile that uses it

#### Scenario: First install
- **WHEN** no install existed before
- **THEN** the installer gives the existing first-load instructions without the update reload notice
