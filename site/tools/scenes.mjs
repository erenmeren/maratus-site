// Retouches the AI scenes of the developers page (ai/dev/*.jpg) and writes assets/dev/*.webp. Serve the repo root on 127.0.0.1:8123 first.
// The screens the generator invented are replaced by the site's own (js/screens.js), lettering (laptop, cards, door) is painted out,
// and the left of the night scene is darkened for the text. Corner points are original pixels, clockwise from top left.
import { launch, sleep } from '../../kit/scripts/lib/cdp.mjs'; import fs from 'node:fs';
const out = new URL('../assets/dev/', import.meta.url); fs.mkdirSync(out, { recursive: true });
const JOBS = {
  'desk': { src: 'd01-desk', sizes: [[2000, .8], [1200, .78]], ops: [
    { op: 'editor', q: [[455, 257], [1396, 253], [1308, 981], [345, 916]], blur: 2.2 },
    { op: 'smear', box: [726, 955, 150, 50], r: 16 },
    { op: 'screen', name: 'code', q: [[1466, 674], [1856, 696], [1778, 1136], [1385, 1089]], dim: .16, blur: .5 }] },
  'counter': { src: 'd02-counter', sizes: [[2600, .78], [1400, .78]], ops: [
    { op: 'screen', name: 'code', q: [[1746, 878], [1934.5, 868], [2013, 1109], [1826, 1127.5]], dim: .12, blur: .4 },
    { op: 'smear', box: [2262, 872, 44, 40], r: 10 }] },
  'phone': { src: 'd04-hand', sizes: [[1500, .8], [900, .78]], ops: [
    { op: 'screen', name: 'code', q: [[501.5, 1157], [821, 1100.5], [950.5, 1505], [637, 1599.5]], dim: .12, blur: .5 },
    { op: 'phone', q: [[955, 1062.5], [1137.5, 1029], [1339, 1501], [1149, 1561]], dim: .07, blur: .8,
      clip: [[905, 170], [898, 140], [912, 124], [952, 118], [962, 136], [985, 142], [1085, 125], [1110, 116], [1108, 90], [1145, 82], [1172, 92], [1192, 115], [1409, 606], [1385, 640], [1345, 680], [1321, 712], [1325, 737], [1345, 748], [1390, 746], [1457, 722], [1485, 785], [1490, 812], [1472, 838], [1285, 906], [1245, 858], [1205, 806], [1165, 748], [1112, 688], [1085, 612]].map(([x, y]) => [x / 1.6 + 400, y / 1.6 + 980]) }] },
  'night': { src: 'd05-night', sizes: [[2400, .8], [1400, .78]], ops: [
    { op: 'editor', q: [[1909, 749], [2397, 751], [2493, 1111], [1981, 1155]], blur: 1.4 },
    { op: 'smear', box: [2222, 1134, 84, 30], r: 12 },
    { op: 'smear', box: [1880, 1270, 320, 70], r: 14, clip: [[1895, 1300], [2075, 1270], [2192, 1294], [1998, 1330]] },
    { op: 'smear', box: [1110, 590, 170, 190], r: 34 },
    { op: 'screen', name: 'idle', q: [[1516, 916], [1774, 906], [1853.5, 1186], [1589, 1218.5]], dim: .12, blur: .5 },
    { op: 'shade' }] },
};
const only = process.argv.slice(2), b = await launch({ offline: true }), p = await b.newPage();
await p.goto('http://127.0.0.1:8123/site/tools/lab.html', { settle: 300 }); for (let i = 0; i < 100; i++) { if (await p.evaluate('!!window.ready')) break; await sleep(100); }
for (const [name, job] of Object.entries(JOBS)) {
  if (only.length && !only.includes(name)) continue;
  const urls = await p.evaluate(async (job) => {
    const SC = await import('/site/js/screens.js');
    const im = new Image(); im.src = `/ai/dev/${job.src}.jpg`; await im.decode();
    const cv = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const C = cv(im.naturalWidth, im.naturalHeight), c = C.getContext('2d'); c.drawImage(im, 0, 0);
    const path = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    const homo = ([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) => { const dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3, d = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / d, h = (dx1 * sy - sx * dy1) / d; return (u, v) => { const w = g * u + h * v + 1; return [((x1 - x0 + g * x1) * u + (x3 - x0 + h * x3) * v + x0) / w, ((y1 - y0 + g * y1) * u + (y3 - y0 + h * y3) * v + y0) / w]; }; };
    const warp = (src, q) => { const o = cv(C.width, C.height), g = o.getContext('2d'), H = homo(q), N = 28, W = src.width, HH = src.height;
      const tri = (a, b2, c2, A, B, D) => { g.save(); const m = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3], ex = [A, B, D].map(([x, y]) => { const l = Math.hypot(x - m[0], y - m[1]) || 1; return [x + (x - m[0]) / l * .8, y + (y - m[1]) / l * .8]; }); path(g, ex); g.clip();
        const den = a[0] * (b2[1] - c2[1]) + b2[0] * (c2[1] - a[1]) + c2[0] * (a[1] - b2[1]), f = (k) => [(A[k] * (b2[1] - c2[1]) + B[k] * (c2[1] - a[1]) + D[k] * (a[1] - b2[1])) / den, (A[k] * (c2[0] - b2[0]) + B[k] * (a[0] - c2[0]) + D[k] * (b2[0] - a[0])) / den, (A[k] * (b2[0] * c2[1] - c2[0] * b2[1]) + B[k] * (c2[0] * a[1] - a[0] * c2[1]) + D[k] * (a[0] * b2[1] - b2[0] * a[1])) / den];
        const fx = f(0), fy = f(1); g.transform(fx[0], fy[0], fx[1], fy[1], fx[2], fy[2]); g.drawImage(src, 0, 0); g.restore(); };
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N, S = (u, v) => [u * W, v * HH]; tri(S(u0, v0), S(u1, v0), S(u0, v1), H(u0, v0), H(u1, v0), H(u0, v1)); tri(S(u1, v0), S(u1, v1), S(u0, v1), H(u1, v0), H(u1, v1), H(u0, v1)); }
      return o; };
    const lay = (src, o) => { const w = warp(src, o.q); c.save(); path(c, o.clip || o.q); c.clip(); if (o.blur) c.filter = `blur(${o.blur}px)`; c.drawImage(w, 0, 0); c.filter = 'none';
      if (o.dim) { c.fillStyle = `rgba(30,6,14,${o.dim})`; path(c, o.clip || o.q); c.fill(); }
      const xs = o.q.map((r) => r[0]), ys = o.q.map((r) => r[1]), x = Math.min(...xs), y = Math.min(...ys), ww = Math.max(...xs) - x, hh = Math.max(...ys) - y, n = cv(Math.ceil(ww), Math.ceil(hh)), ng = n.getContext('2d'), id = ng.createImageData(n.width, n.height); let s = 5; for (let i = 0; i < id.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 256; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 13; } ng.putImageData(id, 0, 0); c.globalCompositeOperation = 'overlay'; c.drawImage(n, x, y); c.restore(); };
    for (const o of job.ops) {
      if (o.op === 'screen') { const s = cv(720, 720); SC.drawScreen(s, null, o.name, 1); lay(s, o); }
      if (o.op === 'phone') { const s = cv(540, 1125); SC.drawPhone(s, null, 'page', 1); const g = s.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fdeef0'; g.beginPath(); g.roundRect(28, 92, 484, 58, 20); g.fill(); g.fillStyle = '#3a0816'; g.font = '600 25px Gabarito'; g.textAlign = 'center'; g.fillText('example.com', 270, 130); lay(s, o); }
      if (o.op === 'editor') { const s = cv(1500, 1000), g = s.getContext('2d'); g.fillStyle = '#26040f'; g.fillRect(0, 0, 1500, 1000); g.font = '500 33px ui-monospace, Menlo, monospace'; const P = '#f6b8c1', T = '#f58a58', L = '#fde3e7', D = '#a8687a';
        [[['POST', T], [' /v1/devices/', L], ['DEVICE_ID', P], ['/trigger', L]], [['Host: ', D], ['api.maratus.co', L]], [['Authorization: ', D], ['Bearer ', L], ['YOUR_API_KEY', P]], [['Idempotency-Key: ', D], ['receipt-8812', P]], [['Content-Type: ', D], ['application/json', L]], [], [['{', L]], [['  "action"', D], [': ', L], ['"show_qr"', T], [',', L]], [['  "payload"', D], [': {', L]], [['    "url"', D], [': ', L], ['"https://example.com/receipt/8812"', T]], [['  }', L]], [['}', L]], [], [['202', T], [' Accepted', L]]].forEach((row, i) => { let x = 90; for (const [t, col] of row) { g.fillStyle = col; g.fillText(t, x, 120 + i * 58); x += g.measureText(t).width; } }); lay(s, o); }
      if (o.op === 'smear') { const [x, y, w, h] = o.box, t = cv(w, h), g = t.getContext('2d'); g.filter = `blur(${o.r}px)`; g.drawImage(C, -x, -y); g.filter = 'none';
        if (!o.clip) { const m = cv(w, h), mg = m.getContext('2d'); mg.filter = `blur(${Math.min(8, h / 6)}px)`; mg.fillRect(h / 5, h / 5, w - h / 2.5, h - h / 2.5); mg.filter = 'none'; g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0); c.drawImage(t, x, y); } else { c.save(); path(c, o.clip); c.clip(); c.drawImage(t, x, y); c.restore(); } }
      if (o.op === 'shade') { const g = c.createLinearGradient(0, 0, C.width * .56, 0); g.addColorStop(0, 'rgba(38,4,15,.9)'); g.addColorStop(.6, 'rgba(38,4,15,.8)'); g.addColorStop(1, 'rgba(38,4,15,0)'); c.fillStyle = g; c.fillRect(0, 0, C.width, C.height); c.fillStyle = 'rgba(38,4,15,.16)'; c.fillRect(0, 0, C.width, C.height); }
    }
    return job.sizes.map(([w, q]) => { const h = Math.round(C.height * w / C.width), t = cv(w, h), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(C, 0, 0, w, h); return t.toDataURL('image/webp', q); });
  }, job);
  job.sizes.forEach(([w], i) => { const f = new URL(`${name}${i ? `-${w}` : ''}.webp`, out); fs.writeFileSync(f, Buffer.from(urls[i].split(',')[1], 'base64')); console.log(f.pathname.split('/').pop(), w, fs.statSync(f).size); });
}
await b.close();
