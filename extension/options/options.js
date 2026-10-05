// Lists adapters from the manifest so a new app needs no registry edit.
const adapterIds = chrome.runtime.getManifest().content_scripts
  .flatMap((entry) => entry.js)
  .map((file) => /^adapters\/([a-z0-9-]+)\/adapter\.js$/.exec(file)?.[1])
  .filter(Boolean);

const REASONS = {
  active: 'Applied',
  'active-remapped': "Applied; the app's own mode differs, so its status colours use the palette",
  disabled: 'Turned off',
  'no-palette': 'Waiting for the Omarchy palette',
  'app-mode-unknown': 'Waiting for the app to load',
  'mode-mismatch': 'Not applied: set the app to follow the system appearance',
};
const HOST = {
  connected: (d) => `Helper: connected${d ? ` (${d})` : ''}`,
  missing: () => 'Helper: no active Omarchy palette found; keeping the last one',
  malformed: () => 'Helper: the active palette could not be read; keeping the last one',
  disconnected: (d) => `Helper: not connected${d ? ` (${d})` : ''}`,
};

async function render() {
  const keys = ['hostStatus', 'disabledAdapters', ...adapterIds.map((id) => `adapter:${id}`)];
  const values = await chrome.storage.local.get(keys);
  const host = values.hostStatus;
  document.getElementById('host').textContent = host ? (HOST[host.state] ?? HOST.disconnected)(host.detail) : 'Helper: not connected yet';
  const disabled = new Set(values.disabledAdapters ?? []);
  const list = document.getElementById('adapters');
  list.replaceChildren(...adapterIds.map((id) => {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !disabled.has(id);
    box.addEventListener('change', async () => {
      const current = new Set((await chrome.storage.local.get('disabledAdapters')).disabledAdapters ?? []);
      if (box.checked) current.delete(id); else current.add(id);
      await chrome.storage.local.set({ disabledAdapters: [...current] });
    });
    label.append(box, ` ${id[0].toUpperCase()}${id.slice(1)}`);
    const status = document.createElement('span');
    status.className = 'status';
    const state = values[`adapter:${id}`];
    status.textContent = state ? `${REASONS[state.reason] ?? state.reason} (app ${state.appMode ?? 'unknown'}, palette ${state.paletteMode ?? 'none'})` : 'No open page yet';
    item.append(label, status);
    return item;
  }));
}

chrome.storage.onChanged.addListener(render);
render();
