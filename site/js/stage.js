// The live 3D device. One renderer, one camera; a pose is a flat bag of numbers (see POSE), so any two poses can be mixed.
// Units: 1 = 1 mm inside the rig. The rig is scaled so that `s` is the device's height as a share of the viewport.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { drawScreen, drawPhone } from './screens.js';
import { GLASS_MARK } from './mark-data.js';

const ROOT = new URL('../', import.meta.url).href;
const D = Math.PI / 180, SIN = Math.sin(20 * D), COS = Math.cos(20 * D);
const FOV = 20, H0 = 100, DIST = H0 / 2 / Math.tan(FOV * D / 2);
const DEVICE_H = 93.8;
export const CENTER = [0, 45, -28];                          // docked device, middle
export const CORE_C = [0, 49, -22.9];                        // the Core's middle when docked
export const PADS = [0, 11.02, -19.44];                      // contact field
export const PORT = [20, 6.075, -7.924];                     // the Core's USB-C port, on its underside
const MAGNETS = [[-23.5, 21.44, -21.53], [23.5, 21.44, -21.53]];   // the Core's two magnets, on its back (PCB frame 13.5 and 60.5, 55.5)
export const SEAT = [0, SIN, COS], RISE = [0, COS, -SIN];    // out of the Dock's face; up along the Dock's face (both unit, docked frame)
export const FREE = [0, 60, 30];                             // where the Core hangs off the Dock (cx, cy, cz), upright with crx 20
const HOME_FREE = [CORE_C[0] + FREE[0], CORE_C[1] + FREE[1], CORE_C[2] + FREE[2]];
const CLEAR = [9, 80], step = (t) => t * t * (3 - 2 * t), part = (t, a, b) => step(Math.max(0, Math.min(1, (t - a) / (b - a))));
/** The only way on and off the Dock, for lf 0 (seated) to 1 (clear): the bolt is drawn back, the Core comes 9 mm straight out
 *  of the Dock's face (off the 3 mm bolt and the 1.4 mm pins), then 80 mm up along the face's 20 degree lean. It must not turn
 *  before lf is 1: at 1 the Core's middle is 64 mm above the Dock's top and the Core's half diagonal is 63 mm.
 *  tools/collide.mjs measures it on the meshes. */
export function liftAt(lf) { const n = CLEAR[0] * part(lf, 0.07, 0.3), r = CLEAR[1] * part(lf, 0.2, 1); return { n, x: 0, y: SEAT[1] * n + RISE[1] * r, z: SEAT[2] * n + RISE[2] * r, lock: 1 - part(lf, 0, 0.07) }; }
export function coreOffset(p) { const l = liftAt(p.lf); return [l.x + p.cx, l.y + p.cy, l.z + p.cz]; }
const UP = liftAt(1);
/** Off the Dock altogether: upright at FREE, (x, y, z) mm from there. */
export const freeAt = (x = 0, y = 0, z = 0) => ({ lf: 1, crx: 20, cx: FREE[0] - UP.x + x, cy: FREE[1] - UP.y + y, cz: FREE[2] - UP.z + z });
/** The eight pairs of ref/maratus-dock-tile-colours.pdf (2026-11-22), in its order, with its hex values: body of Core and Dock, the base-plate
 *  colour on the Dock's ends, the name on the glass. `dock`, where set, paints the Dock's middle too: 4 and 5 stand on an all grey Dock (owner,
 *  2026-11-24). Proposals; none is decided. */
export const COLOURS = {
  retro: { body: '#dfded8', accent: '#ff6516', mark: '#8d8e93' },
  black: { body: '#1b1b1d', accent: '#d71921', mark: '#d71921' },
  orange: { body: '#f37420', accent: '#1b1b1d', mark: '#f37420' },
  yellow: { body: '#f7c200', dock: '#dfded8', accent: '#dfded8', mark: '#f7c200' },
  blue: { body: '#006eb8', dock: '#dfded8', accent: '#dfded8', mark: '#dfded8' },
  green: { body: '#00b49b', accent: '#f15a30', mark: '#f15a30' },
  slate: { body: '#34454c', accent: '#f3a257', mark: '#f3a257' },
  pink: { body: '#f29ac0', accent: '#e31f26', mark: '#f29ac0' },
};
/** The Docks page: each Dock's model has its own frame, front edge near z 0; gz is the middle of its ground picture (tools/export_docks.py).
 *  All three are drawn at one scale, standing on one line, turning about that middle. */
export const DOCKS = { bar: { id: 'bar', gz: 31 }, tile: { id: 'tile', gz: 44 }, mono: { id: 'mono', gz: 30 } };
export const DOCK_YAW = { rest: -29, front: 0, side: -90, back: -206 };
export const dockPose = (id, yaw = DOCK_YAW.rest) => pose({ s: 0.63, y: -0.54, yaw, pitch: 14, px: 0, py: 0, pz: -DOCKS[id].gz, kx: -56, ky: 235, kz: 150 });   // a steeper key light than elsewhere: the shadow stays inside the picture
/** The name on the glass: the hardware's own letters and place (lens drawing, DXF layer `mark`; see tools/mark.py). Upright Core coordinates. */
const MARK_Y = GLASS_MARK.up - GLASS_MARK.lens / 2;

