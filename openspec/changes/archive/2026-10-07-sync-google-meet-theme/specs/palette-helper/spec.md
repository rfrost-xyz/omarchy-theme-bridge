## MODIFIED Requirements

### Requirement: Palette validation and mode
The helper SHALL read `colors.toml` as Omarchy's own resolver does, skipping lines it cannot read and accepting quoted or unquoted values and the legacy `bg`, `fg` and ANSI `colorN` names. Keys are read with only spaces and quotes stripped, as Omarchy reads them. It SHALL send a palette message containing the theme name, a mode of `light` or `dark`, and colours normalised to lower-case `#rrggbb`. `background`, `foreground` and `accent` (falling back to `blue`) SHALL be required.

#### Scenario: Valid palette
- **WHEN** the active theme has a valid `colors.toml`
- **THEN** the helper sends `{"type":"palette", "name", "mode", "colors"}` with only valid colours

#### Scenario: Mode fallback
- **WHEN** `colors.toml` has no `mode` or `theme_type` key and a mid-tone background such as `#c8b89a`
- **THEN** the palette mode is `light`, as `omarchy-theme-color` reports

#### Scenario: Hand-written theme
- **WHEN** `colors.toml` uses single-quoted or unquoted values, `bg` and `fg` names, a section header or a line that is not `key = value`
- **THEN** the helper still sends the palette it can resolve

## ADDED Requirements

### Requirement: Mode resolution
The palette mode SHALL match Omarchy's desktop colour scheme: the `mode` key, else `theme_type`, else a `light.mode` marker, else light when the raw background value (then `bg`, then `color0`) is a six-digit hex colour whose red, green and blue sum to more than 382, else dark. Any declared value other than `light` means dark.

#### Scenario: Unrecognised declared mode
- **WHEN** `colors.toml` declares `mode = "sepia"` with a light background
- **THEN** the palette mode is `dark`, as `omarchy-theme-color` reports
