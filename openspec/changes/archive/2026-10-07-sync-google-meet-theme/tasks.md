# Tasks

## 1. Meet adapter

- [x] 1.1 Add the `https://meet.google.com/*` content script entry and update the manifest description; verify with the `node --test tests/extension` manifest audit listing exactly the three origins
- [x] 1.2 Implement `extension/adapters/meet/` (mode report and token CSS for both palette modes); verify in e2e against a synthetic Meet fixture whose dark container uses a class name unlike Meet's: under a dark palette page and container follow the palette and status colours remap, under a light palette the page follows the palette, the container keeps Meet's dark values and status colours stay, and named colour families and gradients stay in both
- [x] 1.3 Extend the options and toggle e2e so Meet is listed and disabling it reverts Meet without reload

## 2. Contrast

- [x] 2.1 Add Meet to the e2e contrast matrix over every stock Omarchy theme, in both palette modes; verify every threshold in the `app-adapters` spec passes

## 3. Live check

- [x] 3.1 Load the real signed-out Meet page in a throwaway profile with the extension and a synthetic palette; confirm the adapter activates, painted surfaces and text follow the palette, and record `RecalcStyleDuration` with the adapter on and off

## 4. Documentation

- [x] 4.1 Update README (intro, setup note, permissions, mapping, call-screen limitation), installer messages and `AGENTS.md`; verify `./scripts/check` passes
- [x] 4.2 Split requirements over 500 characters in the touched and canonical specs without changing behaviour, adding a tested scenario to each new requirement; verify `openspec validate --all --strict` passes once synced
- [x] 4.3 Limit the e2e profile to the extension under test; verify the Slack fallback poll test passes with 1Password's external extension registered
