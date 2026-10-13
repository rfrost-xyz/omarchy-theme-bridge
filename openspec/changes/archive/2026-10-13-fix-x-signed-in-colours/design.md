# Design

## Context

Live inspection of the user's signed-in `x.com/home` on 13 October 2026 confirmed active X styling and matching light appearance with an Omarchy background of `#dfe4c4`. The root used that palette, but body and 42 visible native surfaces used white. The classic client has `#react-native-stylesheet`, neutral atomic declarations and inline colours. No posts, credentials or account data are needed for the fixture.

## Goals / Non-Goals

Support this X client within the existing origin-scoped adapter. Keep original semantic mapping for the public client, preserve meaning colours and avoid selector maintenance, layout changes, transport changes and a general stylesheet manager.

## Decisions

- Translate only colour-property/value pairs from X's native neutral allowlist. Read the inline native body background before styling to detect classic-client mode; never mutate that background declaration.
- Translate declarations in the explicitly identified React Native stylesheet and neutral inline styles. Keep selectors unchanged. Use palette-variable references with native fallbacks, scoped by active X appearance.
- Keep coloured brand/status declarations, pure white on-colour text, inverted button fills, gradients, media elements and unrecognised colours untouched. Preserve alpha for recognised neutral sticky surfaces.
- Record each changed value and priority. Restore only if the declaration is still the adapter's value, preserving later app changes. Release detached elements and restore orphaned styling when the extension context is invalidated.
- Protect media and SVG consumers of shared native rules by resetting private palette aliases in their semantic scopes, so translated declarations use their native fallbacks. Mirror original colour declarations in an owned inheritable custom property, including brand and status sources. Give only outer protected roots a zero-specificity inherited-colour default; descendants retain their parent's live cascade. Explicit inheritance uses a scoped native fallback. Hover, focus, responsive and animated colours stay live, without computed snapshots or physical-colour pins.
- Translate only recognised body inline foreground colours. Leave its inline background as the appearance signal, and retain unrecognised body colours. Preserve the original priority of owned custom properties separately from each source declaration's priority.
- Register only the original-colour proxy as an inheriting typed colour through the extension's CSS `@property` rule. Mirror native keyframe colour sources into that proxy without changing animation declarations. Mirror explicitly paired native colour transitions, retaining duration, delay and easing for existing properties and restoring owned declarations. No permanent runtime property registration is used.
- Observe new inline/style nodes and app changes; use a bounded one-second visible-page refresh for CSSOM insertions. Avoid changing React Native's stylesheet element or replacing its sheet, since the app can retain its CSSOM reference.

## Risks / Trade-offs

The classic client has no semantic tokens for these surfaces. The bounded translation adds app-specific declaration processing. Synthetic tests must cover CSSOM insertion, inline changes, priority preservation, live mode changes and teardown. Restrict recognised values by appearance so opposite surfaces and on-colour controls retain native values. Native transitions with cyclic timing lists supplied by separate rules can give the proxy a different timing index; paired declarations and colour animations are covered. Verify processing cost on the actual page before claiming live coverage.

## Migration Plan

Update the existing installed extension. A Chromium extension reload is needed to register changed scripts; browser automation cannot operate internal extension pages, so user interaction may be required. Reload X afterwards and inspect computed neutral surfaces without changing app settings or theme state.
