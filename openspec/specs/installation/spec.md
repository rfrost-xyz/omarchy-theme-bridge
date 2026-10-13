# installation Specification

## Purpose
Install and remove the helper and extension for one user and Chromium only, showing every change and leaving Omarchy and existing browser configuration intact.

## Requirements

### Requirement: Transparent per-user install
The installer SHALL support a dry run that lists every file it would write and every configuration line it would change, without printing unrelated configuration lines. It SHALL install only under the user's home: the extension and helper under `~/.local/share/omarchy-theme-bridge/`, one native messaging manifest under `~/.config/chromium/NativeMessagingHosts/` and, only with `--grok`, the two Grok keys in `~/.grok/config.toml`.

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

### Requirement: Clean removal
The uninstaller SHALL remove only installer additions, including its flags entry and marked legacy `omarchy-webapp-theme` installs. If the flags line is unchanged since install, it SHALL restore the file byte for byte, including line endings, final newline and an originally empty `--load-extension=` list; otherwise it SHALL retain later additions. If the flags file is unwritable, it SHALL keep its installed files and explain manual entry removal.

#### Scenario: Uninstall after flag merge
- **WHEN** the uninstaller runs after an install with the flag merge
- **THEN** the flags file matches its pre-install content and the installed directory and manifest are gone

#### Scenario: Omarchy appended an extension after install
- **WHEN** an Omarchy migration appended another extension to the `--load-extension=` line after installation
- **THEN** the uninstaller removes only this extension's entry and the line matches what the migration would have produced without it

#### Scenario: Entry cannot be removed
- **WHEN** the flags file still names the installed extension on a line the uninstaller cannot edit safely
- **THEN** the uninstaller keeps the installed files, explains how to remove the entry and exits with an error

#### Scenario: Repeated uninstall
- **WHEN** the uninstaller runs when nothing is installed
- **THEN** it succeeds without changing anything

#### Scenario: Legacy install left over
- **WHEN** the uninstaller runs and a marked legacy `~/.local/share/omarchy-webapp-theme/` install exists
- **THEN** its flags entry, native host manifest and directory are removed as well

### Requirement: Legacy install migration
For marked legacy `omarchy-webapp-theme` installs, the installer SHALL replace the flags entry with the new path, carry over the Grok record for uninstall, remove the directory and remove the native host manifest only if it points at the legacy helper. Dry runs SHALL list every step. Unmarked legacy directories SHALL remain untouched and be reported. Unsafe legacy flag edits SHALL leave everything unchanged with manual removal instructions.

#### Scenario: Migrate a flags install
- **WHEN** the installer runs over a legacy install that added a `--load-extension` entry
- **THEN** the flags line names the new extension path instead of the legacy one, the legacy directory and manifest are gone, and the new install is in place

#### Scenario: Migrate the Grok record
- **WHEN** the legacy install recorded a Grok configuration edit
- **THEN** after migration the uninstaller still reverts Grok's configuration exactly

#### Scenario: Migration dry run
- **WHEN** the installer runs with `--dry-run` over a legacy install
- **THEN** it lists the legacy items it would remove or move and changes nothing

#### Scenario: Unmarked legacy directory
- **WHEN** `~/.local/share/omarchy-webapp-theme/` exists without the legacy marker
- **THEN** the installer leaves it alone and says so

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
