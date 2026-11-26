// Developers page. The browser scrolls natively; this reads the position, eases it a little and moves the layers (as js/home.js does).
// The hero types one request and the live device answers; the path pans along one counter; the pin diagram plays once.
const root = document.documentElement; root.classList.add('js');
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), ss = (t) => t * t * (3 - 2 * t), ramp = (v, a, b) => ss(clamp((v - a) / (b - a)));
const slim = matchMedia('(max-width: 860px)'), calm = matchMedia('(prefers-reduced-motion: reduce)');
const live = () => root.classList.contains('live'), wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ the device in the hero
const HERO = { s: 0.6, y: -0.1, yaw: -25, pitch: 13, gr: 0.93, gg: 0.58, gb: 0.64 };   // same numbers as DEV in tools/snaps.mjs
const canvas = $('.dev canvas'), poster = $('.poster');
let st = null, S = null, p0 = 0, mx = 0, mxT = 0, seen = true, readyStage, failed = false;
const staged = new Promise((r) => { readyStage = r; });
async function boot() {
  if (!live() || st) return;
  try {
    S = await import('./stage.js'); const s = new S.Stage(canvas); await s.load({ props: false });
    if (document.fonts) await Promise.race([document.fonts.ready, wait(800)]);
    st = s; s.show('idle', true); size(); s.render(S.pose(HERO)); root.classList.add('ready');
    canvas.addEventListener('webglcontextlost', off);
  } catch (e) { console.warn('3D is off:', e.message || e); off(); }
  readyStage(); scenes(); kick();
}
function off() { failed = true; st = null; root.classList.add('cannot'); root.classList.remove('live', 'ready'); }
function size() { if (st) { const n = canvas.clientWidth; st.resize(n, n); } }

// ------------------------------------------------------------------ the request types itself, once; then whenever it is asked to
const lines = $$('.term .ln'), req = lines.filter((l) => !l.classList.contains('res')), res = lines.filter((l) => l.classList.contains('res'));
const again = $('#again'), wire = $('.wire'); let run = 0;
async function send(speed) {
  const id = ++run; again.disabled = true;
  for (const l of lines) { l.classList.remove('done', 'cur'); l.style.setProperty('--c', 0); }
  wire.className = 'wire live-only'; if (st) { st.show('idle'); kick(); }
  await wait(speed > 100 ? 250 : 500);
  let last = performance.now();
  for (const l of req) {
    const n = l.textContent.trim() ? l.textContent.length : 0; let c = 0; l.classList.add('cur');
    while (c < n) { await new Promise((r) => requestAnimationFrame(r)); if (id !== run || !live()) return; const t = performance.now(); c = Math.min(n, c + Math.min(0.1, (t - last) / 1000) * speed); last = t; l.style.setProperty('--c', Math.floor(c)); }
    l.classList.add('done'); l.classList.remove('cur');
  }
  await Promise.race([staged, wait(9000)]); await wait(420); if (id !== run) return;
  for (const l of res) l.classList.add('done');
  wire.classList.add('out'); await wait(620); if (id !== run) return;
  if (st) { st.show('code'); kick(); }
  wire.classList.add('in'); wire.classList.remove('out'); again.disabled = false;
}
again.addEventListener('click', () => send(220));

// ------------------------------------------------------------------ pictures that wait: nothing below the hero loads before the 3D is up or the page moves
function scenes() {
  for (const i of $$('.win img[data-srcset]')) { i.sizes = slim.matches ? '200vw' : '140vw'; if (i.closest('.over')) i.sizes = slim.matches ? '100vw' : '62vw'; i.srcset = i.dataset.srcset; i.removeAttribute('data-srcset'); }
}

