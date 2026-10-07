# Design

## Context

Observed on 7 October 2026 in a throwaway headless Chromium profile, signed
out, on `https://meet.google.com/<code>` (the "can't join" and pre-join
pages), with `prefers-color-scheme` emulated as dark and as light:

- Meet colours its Material 3 components from `--gm3-sys-color-*` tokens
  (surface, surface containers, on-surface, outline, primary, secondary,
  tertiary, error, inverse and their `-rgb` triplets). A light set is
  declared on `body`; an always-dark set is declared on a generated container
  class for the call screen, and a few other generated classes redefine one
  or two tokens locally (dark surfaces over video).
- Older components use `:root` variables: `--gm-*` (background, text,
  hairline, theme colour) and `--hotlane-*`, which the dark container also
  redefines.
- `--ws-sys-color-extended-*` (named blue, green, red and other families) and
  `--ws-sys-color-genai-*` / `-premium-*` gradients carry Meet's own meaning.
- Meet's pages do not follow `prefers-color-scheme`: they stayed light with
  dark emulated. The call screen is dark whatever the setting.

The signed-in home page and the in-call DOM could not be observed without an
account and a live meeting.

## Decisions

- **Mode.** The adapter uses `modePolicy: 'any'`, like Slack: Meet cannot
  follow the palette, so it is themed in either palette mode. It reads Meet's
  page-level mode from `--ws-sys-color-extended-blue-fill` on `body`, a named
  colour the adapter never sets (light blue means dark), so the reading is
  Meet's own even while the adapter is active. Until that token resolves it
  reports no mode and waits. A page that is dark as a whole under a light
  palette may be the call screen, so the adapter reports no mode and leaves
  it to Meet rather than turning it light.
- **Light palette: page level only.** Tokens are set on `html` and `body`.
  The light pages inherit them; elements that redefine tokens (the call
  screen and its local dark surfaces) keep Meet's dark values. Turning the
  call screen light would put dark captions, controls and scrims over video,
  so the dark call screen is treated as meaning to preserve. Meet's own error
  and success colours stay, because Meet is light here too.
- **Dark palette: every element.** The same tokens are set with `!important`
  on `body` and every descendant (`body *`). Important author declarations
  beat Meet's normal container rules whatever their selector, so the call
  screen and its local surfaces take the palette without naming any of
  Meet's generated classes. Error, error container and tertiary (success)
  move to the palette's readable red and green, as Slack does when modes
  differ; native controls follow the palette's dark mode.
- **Token mapping.** Surfaces map to the background and the neutral ramp,
  on-surface to `text`, on-surface-variant to `text-secondary`, outlines to
  the ramp, primary to `accent-text` with the palette background as ink on fills
  (readable by construction; `accent-ink` falls to 3.7:1 on Rose Pine), containers
  to accent tints with readable text, inverse tokens (snackbars, tooltips) to
  a raised palette surface with normal text. Secondary follows the accent,
  since Meet uses it for selected states. The `--ws-sys-color-extended-grey-*`
  family is neutral and follows the ramp; the other named families,
  gradients and premium accents stay Meet's.
- **No generated class selectors.** The adapter matches only `html`, `body`
  and `body *` under the extension's own attributes.
- **Cost.** `body *` with these declarations adds style work on every
  element. It applies only under dark palettes. Measured on the live
  signed-out page padded to about 5,000 elements, a full recalculation
  roughly doubles; every element that restyles pays more. The in-call cost
  is unmeasured.

## Risks

- Meet can rename tokens or move to other variables; the adapter then stops
  recolouring those parts and Meet's own colours return. The fixture records
  the token names used.
- The signed-in home page and the call screen are unverified until checked
  in a real session.
