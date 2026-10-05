import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Browser } from './browser.mjs';

const DARK = 'mode = "dark"\nbackground = "#1a1b26"\nforeground = "#a9b1d6"\naccent = "#7aa2f7"\n';
const LIGHT = 'mode = "light"\nbackground = "#eff1f5"\nforeground = "#4c4f69"\naccent = "#1e66f5"\n';
const DARK2 = 'mode = "dark"\nbackground = "#000000"\nforeground = "#ffffff"\naccent = "#8d8d8d"\n';
const bgVar = (page) => page.eval("getComputedStyle(document.documentElement).getPropertyValue('--omarchy-background').trim()");
const waitBg = (page, value, timeout) => page.waitFor(`getComputedStyle(document.documentElement).getPropertyValue('--omarchy-background').trim() === '${value}'`, timeout);

let browser;
before(async () => {
  browser = await Browser.launch();
  browser.setTheme('tokyo-night', DARK);
});
after(() => browser?.close());

test('initial load exposes palette properties', async () => {
  const page = await browser.open('https://app.notion.com/');
  await waitBg(page, '#1a1b26');
  assert.equal(await page.eval("document.documentElement.dataset.omarchyMode"), 'dark');
  assert.match(await page.eval("getComputedStyle(document.documentElement).getPropertyValue('--omarchy-accent-rgb').trim()"), /^122, 162, 247$/);
  assert.equal(await page.eval("document.querySelectorAll('#omarchy-webapp-theme-palette').length"), 1);
  await page.close();
});

test('live change and directory replacement reach open pages without reload', async () => {
  const notion = await browser.open('https://app.notion.com/');
  const slack = await browser.open('https://app.slack.com/');
  await waitBg(notion, '#1a1b26');
  await notion.eval('window.__marker = 1');
  browser.setTheme('vantablack', DARK2);
  await waitBg(notion, '#000000', 6000);
  await waitBg(slack, '#000000', 6000);
  browser.setTheme('tokyo-night', DARK, { replace: false });
  await waitBg(notion, '#1a1b26', 6000);
  assert.equal(await notion.eval('window.__marker'), 1, 'page was not reloaded');
  await notion.close();
  await slack.close();
});

test('options page reports the helper connection', async () => {
  const options = await browser.options();
  await options.waitFor("document.getElementById('host').textContent.includes('connected (tokyo-night)')");
  await options.close();
});

test('helper is relaunched after it is killed', async () => {
  const page = await browser.open('https://app.notion.com/');
  await waitBg(page, '#1a1b26');
  const before = browser.hostPids();
  assert.ok(before.length >= 1);
  browser.killHost();
  await browser.waitForStorage((s) => s?.state === 'disconnected');
  browser.setTheme('vantablack', DARK2);
  await waitBg(page, '#000000', 8000);
  assert.notDeepEqual(browser.hostPids(), before);
  await page.close();
});

test('stopped service worker reconnects when a page regains attention', async () => {
  const page = await browser.open('https://app.notion.com/');
  await waitBg(page, '#000000');
  browser.killHost();
  assert.ok(await browser.stopWorker(), 'service worker stopped');
  browser.setTheme('tokyo-night', DARK);
  // Simulate the window regaining focus, which sends an "ensure" message.
  await page.eval("window.dispatchEvent(new Event('focus'))");
  await waitBg(page, '#1a1b26', 8000);
  await page.close();
});

test('missing palette keeps the last good palette and reports missing', async () => {
  const page = await browser.open('https://app.slack.com/');
  await waitBg(page, '#1a1b26');
  browser.removeTheme();
  await browser.waitForStorage((s) => s?.state === 'missing', 6000);
  assert.equal(await bgVar(page), '#1a1b26');
  browser.setTheme('latte', LIGHT);
  await waitBg(page, '#eff1f5', 6000);
  await page.close();
});

test('malformed palette keeps the last good palette and reports malformed', async () => {
  const page = await browser.open('https://app.slack.com/');
  await waitBg(page, '#eff1f5');
  browser.setTheme('broken', 'background = "#000000"\n');
  await browser.waitForStorage((s) => s?.state === 'malformed', 6000);
  assert.equal(await bgVar(page), '#eff1f5');
  assert.equal((await browser.storage('hostStatus')).state, 'malformed');
  browser.setTheme('tokyo-night', DARK);
  await waitBg(page, '#1a1b26', 6000);
  await page.close();
});

test('cached palette applies after a browser restart, then refreshes', async () => {
  const page = await browser.open('https://app.notion.com/');
  await waitBg(page, '#1a1b26');
  browser.removeTheme();
  await browser.restart();
  const again = await browser.open('https://app.notion.com/');
  await waitBg(again, '#1a1b26', 4000);
  await browser.waitForStorage((s) => s?.state === 'missing', 6000);
  browser.setTheme('vantablack', DARK2);
  await waitBg(again, '#000000', 8000);
  await again.close();
});
