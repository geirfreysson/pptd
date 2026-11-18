// Model-provider sign-in for the bundled pi, run by the app (lib/pi-login.js) on its own
// Electron binary in Node mode. It uses pi's own login code and credential store
// (<agent dir>/auth.json, normally ~/.pi/agent), so pi sees the sign-in exactly as if
// the user had typed /login in it.
//
// Protocol: newline-delimited JSON. The first line on stdin is the request:
//   {"cmd":"status"}
//     -> {"type":"status","ready":bool,"providers":{"<id>":bool,…}}
//        ready: pi has at least one usable model (stored sign-in, API key in the
//        environment, or a custom models.json), i.e. it won't say "No models available".
//   {"cmd":"login","provider":"<id>","method":"oauth"|"api_key","key":"…"?}
//     -> {"type":"auth_url","url","instructions"?} | {"type":"device_code","userCode","verificationUri"}
//        {"type":"info","message","links"?} | {"type":"progress","message"}
//        {"type":"prompt","id","kind":"text"|"secret","message","placeholder"?}
//        {"type":"prompt_closed","id"}   (the browser finished first; drop the field)
//        {"type":"done"} | {"type":"error","error"}
//     Later lines: {"type":"answer","id","value"}. Cancelling is the app killing us.
//
// PPTD_PI_PKG is the pi-coding-agent package folder. Nothing secret is written to stdout.

import { createInterface } from 'node:readline';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const PROVIDERS = ['openai-codex', 'anthropic'];

const pkg = process.env.PPTD_PI_PKG;
if (!pkg) { out({ type: 'error', error: 'PPTD_PI_PKG is not set.' }); process.exit(1); }
const load = (rel) => import(pathToFileURL(path.join(pkg, 'dist', rel)).href);

// Provider errors can quote tokens; keep anything token-shaped out of the UI and logs.
const clean = (e) => (e instanceof Error ? e.message : String(e || ''))
  .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]').trim() || 'Sign-in failed.';

const lines = createInterface({ input: process.stdin, terminal: false });
let onRequest;
const request = new Promise((resolve) => { onRequest = resolve; });
const answers = new Map(); // prompt id -> resolve
lines.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (onRequest) { const r = onRequest; onRequest = null; r(msg); return; }
  if (msg?.type === 'answer' && answers.has(msg.id)) {
    const resolve = answers.get(msg.id);
    answers.delete(msg.id);
    resolve(String(msg.value ?? ''));
  }
});

async function runtime() {
  const [{ ModelRuntime }, { SettingsManager }, { getAgentDir }, http] = await Promise.all([
    load('core/model-runtime.js'), load('core/settings-manager.js'), load('config.js'), load('core/http-dispatcher.js'),
  ]);
  const settings = SettingsManager.create(process.cwd(), getAgentDir(), { projectTrusted: false });
  http.applyHttpProxySettings(settings.getGlobalSettings().httpProxy);
  http.configureHttpDispatcher(settings.getHttpIdleTimeoutMs());
  const models = await ModelRuntime.create({ allowModelNetwork: false, signal: AbortSignal.timeout(15_000) });
  return { models, settings };
}

async function status() {
  const { models } = await runtime();
  const available = await models.getAvailable(undefined, { signal: AbortSignal.timeout(15_000) });
  const providers = {};
  for (const id of PROVIDERS) {
    try { providers[id] = models.hasConfiguredAuth(id); } catch { providers[id] = false; }
  }
  out({ type: 'status', ready: available.length > 0, providers });
}

async function login({ provider, method, key }) {
  if (!PROVIDERS.includes(provider) || !['oauth', 'api_key'].includes(method)) {
    out({ type: 'error', error: 'That sign-in method isn\'t offered.' });
    return;
  }
  const { models, settings } = await runtime();
  const controller = new AbortController();
  let seq = 0;
  const interaction = {
    signal: controller.signal,
    async prompt(p) {
      // A sign-in method choice: take the first (the browser sign-in), as `pi auth login` does.
      if (p.type === 'select') return p.options[0]?.id;
      // The API key was typed into the app's form already.
      if (p.type === 'secret' && method === 'api_key' && key) return key;
      const id = `p${++seq}`;
      out({ type: 'prompt', id, kind: p.type === 'secret' ? 'secret' : 'text', message: p.message, placeholder: p.placeholder });
      return new Promise((resolve, reject) => {
        answers.set(id, resolve);
        p.signal?.addEventListener('abort', () => {
          answers.delete(id);
          out({ type: 'prompt_closed', id });
          reject(p.signal.reason ?? new Error('Prompt closed'));
        }, { once: true });
      });
    },
    notify(e) {
      if (e.type === 'auth_url') out({ type: 'auth_url', url: e.url, instructions: e.instructions });
      else if (e.type === 'device_code') out({ type: 'device_code', userCode: e.userCode, verificationUri: e.verificationUri });
      else if (e.type === 'info') out({ type: 'info', message: e.message, links: e.links });
      else if (e.message) out({ type: 'progress', message: e.message });
    },
  };
  try {
    await models.login(provider, method, interaction, { getDeviceId: () => settings.getOrCreateDeviceId() });
  } catch (e) {
    out({ type: 'error', error: clean(e) });
    return;
  }
  // Fetch the provider's model list now, as `pi auth login` does; pi retries on start anyway.
  try { await models.refresh({ providers: [provider], signal: AbortSignal.timeout(15_000) }); } catch {}
  out({ type: 'done' });
}

try {
  const req = await request;
  if (req?.cmd === 'status') await status();
  else if (req?.cmd === 'login') await login(req);
  else out({ type: 'error', error: 'Unknown request.' });
} catch (e) {
  out({ type: 'error', error: clean(e) });
}
process.exit(0);
