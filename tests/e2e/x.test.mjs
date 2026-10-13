import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Browser } from './browser.mjs';

const C = createRequire(import.meta.url)('../../extension/content/colour.js');
const DARK = { name: 'tokyo-night', mode: 'dark', colors: { background: '#1a1b26', foreground: '#a9b1d6', accent: '#7aa2f7' } };
const LIGHT = { name: 'latte', mode: 'light', colors: { background: '#eff1f5', foreground: '#4c4f69', accent: '#1e66f5' } };
const active = "document.documentElement.getAttribute('data-omarchy-adapters') === 'x'";
let browser;
let options;
before(async () => { browser = await Browser.launch(); options = await browser.options(); });
after(() => browser?.close());
const setPalette = (palette) => options.eval(`chrome.storage.local.set({ palette: ${JSON.stringify(palette)} })`);
const toggle = () => options.eval("[...document.querySelectorAll('#adapters label')].find((label) => label.textContent.trim() === 'X').querySelector('input').click()");

// Relative HSL computes to color(srgb ...); compare rounded channels with
// the same hex expectations as the direct-token consumers.
async function assertColour(page, selector, property, hex) {
  const value = await page.style(selector, property);
  const numbers = (value.match(/[\d.]+/g) || []).map(Number);
  const channels = value.startsWith('color(srgb') ? numbers.slice(0, 3).map((n) => Math.round(n * 255)) : numbers.slice(0, 3).map(Math.round);
  assert.deepEqual(channels, C.rgb(hex), `${selector} ${property}: ${value}`);
}

for (const palette of [DARK, LIGHT]) {
  test(`x: ${palette.mode} surfaces, text, controls and preserved meaning`, async () => {
    await setPalette(palette);
    const page = await browser.open(`https://x.com/?mode=${palette.mode}`);
    await page.waitFor(active);
    const d = C.derive(palette);
    for (const [selector, property, hex] of [
      ['html', 'backgroundColor', palette.colors.background],
      ['body', 'backgroundColor', palette.colors.background], ['body', 'color', d.text],
      ['#sidebar', 'backgroundColor', d.ramp[4]], ['#sidebar', 'color', d['text-secondary']],
      ['#secondary', 'color', d['text-secondary']], ['#muted', 'color', d['text-tertiary']],
      ['#dialog', 'backgroundColor', d.ramp[4]], ['#dialog', 'color', d.text],
      ['#dialog', 'borderTopColor', d.ramp[12]], ['#input', 'borderTopColor', d.ramp[40]],
      ['#input', 'backgroundColor', d.ramp[4]], ['#input', 'color', d.text],
      ['#button', 'backgroundColor', d.text], ['#button', 'color', palette.colors.background],
      ['#neutral-button', 'backgroundColor', d.ramp[4]], ['#neutral-button', 'color', d.text],
      ['#pressed', 'backgroundColor', d.ramp[8]], ['#pressed-secondary', 'color', d['text-secondary']],
      ['#pressed-muted', 'color', d['text-tertiary']],
      ['#scope', 'backgroundColor', palette.colors.background],
      ['#legacy', 'backgroundColor', d.ramp[4]], ['#legacy', 'color', d.text],
      ['#opposite', 'backgroundColor', palette.mode === 'dark' ? '#ffffff' : '#000000'],
    ]) await assertColour(page, selector, property, hex);
    const preserved = ['#error', '#success', '#warning', '#badge', '#verified', '#liked', '#reposted', '#subscribe', '#brand-button', '#brand-tint', '#chart', '#chat', '#destructive', '#media', '#authored', '#syntax'];
    const snapshot = () => page.eval(`Object.fromEntries(${JSON.stringify(preserved)}.map((s) => { const c = getComputedStyle(document.querySelector(s)); return [s, [c.color, c.backgroundColor, c.backgroundImage, c.borderTopColor]]; }))`);
    const themed = await snapshot();
    await toggle();
    await page.waitFor(`!(${active})`);
    assert.deepEqual(await snapshot(), themed);
    await assertColour(page, 'body', 'backgroundColor', palette.mode === 'dark' ? '#000000' : '#ffffff');
    await toggle();
    await page.waitFor(active);
    await page.close();
  });
}

