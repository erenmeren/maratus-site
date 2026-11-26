#!/usr/bin/env node
// Screenshots and a small DOM probe of a served page, over CDP with the local Chrome for Testing.
//
//   node shot.mjs [url] [outDir] [--widths 375,390,768,1440] [--first] [--reduced-motion] [--no-js]
//                 [--offline] [--settle 4000]
//
// Defaults (unchanged from the first version): url http://127.0.0.1:8080/, outDir .work/shots/,
// full-page PNGs desktop.png (1440) and mobile.png (390), plus a probe without a picture at 375.
// --widths     replaces the default set; every width then gets a full-page PNG named w<width>.png
// --first      also writes the first viewport as <name>-first.png
// --reduced-motion / --no-js   emulate prefers-reduced-motion: reduce / JavaScript off
// --offline    blocks every host except loopback
import fs from 'node:fs';
import path from 'node:path';
import { launch, parseArgs, sleep } from './lib/cdp.mjs';

const HELP = 'usage: node shot.mjs [url] [outDir] [--widths 375,390,768,1440] [--first] [--reduced-motion] [--no-js] [--offline] [--settle ms]';
let pos, opt;
try {
  ({ pos, opt } = parseArgs(process.argv.slice(2),
    { booleans: ['first', 'reduced-motion', 'no-js', 'offline', 'help'] }));
} catch (e) { console.error(`${e.message}\n${HELP}`); process.exit(2); }
if (opt.help) { console.log(HELP); process.exit(0); }

const url = pos[0] || 'http://127.0.0.1:8080/';
const out = pos[1] || '.work/shots/';
const settle = Number(opt.settle || 4000);
let views = [['desktop', 1440, 900, true], ['mobile', 390, 844, true], ['w375', 375, 800, false]];
if (opt.widths) {
  views = String(opt.widths).split(',').map((s) => Number(s.trim())).map((w) => {
    if (!Number.isInteger(w) || w < 200 || w > 4000) { console.error(`Bad width: ${w}\n${HELP}`); process.exit(2); }
    return [`w${w}`, w, w < 768 ? 844 : 900, true];
  });
}
fs.mkdirSync(out, { recursive: true });

const browser = await launch({ offline: !!opt.offline });
let failed = false;
try {
  const page = await browser.newPage();
  if (opt['reduced-motion']) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
  if (opt['no-js']) await page.send('Emulation.setScriptExecutionDisabled', { value: true });
  const events = [];
  page.on((e) => events.push(e));
  for (const [name, w, h, picture] of views) {
    events.length = 0;
    const mobile = w < 768;
    await page.viewport(w, h, mobile);
    const nav = await page.goto(url, { settle });
    if (!nav.ok || nav.status >= 400) {
      console.error(name, 'failed:', nav.error || `HTTP ${nav.status}`);
      failed = true;
      continue;
    }
    const probe = await page.evaluate(`({sw:document.documentElement.scrollWidth,iw:innerWidth,
      h:document.documentElement.scrollHeight,
      fonts:[...document.fonts].filter(f=>f.status=="loaded").length})`);
    const errs = events.filter((e) => e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
      .map((e) => JSON.stringify(e.params).slice(0, 250));
    console.log(name, JSON.stringify({ ...probe, overflow: probe.sw > w }));
    console.log(' errors:', errs);
    if (!picture) continue;
    if (opt.first) fs.writeFileSync(path.join(out, `${name}-first.png`), await page.screenshot());
    await page.viewport(w, Math.min(probe.h, 16000), mobile);
    await sleep(800);
    fs.writeFileSync(path.join(out, `${name}.png`), await page.screenshot());
  }
} finally { await browser.close(); }
process.exit(failed ? 1 : 0);
