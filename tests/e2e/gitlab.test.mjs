import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Browser } from './browser.mjs';

const require = createRequire(import.meta.url);
const C = require('../../extension/content/colour.js');
const DARK = { name: 'tokyo-night', mode: 'dark', colors: { background: '#1a1b26', foreground: '#a9b1d6', accent: '#7aa2f7' } };
const LIGHT = { name: 'latte', mode: 'light', colors: { background: '#eff1f5', foreground: '#4c4f69', accent: '#1e66f5' } };
const active = "document.documentElement.getAttribute('data-omarchy-adapters') === 'gitlab'";
const css = (hex) => `rgb(${C.triplet(hex)})`;
let browser;
let options;
before(async () => { browser = await Browser.launch(); options = await browser.options(); });
after(() => browser?.close());
const setPalette = (palette) => options.eval(`chrome.storage.local.set({ palette: ${JSON.stringify(palette)} })`);
const toggle = () => options.eval("[...document.querySelectorAll('#adapters label')].find((label) => label.textContent.includes('Gitlab')).querySelector('input').click()");

for (const palette of [DARK, LIGHT]) {
  test(`gitlab: ${palette.mode} semantic mappings and meaning colours`, async () => {
    await setPalette(palette);
    const page = await browser.open(`https://git.squintopera.com/?mode=${palette.mode}`);
    await page.waitFor(`${active} && document.documentElement.dataset.omarchyMode === '${palette.mode}'`);
    const d = C.derive(palette);
    assert.equal(await page.style('body', 'backgroundColor'), css(palette.colors.background));
    assert.equal(await page.style('body', 'color'), css(d.text));
    assert.equal(await page.style('#sidebar', 'backgroundColor'), css(d.ramp[4]));
    assert.equal(await page.style('#sidebar', 'color'), css(d['text-secondary']));
    assert.equal(await page.style('#secondary', 'color'), css(d['text-secondary']));
    assert.equal(await page.style('#muted', 'color'), css(d['text-tertiary']));
    assert.equal(await page.style('#link', 'color'), css(d['accent-text']));
    assert.equal(await page.style('#menu', 'backgroundColor'), css(d.ramp[3]));
    assert.equal(await page.style('#dialog', 'borderTopColor'), css(d.ramp[palette.mode === 'dark' ? 12 : 20]));
    assert.equal(await page.style('#button', 'backgroundColor'), css(d.ramp[4]));
    assert.equal(await page.style('#button', 'color'), css(d.text));
    assert.equal(await page.style('#input', 'borderTopColor'), css(d.ramp[40]));
    assert.equal(await page.style('#code', 'backgroundColor'), css(d.ramp[8]));
    assert.equal(await page.style('#scope', 'backgroundColor'), css(palette.colors.background));
    assert.equal(await page.style('#opposite', 'backgroundColor'), palette.mode === 'dark' ? css('#ffffff') : css('#18171d'));
    // Compare resolved meaning colours to the unthemed app in the same mode.
    const selectors = ['#error', '#success', '#warning', '#pipeline', '#added', '#removed', '#syntax', '#label', '#confirm'];
    const colours = () => page.eval(`Object.fromEntries(${JSON.stringify(selectors)}.map((s) => { const c = getComputedStyle(document.querySelector(s)); return [s, [c.color, c.backgroundColor]]; }))`);
    const themed = await colours();
    await toggle();
    await page.waitFor("!document.documentElement.hasAttribute('data-omarchy-adapters')");
    assert.deepEqual(themed, await colours());
    assert.equal(await page.style('body', 'backgroundColor'), palette.mode === 'dark' ? css('#18171d') : css('#ffffff'));
    await toggle();
    await page.waitFor(active);
    await page.close();
  });
}

test('gitlab: mismatch reports waiting and root mode changes activate immediately', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://git.squintopera.com/?mode=light');
  await page.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await page.eval(active), false);
  assert.equal(await page.style('body', 'backgroundColor'), css('#ffffff'));
  await options.waitFor("[...document.querySelectorAll('#adapters li')].some((li) => li.textContent.includes('Gitlab') && li.textContent.includes('set the app to follow the system appearance'))");
  await page.eval("document.documentElement.classList.add('gl-dark')");
  await page.waitFor(active, 1000);
  await page.eval("document.documentElement.classList.remove('gl-dark')");
  await page.waitFor(`!(${active})`, 1000);
  assert.equal(await page.style('body', 'backgroundColor'), css('#ffffff'));
  assert.equal(await page.eval("document.documentElement.hasAttribute('data-omarchy-remap')"), false);
  await page.close();
});

test('gitlab: palette changes update an open page and gate the opposite mode', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://git.squintopera.com/?mode=dark');
  await page.waitFor(active);
  const changed = { ...DARK, colors: { ...DARK.colors, background: '#24283b' } };
  await setPalette(changed);
  await page.waitFor("getComputedStyle(document.body).backgroundColor === 'rgb(36, 40, 59)'");
  await setPalette(LIGHT);
  await page.waitFor(`!(${active}) && document.documentElement.dataset.omarchyMode === 'light'`);
  assert.equal(await page.style('body', 'backgroundColor'), css('#18171d'));
  await page.eval("document.documentElement.classList.remove('gl-dark')");
  await page.waitFor(active, 1000);
  assert.equal(await page.style('body', 'backgroundColor'), css(LIGHT.colors.background));
  await page.close();
});

test('gitlab: independent switch persists across a page reload', async () => {
  await setPalette(DARK);
  const gitlab = await browser.open('https://git.squintopera.com/?mode=dark');
  const slack = await browser.open('https://app.slack.com/?mode=dark');
  await gitlab.waitFor(active);
  await slack.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  await toggle();
  await gitlab.waitFor(`!(${active})`);
  assert.equal(await slack.eval("document.documentElement.getAttribute('data-omarchy-adapters')"), 'slack');
  await gitlab.reload();
  await gitlab.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await gitlab.eval(active), false);
  assert.equal(await gitlab.style('body', 'backgroundColor'), css('#18171d'));
  await toggle();
  await gitlab.waitFor(active);
  await gitlab.close();
  await slack.close();
});

test('gitlab: unrelated GitLab origins receive no extension scripts', async () => {
  for (const origin of ['https://gitlab.com/', 'https://git.example.test/']) {
    const page = await browser.open(origin);
    assert.equal(await page.eval("document.querySelector('#omarchy-theme-bridge-palette')"), null);
    assert.equal(await page.eval("document.documentElement.hasAttribute('data-omarchy-adapters')"), false);
    await page.close();
  }
});
