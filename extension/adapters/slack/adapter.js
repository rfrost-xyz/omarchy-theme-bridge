// Slack marks its theme with an sk-client-theme--dark or --light class.
// Slack in the browser cannot follow the system appearance (only Light or
// Dark), so it is themed in either mode and remaps its status colours when
// its mode differs from the palette's.
globalThis.OmarchyWebappTheme.register({
  id: 'slack',
  modePolicy: 'any',
  appMode() {
    const themed = document.querySelector('.sk-client-theme--dark, .sk-client-theme--light');
    if (!themed) return null;
    return themed.classList.contains('sk-client-theme--dark') ? 'dark' : 'light';
  },
});
