// The Docks page: three Docks, one WebGL renderer. Each Dock's model is loaded when its section comes near, drawn off screen and
// copied into the section's own canvas. A Dock makes one slow turn when it is first seen; after that only the visitor turns it.
const root = document.documentElement; root.classList.add('js');
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const ss = (t) => t * t * (3 - 2 * t);
let S = null, base = null, raf = 0, last = 0, opened = 0;
const views = $$('.dk').map((sec) => ({ id: sec.dataset.dock, sec, canvas: $('canvas', sec), radios: $$('input[type=radio]', sec), name: $('.nm-now', sec), st: null, near: false, seen: false, yaw: 0, move: null, loading: null }));

/** Turn to `to` over `d` seconds; the last call wins. */
function turn(v, to, d) { v.move = { a: v.yaw, b: to, t: 0, d }; v.seen = true; kick(); }
/** The nearest way round to an angle. */
const near = (from, to) => to + Math.round((from - to) / 360) * 360;

async function load(v) {
  if (v.loading || !root.classList.contains('live')) return v.loading;
  return v.loading = (async () => {
    try {
      S = S || await import('./stage.js');
      const st = base ? new S.Stage(null, { share: base }) : (base = new S.Stage(document.createElement('canvas')));
      if (!opened++) st.canvas.addEventListener('webglcontextlost', off);
      await st.load({ dock: S.DOCKS[v.id] });
      if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
      const r = v.radios.find((q) => q.checked); if (r) st.setColour(r.value, true);
      st.show('receipt', true); st.screen.from = null; st.screen.t = 1; st.paint();
      v.yaw = S.DOCK_YAW.rest; v.st = st; size(v); draw(v, true);
      v.sec.classList.add('ready'); look.observe(v.canvas);
    } catch (e) { console.warn('3D is off:', e.message || e); off(); }
  })();
}
function off() { root.classList.remove('live'); for (const v of views) { v.sec.classList.remove('ready'); v.st = null; } }

function size(v) {
  const d = Math.min(2, devicePixelRatio || 1), n = Math.round(v.canvas.clientWidth * d);
  if (n && v.canvas.width !== n) { v.canvas.width = v.canvas.height = n; v.st.dirty = true; }
}
function draw(v) {
  const n = v.canvas.width, st = v.st, R = st.renderer; if (!n) return;
  if (st.dirty || R.domElement.width !== n) { R.setPixelRatio(1); if (R.domElement.width !== n) R.setSize(n, n, false); st.camera.aspect = 1; st.camera.updateProjectionMatrix(); }
  if (!st.render(S.dockPose(v.id, v.yaw))) return;
  const c = v.canvas.getContext('2d'); c.clearRect(0, 0, n, n); c.drawImage(R.domElement, 0, 0);
}
function frame(ts) {
  raf = 0; const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; let busy = false;
  for (const v of views) {
    if (!v.st || !v.near) continue;
    const m = v.move; if (m) { m.t = Math.min(1, m.t + dt / m.d); v.yaw = m.a + (m.b - m.a) * ss(m.t); if (m.t >= 1) v.move = null; else busy = true; }
    if (v.st.tick(dt)) busy = true;
    draw(v);
  }
  if (busy) kick();
}
function kick() { if (!raf && S && !document.hidden) raf = requestAnimationFrame(frame); }

// near: within two thirds of a screen; seen: most of the picture is in view, so the one slow turn starts
const come = new IntersectionObserver((es) => { for (const e of es) { const v = views.find((q) => q.sec === e.target); v.near = e.isIntersecting; if (v.near) load(v); } kick(); }, { rootMargin: '66% 0px' });
const look = new IntersectionObserver((es) => { for (const e of es) { const v = views.find((q) => q.canvas === e.target); if (e.isIntersecting && !v.seen) turn(v, v.yaw + 360, 9); } }, { threshold: 0.7 });

for (const v of views) {
  const c = v.canvas; let px = null;
  c.addEventListener('pointerdown', (e) => { if (!v.st) return; px = e.clientX; v.move = null; v.seen = true; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', (e) => { if (px === null || !v.st) return; v.yaw += (e.clientX - px) * 0.45; px = e.clientX; kick(); });
  for (const n of ['pointerup', 'pointercancel']) c.addEventListener(n, () => { px = null; });
  for (const b of $$('.sides button', v.sec)) b.addEventListener('click', () => { if (v.st) turn(v, near(v.yaw, S.DOCK_YAW[b.dataset.yaw]), 1); });
  const say = () => { const r = v.radios.find((q) => q.checked); if (r) v.name.textContent = $('.nm', r.parentElement).textContent; };
  for (const r of v.radios) r.addEventListener('change', () => { say(); if (r.checked && v.st) { v.st.setColour(r.value); last = performance.now(); kick(); } });
  say();
}

const calm = matchMedia('(prefers-reduced-motion: reduce)');
calm.addEventListener('change', (e) => { if (e.matches) off(); });
document.addEventListener('visibilitychange', () => { last = performance.now(); kick(); });
addEventListener('resize', () => { for (const v of views) if (v.st) size(v); kick(); });
document.addEventListener('keydown', (e) => { const m = $('.menu[open]'); if (e.key === 'Escape' && m) { m.open = false; $('summary', m).focus(); } });
const btn = $('#motion'); let paused = false;
try { paused = localStorage.getItem('motion') === 'off'; } catch { /* private mode */ }
if (!root.classList.contains('live')) root.classList.add(paused && !calm.matches ? 'paused' : 'cannot');
btn.title = paused ? 'Play motion' : 'Pause motion'; btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-pressed', String(paused));
btn.addEventListener('click', () => { try { localStorage.setItem('motion', paused ? 'on' : 'off'); } catch { /* private mode */ } location.reload(); });
const start = () => { if (root.classList.contains('live')) for (const v of views) come.observe(v.sec); };
if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
window.__maratusDocks = { views, get S() { return S; }, load };   // tools/collide.mjs reads this
