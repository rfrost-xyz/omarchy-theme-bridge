# Spec Delta

## Purpose

Install and remove the helper and extension for one user and Chromium only, showing every change and leaving Omarchy and existing browser configuration intact.

## ADDED Requirements

### Requirement: Transparent per-user install
The installer SHALL support a dry run that lists every file it would write and every configuration line it would change, without printing unrelated configuration lines. It SHALL install only under the user's home: the extension and helper under `~/.local/share/omarchy-webapp-theme/` and one native messaging manifest under `~/.config/chromium/NativeMessagingHosts/`.

#### Scenario: Dry run
- **WHEN** the installer runs with `--dry-run`
- **THEN** it prints every planned file (including the ownership marker and the flags record) and changed line, and writes nothing; the uninstaller's dry run also writes nothing

#### Scenario: Install
- **WHEN** the installer runs
- **THEN** it writes only the planned files and the manifest allows only this extension's fixed ID

#### Scenario: Unsafe install path
- **WHEN** the install directory is relative, or contains whitespace, commas, quotes, backslashes, `#` or control characters
- **THEN** a relative directory is refused, and otherwise the flags file is left unchanged with instructions to load the extension unpacked

### Requirement: Omarchy configuration preserved
The installer SHALL NOT modify Omarchy-managed files, browser policies, themes, hooks or other browsers. Editing `~/.config/chromium-flags.conf` SHALL be opt-in, SHALL append this extension's path to the existing single `--load-extension=` list (or add the line when absent), SHALL keep every other line, symlink and file mode, and SHALL NOT duplicate the entry.

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
The uninstaller SHALL remove only what the installer added, including its flags entry, and SHALL restore the flags file byte for byte, including line endings, the final newline and an originally empty `--load-extension=` list, when nothing else has changed that line since installation. If something has (such as an Omarchy migration), it SHALL remove only this extension's entry and keep the later additions. If the flags file cannot be written, it SHALL keep its files and explain how to remove the entry by hand.

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
