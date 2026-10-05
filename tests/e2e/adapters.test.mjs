import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { Browser } from './browser.mjs';

const require = createRequire(import.meta.url);
const C = require('../../extension/content/colour.js');
const DARK = { mode: 'dark', colors: { background: '#1a1b26', foreground: '#a9b1d6', accent: '#7aa2f7' } };
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
  assert.equal(await page.style('#grey-block', 'backgroundColor'), css(derived.ramp[6]));
  assert.match(await page.style('#sidebar .selected', 'backgroundColor'), /^rgba\(122, 162, 247, 0\.16/);
  // Authored block colours keep Notion's dark values.
  assert.equal(await page.token('#red-block', '--c-redBacPri'), '#241d1d');
  assert.equal(await page.style('#red-block', 'backgroundColor'), css('#241d1d'));
  assert.equal(await page.token('#blue-text', '--c-bluTexPri'), NOTION_DARK['--c-bluTexPri']);
  assert.equal(await page.token('#red-block', '--c-redTexPri'), NOTION_DARK['--c-redTexPri']);
  // Primary buttons draw white labels on this blue, so it stays Notion's.
  assert.equal(await page.token('body', '--c-palUiBlu600'), '#2383e2');
  // A light-theme container inside the dark page keeps Notion's light surface.
  assert.equal(await page.style('#opposite', 'backgroundColor'), 'rgb(255, 255, 255)');
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
  assert.equal(await page.style('#code', 'backgroundColor'), css(derived.ramp[8]));
  assert.equal(await page.style('#sidebar', 'backgroundColor'), css(derived.ramp[4]));
  // Triplet tokens still resolve inside rgba().
  assert.equal(await page.style('#triplet', 'backgroundColor'), css('#1a1b26'));
  assert.match(await page.style('#triplet', 'color'), /^rgba\(169, 177, 214, 0\.7/);
  // Status, highlight, error, badge and presence colours keep Slack's values.
  assert.equal(await page.style('#error', 'color'), css('#e46e8f'));
  assert.equal(await page.style('#error', 'backgroundColor'), css('#451a26'));
  assert.equal(await page.style('#success', 'color'), css('#2bac76'));
  assert.equal(await page.style('#warning', 'backgroundColor'), css('#3e3218'));
  assert.equal(await page.style('#badge', 'backgroundColor'), css('#cd2553'));
  assert.equal(await page.style('#presence', 'backgroundColor'), css('#2bac76'));
  await page.close();
});

test('slack: switching the app appearance re-evaluates gating', async () => {
  const page = await browser.open('https://app.slack.com/?mode=dark');
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  await page.eval("document.getElementById('client').className = 'p-client sk-client-theme--light'");
  await page.waitFor("!document.documentElement.hasAttribute('data-omarchy-adapters')", 4000);
  assert.equal(await page.style('#client', 'backgroundColor'), 'rgb(255, 255, 255)');
  await page.eval("document.getElementById('client').className = 'p-client sk-client-theme--dark'");
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'", 4000);
  await page.close();
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
