// Palette maths shared by the service worker, content scripts and tests.
// App-agnostic: it knows Omarchy palettes, not Notion or Slack.
(() => {
  const HEX = /^#[0-9a-f]{6}$/;
  const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const KEY = /^[a-z_][a-z0-9_]{0,40}$/;
  const REQUIRED = ['background', 'foreground', 'accent'];
  // Steps of the neutral ramp from background (0) towards foreground (100).
  const HUE_TINT = 0.18;
  const RAMP = [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 28, 40, 60, 80];

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const hex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = rgb(a); const y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const triplet = (h) => rgb(h).join(', ');

  function luminance(h) {
    const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Move `colour` towards the high-contrast pole until it reaches `ratio`
  // against every colour in `against`.
  function readable(colour, against, ratio, pole) {
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const c = mix(colour, pole, Math.min(t, 1));
      if (against.every((bg) => contrast(c, bg) >= ratio)) return c;
    }
    return pole;
  }

  // Strict validation of a helper message. Returns a clean palette or null.
  function validPalette(message) {
    if (!message || message.type !== 'palette' || typeof message.colors !== 'object' || !message.colors) return null;
    if (message.mode !== 'light' && message.mode !== 'dark') return null;
    const colors = {};
    for (const [key, value] of Object.entries(message.colors)) {
      if (KEY.test(key) && typeof value === 'string' && HEX.test(value)) colors[key] = value;
    }
    if (!REQUIRED.every((key) => key in colors)) return null;
    const name = typeof message.name === 'string' && NAME.test(message.name) ? message.name : null;
    return { name, mode: message.mode, colors };
  }

  // Generic derived values every adapter can rely on.
  function derive(palette) {
    const { background: bg, foreground: fg, accent } = palette.colors;
    const pole = palette.mode === 'dark' ? '#ffffff' : '#000000';
    const ramp = Object.fromEntries(RAMP.map((n) => [n, mix(bg, fg, n / 100)]));
    const surfaces = [bg, ramp[4], ramp[8]];
    const text = readable(fg, [...surfaces, ramp[12]], 4.5, pole);
    const inkCandidates = [bg, fg, '#ffffff', '#000000'];
    // Readable versions of the palette's hues, for adapters that must show a
    // meaning colour (error, success, warning, link) on the palette surfaces.
    const hues = {};
    for (const key of ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'orange']) {
      // Also readable on its own tint (up to 18% of the hue over the background).
      const hue = palette.colors[key];
      if (hue) hues[`${key}-text`] = readable(hue, [...surfaces, mix(bg, hue, HUE_TINT)], 4.5, pole);
    }
    return {
      ...hues,
      ramp,
      text,
      'text-secondary': readable(mix(fg, bg, 0.3), surfaces, 4.5, text),
      'text-tertiary': readable(mix(fg, bg, 0.5), surfaces, 3, text),
      'text-disabled': mix(fg, bg, 0.6),
      'accent-text': readable(accent, surfaces, 4.5, pole),
      'accent-ink': inkCandidates.reduce((best, c) => (contrast(c, accent) > contrast(best, accent) ? c : best)),
    };
  }

  function paletteCss(palette) {
    const lines = [];
    const put = (name, value) => { lines.push(`  --omarchy-${name}: ${value};`); lines.push(`  --omarchy-${name}-rgb: ${triplet(value)};`); };
    for (const [key, value] of Object.entries(palette.colors)) put(key.replace(/_/g, '-'), value);
    const d = derive(palette);
    for (const [n, value] of Object.entries(d.ramp)) put(`mix-${n}`, value);
    for (const [name, value] of Object.entries(d)) if (name !== 'ramp') put(name, value);
    return `:root {\n${lines.join('\n')}\n}\n`;
  }

  const api = { rgb, hex, mix, triplet, luminance, contrast, readable, validPalette, derive, paletteCss, RAMP };
  globalThis.OmarchyColour = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
