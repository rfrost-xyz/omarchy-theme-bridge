// Grok.com marks its resolved appearance with light/dark root classes.
// Preserve app-owned meaning colours by waiting for a matching palette.
// An absent or contradictory marker gives us no reliable mode.
globalThis.OmarchyThemeBridge.register({
  id: 'grok',
  appMode() {
    const classes = document.documentElement.classList;
    const dark = classes.contains('dark');
    const light = classes.contains('light');
    return dark === light ? null : dark ? 'dark' : 'light';
  },
});
