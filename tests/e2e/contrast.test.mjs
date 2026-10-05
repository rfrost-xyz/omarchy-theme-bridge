// Contrast matrix: every stock Omarchy palette rendered through both adapters.
// Palettes are written straight to extension storage; the helper path is
// covered by transport.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Browser } from './browser.mjs';
import { stockThemes } from '../lib/themes.mjs';

const require = createRequire(import.meta.url);
const C = require('../../extension/content/colour.js');
const themes = stockThemes();

// Resolve an element's text colour and effective background (walking up
// through transparent backgrounds) as hex.
const RESOLVE = `(selector) => {
  const parse = (v) => (v.match(/[\\d.]+/g) || []).map(Number);
  const el = document.querySelector(selector);
  let node = el; let layers = [];
  while (node) {
    const c = parse(getComputedStyle(node).backgroundColor);
    const a = c.length === 4 ? c[3] : 1;
    if (a > 0) layers.push([c[0], c[1], c[2], a]);
    if (a >= 1) break;
    node = node.parentElement;
  }
  let bg = [255, 255, 255];
  for (const [r, g, b, a] of layers.reverse()) bg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)];
  const t = parse(getComputedStyle(el).color);
  const ta = t.length === 4 ? t[3] : 1;
  const fg = [0, 1, 2].map((i) => t[i] * ta + bg[i] * (1 - ta));
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { fg: hex(fg), bg: hex(bg) };
}`;

const CHECKS = {
  notion: [
    ['body', 4.5, 'primary text on page'],
    ['#sidebar', 4.5, 'secondary text on sidebar'],
    ['#muted', 3, 'tertiary text on page'],
    ['#link', 4.5, 'link on page'],
    ['#menu', 4.5, 'text on menu'],
    ['#dialog', 4.5, 'text on dialog'],
    ['#code', 4.5, 'text on code block'],
    ['#search', 4.5, 'text on Ctrl+K search'],
    ['#glass-header', 4.5, 'secondary text on glass header'],
    ['#grey-block', 4.5, 'grey block text'],
    ['#red-bg', 4.5, 'text on authored red background'],
    ['#blue-bg', 4.5, 'text on authored blue background'],
    ['#yellow-bg', 4.5, 'text on authored yellow background'],
  ],
  slack: [
    ['#client', 4.5, 'primary text on messages'],
    ['#secondary', 4.5, 'secondary text'],
    ['#muted', 3, 'tertiary text'],
    ['#link', 4.5, 'link and mention'],
    ['#menu', 4.5, 'text on menu'],
    ['#dialog', 4.5, 'text on dialog'],
    ['#code', 4.5, 'text on code block'],
    ['#sidebar', 4.5, 'sidebar text'],
    ['#rail', 4.5, 'rail text on backdrop'],
    ['#legacy-link', 4.5, 'legacy link'],
  ],
};
// Slack's own status colours on our surfaces. Only Slack's light values were
// observable, so these run for light palettes.
const PRESERVED_LIGHT = {
  slack: [
    ['#error-inline', 4.5, 'Slack important text on messages'],
    ['#success-inline', 3, 'Slack success text on messages'],
  ],
};

// Slack's status colours after remapping onto the palette's hues.
const REMAPPED = {
  slack: [
    ['#error-inline', 4.5, 'remapped important text'],
    ['#success-inline', 4.5, 'remapped success text'],
    ['#warning', 4.5, 'remapped warning text on its tint'],
    ['#error', 4.5, 'remapped error text on its tint'],
    ['#success', 4.5, 'remapped success text on its tint'],
    ['#education', 4.5, 'remapped education text on its tint'],
  ],
};

let browser;
let options;
before(async () => {
  browser = await Browser.launch();
  options = await browser.options();
});
after(() => browser?.close());

test('stock themes are present', { skip: themes.length === 0 && 'no stock Omarchy themes on this machine' }, () => {
  assert.ok(themes.length >= 10);
});

for (const theme of themes) {
  test(`contrast for ${theme.name} (${theme.mode})`, async () => {
    const palette = { name: theme.name, mode: theme.mode, colors: theme.colors };
    await options.eval(`chrome.storage.local.set({ palette: ${JSON.stringify(palette)} })`);
    const failures = [];
    const opposite = theme.mode === 'light' ? 'dark' : 'light';
    const cases = [
      { app: 'notion', mode: theme.mode, checks: CHECKS.notion },
      { app: 'slack', mode: theme.mode, checks: theme.mode === 'light' ? [...CHECKS.slack, ...PRESERVED_LIGHT.slack] : CHECKS.slack },
      // Slack cannot follow the system appearance, so it is also themed when
      // its own mode is the opposite one, with status colours remapped.
      { app: 'slack', mode: opposite, checks: [...CHECKS.slack, ...REMAPPED.slack] },
    ];
    for (const { app, mode, checks } of cases) {
      const page = await browser.open(`https://app.${app}.com/?mode=${mode}`);
      await page.waitFor(`document.documentElement.getAttribute('data-omarchy-adapters') === '${app}' && getComputedStyle(document.documentElement).getPropertyValue('--omarchy-background').trim() === '${theme.colors.background}'`);
      for (const [selector, min, label] of checks) {
        const { fg, bg } = await page.eval(`(${RESOLVE})(${JSON.stringify(selector)})`);
        const ratio = C.contrast(fg, bg);
        if (ratio < min) failures.push(`${app} (${mode}) ${label}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
      }
      await page.close();
    }
    assert.deepEqual(failures, []);
  });
}
