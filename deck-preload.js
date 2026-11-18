// Runs (isolated) inside every loaded presentation.
//  - Catches navigation keys before the deck's own radio group sees them
//    (which would wrap last→first) and hands them to the main process.
//  - Catches dropped files (images/video → add to this slide; .html → open).
const { ipcRenderer, webUtils } = require('electron');

let inShow = false;
ipcRenderer.on('mode', (_e, mode) => { inShow = mode !== 'normal'; });

const isRadioDeck = () =>
  !!document.querySelector('input.slide-radio, input[type=radio][name=slide]');

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;   // leave shortcuts to the menu
  const radio = isRadioDeck();
  let action = null;
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': if (radio) action = 'next'; break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': if (radio) action = 'prev'; break;
    case 'Home': if (radio) action = 'first'; break;
    case 'End': if (radio) action = 'last'; break;
    case 'Enter': case ' ': if (inShow) action = e.shiftKey ? 'prev' : 'next'; break;
    case 'Backspace': if (inShow) action = 'prev'; break;
    case 'Escape': if (inShow) action = 'exit'; break;
  }
  if (!action) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  ipcRenderer.send('deck-key', action);
}, true);

// ---------------------------------------------------------------- drop

let overlay = null;
let depth = 0;

function showOverlay(on) {
  if (on && !overlay) {
    overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = [
      'position:fixed', 'inset:10px', 'z-index:2147483647', 'pointer-events:none',
      'border:3px dashed #14a19e', 'border-radius:14px', 'background:rgba(20,161,158,.10)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font:600 18px -apple-system,BlinkMacSystemFont,sans-serif', 'color:#0d6e6c',
    ].join(';');
    const pill = document.createElement('span');
    pill.style.cssText = 'background:rgba(255,255,255,.95);padding:10px 18px;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,.18)';
    pill.textContent = 'Drop to add to this slide';
    overlay.appendChild(pill);
    document.documentElement.appendChild(overlay);
  } else if (!on && overlay) {
    overlay.remove();
    overlay = null;
  }
}

const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e) || inShow) return;
  e.preventDefault();
  depth++;
  showOverlay(true);
}, true);
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();                      // also stops Chromium navigating to the file
  e.dataTransfer.dropEffect = inShow ? 'none' : 'copy';
}, true);
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  depth = Math.max(0, depth - 1);
  if (!depth) showOverlay(false);
}, true);
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  depth = 0;
  showOverlay(false);
  if (inShow) return;
  const paths = [...e.dataTransfer.files].map((f) => webUtils.getPathForFile(f)).filter(Boolean);
  if (paths.length) ipcRenderer.send('deck-drop', paths);
}, true);
