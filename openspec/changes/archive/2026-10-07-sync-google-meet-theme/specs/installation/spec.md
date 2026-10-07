## MODIFIED Requirements

### Requirement: Clean removal
The uninstaller SHALL remove only what the installer added, including its flags entry. When nothing else has changed that line since installation, it SHALL restore the flags file byte for byte, including line endings, final newline and an originally empty `--load-extension=` list; otherwise it SHALL remove only this extension's entry and keep the later additions. If the flags file cannot be written, it SHALL keep its files and explain how to remove the entry by hand.

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
