// Notion reports its theme with classes on <body>.
globalThis.OmarchyThemeBridge.register({
  id: 'notion',
  appMode() {
    const body = document.body;
    if (!body) return null;
    if (body.classList.contains('notion-dark-theme')) return 'dark';
    if (body.classList.contains('notion-body')) return 'light';
    return null;
  },
});
