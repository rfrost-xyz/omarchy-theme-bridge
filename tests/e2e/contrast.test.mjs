// Contrast matrix: every stock Omarchy palette rendered through every adapter.
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
  // rgb()/rgba(), or color(srgb r g b / a) as color-mix() computes to.
  const parse = (v) => {
    const n = (v.match(/[\\d.]+/g) || []).map(Number);
    return v.startsWith('color(srgb') ? n.map((x, i) => (i < 3 ? x * 255 : x)) : n;
  };
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
    ['#selected-row', 4.5, 'selected sidebar row'],
    ['#legacy-link', 4.5, 'legacy link'],
    ['#tooltip', 4.5, 'tooltip and reaction popover text'],
    ['#reacted', 4.5, 'text on your own reaction'],
    ['#menu-item', 4.5, 'menu item'],
    ['#menu-shortcut', 3, 'menu shortcut hint'],
    ['#menu-highlight', 4.5, 'highlighted menu item'],
  ],
  gitlab: [
    ['body', 4.5, 'primary text on page'],
    ['#sidebar', 4.5, 'sidebar text'],
    ['#secondary', 4.5, 'secondary text'],
    ['#muted', 3, 'tertiary text'],
    ['#link', 4.5, 'link on page'],
    ['#menu', 4.5, 'menu text'],
    ['#dialog', 4.5, 'dialog text'],
    ['#selected', 4.5, 'selected navigation'],
    ['#button', 4.5, 'neutral button label'],
    ['#input', 4.5, 'control text'],
    ['#code', 4.5, 'code text'],
    ['#scope', 4.5, 'matching scoped text'],
  ],
  meet: [
    ['#page', 4.5, 'primary text on page'],
    ['#secondary', 4.5, 'secondary text'],
    ['#card', 4.5, 'text on surface container'],
    ['#dialog', 4.5, 'text on dialog'],
    ['#menu', 4.5, 'text on highest container'],
    ['#low', 4.5, 'text on low container'],
    ['#link', 4.5, 'link on page'],
    ['#button-filled', 4.5, 'filled button label'],
    ['#tonal', 4.5, 'tonal button label'],
    ['#snackbar', 4.5, 'snackbar text'],
    ['#grey-chip', 4.5, 'grey chip text'],
    ['#legacy', 4.5, 'legacy text on legacy surface'],
    ['#legacy-hint', 4.5, 'legacy hint text'],
    ['#hotlane', 4.5, 'hotlane text'],
  ],
};
// Meet's call screen, themed only under dark palettes.
const MEET_CALL = [
  ['#call-text', 4.5, 'call screen text'],
  ['#call-controls', 4.5, 'text on call controls'],
  ['#caption', 4.5, 'captions over video'],
];
// Slack's own status colours on our surfaces. Only Slack's light values were
// observable, so these run for light palettes.
const PRESERVED_LIGHT = {
  slack: [
    ['#error-inline', 4.5, 'Slack important text on messages'],
    ['#success-inline', 3, 'Slack success text on messages'],
    ['#red-badge', 4.5, 'red badge count'],
    ['#white-badge', 4.5, 'white badge count'],
  ],
  meet: [
    ['#error', 4.5, 'Meet error text on page'],
    ['#success', 4.5, 'Meet success text on page'],
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
  meet: [
    ['#error', 4.5, 'remapped error text'],
    ['#error-banner', 4.5, 'remapped error text on its tint'],
    ['#success', 4.5, 'remapped success text'],
    ['#legacy-error', 4.5, 'remapped legacy error text'],
    ['#call-error', 4.5, 'remapped error text on the call screen'],
  ],
};
const URLS = { notion: 'https://app.notion.com/', slack: 'https://app.slack.com/', meet: 'https://meet.google.com/', gitlab: 'https://git.squintopera.com/' };

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
      { app: 'gitlab', mode: theme.mode, checks: CHECKS.gitlab },
      { app: 'slack', mode: theme.mode, checks: theme.mode === 'light' ? [...CHECKS.slack, ...PRESERVED_LIGHT.slack] : CHECKS.slack },
      // Slack cannot follow the system appearance, so it is also themed when
      // its own mode is the opposite one, with status colours remapped.
      { app: 'slack', mode: opposite, checks: [...CHECKS.slack, ...REMAPPED.slack] },
      // Meet's pages are light whatever the system appearance; its call
      // screen takes the palette only under dark palettes.
      { app: 'meet', mode: 'light', checks: theme.mode === 'light' ? [...CHECKS.meet, ...PRESERVED_LIGHT.meet] : [...CHECKS.meet, ...MEET_CALL, ...REMAPPED.meet] },
    ];
    for (const { app, mode, checks } of cases) {
      const page = await browser.open(`${URLS[app]}?mode=${mode}`);
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
