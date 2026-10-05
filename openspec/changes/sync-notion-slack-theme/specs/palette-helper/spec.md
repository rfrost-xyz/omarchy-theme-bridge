# Spec Delta

## Purpose

Read the active Omarchy palette without side effects and deliver it to the browser extension whenever it changes, so web apps can follow the desktop theme without restarting Chromium.

## ADDED Requirements

### Requirement: Read-only palette source
The helper SHALL read only `theme/colors.toml` and `theme.name` beneath the Omarchy state directory (`~/.local/state/omarchy/current` by default). It SHALL NOT write files, run commands, follow requests to change themes or expose any other file content.

#### Scenario: Only palette data leaves the helper
- **WHEN** `colors.toml` contains unknown keys, non-colour values or a symlink to a non-palette file
- **THEN** the helper sends only whitelisted keys whose values are valid hex colours, or reports the file as malformed, and never echoes other content

#### Scenario: Unsupported requests are ignored
- **WHEN** the extension sends any message other than `{"type":"get"}`
- **THEN** the helper performs no action and sends nothing in reply

### Requirement: Palette validation and mode
The helper SHALL send a palette message containing the theme name, a mode of `light` or `dark`, and colours normalised to lower-case `#rrggbb`. `background`, `foreground` and `accent` SHALL be required. Mode SHALL come from the `mode` key, else a `light.mode` marker in the theme directory, else background luminance.

#### Scenario: Valid palette
- **WHEN** the active theme has a valid `colors.toml`
- **THEN** the helper sends `{"type":"palette", "name", "mode", "colors"}` with only valid colours

#### Scenario: Mode fallback
- **WHEN** `colors.toml` has no `mode` key and a light background
- **THEN** the palette mode is `light`

### Requirement: Missing and malformed palette reporting
The helper SHALL report `{"type":"status","state":"missing"}` when the palette has been absent for longer than a short grace period, and `{"type":"status","state":"malformed"}` when it cannot be parsed or lacks a required colour. It SHALL keep running and recover when a valid palette returns.

#### Scenario: Palette missing
- **WHEN** the theme directory or `colors.toml` stays absent beyond the grace period
- **THEN** the helper sends a missing status and the extension keeps the last good palette applied

#### Scenario: Palette malformed then fixed
- **WHEN** `colors.toml` becomes malformed and is later corrected
- **THEN** the helper sends a malformed status, then a palette message for the corrected file

### Requirement: Live change detection
The helper SHALL detect theme changes, including Omarchy replacing the whole theme directory, and send exactly one palette message per settled change without the browser restarting.

#### Scenario: Theme directory replaced
- **WHEN** Omarchy removes the theme directory, moves a new one into place and rewrites `theme.name`
- **THEN** the helper sends one palette message for the new theme within about two seconds, and no missing status

#### Scenario: Initial palette
- **WHEN** the extension connects
- **THEN** the helper sends the current palette (or a status) immediately

### Requirement: Connection lifetime
The helper SHALL exit when its standard input closes and SHALL use the native messaging framing (32-bit native-endian length prefix and UTF-8 JSON).

#### Scenario: Browser disconnects
- **WHEN** the extension disconnects or Chromium exits
- **THEN** the helper process exits without leaving child processes
