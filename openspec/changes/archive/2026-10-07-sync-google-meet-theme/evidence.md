# Evidence

Traceability from requirement to implementation, verification and result.
Commands run from the repository root on enceladus (Omarchy, Chromium
153.0.8010.52, Node 26.10.0), 7 October 2026.

## app-adapters

| Requirement / scenario | Implementation | Verification | Result |
| --- | --- | --- | --- |
| Minimal extension access: manifest audit (three origins) | `extension/manifest.json` | `tests/extension`: `content scripts match only the adapter origins…`, `manifest requests only nativeMessaging and storage` | Pass |
| Independent adapters: disable Meet only | options page (unchanged, lists adapters from the manifest) | e2e `adapters toggle independently and live from the options page` (Meet listed, toggled off reverts page and call screen, Slack and Notion unaffected) | Pass |
| Mode gating: Meet under a dark palette | `adapters/meet/adapter.css` (every-element rule, remap block, `color-scheme`), `adapter.js` (`modePolicy: 'any'`, mode from `--ws-sys-color-extended-blue-fill`) | e2e `meet: a dark palette themes the pages and the call screen and remaps status colours` (container with an invented class takes the palette; options page reports remapping) | Pass |
| Mode gating: Meet under a light palette | `adapter.css` page-level rule | e2e `meet: a light palette themes the pages and leaves the call screen dark` | Pass |
| Mode gating: dark Meet page under a dark palette keeps status colours | `adapter.js` mode detection | e2e `meet: a dark Meet page under a dark palette keeps its own status colours` | Pass |
| Meet in either palette mode: dark Meet page under a light palette | `adapter.js` (no mode when the page is dark and the palette light) | e2e `meet: a light palette themes the pages and leaves the call screen dark` (`?mode=dark` page stays inactive with Meet's colours) | Pass |
| Palette transport (scenarios generalised to any matching page) | unchanged | `tests/e2e/transport.test.mjs`, unchanged | Pass |
| Preserved meaning: Meet named colour | `adapter.css` leaves `--ws-sys-color-extended-*` (except grey), genai and premium tokens | e2e dark and light Meet tests assert blue fill and gradient keep Meet's per-container values (gradient asserted in both) | Pass |
| No generated class selectors | `adapter.css` matches only `html`, `body`, `body *` | fixture uses invented container classes; review of selectors | Pass |
| Readable contrast: Meet | `adapter.css` (background as ink on accent fills) | e2e contrast matrix, 22 stock themes, Meet page checks plus call screen and remapped status under dark palettes, Meet's own status colours under light palettes | Pass (23/23) |

## Restructured requirements (task 4.2)

| Requirement / scenario | Verification | Result |
| --- | --- | --- |
| Slack in either mode: returns to the palette's mode | e2e `slack: a different app mode keeps theming and remaps status colours` (flips back, error text returns to Slack's) | Pass |
| Preserved Slack colours: badge while remapped | same test and `slack: a light palette over Slack in Dark…` (red and white badges keep Slack's values) | Pass |
| Mode resolution: unrecognised declared mode | `tests/host` `test_mode_matches_omarchy_resolution` (`mode = "sepia"` over a light background is dark) | Pass |
| Clean removal (reworded) | `tests/install` uninstall tests, unchanged | Pass |

## Live check (task 3.1)

Real signed-out `https://meet.google.com/abc-defg-hij` in the throwaway e2e
profile with the extension and a synthetic palette (Tokyo Night dark, Latte
light):

- Dark: `data-omarchy-adapters="meet"`, `data-omarchy-remap="meet"`; the
  pre-join dialog, its filled button and link took the palette (screenshot
  compared with the adapter off). The "can't join" page backdrop
  (`background: #fff` on a generated class) and two headings use fixed
  colours and stay Meet's.
- Light: adapter active, no remap; the dialog took the palette surface,
  text and accent.
- Style cost under a dark palette, page padded to 5,214 elements, median of
  seven runs of ten forced full recalculations: 15.0 to 17.3 ms with the
  adapter, 7.7 ms without.
- Not reachable signed out: the signed-in home page and the call screen.

## Independent review

One review round (7 October 2026) raised four medium findings: a dark Meet
page under a light palette would be turned light; `./scripts/check` failed
until specs were synced; the README understated the every-element cost; and
design.md contradicted the code on mode detection and ink. All four were
fixed, along with the low findings on hex parsing, missing `-rgb` triplets
for text tokens, an options assertion that Slack could satisfy, the gradient
under a light palette and stale spec wording. Left as documented gaps:
container `-rgb` triplets behind `color-mix()` tints and the unmeasured
in-call style cost.

## Test harness fix found on the way

`tests/e2e/browser.mjs` now passes `--disable-extensions-except` for the
extension under test. On enceladus the 1Password package registers an
external extension (`/usr/share/chromium/extensions/`) that installs into
every new profile and opens a welcome tab, which hid test pages and made
`slack: a mode marker below <body> is still picked up by the fallback poll`
fail on `main` as well.
