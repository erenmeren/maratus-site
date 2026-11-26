// Collision check over the whole scroll range of the home page. Serve the repo root on 127.0.0.1:8123 first.
//   node site/tools/collide.mjs [--steps 1200] [--width 1440] [--height 900] [--yaw 3.2: the pointer's turn] [--url http://127.0.0.1:8123/site/]
// With --url .../site/technical/ it walks every move between that page's poses instead.
// With --url .../site/docks/ --dock bar|tile|mono it checks that Dock with its Core seated (the only state that page has).
// At every step the page's own pose is applied to the page's own meshes. Pairs, triangle against triangle (exact, in mm):
//   Core / Dock, Core / holder, Core / steel post, Core / cable, Dock / holder, Dock / post, phone / device (Core and Dock).
// Seated parts touch; contact is told from overlap by moving the Core 0.1 mm off the face it sits on (TOL).
import { launch, sleep, parseArgs } from '../../kit/scripts/lib/cdp.mjs';
const { opt } = parseArgs(process.argv.slice(2)), W = +(opt.width || 1440), H = +(opt.height || 900), N = +(opt.steps || 1200);
const b = await launch({ offline: true }); const p = await b.newPage(); await p.viewport(W, H, W < 768);
await p.goto(opt.url || 'http://127.0.0.1:8123/site/', { settle: 1500 });
for (let i = 0; i < 200; i++) { if (await p.evaluate('!!window.__maratusDocks||!!(window.__maratusTech&&__maratusTech.stage)||!!(window.__maratus&&__maratus.stage&&__maratus.keys.length&&document.documentElement.classList.contains("ready"))')) break; await sleep(100); }
await p.evaluate(async (N, TOL, YAW, DOCK) => {
  const T = window.__maratusTech, K = window.__maratusDocks; let M = window.__maratus;
  if (K) { const v = K.views.find((q) => q.id === DOCK); await K.load(v); M = { stage: v.st, poseAt: () => K.S.dockPose(DOCK) }; }
  if (T) {                                                    // the technical page: every move between two of its poses that does not fade
    const l = Object.values(T.poses()).map((q) => q[0]), pairs = []; for (const a of l) for (const z of l) if (a !== z && T.family(a) === T.family(z)) pairs.push([a, z]);
    M = { stage: T.stage, n: pairs.length, poseAt: (q) => { const i = Math.min(pairs.length - 1, Math.floor(q)); return T.route(...pairs[i], q - i); } };
  }
  const st = M.stage; await st.props; const S = await import(new URL(T || K ? '../js/stage.js' : 'js/stage.js', location.href).href), THREE = await import('three');
  const ease = (t) => t * t * (3 - 2 * t);
  const poseAt = M.poseAt || ((y) => { const k = M.keys; if (y <= k[0].y) return k[0].o; for (let i = 1; i < k.length; i++) if (k[i].y >= y) return S.mix(k[i - 1].o, k[i].o, ease((y - k[i - 1].y) / Math.max(1, k[i].y - k[i - 1].y)), {}); return k[k.length - 1].o; });
  const tris = (obj, skip = () => false) => { const out = []; obj.traverse((o) => { if (!o.isMesh || skip(o)) return; const g = o.geometry, a = g.attributes.position, ix = g.index, n = ix ? ix.count : a.count; const pos = new Float32Array(n * 3), v = new THREE.Vector3(); for (let i = 0; i < n; i++) { v.fromBufferAttribute(a, ix ? ix.getX(i) : i); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; } out.push({ o, pos, n }); }); return out; };
  const noShadow = (o) => o.material.transparent || o.userData.noCollide || o.geometry.type === 'ShapeGeometry';
  const sets = { core: tris(st.coreIn, noShadow), dock: tris(st.dock, noShadow) }; if (st.phone) sets.phone = tris(st.phone, noShadow);
  const inside = (o, g) => { for (let q = o; q; q = q.parent) if (q === g) return true; return false; };
  for (const k of ['post', 'cable', 'holdCable']) if (st[k]) sets[k] = tris(st[k], noShadow);
  if (st.hold) sets.hold = tris(st.hold, (o) => noShadow(o) || inside(o, st.holdCable));
  // world triangles in `inv` space
  const gather = (set, inv, shift) => { let n = 0; for (const s of set) if (vis(s.o)) n += s.n; const out = new Float32Array(n * 3), v = new THREE.Vector3(), m = new THREE.Matrix4(); let k = 0; for (const s of set) { if (!vis(s.o)) continue; m.multiplyMatrices(inv, s.o.matrixWorld); for (let i = 0; i < s.n; i++) { v.set(s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]).applyMatrix4(m); if (shift) v.add(shift); out[k++] = v.x; out[k++] = v.y; out[k++] = v.z; } } return out; };
  const vis = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const bounds = (a) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < a.length; i++) { const k = i % 3; if (a[i] < lo[k]) lo[k] = a[i]; if (a[i] > hi[k]) hi[k] = a[i]; } return [lo, hi]; };
  const apart = (A, B) => { for (let k = 0; k < 3; k++) if (A[1][k] < B[0][k] || B[1][k] < A[0][k]) return true; return false; };
  // segment against triangle (Moller-Trumbore on the edges of both): exact for non-coplanar pairs
  const segTri = (A, i, j, B, t) => { const px = A[i], py = A[i + 1], pz = A[i + 2], dx = A[j] - px, dy = A[j + 1] - py, dz = A[j + 2] - pz, ax = B[t], ay = B[t + 1], az = B[t + 2], e1x = B[t + 3] - ax, e1y = B[t + 4] - ay, e1z = B[t + 5] - az, e2x = B[t + 6] - ax, e2y = B[t + 7] - ay, e2z = B[t + 8] - az;
    const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, det = e1x * hx + e1y * hy + e1z * hz; if (det > -1e-9 && det < 1e-9) return false; const f = 1 / det, sx = px - ax, sy = py - ay, sz = pz - az, u = f * (sx * hx + sy * hy + sz * hz); if (u < 0 || u > 1) return false;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = f * (dx * qx + dy * qy + dz * qz); if (v < 0 || u + v > 1) return false; const w = f * (e2x * qx + e2y * qy + e2z * qz); return w >= 0 && w <= 1; };
  const hit = (A, a, B, t) => segTri(A, a, a + 3, B, t) || segTri(A, a + 3, a + 6, B, t) || segTri(A, a + 6, a, B, t) || segTri(B, t, t + 3, A, a) || segTri(B, t + 3, t + 6, A, a) || segTri(B, t + 6, t, A, a);
  const triBox = (A, a) => [Math.min(A[a], A[a + 3], A[a + 6]), Math.min(A[a + 1], A[a + 4], A[a + 7]), Math.min(A[a + 2], A[a + 5], A[a + 8]), Math.max(A[a], A[a + 3], A[a + 6]), Math.max(A[a + 1], A[a + 4], A[a + 7]), Math.max(A[a + 2], A[a + 5], A[a + 8])];
  function overlap(A, B, cell = 4) {                          // number of intersecting triangle pairs (stops at 400)
    if (!A.length || !B.length) return 0; const bA = bounds(A), bB = bounds(B); if (apart(bA, bB)) return 0;
    const lo = [0, 1, 2].map((k) => Math.max(bA[0][k], bB[0][k])), hi = [0, 1, 2].map((k) => Math.min(bA[1][k], bB[1][k])), inB = (q) => !(q[3] < lo[0] || q[0] > hi[0] || q[4] < lo[1] || q[1] > hi[1] || q[5] < lo[2] || q[2] > hi[2]);
    const grid = new Map(), c = (v) => Math.floor(v / cell), range = (q, fn) => { for (let x = c(Math.max(q[0], lo[0])); x <= c(Math.min(q[3], hi[0])); x++) for (let y = c(Math.max(q[1], lo[1])); y <= c(Math.min(q[4], hi[1])); y++) for (let z = c(Math.max(q[2], lo[2])); z <= c(Math.min(q[5], hi[2])); z++) fn(x * 73856093 ^ y * 19349663 ^ z * 83492791); };
    for (let t = 0; t < B.length; t += 9) { const q = triBox(B, t); if (!inB(q)) continue; range(q, (k) => { let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(t); }); }
    let n = 0; const seen = new Set();
    for (let a = 0; a < A.length && n < 400; a += 9) { const q = triBox(A, a); if (!inB(q)) continue; seen.clear(); range(q, (k) => { const l = grid.get(k); if (!l) return; for (const t of l) { if (seen.has(t)) continue; seen.add(t); if (Math.min(B[t], B[t + 3], B[t + 6]) > q[3] || Math.max(B[t], B[t + 3], B[t + 6]) < q[0]) continue; if (hit(A, a, B, t)) { n++; if (window.__dbg && window.__dbg.length < 12) window.__dbg.push([A[a], A[a + 1], A[a + 2], B[t], B[t + 1], B[t + 2]].map((v) => +v.toFixed(1)).join(' ')); } } }); }
    return n;
  }
  const y1 = T ? M.n : document.documentElement.scrollHeight - innerHeight, names = [['core', 'dock'], ['core', 'hold'], ['core', 'post'], ['core', 'cable'], ['core', 'holdCable'], ['dock', 'hold'], ['dock', 'post'], ['hold', 'post'], ['phone', 'core'], ['phone', 'dock']].filter(([a, b]) => sets[a] && sets[b]);
  const cache = new Map(); const res = {}; for (const [a, bb] of names) res[`${a}/${bb}`] = { tested: 0, steps: 0, moving: 0, worst: 0, at: [] };
  const I = new THREE.Matrix4(), nrm = new THREE.Vector3(0, Math.sin(20 * Math.PI / 180), Math.cos(20 * Math.PI / 180)).applyQuaternion(st.coreIn.quaternion); let apartSteps = 0, box = 0, gap = 1e9;
  const secs = [...document.querySelectorAll('.pin')].map((e) => [e.id, e.getBoundingClientRect().top + scrollY]);
  window.__run = (from, to) => { const t0 = performance.now(); for (let i = from; i <= to; i++) {
    if (performance.now() - t0 > 20000) return i;
    const y = y1 * i / N, p = { ...poseAt(y) }; p.yaw += YAW; st.apply(p); st.scene.updateMatrixWorld(true);
    I.copy(st.home.matrixWorld).invert();
    const off = st.coreAt.position.distanceTo(new THREE.Vector3(...S.CORE_C)); if (off > 0.01) apartSteps++;
    for (const [a, bb] of names) {
      const R = res[`${a}/${bb}`]; if (bb === 'dock' && !vis(st.dock)) continue; if ((a === 'phone') && !vis(st.phone)) continue; if (['hold', 'post', 'cable', 'holdCable'].includes(bb) && (!vis(st[bb]))) continue;
      const ck = a === 'phone' ? '' : [a, bb, p.cx, p.cy, p.cz, p.crx, p.cry, p.crz, p.dx, p.dy, p.dz, p.lf, p.post, p.hold, p.cable].map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join();
      if (ck && cache.has(ck)) { const [n, bx] = cache.get(ck); R.tested++; if (bx) box++; if (n) { R.steps++; R.worst = Math.max(R.worst, n); if (off > 0.01) R.moving++; } continue; }
      const world = a === 'phone', inv = world ? new THREE.Matrix4() : I;
      let shift = null; if (a === 'core') { shift = new THREE.Vector3(0, 0, 1).applyQuaternion(st.coreAt.quaternion); if (bb === 'dock') shift.copy(nrm); else if (/able/.test(bb)) shift.set(0, 0, 0); else { const q = st.coreAt.quaternion; shift.copy(nrm).applyQuaternion(q); } shift.multiplyScalar(TOL); }
      const A = gather(sets[a], inv, shift), B = gather(sets[bb], inv); R.tested++;
      if (a === 'core' && bb === 'dock' && !apart(bounds(A), bounds(B))) box++;
      window.__dbg = []; const n = overlap(A, B, world ? 3 : 4); if (n && !res.debug) res.debug = [a, bb, y, st.coreAt.position.toArray().map((v) => v.toFixed(2)).join(), ...window.__dbg]; if (ck) cache.set(ck, [n, a === 'core' && bb === 'dock' && !apart(bounds(A), bounds(B))]); if (n) { R.steps++; R.worst = Math.max(R.worst, n); if (off > 0.01) R.moving++; if (R.at.length < 400) { const s = secs.filter((q) => q[1] <= y).pop(); R.at.push(`${s ? s[0] : ''}@${Math.round(y)}`); } }
    }
  }
  return N + 1; };
  window.__end = () => { const debug = res.debug; delete res.debug; for (const k in res) { const l = res[k].at; res[k].at = l.length ? `${l[0]} .. ${l[l.length - 1]}` : ''; }
  return { scroll: y1, samples: N + 1, coreTriangles: gather(sets.core, new THREE.Matrix4()).length / 9, dockTriangles: sets.dock.reduce((s, q) => s + q.n, 0) / 3, stepsWithCoreOffDock: apartSteps, boxesOverlap: box, pairs: res, debug }; };
}, N, 0.1, +(opt.yaw || 0), opt.dock || 'bar');
for (let i = 0; i <= N;) i = await p.evaluate(`__run(${i}, ${N})`);
const r = await p.evaluate('__end()');
console.log(JSON.stringify(r, null, 1)); await b.close();
