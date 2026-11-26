#!/usr/bin/env node
// Viewport screenshots while scrolling step by step (for studying scroll-driven sites).
// node scrollshots.mjs <url> <outDir> [--width 1440] [--height 900] [--step 450] [--max 80] [--wait 700]
import fs from 'node:fs';
import path from 'node:path';
import { launch, parseArgs, sleep } from './lib/cdp.mjs';
const { pos, opt } = parseArgs(process.argv.slice(2));
const [url, out] = pos;
const w = Number(opt.width || 1440), h = Number(opt.height || 900), step = Number(opt.step || 450);
const max = Number(opt.max || 80), wait = Number(opt.wait || 700);
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.viewport(w, h, w < 768);
  const nav = await page.goto(url, { settle: 6000 });
  console.log('nav', nav.status, nav.error || '');
  let y = 0;
  for (let i = 0; i < max; i++) {
    fs.writeFileSync(path.join(out, `${String(i).padStart(3, '0')}.png`), await page.screenshot());
    const info = await page.evaluate(`(()=>{window.scrollBy(0,${step});window.dispatchEvent(new WheelEvent('wheel',{deltaY:${step}}));return {y:scrollY,H:document.documentElement.scrollHeight}})()`);
    if (info.y === y && i > 2) { console.log('end at', i, JSON.stringify(info)); break; }
    y = info.y;
    await sleep(wait);
  }
} finally { await browser.close(); }
