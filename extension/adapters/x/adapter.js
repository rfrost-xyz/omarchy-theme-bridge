// X's current web client marks appearance on the root. Keep the marker
// untouched: the bridge's visible-page poll detects data-theme changes.
globalThis.OmarchyThemeBridge.register({
  id: 'x',
  appMode() {
    const mode = document.documentElement.getAttribute('data-theme');
    return mode === 'light' || mode === 'dark' ? mode : null;
  },
});
