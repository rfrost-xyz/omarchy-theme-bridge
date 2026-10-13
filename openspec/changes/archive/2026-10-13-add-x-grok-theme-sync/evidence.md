# Evidence

## Sources and scope

Public signed-out pages and their current primary stylesheets were inspected on 13 October 2026:

- X: `https://x.com/`, `https://abs.twimg.com/x-web/x-web/assets/styles-xqUjldZF.css`; root `data-theme`, semantic `--x-*` tokens and neutral HSL consumers.
- Grok.com: `https://grok.com/`, `https://cdn.grok.com/_next/static/chunks/01_1py3b_-l92.css`; root light/dark classes and semantic tokens redeclared on the body.

Reversible synthetic light-palette styling probes on both public pages confirmed mapped page/text colours; X's QR popup and cookie buttons, and Grok.com's composer, also followed the palette. App-owned brand/status tokens remained intact. Injected styles and attributes were removed and sampled original computed colours restored. No account, settings or storage changes were made. These probes exercise the mappings; extension transport is verified with synthetic Chromium pages. Signed-in timelines, conversations and account-only screens remain unverified live. X's fixed heading and primitive borders remain app-owned.

## Requirement coverage

| Requirement / scenario | Implementation | Verification |
| --- | --- | --- |
| Minimal access, exact origins | `extension/manifest.json` | Manifest audit; X/Grok negative-origin tests |
| Independent persistent switches | Manifest discovery in options; adapter attributes | App-specific disable/reload tests; `x-grok-transport.test.mjs` browser restart and cached palette |
| Matching appearance, unknown markers and changes | Each `adapter.js`, existing registry | X light/dark/dim/unknown transitions; Grok light/dark/absent/ambiguous transitions |
| Live updates and helper transport | Existing read-only helper and shared content script | Each app's palette tests; helper-driven `x-grok-transport.test.mjs` verifies both pages without reload |
| Semantic mapping and preserved meaning | Each scoped `adapter.css` | Light/dark resolved-colour comparisons with disabled app, authored media and gradients; inserted-content tests |
| Readable interfaces | Contrast-adjusted palette tokens, paired neutral controls | Stock-theme Chromium matrix; neutral fills capped at mix8 and deepest/pressed primary, secondary, tertiary and link text checked |
| Extension reload teardown | Existing content-script teardown | `reload.test.mjs` verifies both new pages lose the palette and adapter attributes |

## Verification results

- X focused Chromium tests: 7 passed.
- Grok.com focused Chromium tests: 6 passed.
- Helper/restart integration test: passed after normalising resolved RGB and relative-HSL channels.
- CSS relative HSL without percentage calculations is supported from Chromium 119, within the extension's existing minimum version 120: [Chrome documentation](https://developer.chrome.com/blog/css-relative-color-syntax).
- Full `./scripts/check`: passed, including 18 helper, 69 installer, 29 extension unit and 68 Chromium tests with zero skips. The matrix covers all 23 stock themes, including secondary, tertiary and link text on deepest/pressed neutral surfaces. Strict OpenSpec validation passed every active change and canonical spec. Two untouched installer descriptions initially exceeded the current validator's length limit; concise equivalent wording resolved those failures and passed focused review.
- Independent review: approved with no open high or medium findings. Review found secondary/tertiary contrast on deeper and pressed surfaces and X's dependent branded tint; both were corrected with regression coverage. Independent maths passed all 368 stock-theme primary/secondary/tertiary/accent combinations across mapped background, mix3, mix4 and mix8 surfaces.

All browser tests use throwaway profiles, synthetic fixtures and temporary theme state. Helper, transport, browser permissions and live installation are unchanged.
