## ADDED Requirements

### Requirement: X signed-in neutral colours
In X's signed-in client, the adapter SHALL translate only recognised native neutral colour declarations into palette variables, without selecting generated classes or changing layout. It SHALL preserve brand, status, badge and authored media colours, apply only in matching appearance, and restore declarations on disable or extension removal without overwriting later app changes.

#### Scenario: Signed-in matching appearance
- **WHEN** the signed-in client uses fixed neutral page, card, text and border colours in the palette's mode
- **THEN** the body, timeline, sticky headers, sidebar cards and neutral text use readable palette colours

#### Scenario: Protected colours remain live
- **WHEN** protected media or SVG colours come from shared rules, inherited sources, hover, focus, responsive rules or animations
- **THEN** those colours SHALL retain X's native cascade while ordinary neutral interface surfaces use the palette

#### Scenario: Dynamic signed-in content
- **WHEN** X adds or changes native neutral stylesheet or inline declarations on an open page
- **THEN** recognised neutral declarations follow the palette within one second without a reload

#### Scenario: Meaning and opposite appearance
- **WHEN** signed-in pages show coloured status, badges, media, inverted controls or explicitly opposite appearance colours
- **THEN** those colours remain app-owned

#### Scenario: Restore native declarations
- **WHEN** X is disabled, the palette mode differs or the extension is reloaded or removed
- **THEN** translated declarations restore their original values and priorities if still owned by the adapter, and later app edits are preserved

#### Scenario: Signed-in appearance detection
- **WHEN** the classic client changes its untouched inline body appearance
- **THEN** the adapter recognises native light and dark backgrounds, waits on unknown appearance and re-evaluates without changing X settings
