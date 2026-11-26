#!/usr/bin/env node
// Builds the G1 reference gallery: first-viewport screenshots of live sites plus numbered contact sheets.
//
//   node gallery.mjs <sites.json> <outDir> [--timeout 25000] [--settle 3000] [--columns 2]
//                    [--renumber] [--offline]
//
// sites.json: [{ "n": 1, "url": "https://example.org/", "label": "Example" }, ...]
//
// Writes (everything below <outDir>/gallery/):
//   index.html              browsable gallery, desktop and mobile shot per site
//   contact-desktop.png     numbered contact sheet of the 1440x900 shots
//   contact-mobile.png      numbered contact sheet of the 390x844 shots
//   shots/NN-desktop.png    single screenshots (NN = the site's number), also NN-mobile.png
//   report.json             one entry per site: ok or skipped, with the reason
//
// A site is skipped when it blocks automation: HTTP 401/403/429, any other 4xx/5xx, a challenge page, a
// navigation error or a timeout. Nothing is retried or dismissed (no cookie-banner clicks). Numbers come
// from sites.json; --renumber closes the gaps left by skipped sites (the report keeps the old number as
// "listed"). Exit code: 0 = at least one shot, 1 = none, 2 = bad input.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, parseArgs, sleep } from './lib/cdp.mjs';

const HELP = 'usage: node gallery.mjs <sites.json> <outDir> [--timeout ms] [--settle ms] [--columns n] [--renumber] [--offline]';
const die = (msg) => { console.error(msg); process.exit(2); };

let pos, opt;
try {
  ({ pos, opt } = parseArgs(process.argv.slice(2), { booleans: ['renumber', 'offline', 'help'] }));
} catch (e) { die(`${e.message}\n${HELP}`); }
if (opt.help) { console.log(HELP); process.exit(0); }
if (pos.length !== 2) die(HELP);
const timeout = Number(opt.timeout || 25000);
const settle = Number(opt.settle || 3000);
const columns = Number(opt.columns || 2);
if (![timeout, settle, columns].every((n) => Number.isFinite(n) && n > 0)) die(`Bad number.\n${HELP}`);

let sites;
try { sites = JSON.parse(fs.readFileSync(pos[0], 'utf8')); } catch (e) { die(`Cannot read ${pos[0]}: ${e.message}`); }
if (!Array.isArray(sites) || !sites.length) die('sites.json must be a non-empty list.');
const seen = new Set();
for (const s of sites) {
  if (!Number.isInteger(s.n) || s.n < 1 || s.n > 99) die(`Bad n: ${JSON.stringify(s)}`);
  if (seen.has(s.n)) die(`Duplicate n: ${s.n}`);
  seen.add(s.n);
  if (typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) die(`Bad url: ${JSON.stringify(s)}`);
}
sites.sort((a, b) => a.n - b.n);

const out = path.join(path.resolve(pos[1]), 'gallery');
const shots = path.join(out, 'shots');
fs.mkdirSync(shots, { recursive: true });
// A re-run must not leave screenshots under old numbers.
for (const f of fs.readdirSync(shots)) if (/^\d\d-(desktop|mobile)\.png$/.test(f)) fs.rmSync(path.join(shots, f));
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (s) => s.label || new URL(s.url).hostname;

const VIEWS = [['desktop', 1440, 900, false], ['mobile', 390, 844, true]];
// Interstitials are short pages with one of these phrases; long pages may mention them legitimately.
const CHALLENGE = /just a moment|checking your browser|verify(ing)? (that )?you are (a )?human|are you a robot|attention required|unusual traffic|access denied|request blocked|enable javascript and cookies|captcha|press and hold|security check/i;

function challengeProbe() {
  const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim();
  return {
    title: document.title, length: text.length, text: text.slice(0, 1500),
    media: document.querySelectorAll('img,video,canvas,svg').length,
    frame: !!document.querySelector('iframe[src*="challenges.cloudflare.com"],iframe[src*="captcha"],#challenge-form,#px-captcha'),
  };
}

async function capture(browser, site) {
  const entry = { n: site.n, listed: site.n, url: site.url, label: label(site), status: 'ok', reason: '', httpStatus: null, title: '', capturedAt: new Date().toISOString(), files: {} };
  const skip = (reason) => { entry.status = 'skipped'; entry.reason = reason; return entry; };
  let page;
  try {
    page = await browser.newPage();
    const bytes = {};
    for (const [name, w, h, mobile] of VIEWS) {
      await page.viewport(w, h, mobile);
      const nav = await page.goto(site.url, { timeout, settle });
      entry.httpStatus = nav.status;
      if (nav.status === 401 || nav.status === 403 || nav.status === 429) return skip(`HTTP ${nav.status}: the site blocks automation (${name})`);
      if (nav.status >= 400) return skip(`HTTP ${nav.status} (${name})`);
      if (!nav.ok) return skip(nav.error === 'timeout' ? `timeout after ${timeout} ms (${name})` : `${nav.error} (${name})`);
      const p = await page.evaluate(challengeProbe);
      entry.title = p.title;
      const hit = CHALLENGE.exec(p.title) || (p.length < 1200 ? CHALLENGE.exec(p.text) : null);
      if (p.frame || hit) return skip(`challenge page: ${p.frame ? 'challenge frame or form' : `"${hit[0]}"`} (${name})`);
      if (p.length < 5 && p.media === 0) return skip(`blank page (${name})`);
      bytes[name] = await page.screenshot();
    }
    entry.bytes = bytes;
    return entry;
  } catch (e) {
    return skip(`error: ${e.message}`);
  } finally { if (page) await page.close(); }
}

