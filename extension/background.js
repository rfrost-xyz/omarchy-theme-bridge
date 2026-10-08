// Holds the native helper connection and publishes its palette to storage.
// Pages subscribe through storage, so this needs no tabs or host permission.
importScripts('content/colour.js');

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

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id === chrome.runtime.id && message?.type === 'ensure') {
    if (!port) { retry = MIN_RETRY; connect(); }
  }
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
