import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { Browser } from './browser.mjs';

const require = createRequire(import.meta.url);
const C = require('../../extension/content/colour.js');
const DARK = { mode: 'dark', colors: { background: '#1a1b26', foreground: '#a9b1d6', accent: '#7aa2f7', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7' } };
const toml = (p) => `mode = "${p.mode}"\n` + Object.entries(p.colors).map(([k, v]) => `${k} = "${v}"`).join('\n') + '\n';
const css = (hex) => `rgb(${C.triplet(hex)})`;
const derived = C.derive(DARK);
const fixture = readFileSync(new URL('./fixtures/notion.html', import.meta.url), 'utf8');
const NOTION_DARK = Object.fromEntries([...fixture.split('.notion-dark-theme {')[1].split('}')[0].matchAll(/(--[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
const active = (page) => page.eval("document.documentElement.getAttribute('data-omarchy-adapters') || ''");

let browser;
before(async () => {
  browser = await Browser.launch();
  browser.setTheme('tokyo-night', toml(DARK));
});
after(() => browser?.close());

test('notion: chrome follows the palette and authored colours stay', async () => {
  const page = await browser.open('https://app.notion.com/?mode=dark');
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'notion'");
  assert.equal(await page.style('body', 'backgroundColor'), css('#1a1b26'));
  assert.equal(await page.style('body', 'color'), css(derived.text));
  assert.equal(await page.style('#sidebar', 'backgroundColor'), css(derived.ramp[4]));
  assert.equal(await page.style('#sidebar', 'color'), css(derived['text-secondary']));
  assert.equal(await page.style('#muted', 'color'), css(derived['text-tertiary']));
  assert.equal(await page.style('#link', 'color'), css(derived['accent-text']));
  assert.equal(await page.style('#menu', 'backgroundColor'), css(derived.ramp[3]));
  assert.equal(await page.style('#dialog', 'backgroundColor'), css(derived.ramp[3]));
  assert.equal(await page.style('#menu', 'borderTopColor'), css(derived.ramp[12]));
  assert.equal(await page.style('#code', 'backgroundColor'), css(derived.ramp[5]));
  assert.match(await page.style('#search', 'backgroundColor'), new RegExp(`^rgba\\(${C.triplet(derived.ramp[3])}, 0\\.94\\)$`));
  assert.match(await page.style('#search-hover', 'backgroundColor'), /^rgba\(169, 177, 214, 0\.055\)$/);
  assert.match(await page.style('#search', 'borderTopColor'), /^rgba\(169, 177, 214, 0\.1\)$/);
  assert.match(await page.style('#glass-header', 'backgroundColor'), new RegExp(`^rgba\\(${C.triplet(derived.ramp[4])}, 0\\.85\\)$`));
  assert.equal(await page.style('#grey-block', 'backgroundColor'), css(derived.ramp[6]));
  assert.match(await page.style('#sidebar .selected', 'backgroundColor'), /^rgba\(122, 162, 247, 0\.16/);
  // Authored block colours keep Notion's dark values.
  assert.equal(await page.token('#red-block', '--c-redBacPri'), '#241d1d');
  assert.equal(await page.style('#red-block', 'backgroundColor'), css('#241d1d'));
  assert.equal(await page.token('#blue-text', '--c-bluTexPri'), NOTION_DARK['--c-bluTexPri']);
  assert.equal(await page.token('#red-block', '--c-redTexPri'), NOTION_DARK['--c-redTexPri']);
  // Primary buttons draw white labels on this blue, so it stays Notion's.
  assert.equal(await page.token('body', '--c-palUiBlu600'), '#2383e2');
  // Every chromatic block family keeps Notion's value.
  const chromatic = Object.keys(NOTION_DARK).filter((k) => /^--c-(blu|bro|gre|ora|pin|pur|red|tea|yel)/.test(k));
  assert.ok(chromatic.length >= 5);
  for (const token of chromatic) assert.equal(await page.token('body', token), NOTION_DARK[token], token);
  // A light-theme container inside the dark page keeps Notion's light surface.
  assert.equal(await page.style('#opposite', 'backgroundColor'), 'rgb(255, 255, 255)');
  await page.close();
});

test('notion: switching its appearance on an open page re-evaluates at once', async () => {
  const page = await browser.open('https://app.notion.com/?mode=dark');
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'notion'");
  await page.eval("document.body.classList.remove('dark', 'notion-dark-theme')");
  await page.waitFor("!document.documentElement.hasAttribute('data-omarchy-adapters')", 1000);
  await page.eval("document.body.classList.add('dark', 'notion-dark-theme')");
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'notion'", 1000);
  await page.close();
});

test('notion: mode mismatch leaves the page alone and is reported', async () => {
  const page = await browser.open('https://app.notion.com/?mode=light');
  await page.waitFor("getComputedStyle(document.documentElement).getPropertyValue('--omarchy-background').trim() === '#1a1b26'");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await active(page), '');
  assert.equal(await page.style('body', 'backgroundColor'), 'rgb(255, 255, 255)');
  const options = await browser.options();
  await options.waitFor("document.body.textContent.includes('set the app to follow the system appearance')");
  await options.close();
  await page.close();
});

test('slack: tokens follow the palette and meaningful colours stay', async () => {
  const page = await browser.open('https://app.slack.com/?mode=dark');
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  assert.equal(await page.style('#client', 'backgroundColor'), css('#1a1b26'));
  assert.equal(await page.style('#client', 'color'), css(derived.text));
  assert.equal(await page.style('#secondary', 'color'), css(derived['text-secondary']));
  assert.equal(await page.style('#muted', 'color'), css(derived['text-tertiary']));
  assert.equal(await page.style('#link', 'color'), css(derived['accent-text']));
  assert.equal(await page.style('#menu', 'backgroundColor'), css(derived.ramp[3]));
  assert.equal(await page.style('#dialog', 'backgroundColor'), css(derived.ramp[3]));
  assert.match(await page.style('#dialog', 'borderTopColor'), /^rgba\(169, 177, 214, 0\.13\)$/);
  assert.equal(await page.style('#code', 'backgroundColor'), css(derived.ramp[8]));
  assert.equal(await page.style('#backdrop', 'backgroundColor'), css('#1a1b26'));
  assert.match(await page.style('#sidebar', 'backgroundColor'), /^rgba\(169, 177, 214, 0\.05/);
  assert.equal(await page.style('#sidebar', 'color'), css(derived['text-secondary']));
  assert.equal(await page.style('#rail', 'color'), css(derived.text));
  assert.match(await page.style('#selected-row', 'backgroundColor'), /^rgba\(122, 162, 247, 0\.18\)$/);
  assert.equal(await page.style('#selected-row', 'color'), css(derived.text));
  assert.equal(await page.style('#legacy-link', 'color'), css(derived['accent-text']));
  // Tooltips and who-reacted popovers: raised surface, not a literal inverse.
  assert.equal(await page.style('#tooltip', 'backgroundColor'), css(derived.ramp[12]));
  assert.equal(await page.style('#tooltip', 'color'), css(derived.text));
  assert.match(await page.style('#reacted', 'backgroundColor'), /^rgba\(122, 162, 247, 0\.2\)$/);
  // Everything else drawn from the inverse pair keeps Slack's values.
  assert.equal(await page.style('#shortcut-hint', 'backgroundColor'), css('#d1d2d3'));
  assert.equal(await page.style('#red-badge', 'backgroundColor'), css('#e01e5a'));
  assert.equal(await page.style('#red-badge', 'color'), css('#1a1d21'));
  assert.equal(await page.style('#white-badge', 'color'), css('#0a77a7'));
  assert.equal(await page.style('#icon-badge', 'backgroundColor'), css('#0a77a7'));
  // Menus follow the palette, including the highlighted row.
  assert.equal(await page.style('#menu-item', 'color'), css(derived.text));
  assert.equal(await page.style('#menu-shortcut', 'color'), css(derived['text-tertiary']));
  assert.match(await page.style('#menu-highlight', 'backgroundColor'), /^rgba\(122, 162, 247, 0\.2\)$/);
  assert.equal(await page.style('#menu-highlight', 'color'), css(derived.text));
  // Triplet tokens still resolve inside rgba().
  assert.equal(await page.style('#triplet', 'backgroundColor'), css('#1a1b26'));
  assert.match(await page.style('#triplet', 'color'), /^rgba\(169, 177, 214, 0\.7/);
  // Status, highlight, error, badge and presence colours keep Slack's values.
  assert.equal(await page.style('#error', 'color'), css('#e46e8f'));
  assert.equal(await page.style('#error', 'backgroundColor'), css('#451a26'));
  assert.equal(await page.style('#success', 'color'), css('#2bac76'));
  assert.equal(await page.style('#success', 'backgroundColor'), css('#10372c'));
  assert.equal(await page.style('#warning', 'backgroundColor'), css('#3e3218'));
  assert.equal(await page.style('#warning', 'color'), css('#e8b13b'));
  assert.equal(await page.style('#education', 'color'), css('#a9b9f5'));
  assert.equal(await page.style('#education', 'backgroundColor'), css('#1c2340'));
  assert.equal(await page.eval("document.documentElement.hasAttribute('data-omarchy-remap')"), false);
  assert.equal(await page.style('#badge', 'backgroundColor'), css('#cd2553'));
  assert.equal(await page.style('#presence', 'backgroundColor'), css('#2bac76'));
  await page.close();
});

test('slack: a different app mode keeps theming and remaps status colours', async () => {
  const page = await browser.open('https://app.slack.com/?mode=dark');
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  // The signed-in client marks its mode on <body>; flip it there so the
  // observer (not the two-second fallback poll) has to react.
  await page.eval("document.body.className = 'sk-client-theme--light'; document.getElementById('client').className = 'p-client sk-client-theme--light'");
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-remap') === 'slack'", 1000);
  assert.equal(await active(page), 'slack');
  assert.equal(await page.style('#client', 'backgroundColor'), css('#1a1b26'));
  assert.equal(await page.style('#client', 'color'), css(derived.text));
  assert.equal(await page.style('#error-inline', 'color'), css(derived['red-text']));
  assert.equal(await page.style('#success-inline', 'color'), css(derived['green-text']));
  assert.equal(await page.style('#warning', 'color'), css(derived['yellow-text']));
  assert.equal(await page.style('#education', 'color'), css(derived['blue-text']));
  assert.equal(await page.style('#badge', 'backgroundColor'), css('#cd2553'));
  assert.equal(await page.style('#presence', 'backgroundColor'), css('#2bac76'));
  // Slack is light here, so its badges keep their light values.
  assert.equal(await page.style('#red-badge', 'backgroundColor'), css('#e01e5a'));
  assert.equal(await page.style('#red-badge', 'color'), css('#ffffff'));
  assert.equal(await page.style('#white-badge', 'color'), css('#1264a3'));
  assert.equal(await page.style('#icon-badge', 'backgroundColor'), css('#1264a3'));
  assert.equal(await page.style('body', 'colorScheme'), 'dark');
  const options = await browser.options();
  await options.waitFor("document.body.textContent.includes('status colours use the palette')");
  await options.close();
  await page.eval("document.body.className = 'sk-client-theme--dark'; document.getElementById('client').className = 'p-client sk-client-theme--dark'");
  await page.waitFor("!document.documentElement.hasAttribute('data-omarchy-remap')", 1000);
  assert.equal(await page.style('#error-inline', 'color'), css('#e46e8f'));
  await page.close();
});

test('slack: a light palette over Slack in Dark uses light controls and palette hues', async () => {
  const LIGHT = { mode: 'light', colors: { background: '#eff1f5', foreground: '#4c4f69', accent: '#1e66f5', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d', blue: '#1e66f5' } };
  const light = C.derive(LIGHT);
  browser.setTheme('latte', toml(LIGHT));
  try {
    const page = await browser.open('https://app.slack.com/?mode=dark');
    await page.waitFor("document.documentElement.getAttribute('data-omarchy-remap') === 'slack' && document.documentElement.dataset.omarchyMode === 'light'", 8000);
    assert.equal(await page.style('#client', 'backgroundColor'), css('#eff1f5'));
    assert.equal(await page.style('body', 'colorScheme'), 'light');
    assert.equal(await page.style('#error-inline', 'color'), css(light['red-text']));
    assert.equal(await page.style('#warning', 'color'), css(light['yellow-text']));
    assert.equal(await page.style('#badge', 'backgroundColor'), css('#cd2553'));
    assert.equal(await page.style('#red-badge', 'backgroundColor'), css('#e01e5a'));
    assert.equal(await page.style('#red-badge', 'color'), css('#1a1d21'));
    assert.equal(await page.style('#white-badge', 'color'), css('#0a77a7'));
    assert.equal(await page.style('#icon-badge', 'backgroundColor'), css('#0a77a7'));
    const options = await browser.options();
    await options.waitFor("document.body.textContent.includes('status colours use the palette')");
    await options.close();
    await page.close();
  } finally {
    browser.setTheme('tokyo-night', toml(DARK));
  }
});

test('adapters toggle independently and live from the options page', async () => {
  const notion = await browser.open('https://app.notion.com/?mode=dark');
  const slack = await browser.open('https://app.slack.com/?mode=dark');
  await notion.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'notion'");
  await slack.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  const options = await browser.options();
  await options.waitFor("document.querySelectorAll('#adapters input').length === 2");
  const labels = await options.eval("[...document.querySelectorAll('#adapters label')].map((l) => l.textContent.trim())");
  assert.deepEqual(labels, ['Notion', 'Slack']);
  await options.eval("[...document.querySelectorAll('#adapters label')].find((l) => l.textContent.includes('Slack')).querySelector('input').click()");
  await slack.waitFor("!document.documentElement.hasAttribute('data-omarchy-adapters')");
  assert.equal(await slack.style('#client', 'backgroundColor'), css('#1a1d21'));
  assert.equal(await active(notion), 'notion');
  await options.eval("[...document.querySelectorAll('#adapters label')].find((l) => l.textContent.includes('Slack')).querySelector('input').click()");
  await slack.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  for (const page of [options, notion, slack]) await page.close();
});
