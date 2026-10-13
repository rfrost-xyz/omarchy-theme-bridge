# Design

## Context

The shared content script already validates palettes, publishes CSS properties, gates adapters by app mode, restores styling on disable or extension removal and persists switches. Options discover adapters from the manifest. Public pages inspected on 2026-10-13 expose semantic tokens: X uses `--x-*` and a root `data-theme`; Grok.com uses `--surface-*`, `--fg-*`, `--border-*`, `--input-*`, `--button-*` and root `light`/`dark` classes.

## Goals / Non-Goals

Implement both sites through the existing adapter interface with no transport changes. Limit Chromium matches to the exact two requested hosts. Keep the Grok.com browser adapter separate from Grok Build's opt-in terminal integration. No settings automation, general stylesheet engine or runtime dependencies are required.

## Decisions

- **Semantic tokens:** scope each stylesheet to its active adapter attribute and map the observed neutral tokens to existing contrast-adjusted palette properties. Grok.com redeclares warm neutral tokens on the body, so map both root and direct body. Preserve named ramps, status, badge, branded and authored-content tokens. A broad descendant colour rewrite would erase meaning and is excluded.
- **Matching modes:** recognise only X's `data-theme="light"`/`"dark"` and Grok.com's unambiguous `light`/`dark` classes. Unknown values return no mode. Remapping in the opposite mode would risk app-owned status colours, so the adapter waits and reports the mismatch. The existing fallback poll detects X attribute changes without changing transport.
- **Neutral compatibility:** include X's observed legacy neutral HSL slots alongside its newer semantic tokens where they are consumed by the current public stylesheet. Only the page root may directly consume a mapped background to replace X's fixed root backdrop; no generated classes or layout properties are changed.
- **Surface contrast:** cap neutral fills at mix8 so inherited secondary, tertiary and accent text stay inside the shared derivation's readable surfaces, including pressed and deepest hover states. Border ramps may remain stronger.
- **Dependent branded tint:** X's `--x-brand-subtle` mixes brand colour against its neutral primary background. Preserve the tint's original white/black base explicitly in matching modes so neutral palette mapping does not alter it indirectly.
- **Evidence and tests:** derive fixtures from the public token declarations and representative consumers, without saving account data. Run both app-specific behavioural tests and the stock-theme contrast matrix. The parent owns the manifest, harness routes, shared tests and documentation; each implementation subagent owns one adapter and its fixtures/tests.

## Risks / Trade-offs

- Public stylesheet drift can leave new app surfaces unchanged. Record inspected sources and expose independent switches; signed-in workflows need separate live verification.
- Tokens may be referenced by meaning colours. Check dependency closure before choosing neutral overrides and compare preserved colours with the adapter disabled.
- X appearance changes can take up to the existing two-second visible-page polling interval. Preserve the shared transport boundary.

## Migration Plan

Install the updated extension through the existing installer and reload the extension and open X/Grok.com pages once. Existing switches persist through the fixed extension ID; the new adapters default to enabled. Disable either switch to restore that site's styling. No live configuration changes are part of implementation.
