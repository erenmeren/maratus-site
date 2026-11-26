// Scroll engine of the home page. The browser scrolls natively; this only reads the position, eases it a little and poses
// the device. Each key is anchored to a section and a progress inside it, so the layout can change without new numbers.
const root = document.documentElement;
root.classList.add('js');
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (t) => t * t * (3 - 2 * t);                        // smoothstep
const ramp = (v, a, b) => ss(clamp((v - a) / (b - a)));
const slimQ = matchMedia('(max-width: 860px)'), calmQ = matchMedia('(prefers-reduced-motion: reduce)');

// ------------------------------------------------------------------ the places, from the manifest
const strip = $('#strip');
let venues = [], venueText = null;
async function places() {
  const data = await (await fetch('data/venues.json')).json();
  venues = data.venues;
  $('#places-caption').textContent = root.classList.contains('live') ? data.caption : data.stillCaption; venueText = data;
  strip.replaceChildren(...venues.map((v) => {
    const li = document.createElement('li'); li.className = 'vcard'; li.style.setProperty('--n', Math.max(4.6, v.name.length * 0.98));
    const img = (extra) => { const i = new Image(); i.decoding = 'async'; i.loading = 'lazy'; i.sizes = '(max-width: 860px) 160vw, 120vw'; i.srcset = `${v.small} 1280w, ${v.src} 2000w`; i.src = v.small; Object.assign(i, extra); return i; };
    const pic = document.createElement('div'); pic.className = 'pic';
    const layer = (cls, ...kids) => { const d = document.createElement('div'); d.className = cls; d.append(...kids); pic.append(d); return d; };
    const word = document.createElement('span'); word.textContent = v.name; word.setAttribute('aria-hidden', 'true');
    v.el = { li, pic, bg: layer('bgp', img({ alt: `${v.alt}. AI-generated scene.` })), word: layer('word', word), ctr: layer('ctr', img({ alt: '' })) };
    const dev = new Image(); dev.className = 'dev'; dev.loading = 'lazy'; dev.alt = `The device on the counter, showing: ${v.screen}`; dev.src = v.still; pic.append(dev);
    const cap = document.createElement('div'); cap.className = 'cap';
    const h = document.createElement('h3'); h.textContent = v.name; const p = document.createElement('p'); p.textContent = v.line; cap.append(h, p);
    li.append(pic, cap); return li;
  }));
}
const BASE = 0.82;                                            // the device's foot, share of the card height
function fitPlaces() {
  if (!venues.length) return;
  $('#places-caption').textContent = root.classList.contains('live') ? venueText.caption : venueText.stillCaption;
  const w = venues[0].el.pic.clientWidth, h = venues[0].el.pic.clientHeight, ratio = 2752 / 1536;
  for (const v of venues) {
    const ih = Math.max(h * v.zoom, (w * 1.16) / ratio, (h * BASE) / v.stand, (h * (1 - BASE)) / (1 - v.stand)), iw = ih * ratio;
    const top = h * BASE - v.stand * ih, left = clamp(w / 2 - v.focus * iw, w * 1.07 - iw, -w * 0.07);
    v.el.li.style.setProperty('--iw', `${iw}px`); v.el.li.style.setProperty('--ih', `${ih}px`); v.el.li.style.setProperty('--il', `${left}px`); v.el.li.style.setProperty('--it', `${top}px`);
    v.el.li.style.setProperty('--cut', `${top + v.edge * ih}px`);
  }
}

// ------------------------------------------------------------------ choreography
let stage = null, S3 = null, keys = [], screens = [], phones = [], sec = {}, VH = 1, VW = 1, cur = null, raf = 0, lastT = 0, mx = 0, mxT = 0;
const tops = {};
function measure() {
  VH = window.innerHeight; VW = root.clientWidth;
  const svh = $('.bk-in') && root.classList.contains('live') ? $('.bk-in').offsetHeight : VH;
  for (const el of $$('.pin')) {
    const top = el.getBoundingClientRect().top + scrollY, h = el.offsetHeight, curtain = el.id === 'talk' ? 0 : svh;
    sec[el.id] = { el, top, travel: Math.max(1, h - svh - curtain), h };
  }
  const c = $('#connect'); sec.connect = { el: c, top: c.getBoundingClientRect().top + scrollY, h: c.offsetHeight, travel: c.offsetHeight };
}
const at = (id, p) => sec[id].top + sec[id].travel * p;

/** The hero pose is fitted to the type: below the headline on phones, beside it on wide screens. The poster image is the
 *  same pose in a square 1.6 device heights tall (DESIGN.md), so the canvas replaces it without a jump. */
