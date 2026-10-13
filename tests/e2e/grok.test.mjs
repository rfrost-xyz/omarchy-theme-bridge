import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Browser } from './browser.mjs';

const require = createRequire(import.meta.url);
const C = require('../../extension/content/colour.js');
const DARK = { name: 'tokyo-night', mode: 'dark', colors: { background: '#1a1b26', foreground: '#a9b1d6', accent: '#7aa2f7' } };
const LIGHT = { name: 'latte', mode: 'light', colors: { background: '#eff1f5', foreground: '#4c4f69', accent: '#1e66f5' } };
const active = "document.documentElement.getAttribute('data-omarchy-adapters') === 'grok'";
const css = (hex) => `rgb(${C.triplet(hex)})`;
let browser;
let options;
before(async () => { browser = await Browser.launch(); options = await browser.options(); });
after(() => browser?.close());
const setPalette = (palette) => options.eval(`chrome.storage.local.set({ palette: ${JSON.stringify(palette)} })`);
const toggle = () => options.eval("[...document.querySelectorAll('#adapters label')].find((label) => label.textContent.includes('Grok.com')).querySelector('input').click()");

for (const palette of [DARK, LIGHT]) {
  test(`grok: ${palette.mode} root and warm body semantic mappings preserve meaning`, async () => {
    await setPalette(palette);
    const page = await browser.open(`https://grok.com/?mode=${palette.mode}`);
    await page.waitFor(`${active} && document.documentElement.dataset.omarchyMode === '${palette.mode}'`);
    const d = C.derive(palette);
    assert.equal(await page.style('body', 'backgroundColor'), css(palette.colors.background));
    assert.equal(await page.style('body', 'color'), css(d.text));
    assert.equal(await page.style('#sidebar', 'backgroundColor'), css(d.ramp[4]));
    assert.equal(await page.style('#sidebar', 'color'), css(d['text-secondary']));
    assert.equal(await page.style('#secondary', 'color'), css(d['text-secondary']));
    assert.equal(await page.style('#muted', 'color'), css(d['text-tertiary']));
    assert.equal(await page.style('#link', 'color'), css(d['accent-text']));
    assert.equal(await page.style('#dialog', 'backgroundColor'), css(d.ramp[3]));
    assert.equal(await page.style('#dialog', 'borderTopColor'), css(d.ramp[20]));
    assert.equal(await page.style('#input', 'backgroundColor'), css(d.ramp[4]));
    assert.equal(await page.style('#input', 'borderTopColor'), css(d.ramp[40]));
    assert.equal(await page.style('#button', 'backgroundColor'), css(d.text));
    assert.equal(await page.style('#button', 'color'), css(palette.colors.background));
    assert.equal(await page.style('#composer', 'backgroundColor'), css(d.ramp[4]));
    assert.equal(await page.style('#bubble', 'backgroundColor'), css(d.ramp[8]));
    assert.equal(await page.style('#legacy', 'backgroundColor'), css(palette.colors.background));
    assert.equal(await page.style('#scope', 'backgroundColor'), css(d.ramp[8]));
    assert.equal(await page.style('#deep', 'backgroundColor'), css(d.ramp[8]));
    assert.equal(await page.style('#deep-hover', 'backgroundColor'), css(d.ramp[8]));
    assert.equal(await page.style('#opposite', 'backgroundColor'), palette.mode === 'dark' ? css('#fcfcfc') : css('#050505'));
    await page.eval("document.querySelector('#input').focus()");
    assert.equal(await page.style('#input', 'borderTopColor'), css(d['accent-text']));
    await page.eval("document.querySelector('#input').blur(); const inserted = document.createElement('div'); inserted.id = 'inserted'; inserted.textContent = 'Inserted neutral content'; document.querySelector('main').appendChild(inserted)");
    assert.equal(await page.style('#inserted', 'backgroundColor'), css(d.ramp[8]));
    assert.equal(await page.style('#inserted', 'color'), css(d.text));

    const selectors = ['#danger', '#success', '#warning', '#added', '#removed', '#incognito', '#brand', '#banner', '#badge', '#code', '#syntax', '#gradient'];
    const meaning = () => page.eval(`Object.fromEntries(${JSON.stringify(selectors)}.map((s) => { const c = getComputedStyle(document.querySelector(s)); return [s, s === '#gradient' ? [c.backgroundImage] : [c.color, c.backgroundColor]]; }))`);
    const media = () => page.eval("(() => {const e = document.querySelector('#media'); const c = getComputedStyle(e); return [e.getAttribute('src'), c.filter, c.opacity];})()");
    const themed = await meaning();
    const themedMedia = await media();
    await toggle();
    await page.waitFor(`!(${active})`);
    assert.deepEqual(themed, await meaning());
    assert.deepEqual(themedMedia, await media());
    assert.equal(await page.style('body', 'backgroundColor'), palette.mode === 'dark' ? css('#131211') : css('#f9f8f7'));
    await toggle();
    await page.waitFor(active);
    await page.close();
  });
}