// ------------------------------------------------------------------ layers
const path = $('.path'), win = $('.win'), pan = $('.pan'), dim = $('.dim'), word = $('.word'), over = $('.over'), overImg = $('.over img');
const stops = $$('.stops li'), slips = $$('.stops .slip'), rail = $$('.rail b'), fill = $('.rail .fill');
const RATIO = 2600 / 1451, STOP = [[-1, 0.24], [0.24, 0.49], [0.49, 0.735], [0.735, 9]];
// the camera along the counter: progress, middle of the view in the picture (x, y), zoom
const CAM = [[0, 0.22, 0.46, 1.06], [0.22, 0.27, 0.46, 1.16], [0.5, 0.52, 0.55, 1.25], [0.6, 0.715, 0.655, 2.0], [0.72, 0.725, 0.655, 2.12], [0.84, 0.79, 0.58, 1.7], [1, 0.8, 0.57, 1.7]];
const ZMAX = 2.2; let box = null, VH = 1, cur = null, raf = 0, last = 0;
const drift = [['.band', 0], ['.night', 0], ['.sheet', 0]].map(([s]) => ({ el: $(s), top: 0, h: 1 })), hero = { el: $('.hero'), top: 0, h: 1 };
const topOf = (el) => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };   // layout position, without transforms
function measure() {
  VH = innerHeight; hero.h = hero.el.offsetHeight;
  for (const d of drift) { d.top = topOf(d.el); d.h = d.el.offsetHeight; }
  if (!live()) return;
  const W = win.clientWidth, H = win.clientHeight, s = Math.max(W / RATIO, H); box = { W, H, h: s, w: s * RATIO, top: topOf(path), travel: Math.max(1, path.offsetHeight - $('.path-in').offsetHeight) };
  pan.style.width = `${box.w * ZMAX}px`; pan.style.height = `${box.h * ZMAX}px`;
}
function camera(p) {
  let i = 0; while (i < CAM.length - 2 && CAM[i + 1][0] < p) i++;
  const a = CAM[i], b = CAM[i + 1], t = ss(clamp((p - a[0]) / (b[0] - a[0]))), m = (k) => a[k] + (b[k] - a[k]) * t, z = m(3), w = box.w * z, h = box.h * z;
  const x = clamp(box.W / 2 - m(1) * w, box.W - w, 0), y = clamp(box.H / 2 - m(2) * h, box.H - h, 0);
  pan.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${(z / ZMAX).toFixed(5)})`;
}
function layers(y) {
  p0 = clamp(y / hero.h); hero.el.style.setProperty('--p', p0.toFixed(4));
  for (const d of drift) if (y > d.top - VH * 1.3 && y < d.top + d.h + VH * 0.3) d.el.style.setProperty('--d', clamp((y + VH / 2 - d.top - d.h / 2) / VH, -1, 1).toFixed(4));
  if (!box || y < box.top - VH * 1.2 || y > box.top + box.travel + VH * 1.2) return;
  const p = clamp((y - box.top) / box.travel), q = (y - box.top) / box.travel;
  camera(p);
  const d = ramp(p, 0.22, 0.29) * (1 - ramp(p, 0.47, 0.55)); dim.style.opacity = (d * 0.84).toFixed(3);
  word.style.opacity = ramp(p, 0.235, 0.29) * (1 - ramp(p, 0.46, 0.52)); word.style.transform = `translate3d(${(0.62 - (p - 0.22) / 0.31 * 1.5) * box.W}px,-50%,0)`;
  const o = ramp(p, 0.715, 0.8); over.style.transform = `translate3d(0,${((1 - o) * 101).toFixed(2)}%,0)`; overImg.style.transform = `translate3d(0,${((1 - o) * -42 + (p - 0.9) * 22).toFixed(2)}%,0)`;
  stops.forEach((el, i) => {
    const [a, b] = STOP[i], mid = (Math.max(0, a) + Math.min(1, b)) / 2;
    el.classList.toggle('on', q >= a && q < b); el.classList.toggle('past', q >= b);
    slips[i].style.transform = `translate3d(0,${(clamp((mid - p) / 0.25, -1.4, 1.4) * VH * (slim.matches ? 0.02 : 0.17)).toFixed(1)}px,0)`;   // in front of the picture, so it moves more than the picture
  });
  fill.style.transform = `scaleX(${p.toFixed(4)})`;
  const at = STOP.findIndex(([, b]) => p < b); rail.forEach((el, i) => el.classList.toggle('on', i === at));
}
function frame(now) {
  raf = 0; if (!live()) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  const y = scrollY; if (cur === null || Math.abs(y - cur) > VH * 3) cur = y;
  cur += (y - cur) * (1 - Math.exp(-dt * 10)); if (Math.abs(y - cur) < 0.4) cur = y;
  mx += (mxT - mx) * (1 - Math.exp(-dt * 4)); if (Math.abs(mxT - mx) < 0.002) mx = mxT;
  layers(cur); let busy = cur !== y || mx !== mxT;
  if (st && seen) { if (st.tick(dt)) busy = true; st.render(S.pose({ ...HERO, yaw: HERO.yaw + mx * 3.2 + p0 * 34, pitch: HERO.pitch + p0 * 5 })); }
  if (busy) kick();
}
function kick() { if (!raf && live() && !document.hidden) raf = requestAnimationFrame(frame); }

// ------------------------------------------------------------------ pins: the example follows the spec (device > store > organization)
const tree = $('.tree'), orgN = $('.node.org'), stN = $$('.node.store'), dvN = $$('.devs li'), steps = $$('.pin-steps li'), aff = $('.aff b');
const URLS = { org: '/welcome', store: '/store-menu', device: '/menu' };
const PIN = [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 1, 0], [1, 0, 0], [0, 0, 0]];   // what is set after each call: organization, store one, its first device
const resolve = ([o, s, d]) => dvN.map((_, i) => (i === 0 && d ? 'device' : i < 3 && s ? 'store' : o ? 'org' : 'none'));
function paintPins(k, from) {
  const [o, s] = PIN[k], now = resolve(PIN[k]), was = from === undefined ? null : from < 0 ? now.map(() => 'none') : resolve(PIN[from]); let n = 0;
  const put = (el, src, txt) => { el.dataset.pin = src; $('.u', el).textContent = txt; };
  put(orgN, o ? 'org' : 'none', o ? URLS.org : 'null'); put(stN[0], s ? 'store' : o ? 'org' : 'none', s ? URLS.store : 'inherit'); put(stN[1], o ? 'org' : 'none', 'inherit');
  dvN.forEach((el, i) => { put(el, now[i], URLS[now[i]] || 'null'); el.classList.remove('hit'); if (was && was[i] !== now[i]) { n++; if (live()) { void el.offsetWidth; el.classList.add('hit'); } } });
  if (was) aff.textContent = n;
  steps.forEach((el, i) => (i === k ? el.setAttribute('aria-current', 'step') : el.removeAttribute('aria-current')));
}
let auto = true;
steps.forEach((el, k) => $('button', el).addEventListener('click', () => { auto = false; paintPins(k, k - 1); }));   // each call is shown against the state before it
async function playPins() { for (const k of [0, 1, 2, 3]) { if (!auto || !live()) return; paintPins(k, k - 1); await wait(k === 3 ? 0 : 1900); } }

// ------------------------------------------------------------------ code tabs and copy
const tabs = $$('[role=tab]'), panels = $$('[role=tabpanel]'), copy = $('.copy');
function tab(i, focus) { tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i; }); if (focus) tabs[i].focus(); copy.textContent = 'Copy code'; measure(); }
tabs.forEach((t, i) => {
  t.addEventListener('click', () => tab(i));
  t.addEventListener('keydown', (e) => { const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (to === undefined) return; e.preventDefault(); tab((to + tabs.length) % tabs.length, true); });
});
tab(0);
copy.addEventListener('click', async () => {
  const code = $('code', panels.find((p) => !p.hidden)); let ok = true;
  try { await navigator.clipboard.writeText(code.textContent); } catch { ok = false; const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  copy.textContent = ok ? 'Copied' : 'Selected, now copy'; setTimeout(() => { copy.textContent = 'Copy code'; }, 2400);
});

// ------------------------------------------------------------------ modes and events
const btn = $('#motion'); let paused = false;
try { paused = localStorage.getItem('motion') === 'off'; } catch { /* private mode */ }
if (!live()) root.classList.add(paused && !calm.matches ? 'paused' : 'cannot');
btn.title = paused ? 'Play motion' : 'Pause motion'; btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-pressed', String(paused));
btn.addEventListener('click', () => { try { localStorage.setItem('motion', paused ? 'on' : 'off'); } catch { /* private mode */ } location.reload(); });
calm.addEventListener('change', (e) => { if (e.matches) off(); });
addEventListener('scroll', () => { if (scrollY > 40) scenes(); kick(); }, { passive: true });
addEventListener('resize', () => { measure(); size(); cur = null; kick(); });
addEventListener('pageshow', () => { measure(); kick(); });
document.addEventListener('visibilitychange', () => { last = performance.now(); kick(); });
document.addEventListener('keydown', (e) => { const m = $('.menu[open]'); if (e.key === 'Escape' && m) { m.open = false; $('summary', m).focus(); } });
if (matchMedia('(hover:hover) and (pointer:fine)').matches) addEventListener('pointermove', (e) => { mxT = (e.clientX / innerWidth - 0.5) * 2; kick(); }, { passive: true });
$$('.calls').forEach((ul) => [...ul.children].forEach((li, i) => li.style.setProperty('--i', i)));
const reveal = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('seen'); reveal.unobserve(e.target); } }, { rootMargin: '0px 0px -12% 0px' });
$$('.group').forEach((g) => reveal.observe(g));
new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); if (live()) playPins(); } }, { threshold: 0.4 }).observe(tree);
new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; kick(); }).observe(canvas);
new ResizeObserver(() => { measure(); kick(); }).observe($('main'));
paintPins(live() ? 0 : 2); if (live()) aff.textContent = 6;
if (live()) poster.src = poster.dataset.src;
measure(); kick();
if (live()) (document.fonts ? Promise.race([document.fonts.ready, wait(700)]) : wait(0)).then(() => send(78));
const later = window.requestIdleCallback || ((f) => setTimeout(f, 200));
if (document.readyState === 'complete') later(boot); else addEventListener('load', () => later(boot), { once: true });
window.__maratusDev = { get stage() { return st; }, get failed() { return failed; }, HERO };