let HERO = { x: 0.44, y: -0.2, s: 0.64, yaw: -30, pitch: 17 };
function poster() {
  const H = $('.stage').clientHeight || VH, st = root.style, h1 = $('h1'), foot = $('.hero-foot');
  if (root.classList.contains('live')) {
    if (slimQ.matches) {
      const pad = parseFloat(getComputedStyle(h1).paddingTop), top = pad + (h1.offsetHeight - pad) - 2, end = $('.hero .ft-in').offsetHeight - foot.offsetHeight - parseFloat(getComputedStyle(foot).bottom);
      const room = Math.max(120, end - top), s = Math.min((room * 0.8) / H, (VW * 0.68) / H, 0.4);
      HERO = { x: 0.02, y: 1 - ((top + room * 0.5) / H) * 2, s, yaw: -30, pitch: 17 };
    } else {
      const line = 104 + parseFloat(getComputedStyle(h1).fontSize) * 0.9, s = Math.min(0.66, ((H - line) / H) * 0.845, (VW * 0.4) / H);
      HERO = { x: 0.44, y: -(1 - 0.06 - s * 1.12), s, yaw: -30, pitch: 17 };
    }
  }
  st.setProperty('--ps', `${HERO.s * H * 1.6}px`); st.setProperty('--px', `${50 + HERO.x * 50}%`); st.setProperty('--py', `${50 - HERO.y * 50}%`);
}

