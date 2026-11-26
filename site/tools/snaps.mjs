// Renders the posters and fallback stills from the live model (tools/lab.html) into .work/snap/*.png; convert to WebP, quality 84.
// Serve the repo root on 127.0.0.1:8123 first. Optional arguments: names to render.
import { launch, sleep } from '../../kit/scripts/lib/cdp.mjs'; import fs from 'node:fs';
const FREE = { lf: 1, crx: 20, cx: 0, cy: 60 - 78.254, cz: 30 + 18.906 }, ROSE = { gr: .93, gg: .58, gb: .64 }, UP = { lf: 1, crx: 28, cry: -165, sh: 0 }, CLOSE = { key: 1.5, kx: -90, ky: 130, kz: 240, rim: .8, env: .72, hemi: .5 };
const J = {
  'poster-hero': [1000, 1000, { s: 0.625, yaw: -23.2, pitch: 19, roll: 1 }, 'idle'], 'poster-phone': [760, 760, { s: 0.625, yaw: -29.6, pitch: 16.2 }, 'idle'],
  'screen-receipt': [900, 900, { s: 0.66, yaw: -24, pitch: 13 }, 'receipt'], 'screen-offer': [900, 900, { s: 0.66, yaw: 22, pitch: 13 }, 'offer'],
  'screen-loyalty': [900, 900, { s: 0.66, yaw: -20, pitch: 13 }, 'loyalty'], 'screen-ticket': [900, 900, { s: 0.66, yaw: 24, pitch: 13, gr: .36, gg: .08, gb: .14 }, 'ticket'],
  'screen-menu': [900, 900, { s: 0.66, yaw: -22, pitch: 13 }, 'menu'], 'screen-mail': [900, 900, { s: 0.66, yaw: -12, pitch: 13 }, 'mail'],
  'still-phone': [1200, 1000, { s: 0.5, x: -0.3, y: 0, yaw: 20, pitch: 12, ph: 1, phx: 0.3, phy: 0, phs: 0.8, phyaw: -10, phroll: 2 }, 'receipt', 'page'],
  'screen-song': [900, 900, { s: 0.66, yaw: -20, pitch: 13, gr: .36, gg: .08, gb: .14 }, 'song'], 'screen-table': [900, 900, { s: 0.66, yaw: 0, pitch: 13, gr: .36, gg: .08, gb: .14 }, 'table'],
  'screen-timetable': [900, 900, { s: 0.66, yaw: 20, pitch: 13, gr: .36, gg: .08, gb: .14 }, 'timetable'], 'screen-question': [900, 900, { s: 0.66, yaw: 20, pitch: 13, gr: .36, gg: .08, gb: .14 }, 'question'],
  'still-back': [900, 900, { s: 0.62, yaw: 14, pitch: 6, ...FREE, cry: -180, don: 0, sh: 0, mag: 1, at: 'core', ...ROSE }, 'idle'],
  'still-magnet': [900, 900, { s: 0.5, y: 0.1, yaw: -24, pitch: 5, ...FREE, don: 0, sh: 0, post: 1, cable: 1, at: 'core', env: .7, key: 1.5, kx: -190, ky: 170, kz: 130, rim: 1.4, hemi: .5, ...ROSE }, 'song'],
  'still-hold': [900, 900, { s: 0.45, y: 0.3, yaw: -28, pitch: 10, ...FREE, don: 0, sh: 0, hold: 1, at: 'core', env: .95, rim: 2, ...ROSE }, 'loyalty'],
  'still-under': [900, 900, { s: 0.86, y: 0, yaw: -14, pitch: 4, lf: 1, cy: 90, crx: -60, at: [5, 6.1, -7.95], sh: 0, don: 0, env: .62, key: 1.6, ky: 60, kz: 260, hemi: .35 }, 'idle'],
  'still-rear': [1600, 1300, { s: 0.6, yaw: 148, pitch: 15, key: 1.45, env: .66 }, 'idle'],
  'still-pads': [1600, 1300, { s: 2.5, yaw: -16, pitch: 7, ...UP, at: 'pads', ...CLOSE }, 'idle'], 'still-contacts': [1600, 1300, { s: 2.5, y: -0.06, yaw: 20, pitch: 24, ...UP, px: 0, py: 14, pz: -20, ...CLOSE }, 'idle'],
  'still-ports': [1600, 1300, { s: 1.45, yaw: 158, pitch: 10, px: 0, py: 19, pz: -50, ...CLOSE, key: 1.2, env: .62 }, 'idle'],
};
J['ortho-front'] = [900, 900, { ortho: 1, s: 0.7, yaw: 0, pitch: 0, py: 46.9, px: 0, sh: 0 }, 'idle']; J['ortho-side'] = [900, 900, { ortho: 1, s: 0.7, yaw: -90, pitch: 0, py: 46.9, px: 0, pz: -30.7, sh: 0 }, 'idle'];
// ortho ones last: they change the camera
const or = { s: 0.6, yaw: -26, pitch: 14, gr: .96, gg: .54, gb: .35 };
for (const n of ['receipt', 'offer', 'loyalty', 'ticket', 'menu', 'pass']) J[`row-${n}`] = [900, 900, or, n];
J['colour-retro'] = [900, 900, { s: 0.66, yaw: -30, pitch: 13, key: 1.75, kx: -210, ky: 150, kz: 90, kg: 0.95, kb: 0.92, env: 0.5, hemi: 0.2, rim: 2.2, gr: .42, gg: .1, gb: .16 }, 'idle'];
const DEV = { s: 0.6, y: -0.1, yaw: -25, pitch: 13, gr: .93, gg: .58, gb: .64 };   // the developers page's hero pose, HERO in js/dev.js
J['dev-idle'] = [1000, 1000, DEV, 'idle']; J['dev-code'] = [1000, 1000, DEV, 'code'];
J['still-apart'] = [1300, 1300, { s: 0.44, x: -0.05, y: -0.42, yaw: -26, pitch: 11, lf: 1, py: 45, gr: .96, gg: .72, gb: .75 }, 'idle'];   // pricing page: Core and Dock, both lent
J['still-hero'] = [1600, 1300, { s: 0.6, yaw: -28, pitch: 15 }, 'idle'];
for (const n of ['retro', 'black', 'orange', 'yellow', 'blue', 'green', 'slate', 'pink']) for (const mono of [false, true]) J[`case-${n}${mono ? '-mono' : ''}`] = [900, 760, { s: 0.64, y: 0.04, yaw: -44, pitch: 16 }, 'receipt', 'camera', 'image/png', 0.9, n, mono];   // shots/colours*.jpg, see sheets.mjs
const V = JSON.parse(fs.readFileSync(new URL('../data/venues.json', import.meta.url))).venues;
V.forEach((v, i) => { J[`device-${v.id}`] = [560, 560, { s: 0.625, y: -0.5, yaw: i % 2 ? -14 : -30, pitch: 9, px: 0, py: 0, pz: -20, ...v.light }, v.screen]; });
const only = process.argv.slice(2);
fs.mkdirSync(new URL('../../.work/snap/', import.meta.url), { recursive: true });
const b = await launch({ offline: true }); const p = await b.newPage(); await p.viewport(1000, 1000); await p.goto('http://127.0.0.1:8123/site/tools/lab.html', { settle: 200 });
for (let i = 0; i < 100; i++) { if (await p.evaluate('!!window.ready')) break; await sleep(100); } await p.evaluate('st.props');
for (const [n, j] of Object.entries(J).sort((a, b) => !!a[1][2].ortho - !!b[1][2].ortho)) { if (only.length && !only.includes(n)) continue; const d = await p.evaluate(`st.dither.value=0;snap(...${JSON.stringify(j)})`); fs.writeFileSync(new URL(`../../.work/snap/${n}.png`, import.meta.url), Buffer.from(d.split(',')[1], 'base64')); }
// the Docks page: front and back of each Dock (dock-*.webp, dock-*-back.webp)
for (const d of ['bar', 'tile', 'mono']) {
  const J = { [`dock-${d}`]: -29, [`dock-${d}-back`]: -206 }; if (only.length && !only.some((n) => n in J)) continue;
  await p.goto(`http://127.0.0.1:8123/site/tools/lab.html?dock=${d}`, { settle: 200 }); for (let i = 0; i < 100; i++) { if (await p.evaluate('!!window.ready')) break; await sleep(100); }
  for (const [n, yaw] of Object.entries(J)) { if (only.length && !only.includes(n)) continue; const u = await p.evaluate(`st.dither.value=0;snap(1000,1000,{yaw:${yaw}},'receipt')`); fs.writeFileSync(new URL(`../../.work/snap/${n}.png`, import.meta.url), Buffer.from(u.split(',')[1], 'base64')); }
}
await b.close();
