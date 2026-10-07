# Evidence

## Scope and source inspection

On 2026-10-07, the public sign-in page at `https://git.squintopera.com/users/sign_in` returned HTTP 200. It marks the root with `gl-system` and toggles `gl-dark` on prefers-color-scheme changes. Its served application stylesheet defines semantic tokens on `:root,.gl-light-scope` and `:root.gl-dark,.gl-dark-scope`.

Inspected assets:

- `/assets/application-38bbb7710d1c136698908a2d115057b2d6043a4caea4ba99118e3cae57fd9937.css`
- `/assets/application_dark-33fb0fbbb609214d8e0f7df0f679d4e872badbaaae9f879dca22f043fee63e03.css`
- `/assets/tailwind-7400ed60609548461aba7dbe0e73b2a51af66e88c8e6246cee55eab159342bff.css`

Representative observed consumers include body background and text, link text, `.super-sidebar` application chrome, `.gl-nav-item` navigation and code/pre surfaces. The fixture uses a minimal dependency closure of actual GitLab UI declarations and synthetic representative consumers. Diff, syntax and label examples are synthetic, not captured application content.

The collaborative preview timed out opening both the instance and a blank background tab. No signed-in project, merge request or pipeline page was inspected live. No live browser profile, theme state or managed configuration was changed.

## Requirement traceability

| Requirement / scenario | Implementation | Verification |
| --- | --- | --- |
| Minimal extension access / manifest audit | `extension/manifest.json` | Extension unit test asserts exactly four origins and unchanged minimal permissions. |
| Independent adapters / disable GitLab only | Manifest-derived options switch, unchanged transport | `gitlab.test.mjs`: independent switch affects only GitLab and persists across a page reload. |
| GitLab matching appearance / live update | `adapters/gitlab/adapter.js`, `adapter.css` | Light/dark mapping tests and open-page palette-update test. |
| GitLab mismatched appearance / appearance changes | Root `gl-dark` mode reader, existing registry gating | Mismatch reporting, immediate root class changes and opposite palette gating tests. |
| Other GitLab origins | Exact `https://git.squintopera.com/*` match | Synthetic gitlab.com and git.example.test pages receive no palette or adapter scripts. |
| Preserved meaning colours | Semantic-only overrides, untouched primitive ramps | Light/dark tests compare resolved status, pipeline, diff, syntax, label and confirmation colours with the disabled adapter. |
| Opposite scoped container | Same-mode `.gl-light-scope` / `.gl-dark-scope` overrides | Matching scope takes the palette; opposite scope retains the app's own surface. |
| Readable GitLab interface | Existing readable text helpers and small ramp surfaces | Stock-theme contrast matrix checks page, sidebar, secondary/tertiary text, link, menu, dialog, selected navigation, neutral button, input, code and same-mode scope. |

## Validation

Focused Chromium run: 29 tests passed, covering six GitLab tests and the contrast matrix for all 22 installed stock themes. The tests use temporary profiles and synthetic pages served by CDP. The first sandboxed run could not start Chromium; the authorised run outside the sandbox completed. Initial fixture expectations were corrected to the observed GitLab dark surface (`#18171d`) and mode-dependent dropdown border aliases.

`./scripts/check` passed: shell syntax, Python helper and installer suites, 28 extension unit tests, 53 headless Chromium tests and strict OpenSpec validation (four items). `git diff --check` passed.

Independent adversarial review found no high- or medium-severity issues. The reviewer independently checked the proposal, delta specification, design, implementation, fixtures, tests and served CSS dependencies. All 65 overridden tokens exist in both GitLab theme scopes; primitive ramps, pipeline, diff and syntax colours remain untouched. Authenticated live coverage remains the documented limitation.

## Delivery record

Planning commit: `81a712e`. Implementation and verified task evidence: `51831d7`. Specifications synchronised with two modified and three added requirements; every delta block was compared with the canonical spec before archive. Strict validation passed after archive. PR: https://github.com/rfrost-xyz/omarchy-webapp-theme/pull/8.