test('x: mismatched and unknown appearances wait until a recognised marker appears', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://x.com/?mode=light');
  await page.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await page.eval(active), false);
  await assertColour(page, 'body', 'backgroundColor', '#ffffff');
  await options.waitFor("[...document.querySelectorAll('#adapters li')].some((li) => li.textContent.includes('X') && li.textContent.includes('set the app to follow the system appearance'))");
  await page.eval("document.documentElement.dataset.theme = 'dark'");
  await page.waitFor(active, 5000);
  for (const mode of ['dim', 'unexpected', null]) {
    await page.eval(mode === null ? "document.documentElement.removeAttribute('data-theme')" : `document.documentElement.dataset.theme = ${JSON.stringify(mode)}`);
    await page.waitFor(`!(${active})`, 5000);
    await options.waitFor("[...document.querySelectorAll('#adapters li')].some((li) => li.textContent.includes('X') && li.textContent.includes('Waiting for the app to load'))");
    await assertColour(page, 'body', 'backgroundColor', '#ffffff');
    await page.eval("document.documentElement.dataset.theme = 'dark'");
    await page.waitFor(active, 5000);
  }
  await page.eval("document.documentElement.dataset.theme = 'light'");
  await page.waitFor(`!(${active})`, 5000);
  assert.equal(await page.eval("document.documentElement.hasAttribute('data-omarchy-remap')"), false);
  await page.close();
});

test('x: an unknown mode at document start stays inactive', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://x.com/?mode=none');
  await page.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await page.eval(active), false);
  await assertColour(page, 'body', 'backgroundColor', '#ffffff');
  await page.close();
});

test('x: live palette updates and newly inserted neutral consumers follow the palette', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://x.com/?mode=dark');
  await page.waitFor(active);
  await page.eval("const node = document.createElement('div'); node.id = 'inserted'; node.className = 'inserted'; node.textContent = 'New post'; document.querySelector('main').appendChild(node)");
  await assertColour(page, '#inserted', 'backgroundColor', DARK.colors.background);
  const changed = { ...DARK, colors: { ...DARK.colors, background: '#24283b' } };
  await setPalette(changed);
  await page.waitFor("getComputedStyle(document.querySelector('#inserted')).backgroundColor === 'rgb(36, 40, 59)'");
  await assertColour(page, '#inserted', 'color', C.derive(changed).text);
  await assertColour(page, 'body', 'backgroundColor', changed.colors.background);
  await setPalette(LIGHT);
  await page.waitFor(`!(${active}) && document.documentElement.dataset.omarchyMode === 'light'`);
  await assertColour(page, 'body', 'backgroundColor', '#000000');
  await page.eval("document.documentElement.dataset.theme = 'light'");
  await page.waitFor(active, 5000);
  await assertColour(page, '#inserted', 'backgroundColor', LIGHT.colors.background);
  await page.close();
});

test('x: independent disable persists across page reload', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://x.com/?mode=dark');
  const slack = await browser.open('https://app.slack.com/?mode=dark');
  await page.waitFor(active);
  await slack.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  await toggle();
  await page.waitFor(`!(${active})`);
  assert.equal(await slack.eval("document.documentElement.getAttribute('data-omarchy-adapters')"), 'slack');
  await page.reload();
  await page.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await page.eval(active), false);
  await assertColour(page, 'body', 'backgroundColor', '#000000');
  await toggle();
  await page.waitFor(active);
  await page.close();
  await slack.close();
});

test('x: alternate, legacy and lookalike hosts receive no extension scripts', async () => {
  for (const origin of ['https://twitter.com/', 'https://www.x.com/', 'https://x.example.test/']) {
    const page = await browser.open(origin);
    assert.equal(await page.eval("document.querySelector('#omarchy-theme-bridge-palette')"), null);
    assert.equal(await page.eval("document.documentElement.hasAttribute('data-omarchy-adapters')"), false);
    await page.close();
  }
});
