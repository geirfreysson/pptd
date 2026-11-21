// Styles: the bundled ones live in the skill (agent/plugin/skills/pptd-slides/styles/<name>/);
// the user's own live in <appData>/PPTD/styles/<name>/, next to the default brand, where the
// agent makes them (PPTD.md, "Making a style") and app updates never touch them. Each holds
// STYLE.md (rules, "**Use for:** …"), style.css and a template.html built by pptd-style.mjs.
// A user style may not reuse a bundled name, so a name always means one style.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Always the installed app's folder, like the brand file, so `npm start` and PPTD.app share it.
const userStylesDir = () => path.join(app.getPath('appData'), 'PPTD', 'styles');

const isStyle = (dir) => { try { return fs.statSync(path.join(dir, 'style.css')).isFile(); } catch { return false; } };

// "**Use for:** …" from a STYLE.md, one line, trimmed for the note.
function useFor(dir, max = 140) {
  try {
    const md = fs.readFileSync(path.join(dir, 'STYLE.md'), 'utf8');
    const m = md.match(/\*\*Use for:\*\*\s*([\s\S]*?)(?:\n\s*\n|\n\*\*)/);
    const s = m ? m[1].replace(/\s+/g, ' ').trim() : '';
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch { return ''; }
}

// → [{ name, dir, useFor }] for the user's own styles (names as plain words only).
function userStyles() {
  const root = userStylesDir();
  let names = [];
  try { names = fs.readdirSync(root); } catch { return []; }
  return names.filter((n) => /^[a-z][a-z0-9-]{1,30}$/.test(n) && isStyle(path.join(root, n))).sort()
    .map((name) => ({ name, dir: path.join(root, name), useFor: useFor(path.join(root, name)) }));
}

// Where a style name lives: the bundled skill first (names there can't be taken), then the
// user's folder. → { where: 'bundled'|'user', dir } or null.
function resolveStyle(name, bundledDir) {
  if (!name) return null;
  const b = path.join(bundledDir, name);
  if (isStyle(b)) return { where: 'bundled', dir: b };
  const u = path.join(userStylesDir(), name);
  if (isStyle(u)) return { where: 'user', dir: u };
  return null;
}

module.exports = { userStylesDir, userStyles, resolveStyle };
