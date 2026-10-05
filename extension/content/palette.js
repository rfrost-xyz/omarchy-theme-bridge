// Palette transport for pages: storage -> CSS custom properties, plus the
// adapter registry that switches app styling on and off. App-agnostic.
(() => {
  if (globalThis.OmarchyWebappTheme) return;
  const { validPalette, paletteCss } = globalThis.OmarchyColour;
  const root = document.documentElement;
  const STYLE_ID = 'omarchy-webapp-theme-palette';
  const ATTR = 'data-omarchy-adapters';
  const adapters = new Map();
  const reported = new Map();
  let palette = null;
  let disabled = new Set();
  let style = null;

  function ensureStyle() {
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
    }
    if (style.parentNode !== root) root.appendChild(style);
  }

  function applyPalette() {
    if (palette) {
      ensureStyle();
      style.textContent = paletteCss(palette);
      root.dataset.omarchyMode = palette.mode;
    } else {
      style?.remove();
      delete root.dataset.omarchyMode;
    }
  }

  function report(id, status) {
    const key = JSON.stringify(status);
    if (reported.get(id) === key) return;
    reported.set(id, key);
    chrome.storage.local.set({ [`adapter:${id}`]: { ...status, at: Date.now() } }).catch(() => {});
  }

  function evaluate() {
    const active = [];
    for (const [id, adapter] of adapters) {
      let appMode = null;
      try { appMode = adapter.appMode(); } catch { appMode = null; }
      let reason = 'active';
      if (disabled.has(id)) reason = 'disabled';
      else if (!palette) reason = 'no-palette';
      else if (!appMode) reason = 'app-mode-unknown';
      else if (appMode !== palette.mode) reason = 'mode-mismatch';
      if (reason === 'active') active.push(id);
      report(id, { reason, appMode, paletteMode: palette?.mode ?? null });
    }
    const value = active.join(' ');
    if ((root.getAttribute(ATTR) ?? '') !== value) {
      if (value) root.setAttribute(ATTR, value);
      else root.removeAttribute(ATTR);
    }
  }

  function ensureConnection() {
    try { chrome.runtime.sendMessage({ type: 'ensure' }).catch(() => {}); } catch { /* extension reloaded */ }
  }

  function load(values) {
    if ('palette' in values) palette = validPalette(values.palette ? { type: 'palette', ...values.palette } : null);
    if ('disabledAdapters' in values) disabled = new Set(Array.isArray(values.disabledAdapters) ? values.disabledAdapters : []);
    applyPalette();
    evaluate();
  }

  // Re-check when the app flips its own theme classes, and keep our style
  // element and attribute in place if the page rewrites the root.
  const observer = new MutationObserver(() => {
    if (palette && style && style.parentNode !== root) ensureStyle();
    evaluate();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class', ATTR], childList: true });
  let bodyObserved = null;
  const watchBody = () => {
    if (document.body && bodyObserved !== document.body) {
      bodyObserved = document.body;
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      evaluate();
    }
  };
  new MutationObserver(watchBody).observe(root, { childList: true });
  document.addEventListener('DOMContentLoaded', watchBody);

  chrome.storage.local.get(['palette', 'disabledAdapters']).then(load).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const values = {};
    for (const key of ['palette', 'disabledAdapters']) if (key in changes) values[key] = changes[key].newValue;
    if (Object.keys(values).length) load(values);
  });

  // Some apps mark their theme below <body>; a cheap re-check while visible
  // catches an in-app appearance change without a subtree observer.
  setInterval(() => { if (document.visibilityState === 'visible') evaluate(); }, 2000);

  ensureConnection();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ensureConnection(); });
  window.addEventListener('focus', ensureConnection);

  globalThis.OmarchyWebappTheme = {
    register(adapter) {
      adapters.set(adapter.id, adapter);
      watchBody();
      evaluate();
    },
  };
})();
