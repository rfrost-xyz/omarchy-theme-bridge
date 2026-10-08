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
  const page = await browser.open('https://app.slack.com/?mode=dark');
  await page.waitFor("document.documentElement.getAttribute('data-omarchy-adapters') === 'slack'");
  const options = await browser.options();
  await options.eval('setTimeout(() => chrome.runtime.reload(), 50); true');
  await page.waitFor("document.getElementById('omarchy-theme-bridge-palette') === null && !document.documentElement.hasAttribute('data-omarchy-mode') && !document.documentElement.hasAttribute('data-omarchy-adapters')", 6000);
  await page.close();
});