export const POSE = {
  x: 0, y: 0, s: 0.6, yaw: 0, pitch: 12, roll: 0, px: 0, py: 45, pz: -28,
  sh: 1,                                                     // ground shadow
  cx: 0, cy: 0, cz: 0, crx: 0, cry: 0, crz: 0,               // Core relative to its docked place (added to the lift)
  dx: 0, dy: 0, dz: 0, don: 1,                               // Dock
  lf: 0, mag: 0,                                             // lift, see liftAt; magnets shown through the back
  post: 0, hold: 0, cable: 0,                                // steel post, holder, USB-C plug at the post: 0 away, 1 in place
  ph: 0, phx: 0.6, phy: -2.6, phs: 0.8, phyaw: 0, phpitch: 0, phroll: 0,
  on: 1,                                                     // 0: nothing is drawn
  exp: 1, key: 1.9, kx: -120, ky: 190, kz: 170, kr: 1, kg: 0.975, kb: 0.95,
  rim: 0.9, rx: 170, ry: 120, rz: -150, rr: 1, rg: 1, rb: 1,
  env: 0.78, hemi: 0.62, gr: 0.96, gg: 0.72, gb: 0.75,        // light bounced up from the ground
};

const REST = {};                                             // scratch
export function mix(a, b, t, out = REST) { for (const k in POSE) out[k] = a[k] + (b[k] - a[k]) * t; return out; }
/** Where a point of the Core (docked coordinates) ends up when the Core has moved. */
export function corePoint(p, pt) {
  const v = new THREE.Vector3(pt[0] - CORE_C[0], pt[1] - CORE_C[1], pt[2] - CORE_C[2]).applyEuler(new THREE.Euler(p.crx * D, p.cry * D, p.crz * D, 'YXZ'));
  const c = coreOffset(p); return { px: v.x + CORE_C[0] + c[0], py: v.y + CORE_C[1] + c[1], pz: v.z + CORE_C[2] + c[2] };
}
const BACK = 8.15;                                           // the Core upright: its back, mm behind the middle (measured on the mesh)
/** Upright Core coordinates (x right, y up, z to the viewer, round the middle) in the docked frame. */
function corePointDocked(x, y, z) { return [CORE_C[0] + x, CORE_C[1] + y * COS + z * SIN, CORE_C[2] - y * SIN + z * COS]; }
export const pose = (o = {}, base = POSE) => ({ ...base, ...o });

// ------------------------------------------------------------------ helpers
function noiseNormal(size = 256, strength = 1.1) {            // tileable, fine, isotropic: moulded-plastic grain
  const h = new Float32Array(size * size);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < h.length; i++) h[i] = rnd();
  const at = (a, x, y) => a[((y + size) % size) * size + ((x + size) % size)];
  const blur = (a) => { const o = new Float32Array(a.length); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let s = 0; for (let j = -1; j < 2; j++) for (let i = -1; i < 2; i++) s += at(a, x + i, y + j) * (i || j ? (i && j ? 1 : 2) : 4); o[y * size + x] = s / 16; } return o; };
  const a = blur(h), b = blur(blur(blur(a)));
  const px = new Uint8Array(size * size * 4);
  const f = (x, y) => at(a, x, y) * 0.55 + at(b, x, y) * 1.6;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (f(x - 1, y) - f(x + 1, y)) * strength, dy = (f(x, y - 1) - f(x, y + 1)) * strength, l = Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
    px[k] = (dx / l * 0.5 + 0.5) * 255; px[k + 1] = (dy / l * 0.5 + 0.5) * 255; px[k + 2] = (1 / l * 0.5 + 0.5) * 255; px[k + 3] = 255;
  }
  const t = new THREE.DataTexture(px, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

/** Photo studio: a big overhead softbox, two strips and a low front card in a dim room. Baked once into an environment map. */
function studio(renderer) {
  const sc = new THREE.Scene();
  const add = (color, k, w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
  };
  const g = new THREE.SphereGeometry(60, 48, 32), c = [], p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = THREE.MathUtils.smoothstep(p.getY(i) / 60, -0.7, 0.9); const k = 0.16 + 0.42 * v; c.push(k, k * 0.985, k * 0.97); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  add('#fffaf4', 7.5, 34, 20, -4, 34, 10);                    // overhead softbox
  add('#ffffff', 5.0, 7, 34, -38, 10, 12);                    // left strip
  add('#fff2ea', 3.4, 12, 30, 40, 8, -8);                     // right card, behind
  add('#ffffff', 1.15, 40, 14, 6, -2, 46);                    // low front card
  add('#ffffff', 2.6, 20, 16, -24, 42, 22);                   // soft window seen in the glass
  const gen = new THREE.PMREMGenerator(renderer);
  const tex = gen.fromScene(sc, 0.012, 0.1, 200).texture;
  gen.dispose();
  return tex;
}

/** Turned-metal tangents for the flat pads: round each pad's own middle, so the highlight is a cone as on real plating. */
function turned(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, n = p.count, tan = new Float32Array(n * 4);
  const ctr = []; for (let r = 0; r < 2; r++) for (let k = 0; k < 10; k++) { const u = (k - 4.5) * 2.54, v = (r ? -1 : 1) * 1.27; ctr.push([PADS[0] + u, PADS[1] + v * COS, PADS[2] - v * SIN]); }
  const a = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3(), nrm = new THREE.Vector3(0, SIN, COS);
  for (let i = 0; i < n; i += 3) {
    c.set(0, 0, 0); for (let j = 0; j < 3; j++) c.add(a.fromBufferAttribute(p, i + j)); c.multiplyScalar(1 / 3);
    let best = ctr[0], bd = 1e9; for (const q of ctr) { const e = (q[0] - c.x) ** 2 + (q[1] - c.y) ** 2 + (q[2] - c.z) ** 2; if (e < bd) { bd = e; best = q; } }
    for (let j = 0; j < 3; j++) {
      a.fromBufferAttribute(p, i + j); d.set(a.x - best[0], a.y - best[1], a.z - best[2]); if (d.lengthSq() < 0.02) d.set(c.x - best[0], c.y - best[1], c.z - best[2]);
      d.cross(nrm).normalize(); tan.set([d.x, d.y, d.z, 1], (i + j) * 4);
    }
  }
  g.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  return g;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
function slab(w, h, d, r, bevel = 0.8, seg = 4) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.1, r - bevel)), { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 18 });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return g;
}

