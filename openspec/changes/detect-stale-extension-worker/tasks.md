## 1. Test harness

- [x] 1.1 Make `stopChromium` kill only the process it is stopping and let `Browser.launch` load a copy of the extension; verify the existing restart tests and a restart held open for more than three seconds pass
- [x] 1.2 Correct the `tests/e2e/reload.test.mjs` header comment about relaunched profiles; verify the reload test still passes

## 2. Stale worker detection

- [x] 2.1 Add `WORKER_BUILD` and the start-up comparison to `extension/background.js`, storing or clearing `workerStatus`; verify with the headless test in 2.4
- [x] 2.2 Add a unit test that recomputes the marker from `background.js` and its imports and fails with the expected value; verify it passes and fails when either file changes
- [x] 2.3 Show the stale-worker notice in the options page; verify in the headless test in 2.4
- [x] 2.4 Add a headless test: a matching worker stores no status; after changing the copy's marker and restarting, the status is stale, the options page names the reload, and the palette still reaches a page

## 3. Guidance

- [x] 3.1 Update `install.sh` messages for reinstall, legacy migration and unpacked updates; verify installer tests for reinstall, migration and first install wording
- [x] 3.2 Update the README limitation on extension reloads and stale workers; verify by reading the rendered section

## 4. Verification

- [x] 4.1 Run `./scripts/check` and strict OpenSpec validation with zero failures
- [x] 4.2 Record the requirement trace and results in `evidence.md`
