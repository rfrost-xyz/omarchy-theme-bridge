// Throwaway headless Chromium with the extension loaded, the real helper
// registered inside the temporary profile and synthetic app pages served
// through CDP. Never touches the live profile or live Omarchy state.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync, renameSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EXTENSION_ID = 'pinjcoeajnkogbmcjjgkgjafpiiebheg';
const HOST_NAME = 'xyz.rfrost.omarchy_webapp_theme';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIXTURES = { 'app.notion.com': 'notion.html', 'app.slack.com': 'slack.html', 'meet.google.com': 'meet.html' };

export class Browser {
  static async launch() {
    const b = new Browser();
    await b.start();
    return b;
  }

  async start() {
    this.dir = mkdtempSync(join(process.env.E2E_TMPDIR || tmpdir(), 'omarchy-webapp-theme-e2e-'));
    this.state = join(this.dir, 'state');
    this.hostPath = join(this.dir, 'host', 'omarchy-webapp-theme-host');
    mkdirSync(dirname(this.hostPath), { recursive: true });
    copyFileSync(join(ROOT, 'host', 'omarchy-webapp-theme-host'), this.hostPath);
    chmodSync(this.hostPath, 0o755);
    const hosts = join(this.dir, 'profile', 'NativeMessagingHosts');
    mkdirSync(hosts, { recursive: true });
    writeFileSync(join(hosts, `${HOST_NAME}.json`), JSON.stringify({
      name: HOST_NAME, description: 'test', path: this.hostPath, type: 'stdio',
      allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
    }));
    mkdirSync(this.state, { recursive: true });
    await this.launchChromium();
  }

  async launchChromium() {
    // Let Chromium choose a free port and read it back, so concurrent runs
    // never share one.
    const activePort = join(this.dir, 'profile', 'DevToolsActivePort');
    rmSync(activePort, { force: true });
    this.proc = spawn(process.env.CHROMIUM || 'chromium', [
      '--headless=new', `--user-data-dir=${join(this.dir, 'profile')}`, '--remote-debugging-port=0',
      '--no-first-run', '--no-default-browser-check', '--disable-sync', '--window-size=1280,800',
      // Only this extension: packages such as 1Password register external
      // extensions for every profile, whose welcome tab hides test pages.
      `--load-extension=${join(ROOT, 'extension')}`, `--disable-extensions-except=${join(ROOT, 'extension')}`, 'about:blank',
    ], { stdio: 'ignore', env: { ...process.env, OMARCHY_PALETTE_STATE_DIR: this.state } });
    for (let i = 0; i < 100 && !existsSync(activePort); i++) await sleep(100);
    if (!existsSync(activePort)) throw new Error('Chromium did not start');
    this.port = Number(readFileSync(activePort, 'utf8').split('\n')[0]);
    let version;
    for (let i = 0; i < 100 && !version; i++) {
      try { version = await (await fetch(`http://127.0.0.1:${this.port}/json/version`)).json(); } catch { await sleep(100); }
    }
    if (!version) throw new Error('Chromium did not start');
    this.ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
    this.nextId = 0;
    this.pending = new Map();
    this.ws.onmessage = (event) => this.dispatch(JSON.parse(event.data));
  }