// ------------------------------------------------------------------ stage
export class Stage {
  /** `share`: another stage whose renderer and studio light are used too (the Docks page draws three stages with one renderer). */
  constructor(canvas, { shadows = true, share = null } = {}) {
    this.canvas = canvas;
    const r = this.renderer = share ? share.renderer : new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setClearColor(0, 0);
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = shadows; r.shadowMap.type = THREE.VSMShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 4, 2000);
    this.camera.position.z = DIST;
    this.scene.environment = share ? share.scene.environment : studio(r);
    this.tex = {};
    this.screen = { el: document.createElement('canvas'), from: null, to: 'off', t: 1 };
    this.phoneUi = { el: document.createElement('canvas'), from: null, to: 'camera', t: 1 };
    this.screen.el.width = this.screen.el.height = 1024;
    this.phoneUi.el.width = 720; this.phoneUi.el.height = 1500;
    this.last = '';
  }

  /** `dock`: a model of the Docks page instead, { id, gz }; its GLB has the Core seated and nothing of the home page's props.
   *  `props: false`: the home page's model without holder and cable (the developers page never shows them). */
  async load({ dock = null, props = true } = {}) {
    const tl = new THREE.TextureLoader();
    const tex = (f) => tl.loadAsync(`${ROOT}assets/3d/${f}`);
    const draco = new DRACOLoader().setDecoderPath(`${ROOT}vendor/three/addons/libs/draco/gltf/`);
    draco.preload();
    const gl = new GLTFLoader().setDRACOLoader(draco);
    const at = (...f) => Promise.all([gl.loadAsync(`${ROOT}assets/3d/${f[0]}.glb`), ...f.slice(1).map((n) => tex(`${n}.webp`))]);
    const [gltf, aoA, grA, aoB = aoA, grB = grA] = await (dock ? at(`dock-${dock.id}`, `ao-${dock.id}`, `ground-${dock.id}`) : at('maratus', 'ao-docked', 'ground-docked', 'ao-apart', 'ground-apart'));
    for (const t of [aoA, aoB]) { t.flipY = false; t.channel = 1; t.anisotropy = 4; }
    this.build(gltf.scene, aoA, aoB, grA, grB, dock);
    this.paint();
    if (dock || !props) { draco.dispose(); return this; }
    // the holder and the cable plug are needed much later: they follow the first picture
    this.props = Promise.all([gl.loadAsync(`${ROOT}assets/3d/props.glb`), tex('ao-props.webp'), tex('ground-props.webp')]).then(([g, ao, gr]) => { ao.flipY = false; ao.channel = 1; this.buildProps(g.scene, ao, gr); this.dirty = true; draco.dispose(); const seen = [this.post, this.hold, this.cable]; for (const q of seen) q.visible = true; this.renderer.compile(this.scene, this.camera); for (const q of seen) q.visible = false; });
    this.props.catch((e) => console.warn('props:', e.message || e));
    return this;
  }

  build(model, aoA, aoB, grA, grB, only = null) {
    const R = this.renderer, aniso = Math.min(8, R.capabilities.getMaxAnisotropy());
    const grain = noiseNormal(); grain.repeat.set(1.9, 1.9);
    this.apart = { value: 0 }; this.dither = { value: 0.011 };
    const withAo = (m) => {
      m.aoMap = aoA; m.aoMapIntensity = 1;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.aoMapB = { value: aoB }; sh.uniforms.uApart = this.apart;
        const chunk = THREE.ShaderChunk.aomap_fragment.replace('( texture2D( aoMap, vAoMapUv ).r - 1.0 )', '( mix( texture2D( aoMap, vAoMapUv ).r, texture2D( aoMapB, vAoMapUv ).r, uApart ) - 1.0 )')
          .replace('reflectedLight.indirectDiffuse *= ambientOcclusion;', 'reflectedLight.indirectDiffuse *= ambientOcclusion; reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, 0.55 ); reflectedLight.directSpecular *= mix( 1.0, ambientOcclusion, 0.7 );');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D aoMapB; uniform float uApart;').replace('#include <aomap_fragment>', chunk);
      };
      return m;
    };
    const std = (color, rough, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    const grainy = (k) => ({ normalMap: grain, normalScale: new THREE.Vector2(k, k) });
    this.mag = { value: 0 };
    const xray = (m) => {                                    // the back opens over the two magnets: an explanation, not a hole
      const base = m.onBeforeCompile;
      m.onBeforeCompile = (sh) => {
        base(sh); sh.uniforms.uMag = this.mag;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
        const v = (a) => `vec3( ${a.map((n) => n.toFixed(4)).join(', ')} )`;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uMag; varying vec3 vObj;
          bool magOpen( vec3 c ) { vec3 d = vObj - c; float a = dot( d, ${v(SEAT)} ); return abs( a ) < 2.0 && length( d - a * ${v(SEAT)} ) < 5.06 * uMag; }`)
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif ( uMag > 0.01 && ( magOpen( ${v(MAGNETS[0])} ) || magOpen( ${v(MAGNETS[1])} ) ) ) discard;`);
      };
      m.customProgramCacheKey = () => 'core-body'; return m;
    };
    const M = this.M = {
      core: xray(withAo(std(COLOURS.retro.body, 0.56, 0, grainy(0.2)))),
      body: withAo(std(COLOURS.retro.body, 0.56, 0, grainy(0.2))),
      accent: withAo(std(COLOURS.retro.accent, 0.5, 0, grainy(0.18))),
      glass: new THREE.MeshPhysicalMaterial({ color: '#08080a', roughness: 0.12, specularIntensity: 1, envMapIntensity: 0.9 }),
      black: std('#141415', 0.5), housing: std('#1b1b1d', 0.5), magnet: std('#d4d4d8', 0.34, 1),
      steel: std('#c4c5c8', 0.27, 1), 'steel-dark': std('#8b8c90', 0.3, 1),
      gold: std('#e6b45a', 0.3, 1), 'gold-barrel': std('#e9b659', 0.3, 1), 'gold-plunger': std('#f2c469', 0.17, 1), 'gold-pad': new THREE.MeshPhysicalMaterial({ color: '#eab85f', roughness: 0.34, metalness: 1, anisotropy: 0.75 }),
      'led-g': std('#2f6b3a', 0.35), 'led-a': std('#8a5a1e', 0.35),
    };
    const sTex = this.screenTex = new THREE.CanvasTexture(this.screen.el);
    sTex.colorSpace = THREE.SRGBColorSpace; sTex.flipY = false; sTex.anisotropy = aniso; sTex.generateMipmaps = true; sTex.minFilter = THREE.LinearMipmapLinearFilter;
    M.screen = new THREE.MeshPhysicalMaterial({ color: '#000', roughness: 0.16, emissive: '#fff', emissiveMap: sTex, emissiveIntensity: 0.99, envMapIntensity: 0.16, specularIntensity: 0.6, toneMapped: false });
    this.parts = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      const n = (o.material.name || '').split('.')[0];
      o.material = M[n] || M.black;
      if (n === 'body' && o.parent.name === 'core') o.material = M.core;
      if (n === 'gold-plunger') this.pins = o;
      o.castShadow = /^(body|accent|glass)$/.test(n); o.receiveShadow = !/screen|glass/.test(n);
      if (n === 'screen') o.renderOrder = 2;
      if (n === 'gold-pad') o.geometry = turned(o.geometry);
    });
    const core = model.getObjectByName('core'), dock = model.getObjectByName('dock');
    this.bolt = model.getObjectByName('bolt');

    // rig > tilt > turn > home (pivot) > dock, coreAt > core
    this.rig = new THREE.Group(); this.tilt = new THREE.Group(); this.turn = new THREE.Group(); this.home = new THREE.Group();
    this.scene.add(this.rig); this.rig.add(this.tilt); this.tilt.add(this.turn); this.turn.add(this.home);
    this.dock = dock; this.home.add(dock);
    this.coreAt = new THREE.Group(); this.home.add(this.coreAt);
    this.coreIn = new THREE.Group(); this.coreIn.position.set(-CORE_C[0], -CORE_C[1], -CORE_C[2]); this.coreAt.add(this.coreIn); this.coreIn.add(core);
    // on the other Docks the Core's own node says where it sits; it moves to the group, so that the name on the glass goes along
    core.updateMatrix(); this.coreIn.updateMatrix(); this.coreIn.matrix.multiply(core.matrix).decompose(this.coreIn.position, this.coreIn.quaternion, this.coreIn.scale);
    core.position.set(0, 0, 0); core.quaternion.identity(); core.scale.set(1, 1, 1);
    this.coreAt.rotation.order = 'YXZ';

    // ground: baked contact shadow (docked / Dock alone) and the key light's own soft shadow
    const gg = new THREE.PlaneGeometry(360, 360);
    // the Docks page frames the device closely: there the shadow has faded out before the picture's edge
    const fall = only ? ' * ( 1.0 - smoothstep( 0.13, 0.2, distance( vG, vec2( 0.5 ) ) ) )' : '';
    this.groundShader = (t) => (sh) => {
      sh.uniforms.tA = { value: t }; sh.uniforms.uN = this.dither;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tA; uniform float uN; varying vec2 vG;').replace('#include <opaque_fragment>', `float gAo = 1.0 - texture2D( tA, vG ).r; diffuseColor.a *= smoothstep( 0.02, 1.0, gAo )${fall}; diffuseColor.a += ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) * uN * step( 0.004, diffuseColor.a );\n#include <opaque_fragment>`);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vG;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvG = uv;');
    };
    const inv = (t) => { const m = new THREE.MeshBasicMaterial({ color: '#1a0208', transparent: true, depthWrite: false, toneMapped: false, opacity: 1 });
      m.onBeforeCompile = this.groundShader(t);
      m.customProgramCacheKey = () => (only ? 'ground-near' : 'ground'); return m; };
    this.groundA = new THREE.Mesh(gg, inv(grA)); this.groundB = new THREE.Mesh(gg, inv(grB));
    this.cast = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.ShadowMaterial({ color: '#2a0410', opacity: 0.2, transparent: true, depthWrite: false }));
    this.cast.receiveShadow = true;
    for (const g of [this.groundA, this.groundB, this.cast]) { g.rotation.x = -Math.PI / 2; g.position.set(0, -0.06, only ? -only.gz : -28); this.home.add(g); }
    this.groundB.position.y = -0.05; this.cast.position.y = -0.1;

    // light
    this.key = new THREE.DirectionalLight('#fff', 2.3);
    this.key.castShadow = R.shadowMap.enabled; this.key.shadow.mapSize.set(512, 512); this.key.shadow.radius = 14; this.key.shadow.blurSamples = 25; this.key.shadow.bias = -0.0006; this.key.shadow.normalBias = 0.35;
    this.rim = new THREE.DirectionalLight('#fff', 1);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#f6b8c1', 0.5);
    this.scene.add(this.key, this.key.target, this.rim, this.hemi);

    this.buildMarks(aniso); if (!only) { this.buildPhone(aniso); this.buildPost(); } this.setColour('retro', true);
  }

  /** Rings round the magnets, and the name on the glass. Both ride on the Core. */
  buildMarks(aniso) {
    this.rings = new THREE.Group(); this.coreIn.add(this.rings);
    const back = new THREE.Vector3(...SEAT).negate(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), back);
    const ring = (r0, r1, o) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72), new THREE.MeshBasicMaterial({ color: '#f26a2a', transparent: true, opacity: o, depthWrite: false, toneMapped: false })); m.userData = { o, noCollide: true }; return m; };
    for (const c of MAGNETS) { const g = new THREE.Group(); g.position.set(...c).addScaledVector(back, 0.1); g.quaternion.copy(q); g.add(ring(6.1, 6.9, 1), ring(8.3, 8.75, 0.75), ring(10.4, 10.7, 0.45)); this.rings.add(g); }
    // white on clear, so the material's colour is the printed colour; the plane floats just above the glass
    const el = document.createElement('canvas'); el.width = 1024; el.height = 256; const c = el.getContext('2d'), w = GLASS_MARK.w * 1.035, k = 1024 / w;
    c.translate(512, 128); c.scale(k, k); c.fillStyle = '#fff'; c.fill(new Path2D(GLASS_MARK.d), 'evenodd');
    const t = new THREE.CanvasTexture(el); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    this.M.lens = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), this.M.lens); m.position.set(...corePointDocked(0, MARK_Y, 7.45)); m.rotation.x = -20 * D; m.renderOrder = 3; m.name = 'lens-mark'; this.coreIn.add(m);
  }

  buildPhone(aniso) {
    const g = this.phone = new THREE.Group(), M = this.M;
    const metal = new THREE.MeshStandardMaterial({ color: '#a59a97', roughness: 0.3, metalness: 1 }), dark = new THREE.MeshStandardMaterial({ color: '#1d181a', roughness: 0.5, metalness: 0.4 });
    const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    mesh(slab(71.5, 149.5, 7.4, 12.2, 1.9, 8), metal);       // frame, rounded over
    mesh(slab(70.1, 148.1, 1.0, 11.5, 0.42, 5), M.glass, 0, 0, 3.4);
    mesh(slab(70.1, 148.1, 1.0, 11.5, 0.42, 5), dark, 0, 0, -3.4);
    const t = this.phoneTex = new THREE.CanvasTexture(this.phoneUi.el); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    const w = 66.6, h = 138.75, sg = new THREE.ShapeGeometry(roundedRect(w, h, 9.6), 20), p = sg.attributes.position, uv = [];
    for (let i = 0; i < p.count; i++) uv.push(p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    mesh(sg, new THREE.MeshPhysicalMaterial({ color: '#000', roughness: 0.1, emissive: '#fff', emissiveMap: t, emissiveIntensity: 0.97, envMapIntensity: 0.5, toneMapped: false }), 0, 0, 3.93);
    for (const [x, y, l] of [[35.9, 26, 17], [-35.9, 34, 10], [-35.9, 20, 10], [-35.9, 48, 5]]) { const b = mesh(slab(2.6, l, 1.1, 1.25, 0.4), metal, x, y, 0); b.rotation.y = Math.PI / 2; }
    mesh(slab(31, 31, 2.2, 8.5, 0.7), dark, -17, 55.5, -4.6);
    for (const [x, y] of [[-23.5, 62], [-10.5, 62], [-17, 50]]) { const l = mesh(new THREE.CylinderGeometry(5.1, 5.3, 1.6, 40), metal, x, y, -6); l.rotation.x = Math.PI / 2; const k = mesh(new THREE.CylinderGeometry(4.2, 4.2, 1.7, 40), M.glass, x, y, -6.05); k.rotation.x = Math.PI / 2; }
    g.visible = false; this.scene.add(g);
  }

  /** A brushed steel post that runs through the picture, for the magnets. Example, not CAD. */
  buildPost() {
    const rnd = ((a) => () => ((a = (a * 16807) % 2147483647) / 2147483647))(11);
    const paint = (fn) => { const el = document.createElement('canvas'); el.width = 1024; el.height = 256; fn(el.getContext('2d')); const t = new THREE.CanvasTexture(el); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
    const streaks = (k, n) => (c) => { c.fillStyle = `rgb(${k},${k},${k})`; c.fillRect(0, 0, 1024, 256); for (let i = 0; i < n; i++) { const v = rnd() > 0.5 ? 255 : 0; c.fillStyle = `rgba(${v},${v},${v},${rnd() * 0.075})`; const y = rnd() * 256, l = 90 + rnd() * 260, x = rnd() * 1024, w = rnd() < 0.16 ? 2 : 1; for (const ox of [0, -1024]) for (const oy of [0, -256]) c.fillRect(x + ox, y + oy, w, l); } };
    const rough = paint(streaks(150, 5200)), bump = paint(streaks(128, 6000));
    const W = 128, DEP = 64, R = 7, shape = roundedRect(W, DEP, R), pts = shape.getPoints(14), L = 1500;
    const pos = [], nor = [], uvs = [], idx = []; let s = 0;
    const ring = pts.slice(); if (ring[0].distanceTo(ring[ring.length - 1]) > 1e-4) ring.push(ring[0]);
    ring.forEach((q, i) => { if (i) s += q.distanceTo(ring[i - 1]); const cx = Math.max(-W / 2 + R, Math.min(W / 2 - R, q.x)), cy = Math.max(-DEP / 2 + R, Math.min(DEP / 2 - R, q.y)), l = Math.hypot(q.x - cx, q.y - cy) || 1; for (const y of [-L / 2, L / 2]) { pos.push(q.x, y, q.y); nor.push((q.x - cx) / l, 0, (q.y - cy) / l); uvs.push(s / 90, y / 240); } if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k, k - 1, k + 1); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeTangents();
    const m = new THREE.MeshPhysicalMaterial({ color: '#b4b2b1', metalness: 1, roughness: 0.56, roughnessMap: rough, bumpMap: bump, bumpScale: 0.35, anisotropy: 0.55, anisotropyRotation: Math.PI / 2, side: THREE.DoubleSide, envMapIntensity: 0.95 });
    const post = this.post = new THREE.Group(), o = new THREE.Mesh(g, m); o.position.z = -BACK - DEP / 2; o.receiveShadow = true; post.add(o);
    // contact shade of the Core on the steel
    const el = document.createElement('canvas'); el.width = el.height = 256; const c = el.getContext('2d'); c.filter = 'blur(9px)'; c.fillStyle = '#12060a'; c.beginPath(); c.roundRect(36, 34, 184, 190, 26); c.fill();
    this.touch = new THREE.Mesh(new THREE.PlaneGeometry(123, 124), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(el), transparent: true, depthWrite: false, toneMapped: false })); this.touch.position.set(1.5, -1.5, -BACK + 0.05); post.add(this.touch);
    post.visible = false; this.home.add(post);
  }

  /** Holder and USB-C cable (props.glb, from tools/export_props.py). Examples, not CAD. */
  buildProps(model, ao, gr) {
    const M = this.M, grain = M.body.normalMap, std = (o) => new THREE.MeshStandardMaterial(o), n2 = (k) => ({ normalMap: grain, normalScale: new THREE.Vector2(k, k) });
    const P = { frame: std({ color: '#817c7a', roughness: 0.43, metalness: 0.92, aoMap: ao, envMapIntensity: 1.15, ...n2(0.3) }), rubber: std({ color: '#151314', roughness: 0.92, aoMap: ao, ...n2(0.3) }), steel: std({ color: '#c9c8c8', roughness: 0.26, metalness: 1, aoMap: ao }), dark: std({ color: '#0b0a0a', roughness: 0.7, aoMap: ao }), cable: std({ color: '#1b191a', roughness: 0.72, ...n2(0.22) }) };
    const steel2 = std({ color: '#c9c8c8', roughness: 0.26, metalness: 1 });
    model.traverse((o) => { if (!o.isMesh) return; const n = o.material.name.split('.')[0]; o.material = P[n] || P.dark; if (o.name.startsWith('plug') && n === 'steel') o.material = steel2; o.castShadow = o.receiveShadow = true; });
    const port = corePoint({ ...POSE, ...freeAt() }, PORT), at0 = new THREE.Vector3(port.px - HOME_FREE[0], port.py - HOME_FREE[1], port.pz - HOME_FREE[2]);
    const cord = (pts) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), 160, 1.85, 14), P.cable); m.castShadow = m.receiveShadow = true; return m; };
    const plug = model.getObjectByName('plug'), hold = this.hold = new THREE.Group(), cable = this.cable = new THREE.Group();
    const plug2 = plug.clone();
    // at the post: hangs down and leaves the picture
    const ca = new THREE.Group(); ca.position.copy(at0); ca.add(plug, cord([[0, -27, 0], [0, -40, 0.4], [0.6, -70, -1.6], [-1.5, -140, -4.6], [2, -260, -5.2], [0, -420, -5.4], [0, -700, -5.4]])); cable.add(ca);
    // at the holder: down, over the base's edge, along the counter
    const g = model.getObjectByName('hold'); hold.add(g);
    const y0 = -107.7 - at0.y, cb = new THREE.Group(); cb.position.copy(at0); cb.add(plug2, cord([[0, -27, 0], [0, -34, 0.2], [2, -42, 2], [8, y0 + 12, 7], [20, y0 + 1.6, 10], [40, y0, 2], [66, y0, -16], [98, y0, -42], [150, y0, -74], [320, y0, -120], [620, y0, -150]])); hold.add(cb); this.holdCable = cb;
    const gm = this.groundA.material.clone(); gm.onBeforeCompile = this.groundShader(gr); gm.customProgramCacheKey = () => 'ground-props';
    this.holdGround = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), gm); this.holdGround.rotation.x = -Math.PI / 2; this.holdGround.position.set(0, -109.6, -34.6); hold.add(this.holdGround);
    this.holdCast = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), this.cast.material.clone()); this.holdCast.rotation.x = -Math.PI / 2; this.holdCast.position.set(0, -109.7, -34.6); this.holdCast.receiveShadow = true; hold.add(this.holdCast);
    for (const q of [hold, cable]) { q.visible = false; this.home.add(q); }
  }

  /** Case colour: the materials change on the live model, nothing else on the page does. */
  setColour(name, instant = false) {
    const c = COLOURS[name]; if (!c) return; this.colour = name;
    const to = { core: c.body, body: c.dock || c.body, accent: c.accent, lens: c.mark }, set = this.tint = [];
    for (const k in to) set.push({ m: this.M[k], a: this.M[k].color.clone(), b: new THREE.Color(to[k]) });
    this.tintT = instant ? 1 : 0; if (instant) for (const q of set) q.m.color.copy(q.b); this.dirty = true;
  }

  // ---------------------------------------------------------------- screen content
  show(name, instant = false) {
    const s = this.screen; if (s.to === name) return;
    s.from = s.to; s.to = name; s.t = instant ? 1 : 0; this.dirty = true;
    if (instant && this.screenTex) this.paint();
  }
  showPhone(name) { const s = this.phoneUi; if (s.to === name) return; s.from = s.to; s.to = name; s.t = 0; this.dirty = true; }
  paint() {
    drawScreen(this.screen.el, this.screen.from, this.screen.to, this.screen.t); this.screenTex.needsUpdate = true;
    if (this.phone) { drawPhone(this.phoneUi.el, this.phoneUi.from, this.phoneUi.to, this.phoneUi.t); this.phoneTex.needsUpdate = true; }
    this.dirty = true;
  }
  /** Advances the screen transitions. Returns true while something still moves. */
  tick(dt) {
    let busy = false;
    if (this.tintT < 1) { this.tintT = Math.min(1, this.tintT + dt / 0.4); for (const q of this.tint) q.m.color.lerpColors(q.a, q.b, this.tintT); this.dirty = busy = true; }
    if (this.screen.t < 1) { this.screen.t = Math.min(1, this.screen.t + dt / 0.85); drawScreen(this.screen.el, this.screen.from, this.screen.to, this.screen.t); this.screenTex.needsUpdate = true; this.dirty = busy = true; }
    if (this.phoneUi.t < 1) { this.phoneUi.t = Math.min(1, this.phoneUi.t + dt / 0.9); drawPhone(this.phoneUi.el, this.phoneUi.from, this.phoneUi.to, this.phoneUi.t); this.phoneTex.needsUpdate = true; this.dirty = busy = true; }
    return busy;
  }

  // ---------------------------------------------------------------- size, pose, render
  resize(w, h, dpr = Math.min(2, window.devicePixelRatio || 1)) {
    this.w = w; this.h = h; this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
  }
  apply(p) {
    const a = this.camera.aspect, k = p.s * H0 / DEVICE_H;
    this.rig.position.set(p.x * H0 / 2 * a, p.y * H0 / 2, 0); this.rig.scale.setScalar(k);
    this.tilt.rotation.set(p.pitch * D, 0, p.roll * D); this.turn.rotation.y = p.yaw * D; this.home.position.set(-p.px, -p.py, -p.pz);
    const co = coreOffset(p), l = liftAt(p.lf); this.coreAt.position.set(CORE_C[0] + co[0], CORE_C[1] + co[1], CORE_C[2] + co[2]);
    this.coreAt.rotation.set(p.crx * D, p.cry * D, p.crz * D);
    const off = Math.hypot(...co), apart = Math.min(1, off / 34); this.apart.value = apart;
    this.dock.visible = p.don > 0.01; this.dock.position.set(p.dx, p.dy, p.dz);
    // the pins are sprung: they come out 1.4 mm as the Core leaves the face; the bolt is drawn back before that
    const back = off > 12 ? 0 : 1.4 - Math.min(1.4, l.n);
    if (this.pins) this.pins.position.set(0, -SEAT[1] * back, -SEAT[2] * back);
    if (this.bolt) this.bolt.position.set(0, -SEAT[1] * 3.2 * (1 - l.lock), -SEAT[2] * 3.2 * (1 - l.lock));
    const sh = p.sh * Math.max(0, Math.min(1, p.don));
    this.groundA.visible = this.groundB.visible = this.cast.visible = sh > 0.01;
    this.groundA.position.x = this.groundB.position.x = p.dx;
    this.groundA.material.opacity = 0.86 * sh * (1 - apart); this.groundB.material.opacity = 0.86 * sh * apart; this.cast.material.opacity = 0.3 * sh;
    this.mag.value = p.mag; this.rings.visible = p.mag > 0.02;
    if (this.rings.visible) for (const g of this.rings.children) g.children.forEach((m, i) => { const e = Math.max(0, Math.min(1, p.mag * 1.7 - i * 0.35)); m.material.opacity = m.userData.o * e; m.scale.setScalar(0.8 + 0.2 * e); });
    const far = Math.max(420, (H0 / 2 * a) / k * 1.25 + 160);  // out of the picture on the right, at any size
    const put = (g, t) => { if (!g) return; g.visible = t > 0.004; if (g.visible) g.position.set(HOME_FREE[0] + far * (1 - t), HOME_FREE[1], HOME_FREE[2]); };
    put(this.post, p.post); put(this.hold, p.hold);
    if (this.cable) { this.cable.visible = p.cable > 0.004 && p.post > 0.004; this.cable.position.set(HOME_FREE[0] + far * (1 - p.post), HOME_FREE[1] - 70 * (1 - p.cable), HOME_FREE[2]); }
    if (this.touch) this.touch.material.opacity = 0.62 * Math.max(0, 1 - (co[2] - FREE[2]) / 26);
    if (this.phone) this.phone.visible = p.ph > 0.01;
    if (this.phone && this.phone.visible) { const f = p.phs * H0 / 150; this.phone.position.set(p.phx * H0 / 2 * a, p.phy * H0 / 2, 46); this.phone.scale.setScalar(f); this.phone.rotation.set(p.phpitch * D, p.phyaw * D, p.phroll * D); }
    this.renderer.toneMappingExposure = p.exp;
    this.key.intensity = p.key; this.key.color.setRGB(p.kr, p.kg, p.kb);
    const span = 130 * k;                                     // the shadow camera follows the device
    this.key.target.position.copy(this.rig.position); this.key.position.set(this.rig.position.x + p.kx, this.rig.position.y + p.ky, p.kz);
    const sc = this.key.shadow.camera;
    if (Math.abs((this.span || 0) - span) > span * 0.02) { this.span = span; sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.near = 1; sc.far = 800; sc.updateProjectionMatrix(); }
    this.rim.intensity = p.rim; this.rim.position.set(p.rx, p.ry, p.rz); this.rim.color.setRGB(p.rr, p.rg, p.rb);
    this.scene.environmentIntensity = p.env; this.hemi.intensity = p.hemi; this.hemi.groundColor.setRGB(p.gr, p.gg, p.gb);
  }
  render(p) {
    if (p.on < 0.5) { if (!this.cleared) { this.renderer.clear(); this.cleared = true; } return false; }
    let key = ''; for (const k in POSE) key += (p[k] * 4096 | 0) + ',';
    if (!this.dirty && key === this.last) return false;
    this.last = key; this.dirty = false; this.cleared = false;
    this.apply(p); this.renderer.render(this.scene, this.camera);
    return true;
  }
}
