# Spec Delta

## MODIFIED Requirements

### Requirement: Transparent per-user install
The installer SHALL support a dry run that lists every file it would write and every configuration line it would change, without printing unrelated configuration lines. It SHALL install only under the user's home: the extension and helper under `~/.local/share/omarchy-webapp-theme/`, one native messaging manifest under `~/.config/chromium/NativeMessagingHosts/` and, only with `--grok`, the two Grok keys in `~/.grok/config.toml`.

#### Scenario: Dry run
- **WHEN** the installer runs with `--dry-run`
- **THEN** it prints every planned file (including the ownership marker and the flags and Grok records) and changed line, and writes nothing; the uninstaller's dry run also writes nothing

#### Scenario: Install
- **WHEN** the installer runs
- **THEN** it writes only the planned files and the manifest allows only this extension's fixed ID

#### Scenario: Unsafe install path
- **WHEN** the install directory is relative, or contains whitespace, commas, quotes, backslashes, `#` or control characters
- **THEN** a relative directory is refused, and otherwise the flags file is left unchanged with instructions to load the extension unpacked

### Requirement: Omarchy configuration preserved
The installer SHALL NOT modify Omarchy-managed files, browser policies, themes, hooks or other browsers. Editing `~/.config/chromium-flags.conf` SHALL be opt-in, SHALL append this extension's path to the existing single `--load-extension=` list (or add the line when absent), SHALL keep every other line, symlink and file mode, and SHALL NOT duplicate the entry. Editing `~/.grok/config.toml` SHALL be opt-in through `--grok` and SHALL follow the `grok-theme` capability.

#### Scenario: Opt-in flag merge
- **WHEN** the installer runs with `--load-extension-flag` twice
- **THEN** the flags file contains one `--load-extension=` line with the original entries followed by this extension once, and all other lines unchanged

#### Scenario: Switch shares a line
- **WHEN** the last `--load-extension` switch is indented or shares a line with other flags
- **THEN** the installer leaves the flags file unchanged, explains why and prints instructions for loading the extension unpacked

#### Scenario: CRLF flags file
- **WHEN** the flags file uses CRLF line endings
- **THEN** the installer leaves it unchanged, explains why and prints instructions for loading the extension unpacked

#### Scenario: Default install leaves flags alone
- **WHEN** the installer runs without `--load-extension-flag`
- **THEN** the flags file is byte-for-byte unchanged and setup instructions for loading the unpacked extension are printed
