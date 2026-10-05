import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { stockThemes } from '../lib/themes.mjs';

const require = createRequire(import.meta.url);
const C = require('../../extension/content/colour.js');
const manifest = JSON.parse(readFileSync(new URL('../../extension/manifest.json', import.meta.url)));
export const EXTENSION_ID = 'pinjcoeajnkogbmcjjgkgjafpiiebheg';

test('manifest requests only nativeMessaging and storage', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['nativeMessaging', 'storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(manifest.externally_connectable, undefined);
});

test('content scripts match only the adapter origins and load the shared core first', () => {
  const matches = manifest.content_scripts.flatMap((c) => c.matches).sort();
  assert.deepEqual(matches, ['https://app.notion.com/*', 'https://app.slack.com/*']);
  for (const entry of manifest.content_scripts) {
    assert.deepEqual(entry.js.slice(0, 2), ['content/colour.js', 'content/palette.js']);
    assert.match(entry.js[2], /^adapters\/[a-z0-9-]+\/adapter\.js$/);
    assert.equal(entry.all_frames, undefined);
  }
});

test('key yields the fixed extension ID used by the helper manifest', () => {
  const digest = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32);
  const id = [...digest].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
  assert.equal(id, EXTENSION_ID);
});

test('validPalette accepts only clean palettes', () => {
  const ok = { type: 'palette', name: 'tokyo-night', mode: 'dark', colors: { background: '#000000', foreground: '#ffffff', accent: '#7aa2f7' } };
  assert.deepEqual(C.validPalette(ok), { name: 'tokyo-night', mode: 'dark', colors: ok.colors });
  assert.equal(C.validPalette({ ...ok, mode: 'sepia' }), null);
  assert.equal(C.validPalette({ ...ok, colors: { background: '#000000', foreground: '#ffffff' } }), null);
  const dirty = C.validPalette({ ...ok, name: '../x', colors: { ...ok.colors, red: 'red;}body{', 'x;y': '#000000' } });
  assert.equal(dirty.name, null);
  assert.deepEqual(Object.keys(dirty.colors).sort(), ['accent', 'background', 'foreground']);
});

test('paletteCss emits only custom properties from validated values', () => {
  const css = C.paletteCss({ name: 'x', mode: 'dark', colors: { background: '#1a1b26', foreground: '#a9b1d6', accent: '#7aa2f7', dark_background: '#13141c' } });
  assert.match(css, /--omarchy-dark-background: #13141c;/);
  assert.match(css, /--omarchy-background-rgb: 26, 27, 38;/);
  assert.match(css, /--omarchy-mix-8: #[0-9a-f]{6};/);
  for (const line of css.trim().split('\n').slice(1, -1)) assert.match(line, /^ {2}--omarchy-[a-z0-9-]+: (#[0-9a-f]{6}|\d+, \d+, \d+);$/);
});

const themes = stockThemes();
test('stock themes are available for the contrast matrix', { skip: themes.length === 0 && 'no stock themes on this machine' }, () => {
  assert.ok(themes.length >= 10);
});

for (const theme of themes) {
  test(`derived text is readable for ${theme.name}`, () => {
    const p = C.validPalette({ type: 'palette', name: theme.name, mode: theme.mode, colors: theme.colors });
    assert.ok(p, 'stock palette validates');
    const d = C.derive(p);
    const bg = p.colors.background;
    for (const surface of [bg, d.ramp[4], d.ramp[8]]) {
      assert.ok(C.contrast(d.text, surface) >= 4.5, `text on ${surface}`);
      assert.ok(C.contrast(d['text-secondary'], surface) >= 4.5, `secondary on ${surface}`);
      assert.ok(C.contrast(d['text-tertiary'], surface) >= 3, `tertiary on ${surface}`);
      assert.ok(C.contrast(d['accent-text'], surface) >= 4.5, `accent text on ${surface}`);
    }
    assert.ok(C.contrast(d['accent-ink'], p.colors.accent) >= 3, 'ink on accent fill');
    const darker = (a, b) => C.luminance(a) < C.luminance(b);
    assert.equal(darker(d.ramp[8], bg), p.mode === 'light', 'ramp moves towards the foreground');
  });
}
