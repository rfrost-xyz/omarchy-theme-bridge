// Slack marks its theme with an sk-client-theme--dark or --light class.
globalThis.OmarchyWebappTheme.register({
  id: 'slack',
  appMode() {
    const themed = document.querySelector('.sk-client-theme--dark, .sk-client-theme--light');
    if (!themed) return null;
    return themed.classList.contains('sk-client-theme--dark') ? 'dark' : 'light';
  },
});
