// GitLab follows System appearance by toggling gl-dark on the page root.
// Its status, diff and syntax colours stay in the app's own mode, so apply
// only while that mode matches the palette. Read no token we override.
globalThis.OmarchyWebappTheme.register({
  id: 'gitlab',
  appMode() {
    return document.documentElement.classList.contains('gl-dark') ? 'dark' : 'light';
  },
});
