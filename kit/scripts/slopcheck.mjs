#!/usr/bin/env node
// Finds named AI-design tells on a served page from computed styles (var() is resolved by Chrome).
//
//   node slopcheck.mjs <url> [--out file.json] [--viewport 1440x900] [--offline] [--settle 2500]
//   node slopcheck.mjs --list
//
// Tell ids match references/ban-list.md. The JSON goes to --out (human-readable text always goes to stdout;
// --json prints the JSON instead). Exit code: 0 = no fail-level tell, 1 = at least one, 2 = could not check.
// --offline blocks every host except loopback (web fonts then fall back, font-family names are still read).
import fs from 'node:fs';
import path from 'node:path';
import { launch, parseArgs, parseSize } from './lib/cdp.mjs';
import { collect, markHidden, overflowProbe } from './lib/collect.mjs';
import { detect, TELLS } from './lib/detectors.mjs';

const HELP = 'usage: node slopcheck.mjs <url> [--out file.json] [--viewport 1440x900] [--offline] [--settle ms] [--json] | --list';
const die = (msg) => { console.error(msg); process.exit(2); };

let pos, opt, size;
try {
  ({ pos, opt } = parseArgs(process.argv.slice(2), { booleans: ['offline', 'json', 'list', 'help'] }));
  size = parseSize(opt.viewport, { width: 1440, height: 900 });
} catch (e) { die(`${e.message}\n${HELP}`); }
if (opt.help) { console.log(HELP); process.exit(0); }
if (opt.list) { for (const [id, name] of Object.entries(TELLS)) console.log(`${id}\t${name}`); process.exit(0); }
const url = pos[0];
if (!url || !/^https?:\/\//.test(url)) die(`A http(s) URL is required.\n${HELP}`);
const settle = Number(opt.settle || 2500);
if (!Number.isFinite(settle)) die('--settle needs a number');

let report;
const browser = await launch({ offline: !!opt.offline });
try {
  const page = await browser.newPage();
  await page.viewport(size.width, size.height, false);
  // Short settle first: markHidden must run before scroll-driven reveals finish.
  const nav = await page.goto(url, { settle: 150 });
  if (!nav.ok) throw new Error(`navigation failed: ${nav.error}`);
  if (nav.status >= 400) throw new Error(`HTTP ${nav.status}`);
  await page.evaluate(markHidden);
  await page.evaluate(`new Promise(r => setTimeout(r, ${settle}))`);
  await page.evaluate('Promise.race([document.fonts.ready.then(() => 1), new Promise(r => setTimeout(r, 4000))])');
  const model = await page.evaluate(collect);
  await page.viewport(390, 844, true);
  const nav390 = await page.goto(url, { settle: Math.max(800, settle / 2) });
  const probe = nav390.ok ? await page.evaluate(overflowProbe, 390) : null;
  const tells = detect(model, probe);
  const fails = tells.filter((t) => t.level === 'fail').length;
  report = {
    tool: 'slopcheck', version: '1.0.0', url, checkedAt: new Date().toISOString(), viewport: size, offline: !!opt.offline,
    page: { title: model.title, height: model.height, elements: model.els.length, truncated: model.truncated, ground: model.ground, firstGround: model.firstGround, textChecked: model.contrast.length, overflow390: probe },
    summary: { pass: fails === 0, tells: tells.length, fails, warns: tells.length - fails, ids: tells.map((t) => t.id) },
    tells,
  };
} catch (e) {
  await browser.close();
  die(`slopcheck could not check ${url}: ${e.message}`);
}
await browser.close();

if (opt.out) {
  fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true });
  fs.writeFileSync(opt.out, `${JSON.stringify(report, null, 2)}\n`);
}
if (opt.json) console.log(JSON.stringify(report, null, 2));
else {
  const s = report.summary;
  console.log(`slopcheck ${url}`);
  console.log(`${s.pass ? 'PASS' : 'FAIL'}: ${s.tells} tells (${s.fails} fail, ${s.warns} warn), ${report.page.elements} elements, ${report.page.textChecked} texts contrast-checked`);
  for (const t of report.tells) {
    console.log(`\n${t.id} ${t.level.toUpperCase()} ${t.name} (x${t.count})${t.note ? ` - ${t.note}` : ''}`);
    for (const e of t.evidence) console.log(`   ${e.selector}: ${e.value}${e.text ? ` "${e.text}"` : ''}`);
  }
}
process.exit(report.summary.pass ? 0 : 1);
