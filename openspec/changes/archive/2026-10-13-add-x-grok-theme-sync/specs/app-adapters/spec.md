## MODIFIED Requirements

### Requirement: Minimal extension access
The extension SHALL request only the `nativeMessaging` and `storage` permissions and SHALL run content scripts only on `https://app.notion.com/*`, `https://app.slack.com/*`, `https://meet.google.com/*`, `https://git.squintopera.com/*`, `https://x.com/*` and `https://grok.com/*`.

#### Scenario: Manifest audit
- **WHEN** the packaged manifest is inspected
- **THEN** it lists exactly those permissions, no `host_permissions`, and content script matches only for those six origins

### Requirement: Independent adapters
Notion, Slack, Google Meet, GitLab, X and Grok.com adapters SHALL be enabled and disabled independently from the extension options page, and disabling one SHALL remove its styling from open pages without reload.

#### Scenario: Disable Slack only
- **WHEN** the Slack adapter is disabled
- **THEN** Slack pages revert to Slack's own colours and Notion pages remain themed

#### Scenario: Disable Meet only
- **WHEN** the Meet adapter is disabled
- **THEN** Meet pages revert to Meet's own colours without reload

#### Scenario: Disable GitLab only
- **WHEN** the GitLab adapter is disabled
- **THEN** GitLab pages revert to their own colours without reload and other adapters stay themed

#### Scenario: Persistent X and Grok.com switches
- **WHEN** either new adapter is disabled and its page or browser is reloaded
- **THEN** its own colours remain restored, its switch remains off and other adapters remain enabled

## ADDED Requirements

### Requirement: X and Grok.com follow matching appearance
The X and Grok.com adapters SHALL apply only while each app's detected appearance matches the palette's light or dark mode. They SHALL read appearance markers they do not override, wait while the mode is unknown, report mismatches and re-evaluate changes without modifying app settings.

#### Scenario: Matching appearance and live palette
- **WHEN** either app is in the palette's mode and the palette changes
- **THEN** neutral surfaces, text, borders, menus and controls update without a page reload

#### Scenario: Unknown or mismatched appearance
- **WHEN** either app has no recognised appearance marker or uses the opposite mode
- **THEN** its adapter remains inactive, its colours remain its own and the options page reports the reason

#### Scenario: App appearance changes
- **WHEN** either app's appearance changes on an open page
- **THEN** its adapter activates or deactivates within the existing appearance re-check interval without reloading

### Requirement: X and Grok.com preserve meaning
The X and Grok.com adapters SHALL map semantic neutral colour tokens and preserve authored media, status and destructive colours, syntax highlighting, badges and branded gradients. They SHALL avoid generated class selectors and layout changes. Newly inserted content SHALL use the same mapping as existing content.

#### Scenario: Meaning colours and inserted content
- **WHEN** themed pages show status, badges, media, syntax, branded gradients or newly inserted neutral content
- **THEN** meaning colours remain the app's own and inserted neutral content follows the palette

#### Scenario: Exact origin isolation
- **WHEN** pages load on Twitter, alternate X or Grok origins, lookalike hosts or unrelated sites
- **THEN** no new palette or adapter scripts run there

### Requirement: Readable X and Grok.com interfaces
For every stock Omarchy theme, mapped X and Grok.com primary, secondary and accent text SHALL reach at least 4.5:1 against their mapped surfaces, tertiary text at least 3:1 and mapped button labels at least 4.5:1 against their fills.

#### Scenario: New adapter contrast matrix
- **WHEN** X and Grok.com are rendered in matching appearance with each stock palette
- **THEN** page, secondary surface, menu, input and button text meet their thresholds
