// Branding is handled by the agent, not by app UI.
//
// - Each deck carries its own brand: <meta name="pptd-brand" content="Name"> and a
//   <style id="pptd-brand"> block with the brand's tokens and rules (docs/pptd-spec.md).
// - The user's DEFAULT brand is a Markdown file the agent writes the first time the user
//   creates a presentation: <appData>/PPTD/brand.md. New decks copy it in.
//
// The app only reports, with every prompt, which of these applies.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Always the installed app's folder, so `npm start` and PPTD.app share one default brand.
const userBrandFile = () => path.join(app.getPath('appData'), 'PPTD', 'brand.md');

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// The brand block lives in <head>; media data URIs come later, so the head of the file is enough.
function readHead(file, bytes = 512 * 1024) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.toString('utf8', 0, n);
  } catch { return ''; } finally { if (fd !== undefined) fs.closeSync(fd); }
}

// → { name, hasBlock } if the deck records a brand, else null.
function deckBrand(deck) {
  if (!deck) return null;
  const head = readHead(deck);
  const meta = head.match(/<meta\s+[^>]*name=["']pptd-brand["'][^>]*>/i);
  const hasBlock = /<style\s+[^>]*id=["']pptd-brand["']/i.test(head);
  if (!meta && !hasBlock) return null;
  const name = meta?.[0].match(/content=["']([^"']*)["']/i)?.[1] || '';
  return { name, hasBlock };
}

const defaultBrand = () => (isFile(userBrandFile()) ? userBrandFile() : null);

module.exports = { userBrandFile, deckBrand, defaultBrand };