  dispatch(message) {
    if (message.id) {
      const waiter = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (!waiter) return;
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter.resolve(message.result);
      return;
    }
    if (message.method === 'Fetch.requestPaused') this.fulfil(message.params, message.sessionId);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method}: no reply`)); }, 15000);
      const settle = (fn) => (value) => { clearTimeout(timer); fn(value); };
      this.pending.set(id, { resolve: settle(resolve), reject: settle(reject), method });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  fulfil({ requestId, request }, sessionId) {
    const url = new URL(request.url);
    const fixture = FIXTURES[url.host];
    if (!fixture || url.pathname !== '/') {
      this.send('Fetch.fulfillRequest', { requestId, responseCode: 404, body: '' }, sessionId).catch(() => {});
      return;
    }
    let html = readFileSync(join(ROOT, 'tests', 'e2e', 'fixtures', fixture), 'utf8');
    html = html.replaceAll('{{MODE}}', url.searchParams.get('mode') === 'light' ? 'light' : 'dark');
    this.send('Fetch.fulfillRequest', {
      requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
      body: Buffer.from(html).toString('base64'),
    }, sessionId).catch(() => {});
  }

  async open(url) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    await this.send('Fetch.enable', { patterns: [{ urlPattern: 'https://app.notion.com/*' }, { urlPattern: 'https://app.slack.com/*' }, { urlPattern: 'https://meet.google.com/*' }] }, sessionId);
    await this.send('Page.enable', {}, sessionId);
    await this.send('Page.navigate', { url }, sessionId);
    const page = new Page(this, targetId, sessionId);
    await page.waitFor('document.readyState === "complete"');
    return page;
  }

  async options() {
    return this.open(`chrome-extension://${EXTENSION_ID}/options/options.html`);
  }

  async workerTarget() {
    const { targetInfos } = await this.send('Target.getTargets');
    return targetInfos.find((t) => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${EXTENSION_ID}/`));
  }

  async stopWorker() {
    const target = await this.workerTarget();
    if (!target) return false;
    const { sessionId } = await this.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await this.send('ServiceWorker.enable', {}, sessionId).catch(() => {});
    await this.send('ServiceWorker.stopAllWorkers', {}, sessionId).catch(() => {});
    await this.send('Target.closeTarget', { targetId: target.targetId }).catch(() => {});
    for (let i = 0; i < 50; i++) {
      if (!(await this.workerTarget())) return true;
      await sleep(100);
    }
    return false;
  }

  hostPids() {
    try {
      return execFileSync('pgrep', ['-f', this.hostPath], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(Number);
    } catch { return []; }
  }

  // Swap the registered helper for one that exits at once, and back.
  breakHost() {
    writeFileSync(this.hostPath, '#!/bin/sh\nexit 0\n');
    chmodSync(this.hostPath, 0o755);
  }

  restoreHost() {
    copyFileSync(join(ROOT, 'host', 'omarchy-webapp-theme-host'), this.hostPath);
    chmodSync(this.hostPath, 0o755);
  }

  killHost() {
    for (const pid of this.hostPids()) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
  }

  // Mirror omarchy-theme-set: stage next-theme, remove theme, move, write name.
  setTheme(name, colours, { replace = true } = {}) {
    const theme = join(this.state, 'theme');
    if (replace) {
      const next = join(this.state, 'next-theme');
      rmSync(next, { recursive: true, force: true });
      mkdirSync(next, { recursive: true });
      writeFileSync(join(next, 'colors.toml'), colours);
      rmSync(theme, { recursive: true, force: true });
      renameSync(next, theme);
    } else {
      mkdirSync(theme, { recursive: true });
      writeFileSync(join(theme, 'colors.toml'), colours);
    }
    writeFileSync(join(this.state, 'theme.name'), `${name}\n`);
  }

  removeTheme() { rmSync(join(this.state, 'theme'), { recursive: true, force: true }); }

  // Read extension storage from an extension page; content pages cannot.
  async storage(key) {
    if (!this.extensionPage) this.extensionPage = await this.options();
    return this.extensionPage.eval(`chrome.storage.local.get(${JSON.stringify(key)}).then((v) => v[${JSON.stringify(key)}] ?? null)`);
  }

  async waitForStorage(predicate, timeout = 8000) {
    const start = Date.now();
    let last;
    while (Date.now() - start < timeout) {
      last = await this.storage('hostStatus');
      if (predicate(last)) return last;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for host status (last: ${JSON.stringify(last)})`);
  }

  async stopChromium() {
    this.extensionPage = null;
    // The connection closes before Chromium can reply, so do not wait for one.
    this.send('Browser.close').catch(() => {});
    this.ws?.close();
    await new Promise((resolve) => { if (this.proc.exitCode !== null) resolve(); else { this.proc.once('exit', resolve); setTimeout(() => { this.proc.kill('SIGKILL'); resolve(); }, 3000); } });
    this.killHost();
  }

  async restart() {
    await this.stopChromium();
    await this.launchChromium();
  }

  async close() {
    await this.stopChromium();
    if (existsSync(this.dir)) rmSync(this.dir, { recursive: true, force: true });
  }
}

class Page {
  constructor(browser, targetId, sessionId) { Object.assign(this, { browser, targetId, sessionId }); }

  async eval(expression) {
    const result = await this.browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, this.sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }

  async waitFor(expression, timeout = 8000) {
    const start = Date.now();
    let last;
    while (Date.now() - start < timeout) {
      try { last = await this.eval(expression); if (last) return last; } catch (error) { last = error.message; }
      await sleep(100);
    }
    throw new Error(`Timed out waiting for ${expression} (last: ${JSON.stringify(last)})`);
  }

  // Resolved custom property on an element, or a computed style property.
  token(selector, name) {
    return this.eval(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).getPropertyValue(${JSON.stringify(name)}).trim()`);
  }

  style(selector, property) {
    return this.eval(`getComputedStyle(document.querySelector(${JSON.stringify(selector)}))[${JSON.stringify(property)}]`);
  }

  async reload() {
    await this.browser.send('Page.reload', {}, this.sessionId);
    await sleep(200);
    await this.waitFor('document.readyState === "complete"');
  }

  close() { return this.browser.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {}); }
}
