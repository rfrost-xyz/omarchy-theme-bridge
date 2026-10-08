// Slack's light tokens sit on :root and .sk-client-theme--light; dark mode adds
// sk-client-theme--dark. The signed-in client can omit any class in Light mode,
// so no dark marker means light. Slack in the browser cannot follow the system
// appearance (only Light or Dark), so it is themed in either mode and remaps its
// status colours when its mode differs from the palette's.
globalThis.OmarchyThemeBridge.register({
  id: 'slack',
  modePolicy: 'any',
  appMode() {
    const themed = document.querySelector('.sk-client-theme--dark, .sk-client-theme--light');
    return themed?.classList.contains('sk-client-theme--dark') ? 'dark' : 'light';
  },
});
