// Palette transport for pages: storage -> CSS custom properties, plus the
// adapter registry that switches app styling on and off. App-agnostic.
(() => {
  if (globalThis.OmarchyThemeBridge) return;
  const { validPalette, paletteCss } = globalThis.OmarchyColour;
  const root = document.documentElement;
  const STYLE_ID = 'omarchy-theme-bridge-palette';
  const ATTR = 'data-omarchy-adapters';
  // Adapters active although the app's own light/dark mode differs from the
  // palette's (only for adapters registered with modePolicy: 'any').
  const REMAP_ATTR = 'data-omarchy-remap';
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
    try {
      chrome.storage.local.set({ [`adapter:${id}`]: { ...status, at: Date.now() } }).catch(() => {});
    } catch { /* context invalidated; teardown follows */ }
  }

  function evaluate() {
    const active = [];
    const remapped = [];
    for (const [id, adapter] of adapters) {
      let appMode = null;
      try { appMode = adapter.appMode(); } catch { appMode = null; }
      let reason = 'active';
      if (disabled.has(id)) reason = 'disabled';
      else if (!palette) reason = 'no-palette';
      else if (!appMode) reason = 'app-mode-unknown';
      else if (appMode !== palette.mode) reason = adapter.modePolicy === 'any' ? 'active-remapped' : 'mode-mismatch';
      if (reason === 'active' || reason === 'active-remapped') active.push(id);
      if (reason === 'active-remapped') remapped.push(id);
      report(id, { reason, appMode, paletteMode: palette?.mode ?? null });
    }
    setTokens(ATTR, active);
    setTokens(REMAP_ATTR, remapped);
  }

  function setTokens(name, ids) {
    const value = ids.join(' ');
    if ((root.getAttribute(name) ?? '') === value) return;
    if (value) root.setAttribute(name, value);
    else root.removeAttribute(name);
  }

  // After the extension is reloaded or removed, this script is orphaned and
  // no longer hears palette changes. Remove everything it added so the page
  // falls back to the app's own colours instead of a stale palette.
  function alive() {
    if (chrome.runtime?.id) return true;
    teardown();
    return false;
  }

  function ensureConnection() {
    if (!alive()) return;
    try { chrome.runtime.sendMessage({ type: 'ensure' }).catch(() => {}); } catch { /* reloaded */ }
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
    if (!alive()) return;
    if (palette && style && style.parentNode !== root) ensureStyle();
    evaluate();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class', ATTR, REMAP_ATTR], childList: true });
  let bodyObserved = null;
  const watchBody = () => {
    if (document.body && bodyObserved !== document.body) {
      bodyObserved = document.body;
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      evaluate();
    }
  };
  const bodyWatcher = new MutationObserver(watchBody);
  bodyWatcher.observe(root, { childList: true });
  // A mode marker below <body> is parsed after the palette may have loaded,
  // so check once more when the document is complete.
  const onReady = () => { watchBody(); evaluate(); };
  document.addEventListener('DOMContentLoaded', onReady);

  chrome.storage.local.get(['palette', 'disabledAdapters']).then(load).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const values = {};
    for (const key of ['palette', 'disabledAdapters']) if (key in changes) values[key] = changes[key].newValue;
    if (Object.keys(values).length) load(values);
  });

  // Some apps mark their theme below <body>; a cheap re-check while visible
  // catches an in-app appearance change without a subtree observer.
  const interval = setInterval(() => { if (alive() && document.visibilityState === 'visible') evaluate(); }, 2000);
  const onVisible = () => { if (document.visibilityState === 'visible') ensureConnection(); };

  function teardown() {
    observer.disconnect();
    bodyWatcher.disconnect();
    clearInterval(interval);
    document.removeEventListener('DOMContentLoaded', onReady);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', ensureConnection);
    style?.remove();
    root.removeAttribute(ATTR);
    root.removeAttribute(REMAP_ATTR);
    delete root.dataset.omarchyMode;
    adapters.clear();
  }

  ensureConnection();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', ensureConnection);

  globalThis.OmarchyThemeBridge = {
    register(adapter) {
      adapters.set(adapter.id, adapter);
      watchBody();
      evaluate();
    },
  };
})();
