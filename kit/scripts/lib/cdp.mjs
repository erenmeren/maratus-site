// Minimal Chrome DevTools Protocol helper. Zero install: node built-ins plus global fetch/WebSocket.
// Chrome runs headless on a random loopback debug port with a throw-away profile under $TMPDIR.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = process.env.HOME || os.homedir();
export const CHROME = process.env.KIT_CHROME ||
  path.join(HOME, '.hermes/tools/chromium-1248/chrome-mac-arm64',
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// `offline` maps every non-loopback host to NOTFOUND, so a page cannot reach the network.
export async function launch({ offline = false, extraArgs = [] } = {}) {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME} (set KIT_CHROME to override)`);
  const tmp = process.env.TMPDIR || os.tmpdir();
  const profile = fs.mkdtempSync(path.join(tmp, 'kit-chrome-'));
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--metrics-recording-only', '--mute-audio', '--hide-scrollbars',
    ...(offline ? ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] : []),
    ...extraArgs, 'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    try { proc.kill('SIGKILL'); } catch { /* already gone */ }
    for (let i = 0; i < 5; i += 1) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { /* Chrome is still exiting */ }
    }
  };
  process.once('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { cleanup(); process.exit(130); });

  // Chrome writes the port it picked into DevToolsActivePort.
  const portFile = path.join(profile, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 100 && !port; i += 1) {
    await sleep(100);
    if (fs.existsSync(portFile)) port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || 0;
    if (proc.exitCode !== null) break;
  }
  if (!port) { cleanup(); throw new Error('Chrome did not open a DevTools port'); }

  const newPage = async () => {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    const target = await res.json();
    return connect(target, port);
  };
  return { port, newPage, close: async () => { cleanup(); await sleep(50); } };
}

async function connect(target, port) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('DevTools socket failed'));
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { resolve, reject, method } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) reject(new Error(`${method}: ${d.error.message}`)); else resolve(d.result);
    } else for (const fn of listeners) fn(d);
  };
  const send = (method, params = {}, timeout = 30000) => new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); reject(new Error(`${method}: timed out`)); }, timeout);
    pending.set(n, {
      method,
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await send(`${domain}.enable`);

  // Runs an expression (or a function plus JSON arguments) in the page and returns its JSON value.
  const evaluate = async (fnOrExpr, ...args) => {
    const expression = typeof fnOrExpr === 'function'
      ? `(${fnOrExpr.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})` : fnOrExpr;
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 90000);
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  };
  const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile });

  // Navigates and waits for the load event (or the timeout). Returns the main document's HTTP status.
  const goto = async (url, { timeout = 20000, settle = 1500 } = {}) => {
    let status = null;
    let mimeType = '';
    let mainLoader = null;
    let done;
    const loaded = new Promise((resolve) => { done = resolve; });
    const off = on((e) => {
      if (e.method === 'Network.responseReceived' && e.params.type === 'Document' &&
          (!mainLoader || e.params.loaderId === mainLoader)) {
        status = e.params.response.status;
        mimeType = e.params.response.mimeType;
      }
      if (e.method === 'Page.loadEventFired') done('load');
    });
    try {
      let nav;
      try {
        nav = await send('Page.navigate', { url }, timeout);
      } catch (e) {
        return { ok: false, error: 'timeout', status, mimeType };
      }
      if (nav.errorText) return { ok: false, error: nav.errorText, status, mimeType };
      mainLoader = nav.loaderId || null;
      let timer;
      const result = await Promise.race([
        loaded, new Promise((r) => { timer = setTimeout(() => r('timeout'), timeout); }),
      ]);
      clearTimeout(timer);
      if (result === 'timeout') return { ok: false, error: 'timeout', status, mimeType };
      await sleep(settle);
      return { ok: true, status, mimeType };
    } finally { off(); }
  };
  const screenshot = async (opts = {}) => {
    const s = await send('Page.captureScreenshot', { format: 'png', ...opts }, 60000);
    return Buffer.from(s.data, 'base64');
  };
  const close = async () => {
    try { ws.close(); } catch { /* ignore */ }
    try { await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`); } catch { /* ignore */ }
  };
  return { send, on, evaluate, viewport, goto, screenshot, close };
}

// Tiny argument parser: positionals plus --flag, --flag value and --flag=value.
export function parseArgs(argv, { booleans = [] } = {}) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    const key = a.slice(2, eq > 0 ? eq : undefined);
    if (eq > 0) opt[key] = a.slice(eq + 1);
    else if (booleans.includes(key)) opt[key] = true;
    else {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`--${key} needs a value`);
      opt[key] = v;
      i += 1;
    }
  }
  return { pos, opt };
}

export function parseSize(text, fallback) {
  if (!text) return fallback;
  const m = /^(\d{2,5})x(\d{2,5})$/i.exec(String(text).trim());
  if (!m) throw new Error(`Bad size "${text}" (want WIDTHxHEIGHT)`);
  return { width: Number(m[1]), height: Number(m[2]) };
}