function choreograph() {
  const { pose, corePoint, PADS, PORT, CORE_C, freeAt } = S3, m = slimQ.matches;
  const W = (wide, slim = {}) => (m ? { ...wide, ...slim } : wide), P = (wide, slim) => pose(W(wide, slim));
  const dark = { key: 1.75, kx: -210, ky: 150, kz: 90, kg: 0.9, kb: 0.84, env: 0.34, hemi: 0.2, rim: 4.2, rr: 1, rg: 0.5, rb: 0.44, rx: 220, ry: 80, rz: -110, gr: 0.42, gg: 0.1, gb: 0.16 };
  const K = []; const key = (id, p, o, ease) => K.push({ y: at(id, p), o, ease });
  screens = []; phones = [];
  const scr = (id, p, name) => screens.push({ y: at(id, p), name });

  // hero: stands to the right, then comes to the middle
  const low = VH < 740;                                      // short windows
  key('hero', 0, pose({ ...HERO }));
  scr('hero', -1, 'idle');
  key('hero', 1, P({ x: 0.14, y: -0.14, s: 0.56, yaw: -14, pitch: 13 }, { x: 0, y: 0.02, s: 0.31, yaw: -14, pitch: 13 }));

  // the bridge: the device stands on the seam between your side and theirs, and shows what nobody expects a till to show
  const seam = P({ x: 0, y: -0.2, s: 0.5, pitch: 12, gr: 0.8, gg: 0.5, gb: 0.55 }, { x: 0, y: low ? -0.12 : -0.02, s: low ? 0.23 : 0.27, pitch: 12, gr: 0.8, gg: 0.5, gb: 0.55 });
  key('bridge', 0, { ...seam, yaw: -22 }); key('bridge', 0.5, { ...seam, yaw: 0 }); key('bridge', 1, { ...seam, yaw: 20 });
  scr('bridge', -0.32, 'song'); scr('bridge', 0.3, 'table'); scr('bridge', 0.64, 'timetable');

  // what it hands over: six words, six screens; the device turns to each
  const names = ['receipt', 'offer', 'loyalty', 'ticket', 'menu', 'question'], OX = [0.36, 0.08, 0.14], gr = [[0.99, 0.93, 0.94], [0.96, 0.54, 0.35], [0.94, 0.6, 0.65], OX, [1, 0.82, 0.66], OX];
  const yaws = [-24, 22, -20, 24, -22, 20];
  names.forEach((n, i) => {
    const [a, b] = PANEL(i), g = { gr: gr[i][0], gg: gr[i][1], gb: gr[i][2] }, L = gr[i] === OX ? { ...dark, rim: 1.8, env: 0.6, ...g } : g;
    const base = P({ x: 0.06, y: -0.22, s: 0.5, pitch: 13, ...L }, { x: 0, y: -0.06, s: 0.34, pitch: 13, ...L });
    key('hands', Math.max(0, a + 0.01), { ...base, yaw: yaws[i] }); key('hands', b, { ...base, yaw: yaws[i] * 0.45, y: base.y + 0.01 });
    scr('hands', i ? a - WIPE * 0.85 : -0.1, n);
  });

  // how: idle, code, phone
  const how = P({ x: 0.36, y: -0.12, s: 0.6, yaw: -22, pitch: 12, ph: 1, phx: 0.62, phy: -2.6, phs: 0.78, phyaw: 34, phroll: -10, phpitch: -6 }, { x: 0, y: 0.18, s: 0.3, yaw: -18, pitch: 12, ph: 1, phx: 2.3, phy: 0.12, phs: 0.42, phyaw: 40, phroll: 8 });
  key('how', -0.02, { ...how, ph: 0 }); scr('how', -0.12, 'idle'); scr('how', 0.07, 'receipt');
  key('how', 0.24, { ...how, yaw: -16 });
  // the phone belongs to whoever is looking: it comes up from the edge of the picture and stays cut by it
  key('how', 0.48, { ...how, ...W({ x: 0.06, y: 0.02, s: 0.49, yaw: 10, phx: 0.46, phy: -0.36, phs: 0.76, phyaw: -20, phroll: 4 }, { x: -0.22, y: 0.22, s: 0.26, yaw: 14, phx: 0.5, phy: 0.1, phs: 0.44, phyaw: -20, phroll: 5 }) });
  key('how', 0.6, { ...how, ...W({ x: 0.06, y: 0.02, s: 0.49, yaw: 12, phx: 0.46, phy: -0.34, phs: 0.77, phyaw: -18, phroll: 3 }, { x: -0.22, y: 0.22, s: 0.26, yaw: 14, phx: 0.5, phy: 0.1, phs: 0.45, phyaw: -20, phroll: 5 }) });
  key('how', 0.84, { ...how, ...W({ x: 0.1, y: 0.06, s: 0.4, yaw: 22, phx: 0.46, phy: -0.28, phs: 0.82, phyaw: -10, phroll: 2 }, { x: -0.46, y: 0.3, s: 0.2, yaw: 24, phx: 0.34, phy: low ? 0.03 : 0.07, phs: low ? 0.42 : 0.475, phyaw: -10, phroll: 3 }) });
  key('how', 1, { ...how, ...W({ x: 0.1, y: 0.06, s: 0.4, yaw: 24, phx: 0.465, phy: -0.26, phs: 0.82, phyaw: -4, phroll: 1 }, { x: -0.46, y: 0.3, s: 0.2, yaw: 24, phx: 0.34, phy: low ? 0.03 : 0.07, phs: low ? 0.425 : 0.48, phyaw: -5, phroll: 2 }) });
  const bye = { ...how, ...W({ x: 0.2, y: -0.06, s: 0.4, yaw: 6, phx: 0.56, phy: -2.7, phs: 1.0, phyaw: 10, phroll: -4 }, { x: 0, y: 0.1, s: 0.28, yaw: 6, phx: 2.5, phy: 0.14, phs: 0.5, phyaw: 30 }) };
  K.push({ y: at('how', 1) + VH * 0.42, o: bye });
  phones.push({ y: at('how', -1), name: 'camera' }, { y: at('how', 0.44), name: 'camera' }, { y: at('how', 0.72), name: 'page' });

  // places: the device stays, the rest moves
  if (venues.length) {
    const r = venues[0].el.pic, cardTop = 1 * (m ? 124 : 172), foot = cardTop + r.clientHeight * BASE, ch = $('.stage').clientHeight;
    const ny = 1 - (foot / ch) * 2, size = Math.min(m ? 0.235 : 0.29, (r.clientHeight / ch) * 0.43);
    venues.forEach((v, i) => {
      const [a, b] = PLACE(i), o = P({ x: m ? 0.2 : 0.4, y: ny, s: size, yaw: i % 2 ? -14 : -30, pitch: 9, px: 0, py: 0, pz: -20, ...v.light });
      key('places', a, o); key('places', b, { ...o, yaw: o.yaw * 0.7 });
      scr('places', i ? a - 0.06 : -0.18, v.screen);
    });
  }

  // device: round the back, off the Dock, the port underneath, into the contacts, down to the Dock's pins.
  // The Core leaves the Dock by `lf` only (stage.js, liftAt) and turns only once it is clear.
  const d = (o, sl) => P({ pitch: 12, ...dark, ...o }, sl), Y = -360;
  key('device', 0, d({ x: -0.34, y: -0.1, s: 0.64, yaw: -46 }, { x: 0, y: low ? 0.4 : 0.3, s: low ? 0.25 : 0.34 }));
  key('device', 0.11, d({ x: -0.34, y: -0.1, s: 0.64, yaw: -42 }, { x: 0, y: low ? 0.4 : 0.3, s: low ? 0.25 : 0.34 }));
  scr('device', -0.16, 'idle');
  key('device', 0.15, d({ x: -0.32, y: -0.1, s: 0.64, yaw: -56 }, { x: 0, y: 0.25, s: 0.36 }));
  key('device', 0.24, d({ x: 0.36, y: -0.08, s: 0.64, yaw: 160 + Y, pitch: 16 }, { x: 0, y: 0.2, s: 0.36, pitch: 16 }));
  key('device', 0.3, d({ x: 0.36, y: -0.08, s: 0.66, yaw: 148 + Y, pitch: 16 }, { x: 0, y: 0.2, s: 0.37, pitch: 16 }));
  key('device', 0.375, d({ x: 0.4, y: -0.32, s: 0.42, yaw: -52 + Y, pitch: 10 }, { x: 0.05, y: 0.02, s: 0.26, pitch: 10 }));
  const rise = d({ x: 0.4, y: -0.36, s: 0.42, yaw: -46 + Y, pitch: 9, lf: 1 }, { x: 0.05, y: -0.06, s: 0.24, pitch: 9, lf: 1 });
  key('device', 0.475, rise); key('device', 0.5, { ...rise, yaw: rise.yaw + 6 });
  const close = { key: 1.7, kx: -90, ky: 130, kz: 240, rim: 0.8, rr: 1, rg: 0.9, rb: 0.85, env: 0.86, hemi: 0.55, gr: 0.8, gg: 0.6, gb: 0.6 };
  const low2 = { lf: 1, crx: -58, key: 2.1, kx: -60, ky: 60, kz: 260, env: 0.7, hemi: 0.4, rim: 2.4 };
  const under = d({ x: 0.62, y: -0.02, s: 0.86, yaw: -16 + Y, pitch: 3, ...low2, cy: 40 }, { x: 0.36, y: 0.26, s: 0.41, yaw: -10 + Y, pitch: 3, ...low2, cy: 150 });   // further up, the Dock leaves the picture
  Object.assign(under, corePoint(under, PORT));
  key('device', 0.565, under); key('device', 0.62, { ...under, yaw: under.yaw + 5 });
  const up = { lf: 1, crx: 28, cry: -165 };
  const mac = d({ x: 0.06, y: low ? -0.46 : -0.36, s: 5.2, yaw: -24 + Y, pitch: 6, ...up, ...close }, { x: 0, y: -0.2, s: 1.6, yaw: -22 + Y, pitch: 4, ...up, ...close });
  Object.assign(mac, corePoint(mac, PADS));
  key('device', 0.72, mac); key('device', 0.78, { ...mac, yaw: mac.yaw + 11, s: mac.s * 1.05, pitch: 11 });
  const pin = d({ x: 0.24, y: -0.4, s: 4.4, yaw: 22 + Y, pitch: 22, ...up, ...close, px: PADS[0], py: PADS[1], pz: PADS[2] }, { x: 0, y: -0.2, s: 1.7, yaw: 22 + Y, pitch: 24, ...up, ...close, px: PADS[0], py: PADS[1], pz: PADS[2] });
  const both = d({ x: 0.14, y: -0.06, s: 0.46, yaw: 2 + Y, pitch: 10, ...up, ...close, px: 0, py: 72, pz: -22 }, { x: 0, y: 0.02, s: 0.34, yaw: 2 + Y, pitch: 10, ...up, ...close, px: 0, py: 72, pz: -22 });
  key('device', 0.815, both); key('device', 0.855, pin); key('device', 0.92, { ...pin, yaw: pin.yaw + 9, pitch: 27, s: pin.s * 1.04 });
  key('device', 1, d({ x: 0.36, y: -0.36, s: 0.42, yaw: 6 + Y, ...up, cry: -172 }, { x: 0.05, y: -0.06, s: 0.24, yaw: 6 + Y, ...up, cry: -172 }));

  // off the Dock: the Dock slides off along the counter, the Core stands upright (its docked lean is 20 degrees)
  const roseG = { gr: 0.93, gg: 0.58, gb: 0.64 }, away = { don: 0, dx: 320, sh: 0 }, piv = { px: 0, py: 109, pz: 7 };
  const f = (xyz, o, sl) => P({ x: 0.36, y: 0.02, s: 0.6, yaw: -20 + Y, pitch: 5, ...roseG, ...away, ...piv, ...freeAt(...xyz), cry: Y, ...o }, { x: 0, y: 0.24, s: 0.31, ...sl });
  const steel = { env: 0.7, key: 1.5, kx: -190, ky: 170, kz: 130, rim: 1.4, hemi: 0.5 };
  // its back, with the magnets
  const back = (o, sl) => f([0, 0, 92], { yaw: -14 + Y, cry: -180, pz: 92, s: 0.54, ...o }, sl);
  scr('off', -0.2, 'offer');
  key('off', 0, back({ mag: 0 })); key('off', 0.05, back({ mag: 1 })); key('off', 0.16, back({ mag: 1, yaw: 12 + Y }));
  // turns round, back to the steel, seen from the side: the gap closes
  key('off', 0.235, f([0, 0, 92], { post: 1, yaw: -40 + Y, s: 0.46, x: 0.36, ...steel, mag: 0 }, { s: 0.25, x: 0.5 }));
  key('off', 0.3, f([0, 0, 34], { post: 1, yaw: -46 + Y, pitch: 9, s: 0.54, x: 0.36, ...steel }, { s: 0.29, x: 0.2 }));
  key('off', 0.335, f([0, 0, 0], { post: 1, yaw: -44 + Y, pitch: 9, s: 0.56, x: 0.36, ...steel }, { s: 0.29, x: 0.06 }), 'in');
  key('off', 0.4, f([0, 0, 0], { post: 1, yaw: -26 + Y, s: 0.58, x: 0.36, ...steel, cable: 0 }, { s: 0.29 }));
  key('off', 0.44, f([0, 0, 0], { post: 1, yaw: -22 + Y, s: 0.58, x: 0.36, ...steel, cable: 1 }, { s: 0.29 })); scr('off', 0.5, 'song');
  key('off', 0.5, f([0, 0, 0], { post: 1, yaw: -14 + Y, s: 0.58, x: 0.36, ...steel, cable: 1 }, { s: 0.29 }));
  // off the post, and from above into the holder, seen from behind
  key('off', 0.53, f([0, 0, 0], { post: 1, yaw: -24 + Y, s: 0.56, ...steel, cable: 0 }, { s: 0.28 }));
  key('off', 0.575, f([0, 60, 40], { post: 0, yaw: -50 + Y, s: 0.42, y: 0.1, ...steel }, { s: 0.24 }));
  const tall = { py: 119, s: 0.35, x: 0.36, y: -0.02, env: 0.95, rim: 2 };
  key('off', 0.62, f([0, 96, 0], { hold: 1, yaw: -132 + Y, pitch: 12, ...tall }, { s: 0.195, y: 0.12 })); scr('off', 0.56, 'loyalty');
  key('off', 0.69, f([0, 0, 0], { hold: 1, yaw: -118 + Y, pitch: 12, ...tall, py: 109, s: 0.44, y: 0.28 }, { s: low ? 0.23 : 0.26, y: low ? 0.4 : 0.36 }));
  key('off', 0.75, f([0, 0, 0], { hold: 1, yaw: -28 + Y, pitch: 10, ...tall, py: 109, s: 0.46, y: 0.28 }, { s: low ? 0.23 : 0.27, y: low ? 0.4 : 0.36 }));
  key('off', 0.8, f([0, 0, 0], { hold: 1, yaw: -20 + Y, pitch: 10, ...tall, py: 109, s: 0.46, y: 0.28 }, { s: low ? 0.23 : 0.27, y: low ? 0.4 : 0.36 }));
  // up and out, the Dock slides back, the Core comes down the way it left
  key('off', 0.835, f([0, 96, 0], { hold: 1, yaw: -26 + Y, pitch: 10, ...tall }, { s: 0.195, y: 0.12 })); scr('off', 0.85, 'idle');
  key('off', 0.86, f([0, 96, 0], { hold: 0, yaw: -32 + Y, pitch: 10, ...tall }, { s: 0.195, y: 0.12 }));
  const homeL = P({ ...roseG, x: 0.34, y: -0.34, s: 0.42, yaw: -40 + Y, pitch: 10, lf: 1, cry: Y }, { x: 0, y: -0.02, s: 0.24, cry: Y });
  key('off', 0.895, { ...homeL });
  key('off', 0.97, P({ ...roseG, x: 0.34, y: -0.12, s: 0.58, yaw: -24 + Y, pitch: 14, cry: Y }, { x: 0, y: 0.18, s: 0.34, cry: Y }));
  key('off', 1, P({ ...roseG, x: 0.34, y: -0.12, s: 0.58, yaw: -18 + Y, pitch: 14, cry: Y }, { x: 0, y: 0.18, s: 0.34, cry: Y }));

  // close (the connect section covers the stage in between)
  const c = P({ x: 0, y: -0.24, s: 0.5, yaw: -372, pitch: 12, cry: -360 }, { x: 0, y: low ? 0.04 : -0.02, s: low ? 0.3 : 0.36, cry: -360 });
  K.push({ y: sec.connect.top + VH * 0.4, o: { ...c, yaw: -420, y: c.y - 0.5 } });
  key('talk', -0.35, { ...c, yaw: -404, y: c.y - 0.1 }); key('talk', 1, { ...c, yaw: -366 }); scr('talk', -0.6, 'mail');
  const ft = $('footer'), end = ft.getBoundingClientRect().top + scrollY - VH;
  if (end >= at('talk', 1) - 4) K.push({ y: end + ft.offsetHeight, o: { ...c, yaw: -366, y: c.y + (ft.offsetHeight / VH) * 2 }, ease: 'lin' });
  K.sort((a, b) => a.y - b.y); keys = K; screens.sort((a, b) => a.y - b.y); phones.sort((a, b) => a.y - b.y);
  void CORE_C;
}

