# Evidence

## Scope and source inspection

On 13 October 2026, read-only inspection of the signed-in Chromium Default X
timeline confirmed a matching light palette (`#dfe4c4`) and active X adapter,
but a white body and 42 native white surfaces. The classic client uses
`#react-native-stylesheet` and inline colours; its root semantic tokens do not
control those surfaces. The fixture contains invented content and class names.

This correction extends only the existing X adapter. Manifest permissions,
origins, palette transport, helper and Grok.com styling are unchanged.

## Requirement trace

| Scenario | Implementation | Verification |
| --- | --- | --- |
| Signed-in matching appearance | X native neutral property/value allowlist and private palette aliases | Native light/dark body, timeline, sidebar, sticky, text and border checks; all 23 stock palettes in contrast matrix |
| Protected colours remain live | Protected alias scopes, zero-specificity outer-root default, typed original-colour proxy and native keyframe shadows | Shared/inherited media and SVG comparisons; hover, focus, responsive and nested inheritance; ancestor animation at 0, 250, 500 and 1000 ms; paired colour transitions |
| Dynamic signed-in content | Mutation queue and visible one-second native CSSOM refresh | Inserted rule/element, inline edits and subsequent palette change |
| Meaning and opposite appearance | Appearance-specific neutral allowlist and protected media fallbacks | Brand, status, badges, inverted controls, media, gradients and opposite-mode comparisons against disabled adapter |
| Restore native declarations | Value/priority ownership records, invalid-context teardown and detached source release | Disable, mismatch and runtime reload; border-side edit, later important app colour, private-property collision and priority checks |
| Signed-in appearance detection | Untouched body inline background, with public-client root fallback | Stale root versus dark body; light/dark changes, unknown dim appearance and return to matching mode |

## Review and verification

- Initial focused native and reload run: 12 passed, zero failures.
- Inherited ancestor animation correction: sampled native interpolation passed.
- Paired native colour and all-property transition regression: passed after
  waiting for fixture setup transitions to settle before changing app state.
- Three full independent review rounds identified shared media declarations,
  frozen pseudo-state snapshots and inherited ancestor animation. Each was
  corrected. The final focused re-check resolved the last medium finding and
  found no new actionable high or medium finding. It inspected passing logs;
  it did not independently rerun tests.
- Final `./scripts/check`: passed with 18 helper, 69 installer, 29 extension
  unit and 81 Chromium tests, zero failures or skips. Strict OpenSpec
  validation passed all five active items. Log:
  `/tmp/x-native-reviewed-full.log`.
- Installed-file verification: all 18 extension files and the helper match
  the source byte for byte. Installed X script SHA-256:
  `9dca711356a8749d44bcff5e6db8ec1145e88c556de92a01cd11f7cdca8180dc`.

The adapter covers native colour animations and locally paired transition
declarations. Independently supplied cyclic timing lists remain a documented
limitation. All automated browser checks use throwaway profiles, synthetic
pages and temporary theme state. They do not touch live profiles or credentials.

## Installation and live acceptance

`./install.sh --dry-run` and `./install.sh` succeeded. The registered helper
points at the installed bridge binary and allows only the fixed extension
origin. Chromium's existing load list retains the three Omarchy extensions
and the bridge; flags and Grok configuration were unchanged by this update.

Live acceptance remains blocked on reloading Omarchy Theme Bridge in Chromium
Default, then refreshing X. The Chrome automation policy blocks internal
extension pages, so that reload requires user interaction. A post-install
read-only check still found no native-adapter marker and white body/timeline,
confirming the old page script remains loaded. The user was given the exact
reload steps. The observed signed-in timeline has been inspected, while live
verification of the installed correction and other account screens remain
unverified.