// Contact sheet: an HTML page rendered by the same Chrome. Numbers are large enough to read on a phone.
function sheetHtml(list, view) {
  const desktop = view === 'desktop';
  const cols = desktop ? columns : columns * 2;
  const tileW = desktop ? 760 : 360;
  const tileH = desktop ? 475 : 780;
  const badge = desktop ? 120 : 96;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Contact sheet ${view}</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#fff;color:#111;font:600 26px/1.25 system-ui,sans-serif;width:${cols * tileW + (cols - 1) * 24 + 48}px}
main{display:grid;grid-template-columns:repeat(${cols},${tileW}px);gap:24px}
figure{margin:0;position:relative;border:2px solid #111}img{display:block;width:100%;height:${tileH}px;object-fit:cover;object-position:top}
b{position:absolute;left:0;top:0;min-width:${badge}px;height:${badge}px;padding:0 14px;background:#111;color:#fff;font-size:${Math.round(badge * 0.72)}px;line-height:${badge}px;text-align:center}
figcaption{padding:10px 14px;border-top:2px solid #111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>
<main>${list.map((e) => `<figure><img src="shots/${pad(e.n)}-${view}.png" alt=""><b>${e.n}</b><figcaption>${esc(e.label)}</figcaption></figure>`).join('')}</main></html>`;
}

function indexHtml(list, skipped) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reference gallery</title><style>
body{margin:0;padding:20px;background:#fff;color:#111;font:17px/1.45 system-ui,sans-serif}h1{font-size:28px;margin:0 0 16px}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:28px}h2{font-size:24px;margin:0 0 8px}
.n{display:inline-block;min-width:64px;padding:4px 12px;margin-right:12px;background:#111;color:#fff;font-size:44px;line-height:1.1;text-align:center;vertical-align:middle}
.pair{display:flex;gap:10px;align-items:flex-start}.pair img{display:block;border:1px solid #777;height:auto}.pair img:first-child{width:72%}.pair img:last-child{width:25%}a{color:#0b57a4;overflow-wrap:anywhere}</style></head><body>
<h1>Reference gallery</h1><main>${list.map((e) => `<section><h2><span class="n">${e.n}</span>${esc(e.label)}</h2><div class="pair"><img src="shots/${pad(e.n)}-desktop.png" alt="${esc(e.label)}, desktop"><img src="shots/${pad(e.n)}-mobile.png" alt="${esc(e.label)}, phone"></div><p><a href="${esc(e.url)}" rel="noreferrer">${esc(e.url)}</a></p></section>`).join('')}</main>
${skipped.length ? `<h2>Skipped</h2><ul>${skipped.map((e) => `<li>${esc(e.label)}: ${esc(e.reason)}</li>`).join('')}</ul>` : ''}</body></html>`;
}

const entries = [];
const sheets = [];
const browser = await launch({ offline: !!opt.offline });
let fatal = null;
try {
  for (const site of sites) {
    const e = await capture(browser, site);
    entries.push(e);
    console.log(`${pad(site.n)} ${e.status}${e.reason ? `: ${e.reason}` : ''}  ${site.url}`);
  }
  const ok = entries.filter((e) => e.status === 'ok');
  if (opt.renumber) ok.forEach((e, i) => { e.n = i + 1; });
  for (const e of ok) {
    for (const [name] of VIEWS) {
      const file = `${pad(e.n)}-${name}.png`;
      fs.writeFileSync(path.join(shots, file), e.bytes[name]);
      e.files[name] = `shots/${file}`;
    }
  }
  for (const e of entries) delete e.bytes;
  fs.writeFileSync(path.join(out, 'index.html'), indexHtml(ok, entries.filter((e) => e.status !== 'ok')));
  if (ok.length) {
    for (const [name] of VIEWS) {
      const tmp = path.join(out, `.sheet-${name}.html`);
      fs.writeFileSync(tmp, sheetHtml(ok, name));
      try {
        const page = await browser.newPage();
        await page.viewport(1600, 1200, false);
        const nav = await page.goto(pathToFileURL(tmp).href, { settle: 400 });
        if (!nav.ok) throw new Error(`contact sheet: ${nav.error}`);
        const box = await page.evaluate('({w:document.body.offsetWidth,h:document.body.offsetHeight})');
        await page.viewport(box.w, Math.min(box.h, 16000), false);
        await sleep(300);
        const file = `contact-${name}.png`;
        fs.writeFileSync(path.join(out, file), await page.screenshot());
        sheets.push(file);
        await page.close();
      } finally { fs.rmSync(tmp, { force: true }); }
    }
  }
} catch (e) { fatal = e; } finally { await browser.close(); }

const okCount = entries.filter((e) => e.status === 'ok').length;
fs.writeFileSync(path.join(out, 'report.json'), `${JSON.stringify({ tool: 'gallery', version: '1.0.0', generatedAt: new Date().toISOString(), out, sheets, ok: okCount, skipped: entries.length - okCount, sites: entries, error: fatal ? fatal.message : null }, null, 2)}\n`);
if (fatal) { console.error(`gallery failed: ${fatal.message}`); process.exit(1); }
console.log(`${okCount} ok, ${entries.length - okCount} skipped -> ${out}`);
process.exit(okCount ? 0 : 1);