const PSTEP = 1 / ($$('.panel').length - 0.305), WIPE = PSTEP * 0.305, PANEL = (i) => [i * PSTEP, i * PSTEP + PSTEP * 0.695];   // panel i is settled between these
const PLACE = (i) => { const n = Math.max(2, venues.length), step = 1 / (n - 0.45); return [i * step, i * step + step * 0.46]; };

const out = {};
function poseAt(y) {
  if (y <= keys[0].y) return keys[0].o;
  let lo = 0, hi = keys.length - 1;
  if (y >= keys[hi].y) return keys[hi].o;
  while (hi - lo > 1) { const k = (lo + hi) >> 1; if (keys[k].y <= y) lo = k; else hi = k; }
  const a = keys[lo], b = keys[hi], t = (y - a.y) / Math.max(1, b.y - a.y);
  return S3.mix(a.o, b.o, b.ease === 'lin' ? t : b.ease === 'in' ? Math.pow(t, 2.6) : ss(t), out);
}
const nameAt = (list, y) => { let n = list[0]?.name; for (const s of list) { if (s.y <= y) n = s.name; else break; } return n; };

// ------------------------------------------------------------------ page layers
const panels = $$('.panel'), words = panels.map((p) => $('h3', p)), nums = $$('.nums span'), swaps = {};
for (const id of ['how', 'device', 'off']) { const box = $('.swap', $(`#${id}`)); swaps[id] = box ? [...box.children] : []; }
const SWAP = { how: [[-0.3, 0.33], [0.33, 0.66], [0.66, 9]], device: [[-0.3, 0.135], [0.2, 0.33], [0.37, 0.515], [0.54, 0.63], [0.695, 0.785], [0.84, 0.93]], off: [[-0.3, 0.205], [0.225, 0.545], [0.575, 0.825], [0.845, 9]] };
const fronts = ['how', 'device', 'off', 'talk'].map((id) => ({ id, el: $('.ft-in', $(`#${id}`)), o: -1 })), heroFoot = $('.hero-foot'), ghost = $('.ghost'), rowEl = $('.row');
const prog = (id, y) => clamp((y - sec[id].top) / sec[id].travel, -1, 2);
const top = $('.top'); let tone = '';
const ctl = $('.ctl'), toned = $$('main > section'), GROUND = { hero: 'pink', bridge: 'oxblood', how: 'pink', places: 'blush', device: 'oxblood', off: 'rose', connect: 'tangerine', talk: 'pink' }, PGROUND = ['blush', 'tangerine', 'rose', 'oxblood', 'peach', 'oxblood'];
let was = 0, hb = '';
function ctlTone(y) {                                         // what is under the pause button, bottom right
  const py = y + VH - 48; let id = '', t = 'light';
  for (const el of toned) { const r = sec[el.id]; if (r && py >= r.top && py < r.top + r.h) { id = el.id; t = el.dataset.tone || t; } }
  if (id === 'bridge') return 'light';
  if (id === 'hands') { const p = prog('hands', y); t = 'light'; panels.forEach((el, i) => { if (i === 0 || p > PANEL(i)[0] - WIPE * 0.94) t = el.dataset.tone; }); }
  if (id === 'device' && !slimQ.matches) { const v = prog('device', y); if ((v > 0.69 && v < 0.79) || (v > 0.84 && v < 0.94)) t = 'light'; }
  return t;
}
function setTone(t) { if (t !== tone) { tone = t; top.dataset.tone = t; } }
function setCtl(t) { if (ctl.dataset.tone !== t) ctl.dataset.tone = t; }
function hideTop() { const y = scrollY; top.classList.toggle('solid', y > VH * 0.5); if (Math.abs(y - was) < 6) return; top.classList.toggle('up', y > was && y > VH * 0.5); was = y; }

