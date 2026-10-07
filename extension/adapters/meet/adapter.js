// Meet does not follow the system appearance: its pages are light and its
// call screen is dark. The page-level mode is read from a named colour token
// the adapter never overrides (a light blue fill means dark), so it reads
// Meet's own value even while the adapter is active. Themed in either mode,
// except a page that is dark as a whole under a light palette: that may be
// the call screen, whose captions and controls sit over video, so it is left
// to Meet (reported as waiting, since the app mode is not usable).
globalThis.OmarchyWebappTheme.register({
  id: 'meet',
  modePolicy: 'any',
  appMode() {
    if (!document.body) return null;
    const fill = getComputedStyle(document.body).getPropertyValue('--ws-sys-color-extended-blue-fill').trim().toLowerCase();
    let rgb = null;
    if (/^#[0-9a-f]{3}$/.test(fill)) rgb = [...fill.slice(1)].map((c) => parseInt(c + c, 16));
    else if (/^#[0-9a-f]{6}$/.test(fill)) rgb = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
    else if (/^rgba?\(/.test(fill)) rgb = (fill.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    // Not loaded yet, or renamed: wait (the registry polls) rather than guess.
    if (!rgb || rgb.length !== 3 || rgb.some((v) => !(v >= 0 && v <= 255))) return null;
    const hex = globalThis.OmarchyColour.hex(rgb);
    const mode = globalThis.OmarchyColour.luminance(hex) > 0.3 ? 'dark' : 'light';
    if (mode === 'dark' && document.documentElement.dataset.omarchyMode === 'light') return null;
    return mode;
  },
});
