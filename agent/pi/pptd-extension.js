// PPTD's extension for the bundled pi agent: the pi side of the Claude Code hooks in
// lib/agent.js, plus PPTD's own look. The app passes two files in the environment:
//
// - PPTD_STATE_FILE: the current-slide and brand note, rewritten by the app. Its text is
//   added to every prompt as a hidden message (Claude: the UserPromptSubmit hook).
//   PPTD_STATE_FILE.json has the same as data; the footer shows the slide on screen from it.
// - PPTD_CHANGES_FILE: notes about changes the user made to the deck in the app (moved a
//   slide, added media). Each note is sent once: steered into a running turn, or held for
//   the next prompt when idle (Claude: the UserPromptSubmit hook, next prompt only).
// - PPTD_EVENTS_FILE: after each write or edit, the file's absolute path is appended as
//   `"file_path": "…"`, so the app opens a deck the agent creates (Claude: PostToolUse).
//   The prompt history's JSON lines go there too: {"type":"prompt","text"} when a run
//   starts, {"type":"steer","text"} for messages sent while it runs, {"type":"end"} when it
//   ends (Claude: UserPromptSubmit and Stop hooks; Claude has no steering).
//
// The startup header is PPTD's (pi's logo, a slides prompt); pi's list of loaded skills and
// extensions is off via quietStartup in PPTD's pi settings (lib/agent.js).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Text, backgroundAnsi, foregroundAnsi, rgbColor, isAppleTerminalSession } from '@earendil-works/pi-tui';

// pi's logo (see pi's components/pi-logo.js): 4 cells by 2 lines of half blocks.
function logoLines(mode) {
  const fg = (c) => foregroundAnsi(c, mode);
  const coral = rgbColor(228, 138, 122), blue = rgbColor(79, 142, 179), yellow = rgbColor(234, 182, 93);
  const reset = '\x1b[0m';
  return [
    `${fg(coral)}${backgroundAnsi(blue, mode)}▀${reset}${fg(coral)}▀█${reset} `,
    `${fg(blue)}█▀${reset} ${fg(yellow)}█${reset}`,
  ];
}

function header(theme) {
  const mode = theme.getColorMode?.() ?? 'truecolor';
  const ask = theme.bold ? theme.bold(theme.fg('accent', 'So, what should be in your slides?')) : theme.fg('accent', 'So, what should be in your slides?');
  const tip = theme.fg('dim', 'Ask for a new presentation, or for a change to the slide on screen.');
  const keys = theme.fg('dim', 'Enter sends · Esc interrupts · / commands · Ctrl+D exits');
  if (isAppleTerminalSession()) return `${ask}\n${tip}\n${keys}`;
  const [top, bottom] = logoLines(mode);
  return `${top} ${ask}\n${bottom} ${tip}\n${keys}`;
}

// The footer line: what PPTD is showing, so the user sees what "this slide" means.
function slideStatus(file) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return undefined; }
  if (!s.deck) return 'PPTD · no deck open: ask for a new one';
  if (!s.total) return `PPTD · ${s.deck}`;
  return `PPTD · ${s.deck} · slide ${s.index + 1} of ${s.total}${s.label ? ` (${s.label})` : ''}`;
}

export default function pptd(pi) {
  // pi runs on PPTD's own Electron binary in Node mode. Don't hand that mode down to the
  // commands it runs (it would turn any Electron app they start into plain Node).
  delete process.env.ELECTRON_RUN_AS_NODE;

  const stateFile = process.env.PPTD_STATE_FILE;
  const eventsFile = process.env.PPTD_EVENTS_FILE;

  const changesFile = process.env.PPTD_CHANGES_FILE;

  // Take pending change notes (moved aside first, so a note written meanwhile isn't lost).
  const takeChanges = () => {
    if (!changesFile) return '';
    const taking = `${changesFile}.taking`;
    try {
      if (!fs.statSync(changesFile).size) return '';
      fs.renameSync(changesFile, taking);
      const text = fs.readFileSync(taking, 'utf8').trim();
      fs.rmSync(taking, { force: true });
      return text;
    } catch { return ''; }
  };
  const sendChanges = (ctx) => {
    const text = takeChanges();
    if (!text) return;
    pi.sendMessage({ customType: 'pptd-user-edit', content: text, display: false },
      { deliverAs: ctx.isIdle() ? 'nextTurn' : 'steer' });
  };

  let watcher = null;
  pi.on('session_start', (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setHeader((_tui, theme) => new Text(header(theme), 1, 0));
    if (!stateFile) return;
    const json = `${stateFile}.json`;
    const update = () => { if (ctx.hasUI) ctx.ui.setStatus('pptd', slideStatus(json)); };
    update();
    // The app rewrites the state file whenever the slide or deck changes, and appends to
    // the changes file when the user edits the deck.
    try {
      watcher?.close();
      watcher = fs.watch(path.dirname(json), (_e, name) => {
        if (!name || name === path.basename(json)) update();
        if (changesFile && (!name || name === path.basename(changesFile))) sendChanges(ctx);
      });
    } catch {}
  });
  pi.on('session_shutdown', () => { watcher?.close(); watcher = null; });

  const logEvent = (ev) => { if (eventsFile) try { fs.appendFileSync(eventsFile, `${JSON.stringify(ev)}\n`); } catch {} };
  let running = false;

  pi.on('before_agent_start', (event) => {
    if (event.messageType === 'user') { running = true; logEvent({ type: 'prompt', text: event.prompt }); }
    if (!stateFile || event.messageType !== 'user') return;
    let text = '';
    try { text = fs.readFileSync(stateFile, 'utf8').trim(); } catch {}
    // Any change notes the watcher hasn't sent yet go with this prompt.
    text = [text, takeChanges()].filter(Boolean).join('\n');
    if (!text) return;
    return { message: { customType: 'pptd', content: text, display: false } };
  });

  // Messages typed while a reply runs join that run (steered in, or queued as a follow-up).
  pi.on('input', (event) => {
    if (running && event.streamingBehavior && typeof event.text === 'string') logEvent({ type: 'steer', text: event.text });
  });
  // Settled: after any automatic retry and queued follow-ups (agent_end can come earlier).
  pi.on('agent_settled', (event) => {
    if (!running) return;
    running = false;
    logEvent({ type: 'end', outcome: event.aborted ? 'aborted' : '' });
  });

  pi.on('tool_result', (event, ctx) => {
    if (!eventsFile || event.isError || (event.toolName !== 'write' && event.toolName !== 'edit')) return;
    let p = event.input?.path;
    if (typeof p !== 'string' || !p) return;
    if (p.startsWith('@')) p = p.slice(1);
    if (p === '~' || p.startsWith('~/')) p = path.join(os.homedir(), p.slice(1));
    const file = path.resolve(ctx.cwd || process.cwd(), p);
    try { fs.appendFileSync(eventsFile, `"file_path": ${JSON.stringify(file)}\n`); } catch {}
  });
}
