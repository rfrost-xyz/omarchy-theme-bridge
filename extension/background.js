// Holds the native helper connection and publishes its palette to storage.
// Pages subscribe through storage, so this needs no tabs or host permission.
importScripts('content/colour.js');

// Chromium keeps a registered worker across restarts even after these files
// change. This marker identifies the code this worker runs; tests keep it in
// step with this file and its imports.
const WORKER_BUILD = '7341d3dc6974';
const HOST = 'xyz.rfrost.omarchy_theme_bridge';
const MIN_RETRY = 1000;
const MAX_RETRY = 30000;
let port = null;
let retry = MIN_RETRY;
let timer = null;

function setStatus(state, detail) {
  chrome.storage.local.set({ hostStatus: { state, detail: detail ? String(detail).slice(0, 200) : null, at: Date.now() } });
}

function schedule() {
  if (timer || port) return;
  timer = setTimeout(() => { timer = null; connect(); }, retry);
  retry = Math.min(retry * 2, MAX_RETRY);
}

function onMessage(message) {
  retry = MIN_RETRY;
  if (message?.type === 'palette') {
    const palette = OmarchyColour.validPalette(message);
    if (palette) {
      chrome.storage.local.set({ palette, hostStatus: { state: 'connected', detail: palette.name, at: Date.now() } });
    } else {
      setStatus('malformed', 'rejected by extension');
    }
  } else if (message?.type === 'status' && (message.state === 'missing' || message.state === 'malformed')) {
    // Keep the last good palette applied; only the status changes.
    setStatus(message.state);
  }
}

function connect() {
  if (port) return;
  clearTimeout(timer);
  timer = null;
  try {
    port = chrome.runtime.connectNative(HOST);
  } catch (error) {
    port = null;
    setStatus('disconnected', error?.message);
    schedule();
    return;
  }
  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(() => {
    const detail = chrome.runtime.lastError?.message;
    port = null;
    setStatus('disconnected', detail);
    schedule();
  });
}

// Compare with the installed file, which is read from disk, and report a
// stale worker separately from hostStatus so connection updates keep it.
async function checkBuild() {
  try {
    const response = await fetch(chrome.runtime.getURL('background.js'), { cache: 'no-store' });
    const installed = /^const WORKER_BUILD = '([0-9a-f]+)';$/m.exec(await response.text())?.[1];
    if (!installed) return;
    if (installed === WORKER_BUILD) await chrome.storage.local.remove('workerStatus');
    else await chrome.storage.local.set({ workerStatus: { state: 'stale', running: WORKER_BUILD, installed, at: Date.now() } });
  } catch { /* unreadable: leave the status as it is */ }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id === chrome.runtime.id && message?.type === 'ensure') {
    if (!port) { retry = MIN_RETRY; connect(); }
    checkBuild();
  }
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
checkBuild();
