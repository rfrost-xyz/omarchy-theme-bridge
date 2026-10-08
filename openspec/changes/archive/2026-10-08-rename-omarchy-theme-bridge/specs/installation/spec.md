# Spec Delta

## MODIFIED Requirements

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

### Requirement: Clean removal
The uninstaller SHALL remove only what the installer added, including its flags entry. When nothing else has changed that line since installation, it SHALL restore the flags file byte for byte, including line endings, final newline and an originally empty `--load-extension=` list; otherwise it SHALL remove only this extension's entry and keep the later additions. If the flags file cannot be written, it SHALL keep its files and explain how to remove the entry by hand. It SHALL also remove a marked legacy `omarchy-webapp-theme` install by the same rules.

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

## ADDED Requirements

### Requirement: Legacy install migration
The installer SHALL migrate an install made under the former name `omarchy-webapp-theme` when its directory carries the legacy ownership marker. It SHALL remove the legacy `--load-extension` entry and add the new extension path in its place, carry the Grok record over so uninstall can still revert Grok's configuration, remove the legacy native host manifest only when it points at the legacy helper, and remove the legacy directory. The dry run SHALL list each of these steps. An unmarked legacy directory SHALL be left alone and reported. If the legacy flags entry cannot be edited safely, the installer SHALL change nothing and explain how to remove it by hand.

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