function layers(y) {
  const near = (id) => y > sec[id].top - VH * 1.2 && y < sec[id].top + sec[id].h + VH * 0.2;
  if (near('hero')) {
    const p = clamp((y - sec.hero.top) / (sec.hero.travel + VH)), o = 1 - ramp(p, 0.1, 0.3);
    sec.hero.el.style.setProperty('--p', p.toFixed(4)); heroFoot.style.opacity = o; heroFoot.style.visibility = o < 0.02 ? 'hidden' : 'visible';
  }
  if (near('bridge')) sec.bridge.el.style.setProperty('--b', clamp((y - sec.bridge.top + VH) / (VH * 1.05)).toFixed(4));
  if (near('hands')) {
    const p = prog('hands', y);
    panels.forEach((el, i) => {
      const [a, b] = PANEL(i), inn = i ? clamp((p - (a - WIPE)) / WIPE) : 1;
      el.style.transform = `translate3d(0,${(1 - inn) * 100}%,0)`;
      const mid = (a + b) / 2, d = clamp((p - mid) / (PSTEP * 0.75), -1.4, 1.4);
      words[i].style.transform = `translate3d(${-d * 9}vw,${(1 - inn) * -46}vh,0)`;
    });
  }
  if (near('how')) {
    const p = prog('how', y);
    nums.forEach((el, i) => { const d = (p - (Math.max(0, SWAP.how[i][0]) + 0.16)) / 0.33; el.style.visibility = Math.abs(d) > 1.6 ? 'hidden' : 'visible'; el.style.transform = `translate3d(0,calc(-50% + ${clamp(-d, -1.6, 1.6) * 108}vh),0)`; });
  }
  if (near('places') && venues.length) {
    const p = prog('places', y), n = venues.length, w = venues[0].el.li.offsetWidth, gap = parseFloat(getComputedStyle(strip).columnGap) || 0;
    let t = 0;
    for (let i = 0; i < n - 1; i++) { const b = PLACE(i)[1], a2 = PLACE(i + 1)[0]; t += ss(clamp((p - b) / (a2 - b))); }
    const drift = p < 0 ? -p * 0.35 : 0;                     // the first card slides in as the section arrives
    t -= drift;
    strip.style.transform = `translate3d(${-t * (w + gap)}px,0,0)`;
    venues.forEach((v, i) => {
      const d = clamp(i - t, -1.3, 1.3), e = v.el;
      e.bg.style.transform = `translate3d(${-d * 6}%,0,0)`; e.word.style.transform = `translate3d(${d * 22}%,0,0)`; e.ctr.style.transform = `translate3d(${d * 4}%,0,0)`;
    });
  }
  for (const f of fronts) {
    const r = sec[f.id]; if (!near(f.id)) continue;
    const o = slimQ.matches ? ramp(y, r.top - VH * 0.3, r.top - VH * 0.04) * (1 - ramp(y, r.top + r.travel + VH * 0.01, r.top + r.travel + VH * 0.2)) : 1;
    if (f.o !== o) { f.o = o; f.el.style.opacity = f.id === 'talk' ? Math.min(1, ramp(y, r.top - VH * 0.3, r.top)) : o; }
  }
  for (const id in swaps) {
    if (!near(id)) continue;
    const p = prog(id, y);
    swaps[id].forEach((el, i) => { const [a, b] = SWAP[id][i]; el.classList.toggle('on', p >= a && p < b); el.classList.toggle('past', p >= b); });
  }
  if (near('device')) { const p = prog('device', y); ghost.style.transform = `translate3d(${46 - p * 680}vw,-50%,0)`; ghost.style.visibility = p > 0.32 ? 'hidden' : 'visible'; }
  if (y > sec.connect.top - VH && y < sec.connect.top + sec.connect.h) rowEl.style.transform = `translate3d(${((y - sec.connect.top) / sec.connect.h) * -22}vw,0,0)`;
  if (near('talk')) sec.talk.el.style.setProperty('--p', clamp((y - sec.talk.top + VH * 0.6) / (VH * 1.2)).toFixed(4));
  // header tone: what is under the header
  const hy = y + 42; let t = 'light', g = 'pink';
  for (const el of toned) { const r = sec[el.id]; if (r && hy >= r.top && hy < r.top + r.h) { t = el.dataset.tone || t; g = GROUND[el.id] || g; } }
  if (hy >= sec.hands.top && hy < sec.hands.top + sec.hands.h) { const p = prog('hands', y); t = 'light'; panels.forEach((el, i) => { if (i === 0 || p > PANEL(i)[0] - 0.008) { t = el.dataset.tone; g = PGROUND[i]; } }); $('.hands h2').style.color = t === 'dark' ? 'var(--on-ox)' : ''; if (hy >= sec.how.top) { t = 'light'; g = 'pink'; } }
  if (hy >= sec.device.top && hy < sec.off.top && ((v) => (v > 0.69 && v < 0.79) || (v > 0.84 && v < 0.94))(prog('device', y))) { t = 'light'; g = 'blush'; }
  setTone(t); setCtl(ctlTone(y)); if (g !== hb) { hb = g; top.style.setProperty('--hb', `var(--${g})`); }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
  raf = 0;
  if (!root.classList.contains('live')) return;
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
  const target = scrollY;
  if (cur === null || Math.abs(target - cur) > VH * 3) cur = target;
  cur += (target - cur) * (1 - Math.exp(-dt * 10));
  if (Math.abs(target - cur) < 0.4) cur = target;
  mx += (mxT - mx) * (1 - Math.exp(-dt * 4)); if (Math.abs(mxT - mx) < 0.002) mx = mxT;
  layers(cur);
  let busy = cur !== target || mx !== mxT;
  if (stage && keys.length) {
    const covered = cur > sec.connect.top + 2 && cur < sec.connect.top + sec.connect.h - VH;   // the opaque section hides the stage
    const p = { ...poseAt(cur) }; p.yaw += mx * 3.2; p.pitch += Math.abs(mx) * 0.3; p.on = covered ? 0 : p.on;
    stage.show(nameAt(screens, cur)); stage.showPhone(nameAt(phones, cur));
    if (stage.tick(dt)) busy = true;
    stage.render(p);
  }
  if (busy) kick();
}
function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }

