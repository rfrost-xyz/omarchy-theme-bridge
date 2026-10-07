# Spec Delta

## MODIFIED Requirements

### Requirement: Minimal extension access
The extension SHALL request only the `nativeMessaging` and `storage` permissions and SHALL run content scripts only on `https://app.notion.com/*`, `https://app.slack.com/*` `https://meet.google.com/*` and `https://git.squintopera.com/*`.

#### Scenario: Manifest audit
- **WHEN** the packaged manifest is inspected
- **THEN** it lists exactly those permissions, no `host_permissions`, and content script matches only for those four origins

### Requirement: Independent adapters
Notion, Slack, Google Meet and GitLab adapters SHALL be enabled and disabled independently from the extension options page, and disabling one SHALL remove its styling from open pages without reload.

#### Scenario: Disable Slack only
- **WHEN** the Slack adapter is disabled
- **THEN** Slack pages revert to Slack's own colours and Notion pages remain themed

#### Scenario: Disable Meet only
- **WHEN** the Meet adapter is disabled
- **THEN** Meet pages revert to Meet's own colours without reload

#### Scenario: Disable GitLab only
- **WHEN** the GitLab adapter is disabled
- **THEN** GitLab pages revert to their own colours without reload and other adapters stay themed

## ADDED Requirements

### Requirement: GitLab follows matching appearance
The GitLab adapter SHALL run only on `https://git.squintopera.com/*` and apply only while GitLab's appearance matches the palette. It SHALL theme semantic surfaces, text, links, borders, navigation, menus and neutral controls without changing GitLab's appearance settings.

#### Scenario: GitLab matching appearance
- **WHEN** GitLab is in the palette's light or dark mode
- **THEN** its interface uses the palette and changes update without reload

#### Scenario: GitLab mismatched appearance
- **WHEN** GitLab is in the opposite mode
- **THEN** styling is inactive and the options page reports the mismatch

#### Scenario: GitLab appearance changes
- **WHEN** GitLab changes its mode on an open page
- **THEN** styling activates or deactivates without reload

#### Scenario: Other GitLab origins
- **WHEN** a page is on gitlab.com or another self-managed GitLab origin
- **THEN** no palette or adapter script runs

### Requirement: Preserved GitLab meaning colours
The GitLab adapter SHALL preserve GitLab's status and pipeline colours, diff additions and deletions, syntax highlighting and authored label colours. Deliberately opposite-mode scoped containers SHALL keep GitLab's colours.

#### Scenario: Meaning colours while themed
- **WHEN** a themed GitLab page shows success, danger, warning, a pipeline status, a diff, syntax or an authored label
- **THEN** those meaning colours keep GitLab's values for the app's mode

#### Scenario: Opposite scoped container
- **WHEN** a themed GitLab page contains an explicitly opposite-mode container
- **THEN** the container keeps its own colour tokens

### Requirement: Readable GitLab interface
For every stock Omarchy theme, GitLab's mapped primary, secondary and link text SHALL reach at least 4.5:1 against their mapped surfaces, tertiary text at least 3:1, and mapped neutral button labels at least 4.5:1 against their fills.

#### Scenario: GitLab contrast matrix
- **WHEN** GitLab is rendered in matching appearance with each stock palette
- **THEN** text on the page, sidebar, menu, dialog, controls and selected navigation meets its threshold
