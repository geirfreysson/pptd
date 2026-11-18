// Model-provider sign-in for the bundled pi, driven from the app's sign-in panel.
// Runs agent/pi/login.mjs (pi's own login code and credential store) on the app's
// Electron binary in Node mode; see that file for the JSON-lines protocol.

const { spawn } = require('child_process');
const path = require('path');
const { loginEnv, findPi, piAgentDir, PI_LOGIN } = require('./agent');

// The providers the panel offers, and how each signs in.
const PROVIDERS = {
  'openai-codex': { name: 'ChatGPT', methods: ['oauth'] },
  anthropic: { name: 'Claude', methods: ['oauth', 'api_key'] },
};

async function helperEnv() {
  const cli = findPi();
  if (!cli) return null;
  const env = await loginEnv();
  return {
    ...env,
    PI_CODING_AGENT_DIR: piAgentDir(env),
    ELECTRON_RUN_AS_NODE: '1',
    PI_SKIP_VERSION_CHECK: '1',
    PI_TELEMETRY: '0',
    PPTD_PI_PKG: path.resolve(cli, '..', '..', '..'), // dist/bundle/cli.js -> package folder
  };
}

// Start the helper with one request. onEvent gets each JSON event; onExit runs once.
async function runHelper(request, onEvent, onExit) {
  const env = await helperEnv();
  if (!env) { onEvent({ type: 'error', error: 'The bundled pi agent is missing from this copy of PPTD.' }); onExit?.(); return null; }
  const proc = spawn(process.execPath, [PI_LOGIN], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buf = '';
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      try { onEvent(JSON.parse(line)); } catch {}
    }
  });
  proc.stderr.on('data', () => {}); // pi's warnings; nothing the panel needs
  let exited = false;
  const done = () => { if (!exited) { exited = true; onExit?.(); } };
  proc.on('exit', done);
  proc.on('error', (e) => { onEvent({ type: 'error', error: e.message }); done(); });
  const send = (obj) => { try { proc.stdin.write(`${JSON.stringify(obj)}\n`); } catch {} };
  send(request);
  return { send, kill: () => { try { proc.kill(); } catch {} } };
}

// Whether pi has a usable model, and which offered providers are signed in.
// Resolves null if it can't tell (pi will then explain for itself when it starts).
function piStatus() {
  return new Promise((resolve) => {
    let result = null;
    let helper = null;
    const timer = setTimeout(() => { helper?.kill(); resolve(null); }, 20000);
    runHelper({ cmd: 'status' }, (e) => { if (e.type === 'status') result = e; },
      () => { clearTimeout(timer); resolve(result); }).then((h) => { helper = h; });
  });
}

// One sign-in. Returns { answer(id, value), cancel() }.
function startLogin({ provider, method, key }, onEvent) {
  let helper = null;
  let cancelled = false;
  let finished = false;
  runHelper({ cmd: 'login', provider, method, key }, (e) => {
    if (e.type === 'done' || e.type === 'error') finished = true;
    if (!cancelled) onEvent(e);
  }, () => {
    if (!finished && !cancelled) onEvent({ type: 'error', error: 'Sign-in stopped unexpectedly.' });
  }).then((h) => { helper = h; if (cancelled) h?.kill(); });
  return {
    answer: (id, value) => helper?.send({ type: 'answer', id, value }),
    cancel: () => { cancelled = true; helper?.kill(); },
  };
}

module.exports = { PROVIDERS, piStatus, startLogin };
