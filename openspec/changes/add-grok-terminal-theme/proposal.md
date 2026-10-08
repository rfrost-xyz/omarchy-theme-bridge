# Proposal

## Why

Grok Build (`grok`, xAI's terminal coding agent) keeps its own built-in colours when Omarchy changes theme. Grok 1.0.46 ships a `terminal` theme that paints no backgrounds and takes every colour from the terminal's default foreground, background and 16-colour ANSI palette. Omarchy already rewrites and reloads the terminal palette (Ghostty, Kitty, Alacritty) on every theme change, so selecting that theme makes Grok follow Omarchy live, with no hook or background process. The theme is still rolling out and needs `[features] terminal_theme = true` to be recognised; without it Grok silently falls back to GrokNight.

## What Changes

- Add an opt-in `--grok` installer switch that sets `[ui] theme = "terminal"` and `[features] terminal_theme = true` in `~/.grok/config.toml`, editing only those two lines and recording what they were.
- The uninstaller reverts each key only while it still holds the installer's value, restoring the file byte for byte when nothing else changed it, and leaves a theme the user later picked in Grok alone.
- Refuse, and leave the file untouched, when the configuration has a shape a line edit cannot change safely.
- Widen the project scope from Chromium web apps to Omarchy theme sync for apps that cannot follow it themselves, starting with Grok. The native helper, extension permissions and adapters are unchanged.

## Capabilities

### New Capabilities

- `grok-theme`: opt-in, reversible Grok Build configuration that makes Grok draw from the Omarchy-managed terminal palette.

### Modified Capabilities

- `installation`: the install footprint and the preserved-configuration rule now include the opt-in Grok configuration edit.

## Impact

One stdlib Python editor (`scripts/grok.py`), installer and uninstaller switches, synthetic installer tests and documentation. No runtime dependencies, no Omarchy hooks, no change to the helper, transport, adapters or extension permissions. Grok itself is not required to run the checks.
