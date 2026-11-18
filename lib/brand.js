// Brand files: plain Markdown that tells the agent how slides should look.
//
// Lookup, first match wins:
//   1. brand.md in the deck's folder (a project or client brand, shared with the decks)
//   2. the user's default: <userData>/brand.md  (File › Edit Brand…)
// No match: the bundled skill's neutral palette.
//
// Brand files live outside the app bundle, so updates never overwrite them and
// nothing brand-specific ships with the app.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const BRAND_NAME = 'brand.md';
const TEMPLATE = path.join(__dirname, 'brand-template.md');

// Always the installed app's folder, so `npm start` and PPTD.app share one default brand.
const userBrandFile = () => path.join(app.getPath('appData'), 'PPTD', BRAND_NAME);
const folderBrandFile = (deck) => path.join(path.dirname(deck), BRAND_NAME);

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// → { file, scope: 'folder' | 'default' } or null
function findBrand(deck) {
  if (deck && isFile(folderBrandFile(deck))) return { file: folderBrandFile(deck), scope: 'folder' };
  if (isFile(userBrandFile())) return { file: userBrandFile(), scope: 'default' };
  return null;
}

// Create a brand file from `from` (default: the blank template) unless it exists.
function ensureBrandFile(file, from = TEMPLATE) {
  if (!isFile(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(from, file, fs.constants.COPYFILE_EXCL);
  }
  return file;
}

module.exports = { BRAND_NAME, TEMPLATE, findBrand, userBrandFile, folderBrandFile, ensureBrandFile };
