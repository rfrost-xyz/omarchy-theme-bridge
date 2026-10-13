import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Browser } from './browser.mjs';

const DARK = 'mode = "dark"\nbackground = "#1a1b26"\nforeground = "#a9b1d6"\naccent = "#7aa2f7"\n';
const CHANGED = 'mode = "dark"\nbackground = "#24283b"\nforeground = "#c0caf5"\naccent = "#7aa2f7"\n';
const active = (id) => `document.documentElement.getAttribute('data-omarchy-adapters') === '${id}'`;
const toggle = (page, label) => page.eval(`[...document.querySelectorAll('#adapters label')].find((l) => l.textContent.trim() === '${label}').querySelector('input').click()`);
// Relative HSL consumers resolve to color(srgb ...), direct tokens to rgb(...).
const waitBackground = (page, channels) => page.waitFor(`(() => {
  const value = getComputedStyle(document.body).backgroundColor;
  const components = (value.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
  const rgb = components.map((v) => Math.round(value.startsWith('color(srgb') ? v * 255 : v));
  return JSON.stringify(rgb) === '${JSON.stringify(channels)}';
})()`);
let browser;
after(() => browser?.close());

test('X and Grok.com receive helper updates and keep independent switches and cached palette after restart', async () => {
  browser = await Browser.launch();
  browser.setTheme('tokyo-night', DARK);
  let x = await browser.open('https://x.com/?mode=dark');
  let grok = await browser.open('https://grok.com/?mode=dark');
  await x.waitFor(active('x'));
  await grok.waitFor(active('grok'));
  await x.eval('window.__noReload = 1');
  await grok.eval('window.__noReload = 1');
  browser.setTheme('storm', CHANGED);
  for (const page of [x, grok]) {
    await waitBackground(page, [36, 40, 59]);
    assert.equal(await page.eval('window.__noReload'), 1);
  }

  let options = await browser.options();
  await toggle(options, 'X');
  await x.waitFor(`!(${active('x')})`);
  assert.equal(await grok.eval(active('grok')), true);
  // The new browser must use the saved palette while its helper is unavailable.
  browser.breakHost();
  await browser.restart();
  x = await browser.open('https://x.com/?mode=dark');
  grok = await browser.open('https://grok.com/?mode=dark');
  await x.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await x.eval(active('x')), false);
  await grok.waitFor(active('grok'));
  assert.equal(await grok.style('body', 'backgroundColor'), 'rgb(36, 40, 59)');
  assert.deepEqual(await browser.storage('disabledAdapters'), ['x']);
  options = await browser.options();
  await options.waitFor("[...document.querySelectorAll('#adapters label')].some((l) => l.textContent.trim() === 'X' && !l.querySelector('input').checked)");
  await toggle(options, 'X');
  await x.waitFor(active('x'));
  await toggle(options, 'Grok.com');
  await grok.waitFor(`!(${active('grok')})`);
  assert.equal(await x.eval(active('x')), true);
  assert.deepEqual(await browser.storage('disabledAdapters'), ['grok']);
  await grok.reload();
  await grok.waitFor("document.documentElement.dataset.omarchyMode === 'dark'");
  assert.equal(await grok.eval(active('grok')), false);
  await toggle(options, 'Grok.com');
  await grok.waitFor(active('grok'));

  browser.restoreHost();
  browser.setTheme('tokyo-night', DARK);
  await x.eval("window.dispatchEvent(new Event('focus'))");
  for (const page of [x, grok]) {
    await waitBackground(page, [26, 27, 38]);
    await page.close();
  }
});