// ------------------------------------------------------------------ modes
async function boot() {
  if (!root.classList.contains('live') || stage || boot.run) return; boot.run = true;
  try {
    S3 = await import('./stage.js');
    const s = new S3.Stage($('.stage canvas'));
    await s.load();
    if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
    stage = s; const rc = radios.find((r) => r.checked); if (rc) s.setColour(rc.value, true); resize(); s.show('idle', true); s.screen.t = 0; s.screen.from = null;
    cur = scrollY; s.render({ ...poseAt(cur) });
    s.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(); });
    root.classList.add('ready'); lastT = performance.now(); kick();
  } catch (e) { console.warn('3D is off:', e.message || e); fail(); }
}
function fail() { for (const f of fronts) f.el.style.opacity = ''; heroFoot.style.opacity = heroFoot.style.visibility = ''; root.classList.add('cannot'); root.classList.remove('live', 'ready'); stage = null; }
let lw = 0, lh = 0;
function resize(force) {
  measure(); poster(); fitPlaces();
  const box = $('.stage'), w = box.clientWidth, h = box.clientHeight;
  if (stage && (force || w !== lw || h !== lh)) { lw = w; lh = h; stage.resize(w, h); }
  if (stage) choreograph();
  kick();
}
function setMode(on, keep) {
  let mark = null;
  if (keep) { const els = $$('main > section'); let best = 1e9; for (const el of els) { const r = el.getBoundingClientRect(); const d = r.top <= 10 && r.bottom > 10 ? 0 : Math.abs(r.top); if (d <= best) { best = d; mark = el; } } }
  root.classList.toggle('live', on); if (!on) { for (const f of fronts) { f.el.style.opacity = ''; f.o = -1; } heroFoot.style.opacity = heroFoot.style.visibility = ''; top.classList.remove('up'); root.classList.remove('ready'); top.dataset.tone = 'light'; tone = 'light'; }
  else if (stage) root.classList.add('ready');
  lw = 0; cur = null; resize(); if (on) boot();
  if (mark && mark.id !== 'hero') scrollTo({ top: mark.getBoundingClientRect().top + scrollY, behavior: 'instant' });
}
const btn = $('#motion');
function label() { const p = root.classList.contains('paused'); btn.setAttribute('aria-pressed', String(p)); btn.title = p ? 'Play motion' : 'Pause motion'; btn.setAttribute('aria-label', btn.title); }
btn.addEventListener('click', () => {
  const p = !root.classList.contains('paused'); root.classList.toggle('paused', p);
  try { localStorage.setItem('motion', p ? 'off' : 'on'); } catch { /* private mode */ }
  label(); setMode(!p, true);
});
if (!root.classList.contains('live')) { if (calmQ.matches) root.classList.add('cannot'); else { try { if (localStorage.getItem('motion') === 'off') root.classList.add('paused'); else root.classList.add('cannot'); } catch { root.classList.add('cannot'); } } }
label();
calmQ.addEventListener('change', () => { root.classList.toggle('cannot', calmQ.matches); setMode(!calmQ.matches && !root.classList.contains('paused'), true); });
addEventListener('scroll', () => { if (root.classList.contains('live')) hideTop(); kick(); }, { passive: true });
addEventListener('resize', () => { if (Math.abs(root.clientWidth - VW) > 1 || Math.abs(innerHeight - VH) > 140 || !slimQ.matches) resize(); });
document.addEventListener('visibilitychange', () => { lastT = performance.now(); kick(); });
if (matchMedia('(hover:hover) and (pointer:fine)').matches) addEventListener('pointermove', (e) => { mxT = (e.clientX / innerWidth - 0.5) * 2; kick(); }, { passive: true });
// case colour: the live model changes its materials, the line above the dots says the name. The stills always show the first.
const radios = $$('.picker input'), caseName = $('#case-name');
const sayColour = () => { const r = radios.find((q) => q.checked); if (r) caseName.textContent = $('.nm', r.parentElement).textContent; };
sayColour();
for (const r of radios) r.addEventListener('change', () => { if (r.checked) sayColour(); if (r.checked && stage) { stage.setColour(r.value); lastT = performance.now(); kick(); } });
// in-page links: land where the section is settled, not at its edge; close the small menu
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const d = a.closest('details'); if (d) d.open = false;
  const s = sec[a.hash.slice(1)]; if (!s || !root.classList.contains('live') || a.classList.contains('skip')) return;
  e.preventDefault(); history.pushState(null, '', a.hash); scrollTo({ top: s.top + 2, behavior: 'smooth' });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const m = $('.menu[open]'); if (m) { m.open = false; $('summary', m).focus(); } } });

measure(); poster();
places().catch((e) => console.warn('places:', e.message)).then(() => { resize(); });
// The page is readable first; three.js and the model come after the first paint.
const later = window.requestIdleCallback || ((f) => setTimeout(f, 200));
if (document.readyState === 'complete') later(boot); else addEventListener('load', () => later(boot), { once: true });
addEventListener('load', () => resize());
if (document.fonts) document.fonts.ready.then(() => resize());
addEventListener('pageshow', () => resize());
window.__maratus = { get stage() { return stage; }, get keys() { return keys; }, poseAt: (y) => poseAt(y) };   // tools/collide.mjs reads this
kick();
