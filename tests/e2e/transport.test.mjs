import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Browser } from './browser.mjs';

const DARK = 'mode = "dark"\nbackground = "#1a1b26"\nforeground = "#a9b1d6"\naccent = "#7aa2f7"\n';
const LIGHT = 'mode = "light"\nbackground = "#eff1f5"\nforeground = "#4c4f69"\naccent = "#1e66f5"\n';
const DARK2 = 'mode = "dark"\nbackground = "#000000"\nforeground = "#ffffff"\naccent = "#8d8d8d"\n';
const bgVar = (page) => page.eval("getComputedStyle(document.documentElement).getPropertyValue('--omarchy-background').trim()");
const waitBg = (page, value, timeout) => page.waitFor(`getComputedStyle(document.documentElement).getPropertyValue('--omarchy-background').trim() === '${value}'`, timeout);

// Each test sets the theme it starts from, so tests can run alone or in any order.
async function openWith(url, name, colours, background) {
  browser.setTheme(name, colours);
  const page = await browser.open(url);
  await waitBg(page, background, 8000);
  return page;
}

let browser;
before(async () => {
  browser = await Browser.launch();
  browser.setTheme('tokyo-night', DARK);
});
after(() => browser?.close());

test('initial load exposes palette properties', async () => {
  const page = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
  assert.equal(await page.eval("document.documentElement.dataset.omarchyMode"), 'dark');
  assert.match(await page.eval("getComputedStyle(document.documentElement).getPropertyValue('--omarchy-accent-rgb').trim()"), /^122, 162, 247$/);
  assert.equal(await page.eval("document.querySelectorAll('#omarchy-webapp-theme-palette').length"), 1);
  await page.close();
});

test('live change and directory replacement reach open pages without reload', async () => {
  const notion = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
  const slack = await browser.open('https://app.slack.com/');
  await waitBg(slack, '#1a1b26');
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
  const page = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
  await page.close();
  const options = await browser.options();
  await options.waitFor("document.getElementById('host').textContent.includes('connected (tokyo-night)')");
  await options.close();
});

test('helper is relaunched after it is killed', async () => {
  const page = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
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
  const page = await openWith('https://app.notion.com/', 'vantablack', DARK2, '#000000');
  browser.killHost();
  assert.ok(await browser.stopWorker(), 'service worker stopped');
  browser.setTheme('tokyo-night', DARK);
  // Simulate the window regaining focus, which sends an "ensure" message.
  await page.eval("window.dispatchEvent(new Event('focus'))");
  await waitBg(page, '#1a1b26', 8000);
  await page.close();
});

test('a live worker reconnects at once on ensure instead of waiting for backoff', async () => {
  const page = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
  browser.breakHost();
  try {
    browser.killHost();
    // Failed relaunches at about 1, 3 and 7 s push the next retry to about 15 s.
    await new Promise((r) => setTimeout(r, 8500));
    assert.ok(await browser.workerTarget(), 'worker stayed alive');
  } finally {
    browser.restoreHost();
  }
  browser.setTheme('vantablack', DARK2);
  const start = Date.now();
  await page.eval("window.dispatchEvent(new Event('focus'))");
  await waitBg(page, '#000000', 3000);
  assert.ok(Date.now() - start < 3000);
  browser.setTheme('tokyo-night', DARK);
  await waitBg(page, '#1a1b26', 6000);
  await page.close();
});

test('opening a page wakes a stopped worker and reconnects', async () => {
  const first = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
  await first.close();
  browser.killHost();
  assert.ok(await browser.stopWorker(), 'service worker stopped');
  browser.setTheme('vantablack', DARK2);
  const page = await browser.open('https://app.notion.com/');
  await waitBg(page, '#000000', 8000);
  await page.close();
});

test('a page becoming visible wakes a stopped worker and reconnects', async () => {
  const page = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
  browser.killHost();
  assert.ok(await browser.stopWorker(), 'service worker stopped');
  browser.setTheme('vantablack', DARK2);
  await page.eval("document.dispatchEvent(new Event('visibilitychange'))");
  await waitBg(page, '#000000', 8000);
  await page.close();
});

test('missing palette keeps the last good palette and reports missing', async () => {
  const page = await openWith('https://app.slack.com/', 'tokyo-night', DARK, '#1a1b26');
  browser.removeTheme();
  await browser.waitForStorage((s) => s?.state === 'missing', 6000);
  assert.equal(await bgVar(page), '#1a1b26');
  browser.setTheme('latte', LIGHT);
  await waitBg(page, '#eff1f5', 6000);
  await page.close();
});

test('malformed palette keeps the last good palette and reports malformed', async () => {
  const page = await openWith('https://app.slack.com/', 'latte', LIGHT, '#eff1f5');
  browser.setTheme('broken', 'background = "#000000"\n');
  await browser.waitForStorage((s) => s?.state === 'malformed', 6000);
  assert.equal(await bgVar(page), '#eff1f5');
  assert.equal((await browser.storage('hostStatus')).state, 'malformed');
  browser.setTheme('tokyo-night', DARK);
  await waitBg(page, '#1a1b26', 6000);
  await page.close();
});

test('cached palette applies after a browser restart, then refreshes', async () => {
  const page = await openWith('https://app.notion.com/', 'tokyo-night', DARK, '#1a1b26');
  browser.removeTheme();
  await browser.restart();
  const again = await browser.open('https://app.notion.com/');
  await waitBg(again, '#1a1b26', 4000);
  await browser.waitForStorage((s) => s?.state === 'missing', 6000);
  browser.setTheme('vantablack', DARK2);
  await waitBg(again, '#000000', 8000);
  await again.close();
});
