// Separate browser: an unpacked --load-extension extension does not come back
// after runtime.reload() in headless Chromium, and a profile that has already
// been relaunched stops answering after the reload.
import { test, after } from 'node:test';
import { Browser } from './browser.mjs';

let browser;
after(() => browser?.close());

test('reloading the extension removes stale styling from open pages', async () => {
  browser = await Browser.launch();
  browser.setTheme('tokyo-night', 'mode = "dark"\nbackground = "#1a1b26"\nforeground = "#a9b1d6"\naccent = "#7aa2f7"\n');
  const pages = [];
  for (const [id, host] of [['slack', 'app.slack.com'], ['x', 'x.com'], ['grok', 'grok.com']]) {
    const page = await browser.open(`https://${host}/?mode=dark`);
    await page.waitFor(`document.documentElement.getAttribute('data-omarchy-adapters') === '${id}'`);
    pages.push(page);
  }
  const native = await browser.open('https://x.com/?client=native&mode=dark');
  await native.waitFor("getComputedStyle(document.querySelector('#timeline')).backgroundColor === 'rgb(26, 27, 38)'");
  pages.push(native);
  const options = await browser.options();
  await options.eval('setTimeout(() => chrome.runtime.reload(), 50); true');
  for (const page of pages) {
    await page.waitFor("document.getElementById('omarchy-theme-bridge-palette') === null && !document.documentElement.hasAttribute('data-omarchy-mode') && !document.documentElement.hasAttribute('data-omarchy-adapters')", 6000);
  }
  await native.waitFor("!document.documentElement.hasAttribute('data-omarchy-x-native') && !document.querySelector('#inline').style.cssText.includes('--omarchy-x-native') && ![...document.querySelector('#react-native-stylesheet').sheet.cssRules].some(r=>r.style?.cssText.includes('--omarchy-x-native'))",6000);
  for (const page of pages) await page.close();
});
