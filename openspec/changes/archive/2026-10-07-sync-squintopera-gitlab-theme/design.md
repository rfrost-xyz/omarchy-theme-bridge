# Design

## Context

See proposal.md for motivation. Public styles served by git.squintopera.com on 2026-10-07 define GitLab UI semantic `--gl-*` tokens on `:root`, `.gl-light-scope` and `:root.gl-dark,.gl-dark-scope`. The sign-in page marks System appearance with `gl-system` and toggles `gl-dark` on the root through prefers-color-scheme.

## Goals / Non-Goals

Theme the neutral interface through existing tokens, keep the palette transport unchanged and preserve GitLab's meaning colours. No generic GitLab origin matching, stylesheet management or app appearance manipulation.

## Decisions

- Register `gitlab` with default matching-mode gating. Read root `gl-dark` only, with no dark marker meaning light. GitLab supports System appearance, so remapping all status, diff and syntax colours for mismatched modes would add unnecessary risk.
- Override semantic surface, text, border, navigation, neutral action and control tokens. Leave primitive colour ramps, status families, diffs, syntax, labels and destructive actions alone. Primitive ramp overrides would recolour meaning colours indirectly.
- Apply on the root and same-mode explicit scopes with sufficient specificity and important declarations. Leave opposite-mode scopes unchanged. No layout or generated class selectors are needed.
- Use existing derived readable text and ramp values, with fills at background or ramp steps up to 8. Keep confirmation button fills GitLab's own because their foreground can share primitive values with statuses.
- Extend the synthetic browser routing and contrast matrix by one origin. Fixtures model token declarations and representative consumers from the served CSS without copying application data.

## Risks / Trade-offs

- GitLab upgrades can rename tokens. Record the inspected asset hashes and representative consumers in evidence; unmapped fixed colours remain GitLab's.
- Signed-in project pages cannot be checked through the public sign-in page. Automated fixtures verify mappings and preservation, with live authenticated coverage explicitly unverified.
- A fixed opposite appearance leaves GitLab unthemed until it matches. Document System appearance and verify mismatch reporting.

## Migration Plan

Reinstall or reload the extension, reload open GitLab pages and select System appearance in GitLab. Disable the GitLab adapter to restore native styling. No helper or permissions migration is needed.
