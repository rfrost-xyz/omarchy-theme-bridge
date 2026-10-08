# grok-theme Specification

## Purpose
Make Grok Build follow the Omarchy theme through its terminal theme, with an opt-in, reversible edit of `~/.grok/config.toml`.

## Requirements

### Requirement: Grok follows the terminal palette
When the user opts in with `--grok`, the installer SHALL set `theme = "terminal"` in the `[ui]` table and `terminal_theme = true` in the `[features]` table of `~/.grok/config.toml`, so Grok Build draws its colours from the terminal palette that Omarchy manages. It SHALL change no other key, line or file in `~/.grok/`, and running it again SHALL change nothing.

#### Scenario: Opt in on an existing configuration
- **WHEN** the installer runs with `--grok` and `config.toml` already has `[ui]` and `[features]` tables with other keys and another theme
- **THEN** only the `theme` line and one `terminal_theme` line change, every other line is byte for byte the same, and the parsed document differs only in those two keys

#### Scenario: No configuration yet
- **WHEN** `~/.grok/config.toml` does not exist
- **THEN** the installer creates it containing only the two tables and keys

#### Scenario: Default install leaves Grok alone
- **WHEN** the installer runs without `--grok`
- **THEN** nothing under `~/.grok/` is created or changed

#### Scenario: Dry run
- **WHEN** the installer runs with `--dry-run --grok`
- **THEN** it prints only the Grok lines it would change and writes nothing

### Requirement: Unsafe Grok configuration left alone
The installer SHALL leave `config.toml` unchanged and explain why when it cannot edit it safely: CRLF line endings, multi-line strings, top-level dotted keys or inline tables for `ui` or `features`, duplicate table headers, or a file that does not parse. It SHALL verify after every edit that the parsed document equals the original with only the two keys set.

#### Scenario: Unsupported shape
- **WHEN** `config.toml` sets `ui.theme` as a top-level dotted key
- **THEN** the installer leaves the file unchanged, explains why and still completes the rest of the install

### Requirement: Reversible Grok configuration
The uninstaller SHALL revert each key the installer set only while that line is still what the installer wrote, restoring the original line or removing an added line, an added empty table header and a created empty file. When nothing else changed the file, it SHALL restore it byte for byte. It SHALL keep a theme the user later chose in Grok and SHALL NOT remove a key that already held the target value before installation.

#### Scenario: Uninstall restores the file
- **WHEN** the uninstaller runs after an install with `--grok` and nothing else changed `config.toml`
- **THEN** the file matches its pre-install bytes, mode and symlink, or is removed if the installer created it

#### Scenario: User picked another theme
- **WHEN** the user chose another theme in Grok after installation
- **THEN** the uninstaller keeps that theme line and reverts only the feature flag if it is still the installer's
