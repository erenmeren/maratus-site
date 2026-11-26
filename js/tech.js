// The technical page's viewer: the section being read decides the pose; dragging turns the device. Nothing else moves.
const root = document.documentElement; root.classList.add('js');
const $ = (s) => document.querySelector(s), canvas = $('.view canvas'), box = $('.view-in');
const slim = matchMedia('(max-width: 980px)');
let st = null, S = null, want = null, from = null, t = 1, drag = 0, spin = 0, raf = 0, last = 0, name = '', visible = true, now = {};

function poses() {
  const { pose, corePoint, freeAt, PADS, PORT } = S, s = (w, m) => (slim.matches ? m : w);
  const up = { lf: 1, crx: 28, cry: -165 }, free = { ...freeAt(), don: 0, dx: 320, sh: 0, py: 109, pz: 7 };
  const base = { s: s(0.52, 0.66), pitch: 14, yaw: -28, y: s(-0.02, -0.06), x: 0 };
  const P = (o) => pose({ ...base, ...o });
  const pads = P({ s: s(3, 3.4), pitch: 8, yaw: -22, ...up, kx: -90, ky: 130, kz: 240, rim: 0.8, env: 0.86 }); Object.assign(pads, corePoint(pads, PADS));
  const under = P({ s: s(0.9, 0.8), pitch: 4, yaw: -14, lf: 1, cy: 60, crx: -60, y: 0, env: 0.9, key: 2.1, ky: 60, kz: 260 }); Object.assign(under, corePoint(under, PORT));
  return {
    top: [P({}), 'idle'], size: [P({ yaw: -38, pitch: 10 }), 'idle'], core: [P({ ...free, yaw: -24, pitch: 6, y: 0 }), 'receipt'],
    dock: [P({ s: s(0.4, 0.44), y: s(-0.34, -0.38), pitch: 12, ...up }), 'receipt'], network: [P({ yaw: 152, pitch: 16 }), 'receipt'],
    under: [under, 'receipt'],
    mount: [P({ ...free, hold: 1, s: s(0.42, 0.4), y: s(0.26, 0.32), yaw: -24, pitch: 10 }), 'loyalty'],
    api: [P({ yaw: -14, pitch: 10, s: s(0.56, 0.7) }), 'receipt'], paths: [P({ yaw: 24 }), 'loyalty'], pads: [pads, 'receipt'],
  };
}
// On and off the Dock the Core keeps to its path: out, `lf` first and the rest after it; back, the rest first. Into the holder
// or away from the counter the picture fades instead, so nothing passes through anything.
const REST = ['cx', 'cy', 'cz', 'crx', 'cry', 'crz'], family = (p) => (p.hold > 0.5 ? 2 : p.don < 0.5 ? 1 : 0), ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
function route(a, b, k) {
  const o = S.mix(a, b, ease(k), {}); if (Math.abs(a.lf - b.lf) < 1e-4) return o;
  const out = b.lf > a.lf, l = out ? (k >= 0.5 ? 1 : ease(k / 0.5)) : (k <= 0.5 ? 0 : ease((k - 0.5) / 0.5)), r = out ? (k <= 0.5 ? 0 : ease((k - 0.5) / 0.5)) : (k >= 0.5 ? 1 : ease(k / 0.5));
  o.lf = a.lf + (b.lf - a.lf) * l; for (const n of REST) o[n] = a[n] + (b[n] - a[n]) * r;
  return o;
}
let fade = 0;
function go(id) {
  if (!st || id === name) return; name = id; clearTimeout(fade); canvas.style.opacity = '';
  const [p, scr] = poses()[id] || poses().top; spin = 0;
  if (family(p) !== family(now)) { canvas.style.opacity = 0; fade = setTimeout(() => { from = want = now = { ...p }; t = 1; st.show(scr, true); canvas.style.opacity = ''; kick(); }, 380); return; }
  from = { ...now }; want = p; t = 0; st.show(scr); kick();
}
function frame(ts) {
  raf = 0; const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  t = Math.min(1, t + dt / (from.lf !== want.lf ? 1.9 : 1.15));
  now = route(from, want, t); drag += (spin - drag) * (1 - Math.exp(-dt * 12));
  const busy = st.tick(dt); st.render({ ...now, yaw: now.yaw + drag });
  if (busy || t < 1 || Math.abs(spin - drag) > 0.05) kick();
}
function kick() { if (!raf && st && visible && !document.hidden) raf = requestAnimationFrame(frame); }
function size() { if (st) { st.resize(box.clientWidth, box.clientHeight); kick(); } }
async function boot() {
  if (!root.classList.contains('live')) return;
  try {
    S = await import('./stage.js'); const s = new S.Stage(canvas); await s.load();
    if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
    st = s; s.show('idle', true); now = { ...poses().top[0] }; from = now; want = now; name = 'top'; s.paint(); size(); s.render(now);
    root.classList.add('ready'); watch();
    canvas.addEventListener('webglcontextlost', () => { root.classList.remove('live', 'ready'); st = null; });
  } catch (e) { console.warn('3D is off:', e.message || e); root.classList.remove('live'); }
}
function watch() {
  const secs = [...document.querySelectorAll('.doc section')];
  const pick = () => { const mid = innerHeight * (slim.matches ? 0.62 : 0.5); let id = 'top'; for (const s of secs) if (s.getBoundingClientRect().top < mid) id = s.id; go(id); };
  addEventListener('scroll', pick, { passive: true }); pick();
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; kick(); }).observe(box);
}
let px = null;
canvas.addEventListener('pointerdown', (e) => { px = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (px === null) return; spin += (e.clientX - px) * 0.45; px = e.clientX; kick(); });
for (const n of ['pointerup', 'pointercancel']) canvas.addEventListener(n, () => { px = null; });
addEventListener('resize', size); slim.addEventListener('change', () => { const id = name; name = ''; go(id); size(); });
document.addEventListener('visibilitychange', () => { last = performance.now(); kick(); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => { if (e.matches) { root.classList.remove('live', 'ready'); } });
document.addEventListener('keydown', (e) => { const m = $('.menu[open]'); if (e.key === 'Escape' && m) { m.open = false; m.querySelector('summary').focus(); } });
const btn = $('#motion'), calm = matchMedia('(prefers-reduced-motion: reduce)').matches; let off = false;
try { off = localStorage.getItem('motion') === 'off'; } catch { /* private mode */ }
if (!root.classList.contains('live')) root.classList.add(off && !calm ? 'paused' : 'cannot');
btn.title = off ? 'Play motion' : 'Pause motion'; btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-pressed', String(off));
btn.addEventListener('click', () => { try { localStorage.setItem('motion', off ? 'on' : 'off'); } catch { /* private mode */ } location.reload(); });
const later = window.requestIdleCallback || ((f) => setTimeout(f, 200));
if (document.readyState === 'complete') later(boot); else addEventListener('load', () => later(boot), { once: true });
window.__maratusTech = { get stage() { return st; }, poses: () => poses(), route: (a, b, k) => route(a, b, k), family };   // tools/collide.mjs reads this
