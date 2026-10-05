# Spec Delta

## Purpose

Apply the Omarchy palette to the Notion and Slack web apps in Chromium, including app-mode windows, through small per-app adapters over a shared palette transport.

## ADDED Requirements

### Requirement: Minimal extension access
The extension SHALL request only the `nativeMessaging` and `storage` permissions and SHALL run content scripts only on `https://app.notion.com/*` and `https://app.slack.com/*`.

#### Scenario: Manifest audit
- **WHEN** the packaged manifest is inspected
- **THEN** it lists exactly those permissions, no `host_permissions`, and content script matches only for those two origins

### Requirement: Palette transport
The extension SHALL keep a connection to the helper, store the last good palette and helper status, and expose the palette to matching pages as `--omarchy-*` CSS custom properties with derived helper values. Pages SHALL receive changes without reloading.

#### Scenario: Initial load
- **WHEN** a Notion or Slack page loads and a palette is stored
- **THEN** the palette properties are present before the adapter activates

#### Scenario: Live theme change
- **WHEN** the helper sends a new palette
- **THEN** every open matching page, including `--app` windows, updates without reload

#### Scenario: Helper reconnection
- **WHEN** the helper exits or the extension service worker is stopped
- **THEN** the extension reconnects with backoff, or when a matching page loads, regains focus or becomes visible, and later theme changes still reach open pages

#### Scenario: Extension reloaded
- **WHEN** the extension is reloaded or removed while Notion or Slack pages are open
- **THEN** those pages drop every palette property, attribute and adapter style rather than keeping a stale palette

#### Scenario: Browser restart
- **WHEN** Chromium starts with matching pages restored
- **THEN** the cached palette is applied immediately and refreshed once the helper reconnects

### Requirement: Independent adapters
Notion and Slack adapters SHALL be enabled and disabled independently from the extension options page, and disabling one SHALL remove its styling from open pages without reload.

#### Scenario: Disable Slack only
- **WHEN** the Slack adapter is disabled
- **THEN** Slack pages revert to Slack's own colours and Notion pages remain themed

### Requirement: Mode gating
An adapter SHALL apply only while the app's own light or dark mode matches the palette mode, and SHALL re-evaluate when either changes. The extension SHALL NOT fake the page's colour scheme preference.

#### Scenario: Mismatched mode
- **WHEN** the palette is light and Notion is showing its dark theme
- **THEN** the Notion adapter stays inactive and the options page reports the mismatch

#### Scenario: Matching mode
- **WHEN** the app's mode and the palette mode agree
- **THEN** the adapter maps the palette onto the app's surfaces, text, borders, menus, dialogs, sidebars and code blocks

### Requirement: Semantic mapping and preserved meaning
Adapters SHALL override the apps' semantic colour variables rather than layout selectors. The Notion adapter SHALL NOT change authored block colour families other than neutral grey, or the primary button blue that sits under white labels. The Slack adapter SHALL NOT change success, warning, important, education or presence colours.

#### Scenario: Authored Notion colour
- **WHEN** a Notion block uses a red background colour
- **THEN** it keeps Notion's red for the current mode

#### Scenario: Slack status colour
- **WHEN** Slack shows an important or success state
- **THEN** it keeps Slack's own colour for the current mode

### Requirement: Readable contrast
For every stock Omarchy theme, mapped primary text SHALL reach at least 4.5:1 against mapped primary, secondary and popover surfaces, secondary text and accent text at least 4.5:1 against the primary surface, and tertiary text at least 3:1.

#### Scenario: Contrast matrix
- **WHEN** the adapters are rendered against each stock Omarchy palette
- **THEN** every measured pair meets its threshold
