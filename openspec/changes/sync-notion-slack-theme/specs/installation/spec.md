# Spec Delta

## Purpose

Install and remove the helper and extension for one user and Chromium only, showing every change and leaving Omarchy and existing browser configuration intact.

## ADDED Requirements

### Requirement: Transparent per-user install
The installer SHALL support a dry run that lists every file it would write and every configuration line it would change, without printing unrelated configuration lines. It SHALL install only under the user's home: the extension and helper under `~/.local/share/omarchy-webapp-theme/` and one native messaging manifest under `~/.config/chromium/NativeMessagingHosts/`.

#### Scenario: Dry run
- **WHEN** the installer runs with `--dry-run`
- **THEN** it prints the planned files and changed lines and writes nothing

#### Scenario: Install
- **WHEN** the installer runs
- **THEN** it writes only the planned files and the manifest allows only this extension's fixed ID

### Requirement: Omarchy configuration preserved
The installer SHALL NOT modify Omarchy-managed files, browser policies, themes, hooks or other browsers. Editing `~/.config/chromium-flags.conf` SHALL be opt-in, SHALL append this extension's path to the existing single `--load-extension=` list (or add the line when absent), SHALL keep every other line, symlink and file mode, and SHALL NOT duplicate the entry.

#### Scenario: Opt-in flag merge
- **WHEN** the installer runs with `--load-extension-flag` twice
- **THEN** the flags file contains one `--load-extension=` line with the original entries followed by this extension once, and all other lines unchanged

#### Scenario: Switch shares a line
- **WHEN** the last `--load-extension` switch is indented or shares a line with other flags
- **THEN** the installer leaves the flags file unchanged, explains why and prints instructions for loading the extension unpacked

#### Scenario: Default install leaves flags alone
- **WHEN** the installer runs without `--load-extension-flag`
- **THEN** the flags file is byte-for-byte unchanged and setup instructions for loading the unpacked extension are printed

### Requirement: Clean removal
The uninstaller SHALL remove only what the installer added, including its flags entry, and SHALL restore the flags file byte for byte, including line endings, the final newline and an originally empty `--load-extension=` list.

#### Scenario: Uninstall after flag merge
- **WHEN** the uninstaller runs after an install with the flag merge
- **THEN** the flags file matches its pre-install content and the installed directory and manifest are gone

#### Scenario: Repeated uninstall
- **WHEN** the uninstaller runs when nothing is installed
- **THEN** it succeeds without changing anything
