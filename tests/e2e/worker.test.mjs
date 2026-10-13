// Chromium keeps running the registered worker after the extension's files
// change, even across restarts. Loads a copy of the extension so the test can
// change the installed worker under a running profile.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from './browser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DARK = 'mode = "dark"\nbackground = "#1a1b26"\nforeground = "#a9b1d6"\naccent = "#7aa2f7"\n';
const DARK2 = 'mode = "dark"\nbackground = "#000000"\nforeground = "#ffffff"\naccent = "#8d8d8d"\n';
const MARKER = /^const WORKER_BUILD = '([0-9a-f]+)';$/m;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitBg = (page, value) => page.waitFor(`getComputedStyle(document.documentElement).getPropertyValue('--omarchy-background').trim() === '${value}'`);

const dir = mkdtempSync(join(process.env.E2E_TMPDIR || tmpdir(), 'omarchy-theme-bridge-worker-'));
const extension = join(dir, 'extension');
const workerFile = join(extension, 'background.js');
let browser;
after(async () => {
  await browser?.close();
  rmSync(dir, { recursive: true, force: true });
});

function setInstalledBuild(build) {
  writeFileSync(workerFile, readFileSync(workerFile, 'utf8').replace(MARKER, `const WORKER_BUILD = '${build}';`));
}

async function workerStatus(predicate) {
  const start = Date.now();
  let last;
  while (Date.now() - start < 8000) {
    last = await browser.storage('workerStatus');
    if (predicate(last)) return last;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for worker status (last: ${JSON.stringify(last)})`);
}

const notice = (options) => options.eval("document.getElementById('worker').hidden ? null : document.getElementById('worker').textContent");

test('a worker older than the installed files is reported and keeps working', async () => {
  cpSync(join(ROOT, 'extension'), extension, { recursive: true });
  const built = MARKER.exec(readFileSync(workerFile, 'utf8'))[1];
  browser = await Browser.launch({ extension });
  browser.setTheme('tokyo-night', DARK);
  await browser.waitForStorage((s) => s?.state === 'connected');
  // A matching worker clears a stale status when a page asks it to connect.
  let options = await browser.options();
  await options.eval("chrome.storage.local.set({ workerStatus: { state: 'stale', running: 'x', installed: 'y', at: 0 } })");
  await options.waitFor("!document.getElementById('worker').hidden");
  const first = await browser.open('https://app.notion.com/');
  await workerStatus((s) => s === null);
  await options.waitFor("document.getElementById('worker').hidden");
  await first.close();

  // Simulate an update: the installed worker changes, the registered one does not.
  setInstalledBuild('0123456789ab');
  await browser.restart();
  const stale = await workerStatus((s) => s?.state === 'stale');
  assert.deepEqual({ running: stale.running, installed: stale.installed }, { running: built, installed: '0123456789ab' });
  options = await browser.options();
  assert.match(await notice(options), /Reload Omarchy Theme Bridge in chrome:\/\/extensions/);

  // The stale worker still connects and delivers palettes, and connection
  // updates leave the stale status in place.
  await browser.waitForStorage((s) => s?.state === 'connected');
  const page = await browser.open('https://app.notion.com/');
  await waitBg(page, '#1a1b26');
  browser.setTheme('vantablack', DARK2);
  await waitBg(page, '#000000');
  await browser.waitForStorage((s) => s?.detail === 'vantablack');
  assert.equal((await browser.storage('workerStatus'))?.state, 'stale');
  await page.close();

  // Once the installed files match the running worker again, the status clears.
  setInstalledBuild(built);
  await browser.restart();
  await workerStatus((s) => s === null);
  options = await browser.options();
  assert.equal(await notice(options), null);
});
