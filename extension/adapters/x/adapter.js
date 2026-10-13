// X has semantic and classic React Native clients. Only the classic client's
// explicitly identified native sheet and inline neutral colours are translated.
(() => {
  const root = document.documentElement;
  const MARKER = 'data-omarchy-x-native';
  const PROXY = '--omarchy-x-native-original-color';
  const originalMarker = root.getAttribute(MARKER);
  const properties = ['background-color', 'color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'];
  const protectedSelector = 'svg, img, video, canvas, picture, [data-testid="tweetPhoto"], [data-testid="videoPlayer"]';
  const records = new Map();
  const pending = new Set();
  const maps = {
    light: {
      background: { '255,255,255': 'background', '239,243,244': 'surface', '247,249,249': 'surface' },
      color: { '15,20,25': 'text', '83,100,113': 'secondary', '130,154,171': 'tertiary' },
      border: { '207,217,222': 'border', '239,243,244': 'border' },
    },
    dark: {
      background: { '0,0,0': 'background', '22,24,28': 'surface', '32,35,39': 'raised' },
      color: { '231,233,234': 'text', '113,118,123': 'secondary' },
      border: { '47,51,54': 'border' },
    },
  };
  let lastMode = null;
  let lastSheet = null;
  let stopped = false;

  function nativeSheet() {
    const node = document.getElementById('react-native-stylesheet');
    return node?.tagName === 'STYLE' ? node.sheet : null;
  }
  function rgb(value) {
    const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(value);
    if (!match) return null;
    const channels = match.slice(1, 4).map(Number);
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    if (channels.some((n) => n > 255) || !(alpha > 0 && alpha <= 1)) return null;
    return { key: channels.join(','), alpha };
  }
  function appMode() {
    if (nativeSheet()) {
      // Never translate the inline background: it remains X's mode signal.
      const background = rgb(document.body?.style.getPropertyValue('background-color') ?? '');
      const mode = background?.alpha === 1 ? ({ '255,255,255': 'light', '0,0,0': 'dark' })[background.key] : null;
      const marker = mode || 'unknown';
      if (root.getAttribute(MARKER) !== marker) root.setAttribute(MARKER, marker);
      return mode || null;
    }
    if (root.hasAttribute(MARKER)) root.removeAttribute(MARKER);
    const mode = root.getAttribute('data-theme');
    return mode === 'light' || mode === 'dark' ? mode : null;
  }
  function replacement(property, value, mode) {
    if (property === 'color' && /^(inherit|unset|currentcolor)$/i.test(value)) {
      return `var(--omarchy-x-native-protected-color, ${value})`;
    }
    const parsed = rgb(value);
    if (!parsed) return null;
    const role = property === 'background-color' ? 'background' : property === 'color' ? 'color' : 'border';
    const name = maps[mode][role][parsed.key];
    if (!name) return null;
    if (parsed.alpha !== 1) {
      if (role !== 'background' || name !== 'background') return null;
      return `rgba(var(--omarchy-x-native-${mode}-background-rgb, ${parsed.key}), ${parsed.alpha})`;
    }
    return `var(--omarchy-x-native-${mode}-${name}, ${value})`;
  }
  function owned(style, property, saved) {
    return saved && style.getPropertyValue(property) === saved.ours && style.getPropertyPriority(property) === saved.priority;
  }
  function restoreProperty(style, property, saved) {
    if (!owned(style, property, saved)) return;
    if (saved.original) style.setProperty(property, saved.original, saved.originalPriority);
    else style.removeProperty(property);
  }
  function restore(style, saved) {
    for (const [property, entry] of saved.entries) restoreProperty(style, property, entry);
    if (saved.node && !saved.hadStyleAttribute && style.length === 0) saved.node.removeAttribute('style');
    records.delete(style);
  }
  function write(style, property, value, priority, entries) {
    const saved = entries.get(property);
    if (owned(style, property, saved) && saved.ours === value && saved.priority === priority) return;
    const original = owned(style, property, saved) ? saved.original : style.getPropertyValue(property);
    const originalPriority = owned(style, property, saved) ? saved.originalPriority : style.getPropertyPriority(property);
    style.setProperty(property, value, priority);
    entries.set(property, { original, originalPriority, ours: style.getPropertyValue(property), priority });
  }
  function nativeValue(style, property, entries) {
    const saved = entries.get(property);
    return owned(style, property, saved) ? saved.original : style.getPropertyValue(property);
  }
  function nativePriority(style, property, entries) {
    const saved = entries.get(property);
    return owned(style, property, saved) ? saved.originalPriority : style.getPropertyPriority(property);
  }
  function list(value) {
    // Timing functions may contain commas inside parentheses.
    const result = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index++) {
      if (value[index] === '(') depth++;
      if (value[index] === ')') depth--;
      if (value[index] === ',' && depth === 0) { result.push(value.slice(start, index).trim()); start = index + 1; }
    }
    result.push(value.slice(start).trim());
    return result;
  }
  function mirrorTransition(style, entries) {
    const property = 'transition-property';
    const names = list(nativeValue(style, property, entries));
    const colourIndex = names.findLastIndex((name) => name === 'color' || name === 'all');
    const timings = ['transition-duration', 'transition-delay', 'transition-timing-function'];
    if (colourIndex < 0 || names.includes(PROXY)) {
      for (const name of [property, ...timings]) {
        const saved = entries.get(name);
        if (saved) restoreProperty(style, name, saved);
        entries.delete(name);
      }
      return;
    }
    // Expand only locally declared cyclic timing lists. Leaving an absent
    // declaration absent preserves timings supplied by another app rule.
    for (const name of timings) {
      const value = nativeValue(style, name, entries);
      if (!value) continue;
      const values = list(value);
      const expanded = names.map((_, index) => values[index % values.length]);
      expanded.push(values[colourIndex % values.length]);
      write(style, name, expanded.join(', '), nativePriority(style, name, entries), entries);
    }
    write(style, property, [...names, PROXY].join(', '), nativePriority(style, property, entries), entries);
  }
  function translate(style, mode, node = null, keyframe = false) {
    const savedRecord = records.get(style);
    const entries = savedRecord?.entries ?? new Map();
    const hadStyleAttribute = savedRecord?.hadStyleAttribute ?? node?.hasAttribute('style');
    const savedColour = entries.get('color');
    const colour = owned(style, 'color', savedColour) ? savedColour.original : style.getPropertyValue('color');
    const colourPriority = owned(style, 'color', savedColour) ? savedColour.originalPriority : style.getPropertyPriority('color');
    // Mirror the live native cascade, including brand/status and pseudo-state
    // colours. This inherits to media without capturing computed colour values.
    let proxy = colour || (node === document.body ? (mode === 'dark' ? 'rgb(231, 233, 234)' : 'rgb(15, 20, 25)') : null);
    if (proxy && /^(inherit|unset|currentcolor)$/i.test(proxy)) proxy = 'inherit';
    if (proxy === 'initial') proxy = 'CanvasText';
    if (proxy) write(style, PROXY, proxy, colourPriority, entries);
    else if (entries.has(PROXY)) { restoreProperty(style, PROXY, entries.get(PROXY)); entries.delete(PROXY); }
    if (!keyframe) mirrorTransition(style, entries);
    const protectedNode = node?.closest(protectedSelector);
    for (const property of properties) {
      const saved = entries.get(property);
      const original = owned(style, property, saved) ? saved.original : style.getPropertyValue(property);
      const inheritsColour = property === 'color' && /^(inherit|unset|currentcolor)$/i.test(original);
      if (keyframe || (protectedNode && !inheritsColour) || (node === document.body && property !== 'color')) {
        if (saved) restoreProperty(style, property, saved);
        entries.delete(property);
        continue;
      }
      const value = style.getPropertyValue(property);
      const priority = style.getPropertyPriority(property);
      if (node && property === 'color') {
        const background = rgb(style.getPropertyValue('background-color'));
        if (background && !maps[mode].background[background.key]) {
          if (saved) restoreProperty(style, property, saved);
          entries.delete(property);
          continue;
        }
      }
      if (owned(style, property, saved)) continue;
      entries.delete(property);
      const next = replacement(property, value, mode);
      if (next) write(style, property, next, priority, entries);
    }
    if (entries.size) records.set(style, { entries, node, hadStyleAttribute });
    else records.delete(style);
  }
  function queue(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.hasAttribute('style')) pending.add(node);
    for (const child of node.querySelectorAll('[style]')) pending.add(child);
  }
  function processSync(scanSheet) {
    if (stopped) return;
    if (!chrome.runtime?.id) { teardown(); return; }
    const sheet = nativeSheet();
    const mode = appMode();
    const active = sheet && maps[mode] && root.dataset.omarchyMode === mode && (root.getAttribute('data-omarchy-adapters') ?? '').split(' ').includes('x');
    const changed = mode !== lastMode || sheet !== lastSheet;
    if (!active || changed) {
      for (const [style, saved] of records) restore(style, saved);
      if (active) queue(root);
    }
    lastMode = active ? mode : null;
    lastSheet = active ? sheet : null;
    if (!active) { pending.clear(); return; }
    const ruleStyles = new Set();
    const scanned = scanSheet || changed;
    function visit(rules) {
      for (const rule of rules) {
        if (rule.type === CSSRule.STYLE_RULE || rule.type === CSSRule.KEYFRAME_RULE) {
          ruleStyles.add(rule.style);
          translate(rule.style, mode, null, rule.type === CSSRule.KEYFRAME_RULE);
        } else if (rule.cssRules) visit(rule.cssRules);
      }
    }
    if (scanned) { try { visit(sheet.cssRules); } catch { /* sheet is being replaced */ } }
    for (const [style, saved] of records) {
      if (saved.node ? !saved.node.isConnected : scanned && !ruleStyles.has(style)) restore(style, saved);
    }
    if (document.body) pending.add(document.body);
    for (const node of pending) if (node.isConnected) translate(node.style, mode, node);
    pending.clear();
  }
  function collect(mutations) {
    let sourceChanged = false;
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        pending.add(mutation.target);
        if (mutation.attributeName === 'data-testid') queue(mutation.target);
      }
      for (const node of mutation.addedNodes) queue(node);
      if (mutation.type === 'childList' && mutation.target.id === 'react-native-stylesheet') sourceChanged = true;
    }
    return sourceChanged;
  }
  const observer = new MutationObserver((mutations) => sync(collect(mutations)));
  const observerOptions = { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'data-testid', 'data-theme', 'data-omarchy-adapters', 'data-omarchy-mode'] };
  function sync(scanSheet = false) {
    const queuedSourceChange = collect(observer.takeRecords());
    observer.disconnect();
    try { processSync(scanSheet || queuedSourceChange); }
    finally { if (!stopped) observer.observe(root, observerOptions); }
  }
  observer.observe(root, observerOptions);
  const interval = setInterval(() => { if (document.visibilityState === 'visible') sync(true); }, 1000);
  function teardown() {
    stopped = true;
    observer.disconnect();
    clearInterval(interval);
    for (const [style, saved] of records) restore(style, saved);
    pending.clear();
    if (originalMarker === null) root.removeAttribute(MARKER);
    else root.setAttribute(MARKER, originalMarker);
  }
  globalThis.OmarchyThemeBridge.register({ id: 'x', appMode });
  sync();
})();
