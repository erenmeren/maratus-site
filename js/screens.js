// What the device screen and the customer's phone show. Everything is drawn on a canvas, so it stays sharp at any size
// and costs nothing to download. Coordinates are the device's own 720 x 720.
import { QR } from './qr-data.js';
import { DISC, TILE, WORD } from './logo-data.js';

export const INK = { pink: '#f6b8c1', rose: '#ef98a6', ox: '#4a0c1f', deep: '#3a0816', blush: '#fdeef0', orange: '#d9552b', tang: '#f58a58', white: '#fff' };
const FACE = 'Gabarito, "Gabarito Fallback", "Avenir Next", sans-serif';
const F = (w, px) => `${w} ${px}px ${FACE}`;
const disc = new Path2D(DISC), tile = new Path2D(TILE), word = new Path2D(WORD);

function text(c, s, x, y, { w = 800, px = 40, color = INK.deep, align = 'left', track = -0.02 } = {}) {
  c.font = F(w, px); c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
  if ('letterSpacing' in c) c.letterSpacing = `${track * px}px`;
  c.fillText(s, x, y);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
}
function lines(c, arr, x, y, o) { arr.forEach((s, i) => text(c, s, x, y + i * o.px * (o.lh || 0.98), o)); }
function box(c, x, y, w, h, r, color) { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function bg(c, color) { c.fillStyle = color; c.fillRect(0, 0, 720, 720); }
export function qr(c, key, x, y, size, { dark = INK.deep, light = INK.white, pad = 3, r = 22 } = {}) {
  const q = QR[key], n = q.length, m = size / (n + pad * 2);
  if (light) box(c, x, y, size, size, r, light);
  c.fillStyle = dark;
  q.forEach((row, i) => {                                     // runs, not dots: no seams between modules
    for (let j = 0; j < n; j++) {
      if (row[j] !== '1') continue;
      let k = j; while (k < n && row[k] === '1') k++;
      c.fillRect(x + (j + pad) * m, y + (i + pad) * m, (k - j) * m + 0.25, m + 0.25);
      j = k;
    }
  });
}
const logo = (c, color, x = 360, align = 'center', y = 84) => text(c, 'Your logo', x, y, { w: 700, px: 32, color, align });

// ---- device screens
const S = {
  off(c) { bg(c, '#050506'); },
  idle(c, t) {                                               // the disc rises behind the tile
    bg(c, INK.ox);
    const e = 1 - Math.pow(1 - Math.min(1, t * 1.25), 4);
    c.save(); c.translate(100, 174.11); c.scale(0.14934, 0.14934);
    c.save(); c.translate(1615.97, 932.94); c.scale(13.46, 13.46);
    c.save(); c.translate(-9 * (1 - e), 15 * (1 - e)); c.fillStyle = INK.tang; c.fill(disc, 'evenodd'); c.restore();
    c.fillStyle = INK.ox; c.save(); c.scale(1.17, 1.17); c.fill(tile, 'evenodd'); c.restore();
    if (e > 0.98) { c.fillStyle = INK.tang; c.fill(disc, 'evenodd'); }
    c.fillStyle = INK.pink; c.fill(tile, 'evenodd'); c.restore();
    c.translate(0, 2372.32); c.fillStyle = INK.pink; c.fill(word); c.restore();
  },
  receipt(c) {
    bg(c, INK.white); logo(c, INK.deep, 60, 'left');
    text(c, 'Your receipt', 60, 168, { px: 70 });
    qr(c, 'site', 132, 196, 440, { pad: 1, light: null });
    text(c, 'Scan to keep it', 60, 678, { w: 700, px: 34 });
  },
  offer(c) {
    bg(c, INK.tang);
    c.fillStyle = '#fbb08a'; c.beginPath(); c.arc(640, 96, 236, 0, 7); c.fill();
    logo(c, INK.deep, 60, 'left');
    lines(c, ['This one’s', 'on us'], 60, 190, { px: 96, lh: 0.94 });
    qr(c, 'site', 60, 330, 330);
    lines(c, ['Scan for', 'today’s', 'offer'], 430, 560, { w: 700, px: 40, lh: 1.12 });
  },
  loyalty(c) {
    bg(c, INK.pink); logo(c, INK.deep, 60, 'left');
    box(c, 48, 118, 624, 250, 36, INK.ox);
    text(c, 'Your card', 88, 198, { px: 58, color: INK.white });
    for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(112 + i * 71, 294, 26, 0, 7); c.fillStyle = i < 5 ? INK.tang : '#6f2a40'; c.fill(); }
    qr(c, 'site', 48, 396, 276);
    lines(c, ['Scan to', 'open your', 'loyalty card'], 356, 510, { w: 700, px: 42, lh: 1.14 });
  },
  ticket(c) {
    bg(c, INK.ox);
    c.fillStyle = INK.tang; c.beginPath(); c.arc(590, 150, 64, 0, 7); c.fill();
    logo(c, INK.pink, 60, 'left');
    lines(c, ['Tonight’s', 'ticket'], 60, 190, { px: 92, color: INK.pink, lh: 0.94 });
    qr(c, 'site', 60, 320, 340, { light: INK.pink, dark: INK.ox });
    lines(c, ['Scan it', 'onto your', 'phone'], 436, 560, { w: 700, px: 40, color: INK.pink, lh: 1.12 });
  },
  menu(c) {
    bg(c, INK.white); logo(c, INK.deep, 60, 'left');
    text(c, 'Today’s menu', 60, 172, { px: 76 });
    const rows = [470, 560, 400, 520, 450];
    rows.forEach((w, i) => { box(c, 60, 214 + i * 34, w, 14, 7, i % 2 ? '#f3c4cb' : INK.rose); });
    qr(c, 'site', 60, 392, 272, { light: INK.white });
    lines(c, ['Scan to', 'read the', 'rest'], 366, 500, { w: 700, px: 42, lh: 1.14 });
  },
  returns(c) {
    bg(c, '#fff'); logo(c, INK.deep, 60, 'left');
    lines(c, ['Keep this', 'for returns'], 60, 172, { px: 84, lh: 0.94 });
    qr(c, 'site', 60, 304, 350, { light: INK.blush });
    lines(c, ['Scan to', 'save your', 'proof of', 'purchase'], 446, 470, { w: 700, px: 38, lh: 1.14 });
  },
  pass(c) {
    bg(c, '#ffd1a8'); logo(c, INK.deep, 60, 'left');
    lines(c, ['First visit', 'day pass'], 60, 176, { px: 92, lh: 0.94 });
    qr(c, 'site', 60, 316, 340);
    lines(c, ['Scan to', 'walk in'], 436, 600, { w: 700, px: 42, lh: 1.14 });
  },
  song(c) {
    bg(c, INK.ox); logo(c, INK.pink, 60, 'left');
    lines(c, ['Pick the', 'next song'], 60, 186, { px: 96, color: INK.pink, lh: 0.94 });
    [[0.92, INK.tang], [0.64, INK.rose], [0.4, '#8c3550']].forEach(([w, col], i) => { box(c, 380, 342 + i * 62, 280 * w, 40, 20, col); });
    qr(c, 'site', 60, 326, 290, { light: INK.pink, dark: INK.ox });
    text(c, 'Scan to vote', 380, 600, { w: 700, px: 44, color: INK.pink });
  },
  table(c) {
    bg(c, INK.tang); logo(c, INK.deep, 60, 'left');
    lines(c, ['Your table', 'is ready'], 60, 190, { px: 104, lh: 0.94 });
    qr(c, 'site', 60, 344, 316);
    lines(c, ['Scan for', 'the way', 'to table 12'], 416, 540, { w: 700, px: 42, lh: 1.14 });
  },
  timetable(c) {
    bg(c, '#ffd1a8'); logo(c, INK.deep, 60, 'left');
    text(c, 'Classes today', 60, 176, { px: 82 });
    [['07:00', 'Spin'], ['12:30', 'Yoga'], ['18:00', 'Boxing']].forEach(([t, n], i) => { const y = 262 + i * 66; c.fillStyle = i === 1 ? INK.ox : '#ffe6d0'; c.beginPath(); c.roundRect(60, y - 44, 600, 58, 18); c.fill(); text(c, t, 84, y, { w: 700, px: 38, color: i === 1 ? '#fff' : INK.deep }); text(c, n, 252, y, { w: 700, px: 38, color: i === 1 ? '#fff' : INK.deep }); });
    qr(c, 'site', 60, 432, 236);
    lines(c, ['Scan to', 'book a place'], 330, 578, { w: 700, px: 46, lh: 1.14 });
  },
  question(c) {
    bg(c, INK.rose); logo(c, INK.deep, 60, 'left');
    lines(c, ['How was', 'it today?'], 60, 186, { px: 100, lh: 0.94 });
    [[0, '#fff'], [1, '#fff'], [2, '#fff']].forEach(([i, col]) => { const x = 452 + i * 88, y = 420; c.fillStyle = col; c.beginPath(); c.arc(x, y, 38, 0, 7); c.fill(); c.fillStyle = INK.ox; for (const d of [-12, 12]) { c.beginPath(); c.arc(x + d, y - 8, 5, 0, 7); c.fill(); } c.strokeStyle = INK.ox; c.lineWidth = 5.5; c.lineCap = 'round'; c.beginPath(); if (i === 0) c.arc(x, y + 27, 14, Math.PI * 1.2, Math.PI * 1.8); else if (i === 1) { c.moveTo(x - 12, y + 15); c.lineTo(x + 12, y + 15); } else c.arc(x, y + 6, 14, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); });
    qr(c, 'site', 60, 330, 310);
    lines(c, ['Scan to', 'tell us'], 414, 556, { w: 700, px: 46, lh: 1.14 });
  },
  setlist(c) {
    bg(c, INK.ox); c.fillStyle = INK.tang; c.beginPath(); c.arc(610, 120, 60, 0, 7); c.fill(); logo(c, INK.pink, 60, 'left');
    lines(c, ['Tonight’s', 'setlist'], 60, 186, { px: 96, color: INK.pink, lh: 0.94 });
    [250, 190, 226, 160, 206].forEach((w, i) => { text(c, String(i + 1), 60, 366 + i * 46, { w: 800, px: 34, color: INK.tang }); box(c, 100, 342 + i * 46, w, 22, 11, '#8c3550'); });
    qr(c, 'site', 372, 318, 290, { light: INK.pink, dark: INK.ox });
    text(c, 'Scan to take it home', 60, 668, { w: 700, px: 44, color: INK.pink });
  },
  code(c) {                                                  // developers page: nothing but the link that was sent
    bg(c, INK.pink); logo(c, INK.deep, 60, 'left');
    qr(c, 'dev', 120, 120, 480, { pad: 2.4 });
    text(c, 'Scan with your phone', 360, 668, { w: 700, px: 40, align: 'center' });
  },
  mail(c) {
    bg(c, INK.ox);
    text(c, 'Talk to us', 60, 150, { px: 108, color: INK.pink });
    qr(c, 'mail', 60, 200, 400, { light: INK.pink, dark: INK.ox });
    lines(c, ['Scan to', 'write an', 'email'], 492, 494, { w: 700, px: 40, color: INK.pink, lh: 1.14 });
    text(c, 'hi@maratus.co', 60, 672, { w: 700, px: 38, color: INK.tang });
  },
};
export const SCREENS = Object.keys(S);

