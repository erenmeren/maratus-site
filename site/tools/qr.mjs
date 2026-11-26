// Small QR encoder: byte mode, versions 1-6, ECC M. Writes site/js/qr-data.js
import fs from 'node:fs';
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rs(data, n) {
  let g = [1];
  for (let i = 0; i < n; i++) { const r = new Array(g.length + 1).fill(0); g.forEach((c, j) => { r[j] ^= c; r[j + 1] ^= mul(c, EXP[i]); }); g = r; }
  const out = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) { const c = out[i]; if (c) g.forEach((v, j) => { out[i + j] ^= mul(v, c); }); }
  return out.slice(data.length);
}
// version: [ecc per block, [blocks, data per block]...] for level M
const M = { 1: [10, [1, 16]], 2: [16, [1, 28]], 3: [26, [1, 44]], 4: [18, [2, 32]], 5: [24, [2, 43]], 6: [16, [4, 27]] };
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
function encode(text) {
  const bytes = [...Buffer.from(text)];
  let v = 1; const cap = (k) => M[k].slice(1).reduce((s, [b, d]) => s + b * d, 0);
  while (cap(v) * 8 < 4 + 8 + bytes.length * 8) v++;
  const bits = []; const put = (x, n) => { for (let i = n - 1; i >= 0; i--) bits.push((x >> i) & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach((b) => put(b, 8));
  const total = cap(v) * 8; put(0, Math.min(4, total - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; data.length < cap(v); p++) data.push(p % 2 ? 0x11 : 0xec);
  const [ec, ...groups] = M[v]; const blocks = []; let at = 0;
  for (const [b, d] of groups) for (let i = 0; i < b; i++) { blocks.push(data.slice(at, at + d)); at += d; }
  const eccs = blocks.map((b) => rs(b, ec)); const stream = [];
  for (let i = 0; i < Math.max(...blocks.map((b) => b.length)); i++) blocks.forEach((b) => { if (i < b.length) stream.push(b[i]); });
  for (let i = 0; i < ec; i++) eccs.forEach((b) => stream.push(b[i]));
  const n = 17 + 4 * v; const m = Array.from({ length: n }, () => new Array(n).fill(null)); const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, x) => { if (r >= 0 && c >= 0 && r < n && c < n) { m[r][c] = x; fn[r][c] = true; } };
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) for (let r = -1; r < 8; r++) for (let c = -1; c < 8; c++) {
    const on = r >= 0 && r < 7 && c >= 0 && c < 7 && (r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5)); set(r0 + r, c0 + c, on ? 1 : 0);
  }
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 ? 0 : 1); set(i, 6, i % 2 ? 0 : 1); }
  for (const r of ALIGN[v]) for (const c of ALIGN[v]) { if (fn[r][c]) continue; for (let a = -2; a < 3; a++) for (let b = -2; b < 3; b++) set(r + a, c + b, Math.max(Math.abs(a), Math.abs(b)) !== 1 ? 1 : 0); }
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) set(8, i, 0); if (m[i][8] === null) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { set(8, n - 1 - i, 0); set(n - 1 - i, 8, 0); }
  set(n - 8, 8, 1);
  const sb = stream.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1)); let k = 0;
  for (let c = n - 1, up = true; c > 0; c -= 2, up = !up) { if (c === 6) c--; for (let i = 0; i < n; i++) { const r = up ? n - 1 - i : i; for (const cc of [c, c - 1]) if (!fn[r][cc]) m[r][cc] = sb[k++] || 0; } }
  const MASK = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  let best = null;
  MASK.forEach((f, id) => {
    const q = m.map((row, r) => row.map((x, c) => (fn[r][c] ? x : x ^ (f(r, c) ? 1 : 0))));
    let d = (0 << 3) | id; let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    const fb = ((d << 10) | rem) ^ 0x5412; const bit = (i) => (fb >> i) & 1;
    for (let i = 0; i < 6; i++) q[i][8] = bit(i); q[7][8] = bit(6); q[8][8] = bit(7); q[8][7] = bit(8); for (let i = 9; i < 15; i++) q[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) q[8][n - 1 - i] = bit(i); for (let i = 8; i < 15; i++) q[n - 15 + i][8] = bit(i); q[n - 8][8] = 1;
    let s = 0; const line = (get) => { for (let a = 0; a < n; a++) { let run = 1; for (let b = 1; b < n; b++) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } } };
    line((a, b) => q[a][b]); line((a, b) => q[b][a]);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (q[r][c] === q[r][c + 1] && q[r][c] === q[r + 1][c] && q[r][c] === q[r + 1][c + 1]) s += 3;
    const dark = q.flat().reduce((a, b) => a + b, 0) / (n * n); s += Math.floor(Math.abs(dark - 0.5) * 20) * 10;
    if (!best || s < best.s) best = { s, q };
  });
  return best.q.map((r) => r.join(''));
}
const out = { site: encode('https://maratus.co/'), mail: encode('mailto:hi@maratus.co'), dev: encode('https://example.com/receipt/8812') };
fs.writeFileSync(process.argv[2], `// QR modules, one string per row. site: https://maratus.co/  mail: mailto:hi@maratus.co  dev: https://example.com/receipt/8812, the example link of the API spec  (encoded at build time, decoded in tests)\nexport const QR = ${JSON.stringify(out)};\n`);
for (const [k, v] of Object.entries(out)) console.log(k, v.length);
