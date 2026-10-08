# Design

## Context

See proposal.md. Evidence gathered on 2026-10-08 against Grok 1.0.46 (`npm:@xai-official/grok`):

- The documentation embedded in the binary describes a `terminal` theme (aliases `terminal-default`, `transparent`, `native`) that uses the terminal's default foreground and background and its 16-colour ANSI palette, and is hidden until `[features] terminal_theme = true` or `GROK_TERMINAL_THEME=1`.
- In a pseudo-terminal with a throwaway `HOME`, `theme = "terminal"` alone rendered GrokNight (1,306 truecolour background sequences and an OSC 12 cursor colour). With the feature flag added, Grok emitted no truecolour sequences and no cursor colour, only default and ANSI indexed colours.
- `~/.config/ghostty/config` includes `~/.local/state/omarchy/current/theme/ghostty.conf`, and `omarchy-restart-terminal` (called by `omarchy-theme-set`) sends SIGUSR2 to Ghostty, SIGUSR1 to Kitty and touches the Alacritty config. Terminal palettes therefore change live, and Grok's colours with them.
- `GROK_THEME` and `LC_GROK_THEME` override the configured theme, and minimal mode (`--minimal`) ignores themes and already uses terminal colours.

## Goals / Non-Goals

Make Grok follow Omarchy with one reversible configuration edit. No Omarchy hook, no generated Grok theme (Grok cannot load custom palettes), no change to the native helper, which stays read-only and Chromium-only. No other terminal apps in this change.

## Decisions

- **Terminal theme, not a hook.** A `theme-set` hook mapping Omarchy themes to the nearest built-in would be approximate and would write Grok's configuration on every theme change. The terminal theme is exact for any Omarchy theme and needs one edit.
- **Interface.** `scripts/grok.py <add|remove> <config> <state> [--write]` prints only the lines it would change, or `unchanged`, and exits 3 when it refuses. `scripts/common.sh` defines `GROK_CONFIG=$HOME/.grok/config.toml`, `GROK_STATE=$DATA_DIR/grok-state.json` and a `grok_edit` wrapper, mirroring `flags_edit`. `install.sh --grok` and `uninstall.sh` call it; the installer staging step carries `grok-state.json` across reinstalls like `flags-state.json`.
- **Line edit with a parse check.** Python's `tomllib` cannot write, so the editor changes lines. It parses the file with `tomllib` before and after the edit and requires the result to equal the original document with only the two keys set. It refuses CRLF line endings, multi-line strings, top-level dotted keys or inline tables for `ui` or `features`, duplicate `[ui]` or `[features]` headers, and files that do not parse.
- **What is recorded.** For each key, the state records the original line (or that the key, its table or the file was absent) and the line the installer wrote. A key already holding the target value is recorded as untouched and never removed.
- **Reversal.** The uninstaller reverts a key only while its line is still exactly what the installer wrote. Grok rewrites `config.toml` when the user picks a theme in `/theme` or `/settings`; that choice is kept. A table header the installer added is removed only when the table is otherwise empty, and a file it created only when it is empty. When nothing else changed, the file is restored byte for byte.
- **Writes.** Write through symlinks to the target, keep the file mode, and replace atomically from a temporary file in the same directory. Create `~/.grok/` only when it is missing and the installer is creating the file.

## Risks / Trade-offs

- The feature flag belongs to a rollout and may be renamed or become default. The flag is harmless once the theme is general; documentation records how to check with `grok` and `/theme`.
- Contrast depends on the terminal profile, for example a very dark bright-black slot makes dividers faint. Omarchy's stock themes are tuned for terminals, so this is accepted and documented.
- `GROK_THEME` overrides configuration. Documented.

## Migration Plan

Run `./install.sh --grok` once and restart open Grok sessions. Remove with `./uninstall.sh`, or pick another theme in Grok's `/theme`, which the uninstaller then leaves alone.
