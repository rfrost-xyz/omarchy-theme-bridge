// Read-only loader for stock Omarchy palettes, used as test data.
import { readdirSync, readFileSync, existsSync } from 'node:fs';

export const STOCK = process.env.OMARCHY_THEMES_DIR || '/usr/share/omarchy/themes';

export function parseColours(text) {
  const colors = {};
  let mode = null;
  for (const line of text.split('\n')) {
    const m = /^\s*([a-z_][a-z0-9_]*)\s*=\s*"([^"]*)"/.exec(line);
    if (!m) continue;
    if (m[1] === 'mode') mode = m[2];
    else if (/^#[0-9a-fA-F]{6}$/.test(m[2])) colors[m[1]] = m[2].toLowerCase();
  }
  return { mode, colors };
}

export function stockThemes() {
  if (!existsSync(STOCK)) return [];
  return readdirSync(STOCK)
    .filter((name) => existsSync(`${STOCK}/${name}/colors.toml`))
    .map((name) => ({ name, ...parseColours(readFileSync(`${STOCK}/${name}/colors.toml`, 'utf8')), raw: readFileSync(`${STOCK}/${name}/colors.toml`, 'utf8') }));
}
