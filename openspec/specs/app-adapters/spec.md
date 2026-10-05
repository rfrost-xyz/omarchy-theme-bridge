# app-adapters Specification

## Purpose
Apply the Omarchy palette to the Notion and Slack web apps in Chromium, including app-mode windows, through small per-app adapters over a shared palette transport.

## Requirements

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
Each adapter SHALL declare how it treats the app's own light or dark mode, and the extension SHALL re-evaluate when either mode changes. The Notion adapter, whose app follows the system appearance, SHALL apply only while Notion's mode matches the palette mode. The Slack adapter, whose browser app cannot follow the system appearance, SHALL apply in either mode and, when Slack's mode differs from the palette's, SHALL move Slack's meaning colours onto readable versions of the palette's hues. The extension SHALL NOT fake the page's colour scheme preference or operate the apps' settings.

#### Scenario: Mismatched mode in Notion
- **WHEN** the palette is light and Notion is showing its dark theme
- **THEN** the Notion adapter stays inactive and the options page reports the mismatch

#### Scenario: Mismatched mode in Slack
- **WHEN** the palette is light and Slack is set to Dark
- **THEN** Slack is themed with the palette, its error, success, warning and education colours use the palette's red, green, yellow and blue adjusted for contrast, native controls follow the palette's mode, and the options page says the status colours were remapped

#### Scenario: Matching mode
- **WHEN** the app's mode and the palette mode agree
- **THEN** the adapter maps the palette onto the app's surfaces, text, borders, menus, dialogs, sidebars and code blocks

### Requirement: Semantic mapping and preserved meaning
Adapters SHALL override the apps' semantic colour variables rather than layout selectors. The Notion adapter SHALL NOT change authored block colour families other than neutral grey, or the primary button blue that sits under white labels. While Slack's mode matches the palette's, the Slack adapter SHALL NOT change success, warning, important, education, badge or presence colours. It SHALL NOT change badge colours in either mode; when it remaps, success and anything else Slack draws in its success green keep a green hue from the palette.

#### Scenario: Authored Notion colour
- **WHEN** a Notion block uses a red background colour
- **THEN** it keeps Notion's red for the current mode

#### Scenario: Slack status colour
- **WHEN** Slack shows an important or success state
- **THEN** it keeps Slack's own colour for the current mode

### Requirement: Readable contrast
For every stock Omarchy theme, mapped primary text SHALL reach at least 4.5:1 against mapped primary, secondary and popover surfaces (including Notion's search dialog and Slack's navigation), secondary text and accent text at least 4.5:1 against the primary surface, tertiary text at least 3:1, and remapped Slack status text at least 4.5:1 against its own tinted background.

#### Scenario: Contrast matrix
- **WHEN** the adapters are rendered against each stock Omarchy palette
- **THEN** every measured pair meets its threshold