/** Draws `to`, pushed up over `from`, at t in 0..1. */
export function drawScreen(canvas, from, to, t) {
  const c = canvas.getContext('2d'), k = canvas.width / 720;
  c.setTransform(k, 0, 0, k, 0, 0);
  if (t >= 1 || !from || from === to) { S[to](c, to === 'idle' ? t : 1); return; }
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  S[from](c, 1);
  c.fillStyle = `rgba(20,2,8,${0.35 * e})`; c.fillRect(0, 0, 720, 720);
  c.save(); c.translate(0, 720 * (1 - e)); c.beginPath(); c.rect(0, 0, 720, 720); c.clip(); S[to](c, t); c.restore();
}

// ---- the customer's phone, 540 x 1125
function phoneBar(c) { text(c, '9:41', 44, 54, { w: 700, px: 25 }); c.fillStyle = '#0a0607'; c.beginPath(); c.arc(270, 44, 15, 0, 7); c.fill(); }
const P = {
  camera(c, t) {
    c.fillStyle = '#1b1114'; c.fillRect(0, 0, 540, 1125);
    c.fillStyle = INK.pink; c.fillRect(0, 130, 540, 800);
    c.save(); c.translate(270, 500); c.rotate(-0.05);
    box(c, -190, -190, 380, 380, 44, '#101012'); box(c, -166, -166, 332, 332, 6, '#fff');
    c.translate(-166, -166); c.scale(332 / 720, 332 / 720); S.receipt(c); c.restore();
    const g = 1 - Math.min(1, t * 2), m = 206 + g * 60; c.strokeStyle = '#ffd24a'; c.lineWidth = 7; c.lineCap = 'round';
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(270 + sx * m, 500 + sy * (m - 54)); c.lineTo(270 + sx * m, 500 + sy * m); c.lineTo(270 + sx * (m - 54), 500 + sy * m); c.stroke(); }
    if (t > 0.5) { box(c, 92, 770, 356, 64, 32, '#ffd24a'); text(c, 'your-brand.example', 270, 812, { w: 700, px: 29, align: 'center', color: '#241a00' }); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(270, 1025, 46, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(270, 1025, 58, 0, 7); c.stroke();
    text(c, '9:41', 44, 54, { w: 700, px: 25, color: '#fff' }); c.fillStyle = '#000'; c.beginPath(); c.arc(270, 44, 15, 0, 7); c.fill();
  },
  page(c) {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 540, 1125); phoneBar(c);
    box(c, 28, 92, 484, 58, 20, INK.blush); text(c, 'your-brand.example', 270, 130, { w: 600, px: 25, align: 'center' });
    c.fillStyle = INK.orange; c.fillRect(0, 176, 540, 300);
    text(c, 'Your logo', 44, 246, { w: 700, px: 34, color: '#fff' });
    lines(c, ['Your', 'receipt'], 44, 352, { px: 84, color: '#fff', lh: 0.94 });
    const items = [['Flat white', 1], ['Almond croissant', 1], ['Beans, 250 g', 2]];
    items.forEach(([n, q], i) => { const y = 550 + i * 70; text(c, n, 44, y, { w: 600, px: 32 }); text(c, `x ${q}`, 496, y, { w: 600, px: 32, align: 'right', color: '#6d2a3c' }); });
    box(c, 44, 762, 452, 92, 26, INK.ox); text(c, 'Save receipt', 270, 820, { w: 700, px: 34, color: '#fff', align: 'center' });
    box(c, 44, 874, 452, 92, 26, INK.pink); text(c, 'Join and collect points', 270, 932, { w: 700, px: 32, align: 'center' });
    box(c, 180, 1096, 180, 9, 5, '#0a0607');
  },
};
export function drawPhone(canvas, from, to, t) {
  const c = canvas.getContext('2d'), k = canvas.width / 540;
  c.setTransform(k, 0, 0, k, 0, 0);
  if (t >= 1 || !from || from === to) { P[to](c, t); return; }
  const e = 1 - Math.pow(1 - t, 3);
  P[from](c, 1); c.save(); c.translate(0, 1125 * (1 - e)); P[to](c, t); c.restore();
}
