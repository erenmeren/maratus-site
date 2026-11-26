// Puts the case-* pictures of snaps.mjs together into shots/colours.jpg, colours-mono.jpg and colours-compare.jpg.
// Serve the repo root on 127.0.0.1:8123 and run snaps.mjs first. Names come from index.html, hex values from stage.js.
import { launch, sleep } from '../../kit/scripts/lib/cdp.mjs'; import fs from 'node:fs';
const names = Object.fromEntries([...fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').matchAll(/name="case" value="(\w+)".*?class="nm">([^<]+)</g)].map((m) => m.slice(1)));
const b = await launch({ offline: true }), p = await b.newPage(); await p.viewport(2400, 1290); await p.goto('http://127.0.0.1:8123/site/tools/lab.html', { settle: 500 });
for (let i = 0; i < 100; i++) { if (await p.evaluate('!!window.ready')) break; await sleep(100); }
const C = await p.evaluate('({...S.COLOURS})'), ids = Object.keys(C);
const cell = (n, mono) => { const c = C[n], hex = mono ? `Core and whole Dock ${c.body}, name ${c.mark}` : c.dock ? `Core ${c.body}, whole Dock ${c.dock}, name ${c.mark}` : `Core and Dock ${c.body}, ends ${c.accent}, name ${c.mark}`;
  return `<figure><img src="/.work/snap/case-${n}${mono ? '-mono' : ''}.png" width="590" height="498"><figcaption><b>${ids.indexOf(n) + 1} ${names[n]}</b>${hex}</figcaption></figure>`; };
const A = 'A: Dock in the second colour', B = 'B: Dock in the Core’s colour', four = ['retro', 'yellow', 'blue', 'pink'], row = (l, m) => `<div class="row">${l.map((n) => cell(n, m)).join('')}</div>`;
const all = (t, m) => `<h1>${t}</h1>${row(ids.slice(0, 4), m)}${row(ids.slice(4), m)}`;
const S = { colours: all(A, false), 'colours-mono': all(B, true), 'colours-compare': `<h1>${A}</h1>${row(four, false)}<h1>${B}</h1>${row(four, true)}` };
for (const [f, html] of Object.entries(S)) {
  const h = await p.evaluate(async (html) => {
    document.body.innerHTML = `<style>body{width:2400px;margin:0;padding:44px 0 36px;box-sizing:border-box;background:#f6b8c1;color:#3a0816;font-family:Gabarito}h1{margin:0 0 0 60px;font-size:44px;font-weight:800}.row{display:grid;grid-template-columns:repeat(4,590px);padding:0 20px;margin-bottom:24px}figure{margin:0;text-align:center}img{display:block;margin-bottom:-20px}figcaption{position:relative;font-size:21px;color:#6d2a3c}b{display:block;font-size:30px;font-weight:700;color:#3a0816;margin-bottom:6px}</style>${html}`;
    await Promise.all([...document.images].map((i) => i.decode())); await document.fonts.ready; return document.body.offsetHeight; }, html);
  await p.viewport(2400, h); await sleep(300); fs.writeFileSync(new URL(`../shots/${f}.jpg`, import.meta.url), await p.screenshot({ format: 'jpeg', quality: 90 })); console.log(f, h);
}
// the Docks page's three Docks in Retro, one angle and one scale (dock-*.png of snaps.mjs) -> shots/docks.jpg
{ const h = await p.evaluate(async (html) => { document.body.innerHTML = html; await Promise.all([...document.images].map((i) => i.decode())); await document.fonts.ready; return document.body.offsetHeight; },
  `<style>body{width:2400px;margin:0;padding:10px 0 60px;box-sizing:border-box;background:#f6b8c1;color:#3a0816;font-family:Gabarito}.row{display:grid;grid-template-columns:repeat(3,800px)}figure{margin:0;text-align:center}img{display:block}figcaption{font-size:24px;color:#6d2a3c}b{display:block;font-size:52px;font-weight:800;letter-spacing:-.03em;color:#3a0816}</style><div class="row">${[['bar', 'BAR', 'end caps'], ['tile', 'TILE', 'base plate'], ['mono', 'MONO', 'port plate and base plate']].map(([i, n, s]) => `<figure><img src="/.work/snap/dock-${i}.png" width="800" height="800"><figcaption><b>${n}</b>Retro: ${C.retro.body}, ${s} ${C.retro.accent}</figcaption></figure>`).join('')}</div>`);
  await p.viewport(2400, h); await sleep(300); fs.writeFileSync(new URL('../shots/docks.jpg', import.meta.url), await p.screenshot({ format: 'jpeg', quality: 90 })); console.log('docks', h); }
await b.close();