test('grok: mismatch, missing and contradictory appearance markers wait without changing settings', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://grok.com/?mode=light');
  await page.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await page.eval(active), false);
  assert.equal(await page.style('body', 'backgroundColor'), css('#f9f8f7'));
  await options.waitFor("[...document.querySelectorAll('#adapters li')].some((li) => li.textContent.includes('Grok.com') && li.textContent.includes('set the app to follow the system appearance'))");
  await page.eval("document.documentElement.classList.replace('light', 'dark')");
  await page.waitFor(active, 1000);
  assert.equal(await page.eval("document.documentElement.className"), 'scheme-light dark:scheme-dark dark');
  await page.eval("document.documentElement.classList.add('light')");
  await page.waitFor(`!(${active})`, 1000);
  assert.equal(await browser.storage('adapter:grok').then((v) => v.reason), 'app-mode-unknown');
  await page.eval("document.documentElement.classList.remove('light', 'dark')");
  assert.equal(await page.eval(active), false);
  await page.close();
  const unknown = await browser.open('https://grok.com/?mode=none');
  await unknown.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await unknown.eval(active), false);
  assert.equal(await unknown.style('body', 'backgroundColor'), css('#f9f8f7'));
  await unknown.eval("document.documentElement.classList.add('dark')");
  await unknown.waitFor(active, 1000);
  assert.equal(await unknown.eval("document.documentElement.hasAttribute('data-omarchy-remap')"), false);
  await unknown.close();
});

test('grok: live palette changes update the page and gate the opposite mode', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://grok.com/?mode=dark');
  await page.waitFor(active);
  await setPalette({ ...DARK, colors: { ...DARK.colors, background: '#24283b' } });
  await page.waitFor("getComputedStyle(document.body).backgroundColor === 'rgb(36, 40, 59)'");
  await setPalette(LIGHT);
  await page.waitFor(`!(${active}) && document.documentElement.dataset.omarchyMode === 'light'`);
  assert.equal(await page.style('body', 'backgroundColor'), css('#131211'));
  await page.eval("document.documentElement.classList.replace('dark', 'light')");
  await page.waitFor(active, 1000);
  assert.equal(await page.style('body', 'backgroundColor'), css(LIGHT.colors.background));
  await page.close();
});

test('grok: independent switch persists across page and browser reloads', async () => {
  await setPalette(DARK);
  const page = await browser.open('https://grok.com/?mode=dark');
  const slack = await browser.open('https://app.slack.com/?mode=dark');
  await page.waitFor(active);
  await slack.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  await toggle();
  await page.waitFor(`!(${active})`);
  assert.equal(await slack.eval("document.documentElement.getAttribute('data-omarchy-adapters')"), 'slack');
  await page.reload();
  await page.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await page.eval(active), false);
  assert.equal(await page.style('body', 'backgroundColor'), css('#131211'));
  await browser.restart();
  options = await browser.options();
  await options.waitFor("[...document.querySelectorAll('#adapters label')].some((label) => label.textContent.includes('Grok.com') && !label.querySelector('input').checked)");
  const reopened = await browser.open('https://grok.com/?mode=dark');
  await reopened.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await reopened.eval(active), false);
  assert.equal(await reopened.style('body', 'backgroundColor'), css('#131211'));
  await toggle();
  await reopened.waitFor(active);
  await reopened.close();
});

test('grok: alternate and lookalike origins receive no palette or adapter scripts', async () => {
  for (const origin of ['https://www.grok.com/', 'https://grok.x.ai/', 'https://grok.example.test/']) {
    const page = await browser.open(origin);
    assert.equal(await page.eval("document.querySelector('#omarchy-theme-bridge-palette')"), null);
    assert.equal(await page.eval("document.documentElement.hasAttribute('data-omarchy-adapters')"), false);
    assert.equal(await page.token('body', '--omarchy-background'), '');
    await page.close();
  }
});
