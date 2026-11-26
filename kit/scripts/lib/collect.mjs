// Runs INSIDE the page (serialised by slopcheck.mjs). Reads computed styles only, so var() is resolved.
// Returns a compact model of the page; every judgement lives in lib/detectors.mjs.
/* eslint-disable no-undef */

// Called once right after load: remembers elements that are still invisible, to spot entrance animations.
export function markHidden() {
  window.__kitHidden = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 12) continue;
    if (parseFloat(getComputedStyle(el).opacity) < 0.05) window.__kitHidden.push(el);
  }
  return window.__kitHidden.length;
}

export async function collect() {
  const MAX = 6000;
  const vw = innerWidth;
  const vh = innerHeight;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Any CSS colour (rgb, oklch, color-mix, ...) to [r,g,b,a] through a canvas pixel.
  const cv = document.createElement('canvas');
  cv.width = 1; cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const rgba = (s) => {
    if (!s || s === 'transparent' || s === 'none') return [0, 0, 0, 0];
    if (cache.has(s)) return cache.get(s);
    const m = /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/.exec(s);
    let out;
    if (m) out = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    else {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = [d[0], d[1], d[2], Math.round((d[3] / 255) * 1000) / 1000];
    }
    cache.set(s, out);
    return out;
  };
  const over = (top, under) => {
    const a = top[3] + under[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a);
  };
  const path = (el) => {
    const bits = [];
    for (let e = el, n = 0; e && e !== document.documentElement && n < 3; e = e.parentElement, n += 1) {
      let s = e.tagName.toLowerCase();
      if (e.id) { bits.unshift(`${s}#${e.id}`); break; }
      const c = [...e.classList].slice(0, 2).join('.');
      if (c) s += `.${c}`;
      bits.unshift(s);
    }
    return bits.join(' > ');
  };
  const clean = (s) => s.replace(/\s+/g, ' ').trim();

  // 1. Walk the page screen by screen: fires lazy content and reveals, samples the ground, measures contrast.
  const ground = new Map();
  const first = new Map();     // first viewport only
  const contrast = new Map();
  const groundAt = (stack) => {
    let acc = [0, 0, 0, 0];
    for (const e of stack) {
      const tag = e.tagName;
      if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'IFRAME' || e.ownerSVGElement || tag === 'svg') return null;
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none' && cs.webkitBackgroundClip !== 'text') return null;
      const bg = rgba(cs.backgroundColor);
      if (bg[3] > 0) acc = over(acc, bg);
      if (acc[3] > 0.985) return acc;
    }
    return over(acc, [255, 255, 255, 1]);
  };
  const height = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const screens = Math.min(Math.ceil(height() / vh), 24);
  const ownText = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return clean(t);
  };
  const sr = (el, cs, r) => r.width <= 2 || r.height <= 2 || cs.clipPath === 'inset(50%)' || cs.clip === 'rect(0px, 0px, 0px, 0px)';
  const behavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  for (let s = 0; s < screens; s += 1) {
    scrollTo(0, s * vh);
    await wait(260);
    for (let i = 0; i < 17; i += 1) {
      for (let j = 0; j < 12; j += 1) {
        const st = document.elementsFromPoint(((i + 0.5) / 17) * vw, ((j + 0.5) / 12) * vh);
        const c = st.length ? groundAt(st) : null;
        const k = c ? c.slice(0, 3).map(Math.round).join(',') : 'image';
        ground.set(k, (ground.get(k) || 0) + 1);
        if (s === 0) first.set(k, (first.get(k) || 0) + 1);
      }
    }
    for (const el of document.body.querySelectorAll('*')) {
      if (contrast.has(el)) continue;
      const t = ownText(el);
      if (t.length < 2 || !/[\p{L}\p{N}]/u.test(t)) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > vw || cy > vh || r.width < 3 || r.height < 3) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || sr(el, cs, r)) continue;
      if (el.closest('[aria-hidden="true"],[disabled],[inert]')) continue;
      let opacity = 1;
      for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
      if (opacity < 0.9) continue;            // mid-animation or deliberately faded: not judged here
      if (cs.webkitBackgroundClip === 'text' || cs.webkitTextFillColor !== cs.color) continue;
      const st = document.elementsFromPoint(cx, cy);
      const at = st.indexOf(el);
      if (at < 0) continue;
      const under = groundAt(st.slice(at));
      if (!under) continue;
      contrast.set(el, { fg: rgba(cs.color), bg: under, size: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400, sel: path(el), text: t.slice(0, 50) });
    }
  }
  scrollTo(0, 0);
  await wait(250);
  document.documentElement.style.scrollBehavior = behavior;

  // 2. One record per visible element.
  const els = [];
  const index = new Map();
  const pseudos = [];
  const rotation = (cs) => {
    let deg = 0;
    const m = /^matrix\(([-\d.e]+),\s*([-\d.e]+)/.exec(cs.transform);
    if (m) deg = (Math.atan2(+m[2], +m[1]) * 180) / Math.PI;
    const r = /(-?[\d.]+)deg/.exec(cs.rotate || '');
    if (r) deg += +r[1];
    return Math.round(deg * 10) / 10;
  };
  const border = (cs) => ['Top', 'Right', 'Bottom', 'Left'].map((side) => ({
    w: parseFloat(cs[`border${side}Width`]) || 0, s: cs[`border${side}Style`], c: rgba(cs[`border${side}Color`]),
  }));
  const gen = (cs) => ({
    color: rgba(cs.color), bg: rgba(cs.backgroundColor), bgImage: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 400),
    size: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400, family: cs.fontFamily, style: cs.fontStyle,
    tracking: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing), upper: cs.textTransform === 'uppercase',
    radius: cs.borderTopLeftRadius, shadow: cs.boxShadow === 'none' ? '' : cs.boxShadow, border: border(cs), rot: rotation(cs),
    textShadow: cs.textShadow === 'none' ? '' : cs.textShadow,
  });
  for (const el of document.body.querySelectorAll('*')) {
    if (els.length >= MAX) break;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template', 'br', 'wbr', 'option', 'source', 'link', 'meta'].includes(tag)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    if (sr(el, cs, r)) continue;
    const inSvg = !!el.ownerSVGElement;
    const rec = {
      i: els.length, tag, sel: path(el), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
      parent: index.has(el.parentElement) ? index.get(el.parentElement) : -1,
      text: ownText(el).slice(0, 160), full: '', inSvg, kids: el.children.length,
      href: tag === 'a' ? el.getAttribute('href') || '' : '', cls: (el.getAttribute('class') || '').slice(0, 80),
      role: el.getAttribute('role') || '', hidden: !!el.closest('[aria-hidden="true"]'),
      align: cs.textAlign, pos: cs.position, opacity: parseFloat(cs.opacity), display: cs.display,
      backdrop: cs.backdropFilter && cs.backdropFilter !== 'none' ? cs.backdropFilter : '',
      filter: cs.filter && cs.filter !== 'none' ? cs.filter : '',
      clipText: cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text', fill: rgba(cs.webkitTextFillColor),
      mask: (cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : '').slice(0, 200),
      bgSize: cs.backgroundSize, anim: cs.animationName === 'none' ? '' : cs.animationName, animIter: cs.animationIterationCount,
      inTable: !!el.closest('table,[role=table],[role=grid]'), inCode: !!el.closest('pre,code,kbd,samp,[role=log]'),
      inForm: !!el.closest('input,select,textarea,[type=file]'), inOl: !!el.closest('ol'), inNav: !!el.closest('nav'),
      tabular: /tabular-nums/.test(cs.fontVariantNumeric), ...gen(cs),
    };
    if (/^(h[1-6]|a|button|li|figure|article|summary|label)$/.test(tag) || el.children.length <= 12) {
      rec.full = clean(el.innerText || el.textContent || '').slice(0, 220);
    }
    index.set(el, rec.i);
    els.push(rec);
    if (!inSvg) {
      for (const which of ['::before', '::after']) {
        const ps = getComputedStyle(el, which);
        if (ps.content === 'none' || ps.content === 'normal' || ps.display === 'none') continue;
        pseudos.push({ of: rec.i, which, sel: rec.sel + which, content: ps.content.replace(/^"|"$/g, '').slice(0, 60), w: parseFloat(ps.width) || 0, h: parseFloat(ps.height) || 0, ...gen(ps) });
      }
    }
  }
  const revealed = (window.__kitHidden || []).filter((e) => e.isConnected && parseFloat(getComputedStyle(e).opacity) > 0.6);
  const shares = (map) => {
    const list = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const total = list.reduce((n, [, c]) => n + c, 0) || 1;
    return list.slice(0, 8).map(([k, c]) => ({ rgb: k === 'image' ? null : k.split(',').map(Number), share: c / total }));
  };
  return {
    url: location.href, title: document.title, vw, vh, height: height(), truncated: els.length >= MAX,
    bodyFamily: getComputedStyle(document.body).fontFamily, textLength: (document.body.innerText || '').length,
    ground: shares(ground), firstGround: shares(first),
    contrast: [...contrast.values()], els, pseudos,
    revealed: revealed.map(path).slice(0, 200),
  };
}

// Narrow-width probe: document width plus the elements that stick out of it.
export function overflowProbe(width) {
  const de = document.documentElement;
  const wide = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right <= width + 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.position === 'fixed') continue;
    let clipped = false;     // inside a scroller or a clipping box: not layout-wide
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      if (getComputedStyle(e).overflowX !== 'visible') { clipped = true; break; }
    }
    if (clipped) continue;
    wide.push({ sel: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList[0] ? `.${el.classList[0]}` : ''), right: Math.round(r.right) });
  }
  wide.sort((a, b) => b.right - a.right);
  return { scrollWidth: Math.max(de.scrollWidth, document.body.scrollWidth), clientWidth: de.clientWidth, wide: wide.slice(0, 6) };
}
