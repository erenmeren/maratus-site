// Detectors for the named tells in references/ban-list.md. Input: the page model from lib/collect.mjs.
// Rules are general: no URLs, class names or selectors of any particular site.
// level "fail" = named tell or broken quality floor; level "warn" = weak or context-dependent, review by eye.

// ---------- colour helpers (sRGB -> OKLCH, WCAG contrast) ----------
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function oklch([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, bb), h };
}
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrastRatio(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
export const hex = (c) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const between = (v, a, b) => v >= a && v <= b;
const isPaper = (c) => { const o = oklch(c); return o.L >= 0.86 && between(o.C, 0.006, 0.07) && between(o.h, 45, 120); };
const isNearBlack = (c) => oklch(c).L <= 0.24;
// Lime, acid yellow-green and mint; L >= 0.8 keeps ordinary status greens out.
const isAcid = (c) => { const o = oklch(c); return o.L >= 0.8 && o.C >= 0.13 && between(o.h, 98, 175); };
const isWarm = (c) => { const o = oklch(c); return between(o.L, 0.45, 0.8) && o.C >= 0.11 && between(o.h, 27, 62); };
const isViolet = (c) => { const o = oklch(c); return o.C >= 0.07 && between(o.h, 272, 330); };
const isBlueViolet = (c) => { const o = oklch(c); return o.C >= 0.07 && between(o.h, 225, 330); };

// ---------- type helpers ----------
export const firstFamily = (list) => (list || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
const MONO = /\bmono\b|mono$|courier|consolas|menlo|monaco|\bcode\b|typewriter|^monospace$|ui-monospace/i;
const SERIF = /serif(?<!sans[- ]serif)|^(georgia|times|garamond|palatino|baskerville|didot|bodoni|cambria|charter|fraunces|playfair|newsreader|lora|merriweather|cormorant|spectral|crimson|gloock|eb garamond|libre (caslon|baskerville|bodoni)|young serif|tiempos|canela|recoleta|literata|bitter|domine|vollkorn|cardo|alegreya(?! sans))/i;
const OVERUSED = [
  // first-order library defaults
  'inter', 'roboto', 'open sans', 'poppins', 'montserrat', 'lato', 'nunito',
  // second-order "tasteful" defaults
  'space grotesk', 'geist', 'plus jakarta sans', 'instrument serif', 'instrument sans', 'fraunces',
  'playfair display', 'bricolage grotesque', 'dm sans', 'dm serif display', 'manrope', 'outfit', 'sora', 'syne',
  'newsreader', 'cormorant garamond', 'unbounded', 'archivo black', 'figtree',
];
const OVERUSED_MONO = ['jetbrains mono', 'ibm plex mono', 'space mono', 'geist mono', 'dm mono', 'fira code'];
const base = (f) => f.toLowerCase().replace(/\s+(variable|vf)$/, '');
const isMono = (e) => MONO.test(firstFamily(e.family));
const isSerif = (e) => SERIF.test(firstFamily(e.family));
const letters = (t) => (t.match(/\p{L}/gu) || []).length;
const allCaps = (t) => letters(t) >= 3 && t === t.toLocaleUpperCase('en') && t !== t.toLocaleLowerCase('en');
const capsLook = (e) => letters(e.text) >= 3 && (e.upper || allCaps(e.text));
const EMOJI = /^\p{Extended_Pictographic}(️|‍|\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;
const px = (v) => parseFloat(v) || 0;

// ---------- box helpers ----------
const visibleBorder = (b) => b.w > 0 && b.s !== 'none' && b.s !== 'hidden' && b.c[3] > 0.05;
const boxed = (e) => e.bg[3] > 0.05 || !!e.bgImage || !!e.shadow || e.border.filter(visibleBorder).length === 4;
const radiusPx = (e) => (/%/.test(e.radius) ? (px(e.radius) / 100) * Math.min(e.w, e.h) : px(e.radius));
const isPill = (e) => radiusPx(e) >= e.h / 2 - 1 && e.w > e.h * 1.3 && radiusPx(e) >= 8;
const isControl = (e) => e.tag === 'button' || (e.tag === 'a' && boxed(e)) || e.role === 'button';

function shadows(text) {
  if (!text) return [];
  return text.split(/,(?![^(]*\))/).map((part) => {
    const col = /(rgba?|color|oklch|oklab|lab|lch|hsla?)\([^)]*\)/.exec(part);
    const nums = part.replace(col ? col[0] : '', '').match(/-?[\d.]+px/g) || [];
    const alpha = col ? (/[,/]\s*([\d.]+)\s*\)$/.exec(col[0])) : null;
    const a = col && /^rgba|\//.test(col[0]) && alpha ? +alpha[1] : 1;
    return { x: px(nums[0]), y: px(nums[1]), blur: px(nums[2]), spread: px(nums[3]), inset: /inset/.test(part), a, raw: part.trim() };
  });
}
const gradientStops = (img) => [...(img || '').matchAll(/rgba?\(([^)]+)\)/g)]
  .map((m) => m[1].split(/[,\s/]+/).filter(Boolean).map(Number)).filter((c) => c.length >= 3 && (c[3] === undefined || c[3] > 0.15));

// ---------- evidence helpers ----------
const ev = (e, value, extra) => ({ selector: e.sel, value, ...(e.text ? { text: e.text.slice(0, 48) } : {}), ...extra });
const quote = (t) => `"${t.slice(0, 40)}"`;

export const TELLS = {
  T01: 'Paper/cream ground', T02: 'Cream + serif/display + warm accent + mono labels', T03: 'Near-black ground + acid accent',
  T04: 'Purple/indigo-blue gradient', T05: 'Gradient text', T06: 'Glassmorphism / unearned blur', T07: 'Decorative atmosphere (orbs, halos, grid lines)',
  T10: 'Monospace chrome labels', T11: 'Tracked all-caps eyebrows', T12: 'Default or overused typeface', T13: 'Accented headline phrase',
  T15: 'Tiny text', T16: 'Low-contrast text',
  T20: 'Decorative 01/02/03 numbering', T21: 'Template hero (centred, pill, two CTAs)', T22: 'Broadsheet hairlines', T23: 'SaaS card kit grid',
  T24: 'Icon or emoji feature rows', T25: 'One radius on everything', T26: 'Monument stat strip', T27: 'Label chrome (middots, slash counters, dash labels)',
  T28: 'Arrow glued to links', T30: 'Hard offset shadow', T31: 'Rotated stamp or badge', T32: 'Dashed perforation rules', T33: 'Pill everything',
  T40: 'Horizontal overflow at 390 px', T50: 'Fade-up entrances everywhere', T51: 'Endless decorative motion', T60: 'Marketing filler copy', T61: 'Vague call-to-action labels',
};

export function detect(m, probe390) {
  const out = [];
  const fire = (id, level, count, evidence, note = '') =>
    out.push({ id, name: TELLS[id], level, count, note, evidence: evidence.slice(0, 6) });
  const els = m.els;
  const pseudoOf = (i) => m.pseudos.filter((p) => p.of === i);
  const kidsOf = new Map();
  for (const e of els) { if (!kidsOf.has(e.parent)) kidsOf.set(e.parent, []); kidsOf.get(e.parent).push(e); }
  const kids = (e) => kidsOf.get(e.i) || [];
  const parent = (e) => (e.parent >= 0 ? els[e.parent] : null);
  const under = (e) => { const all = []; const go = (n) => { for (const k of kids(n)) { all.push(k); go(k); } }; go(e); return all; };
  const texts = els.filter((e) => e.text.length >= 2 && !e.inSvg);
  const headings = els.filter((e) => /^h[1-3]$/.test(e.tag) && e.full);
  const bigHeads = headings.filter((e) => /^h[12]$/.test(e.tag));
  const display = [...texts].sort((a, b) => b.size - a.size)[0];
  const usable = m.ground.filter((g) => g.rgb);
  const ground = usable[0];
  const groundShare = (fn, list = m.ground) => list.filter((g) => g.rgb && fn(g.rgb)).reduce((n, g) => n + g.share, 0);
  const groundOf = (fn) => [...m.ground, ...m.firstGround].find((g) => g.rgb && fn(g.rgb));
  const pct = (v) => `${(v * 100).toFixed(0)}%`;

  // Painted colours in use: fills, text and borders, with where they were seen.
  const paints = [];
  for (const e of [...els.filter((x) => !x.inSvg), ...m.pseudos]) {
    if (e.bg[3] > 0.5) paints.push({ c: e.bg, e, how: 'background' });
    for (const b of e.border) if (visibleBorder(b) && b.w >= 2) { paints.push({ c: b.c, e, how: 'border' }); break; }
    if (e.text && e.text.length >= 2 && e.color[3] > 0.5) paints.push({ c: e.color, e, how: 'text' });
  }

  // Small text in a monospace face outside code, tables, forms and figures.
  const monoLabels = texts.filter((e) => e.size <= 14.5 && e.text.length <= 60 && letters(e.text) >= 3 && isMono(e) && !e.inCode && !e.inTable && !e.inForm);

  // --- palette ---
  const paperShare = groundShare(isPaper);
  const paperFirst = groundShare(isPaper, m.firstGround);
  if (ground && (paperShare >= 0.35 || paperFirst >= 0.5)) {
    const g = groundOf(isPaper);
    fire('T01', 'fail', 1, [{ selector: 'page ground', value: `${hex(g.rgb)}: ${pct(paperShare)} of the page, ${pct(paperFirst)} of the first viewport` }]);
    const warm = paints.filter((p) => isWarm(p.c));
    const serifHead = headings.filter((h) => isSerif(h));
    const charDisplay = display && OVERUSED.includes(base(firstFamily(display.family)));
    const parts = [];
    const proof = [];
    if (warm.length) { parts.push('warm accent'); proof.push(ev(warm[0].e, `${warm[0].how} ${hex(warm[0].c)}`, { count: warm.length })); }
    if (serifHead.length) { parts.push('serif display'); proof.push(ev(serifHead[0], firstFamily(serifHead[0].family))); }
    else if (charDisplay) { parts.push('stock display face'); proof.push(ev(display, firstFamily(display.family))); }
    if (monoLabels.length >= 2) { parts.push('mono labels'); proof.push(ev(monoLabels[0], firstFamily(monoLabels[0].family), { count: monoLabels.length })); }
    if (parts.includes('warm accent') && parts.length >= 2) fire('T02', 'fail', parts.length, proof, `cream ground with ${parts.join(', ')}`);
  }
  const darkShare = groundShare(isNearBlack);
  const darkFirst = groundShare(isNearBlack, m.firstGround);
  if (darkShare >= 0.25 || darkFirst >= 0.4) {
    // A lone small dot is a status light, not an accent: need a fill with some area, large text or repeated use.
    const acid = paints.filter((p) => isAcid(p.c));
    const carries = acid.some((p) => (p.how === 'background' && p.e.w * p.e.h >= 1500) || (p.how === 'text' && p.e.size >= 20));
    if (carries || acid.length >= 3) {
      fire('T03', 'fail', acid.length, [{ selector: 'page ground', value: `${hex(groundOf(isNearBlack).rgb)}: ${pct(darkShare)} of the page, ${pct(darkFirst)} of the first viewport` },
        ...acid.slice(0, 4).map((p) => ev(p.e, `${p.how} ${hex(p.c)}`))]);
    }
  }
  const boxes = [...els.filter((e) => !e.inSvg), ...m.pseudos];
  const grads = boxes.filter((e) => /gradient/.test(e.bgImage));
  const violet = grads.filter((e) => { const st = gradientStops(e.bgImage); return st.length >= 2 && st.some(isViolet) && st.filter(isBlueViolet).length >= 2; });
  if (violet.length) fire('T04', 'fail', violet.length, violet.map((e) => ev(e, e.bgImage.slice(0, 110))));
  const gradText = els.filter((e) => e.clipText && /gradient/.test(e.bgImage) && (e.fill[3] < 0.2 || e.color[3] < 0.2) && e.full);
  if (gradText.length) fire('T05', 'fail', gradText.length, gradText.map((e) => ev(e, `background-clip:text, ${e.bgImage.slice(0, 80)}`)));
  const glass = els.filter((e) => /blur\(\s*[1-9]/.test(e.backdrop));
  if (glass.length) {
    const loose = glass.filter((e) => !['fixed', 'sticky'].includes(e.pos));
    fire('T06', loose.length ? 'fail' : 'warn', glass.length, (loose.length ? loose : glass).map((e) => ev(e, `backdrop-filter: ${e.backdrop}`)), loose.length ? '' : 'only on fixed or sticky layers');
  }
  const area = m.vw * m.vh;
  const atmosphere = boxes.filter((e) => {
    const big = e.w * e.h >= area * 0.12;
    if (/repeating-(linear|radial)-gradient/.test(e.bgImage) && big) return true;
    if (big && /radial-gradient/.test(e.bgImage) && /rgba\([^)]*,\s*0\)|transparent/.test(e.bgImage) && !e.clipText) return true;
    if (big && (e.bgImage.match(/linear-gradient/g) || []).length >= 2 && /\b1px\b/.test(e.bgImage)) return true;
    return /blur\((\d{2,})/.test(e.filter || '') && +/blur\((\d+)/.exec(e.filter)[1] >= 20 && e.w > 120;
  });
  if (atmosphere.length) fire('T07', 'fail', atmosphere.length, atmosphere.map((e) => ev(e, (e.filter || e.bgImage).slice(0, 100))));

  // --- type ---
  if (monoLabels.length >= 3) fire('T10', 'fail', monoLabels.length, monoLabels.slice(0, 5).map((e) => ev(e, `${firstFamily(e.family)} ${e.size}px${capsLook(e) ? ' all caps' : ''}`)));
  const eyebrows = texts.filter((e) => e.size <= 15 && e.text.length <= 48 && capsLook(e) && e.tracking >= e.size * 0.03 && !/^(abbr|th|td|input)$/.test(e.tag) && !e.inTable && !e.inCode);
  if (eyebrows.length >= 3) fire('T11', 'fail', eyebrows.length, eyebrows.slice(0, 5).map((e) => ev(e, `${e.size}px caps, tracking ${e.tracking.toFixed(2)}px`)));
  const chars = new Map();
  for (const e of texts) { const f = firstFamily(e.family); chars.set(f, (chars.get(f) || 0) + e.text.length); }
  const total = [...chars.values()].reduce((a, b) => a + b, 0) || 1;
  const families = [...chars.entries()].sort((a, b) => b[1] - a[1]).filter(([f, n]) => n / total >= 0.01);
  const flagged = families.filter(([f]) => OVERUSED.includes(base(f)) || OVERUSED_MONO.includes(base(f)));
  if (flagged.length) {
    const headFam = new Set(headings.map((h) => base(firstFamily(h.family))));
    const strong = flagged.filter(([f]) => headFam.has(base(f)) || chars.get(f) / total >= 0.5);
    fire('T12', strong.length || flagged.length >= 2 ? 'fail' : 'warn', flagged.length,
      flagged.map(([f, n]) => ({ selector: 'font-family', value: `${f} on ${((n / total) * 100).toFixed(0)}% of text${headFam.has(base(f)) ? ', used for headings' : ''}` })));
  }
  const accented = [];
  for (const h of bigHeads) {
    for (const k of under(h)) {
      const t = k.full || k.text;
      if (!t || t.length >= h.full.length - 1 || k.tag === 'a' || k.hidden || k.inSvg) continue;
      const a = oklch(k.color), b = oklch(h.color);
      const hueGap = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
      const recolour = a.C >= 0.09 && (b.C < 0.05 || hueGap > 35 || Math.abs(a.L - b.L) > 0.25);
      const italic = k.style === 'italic' && h.style !== 'italic';
      const marker = k.bg[3] > 0.5 && oklch(k.bg).C >= 0.09;
      if (recolour || italic || marker) {
        const why = recolour ? `color ${hex(k.color)} in a ${hex(h.color)} heading` : italic ? 'italic phrase in an upright heading' : `highlight ${hex(k.bg)}`;
        accented.push(ev({ sel: k.sel, text: t }, why));
      }
    }
  }
  if (accented.length) fire('T13', 'fail', accented.length, accented);
  const tiny = texts.filter((e) => e.size < 12 && e.h >= 4 && !e.hidden && e.opacity > 0.05 && /[\p{L}\p{N}]{2}/u.test(e.text));
  if (tiny.length) fire('T15', tiny.length >= 2 ? 'fail' : 'warn', tiny.length, [...tiny].sort((a, b) => a.size - b.size).map((e) => ev(e, `${e.size}px`)));
  const low = [];
  for (const c of m.contrast) {
    const fg = c.fg[3] < 1 ? over(c.fg, c.bg) : c.fg;
    const ratio = contrastRatio(fg, c.bg);
    const large = c.size >= 24 || (c.size >= 18.66 && c.weight >= 700);
    if (ratio < (large ? 3 : 4.5) - 0.02) low.push({ selector: c.sel, value: `${ratio.toFixed(2)}:1 (${hex(fg)} on ${hex(c.bg)}, ${c.size}px)`, text: c.text, ratio });
  }
  if (low.length) fire('T16', 'fail', low.length, low.sort((a, b) => a.ratio - b.ratio).map(({ ratio, ...r }) => r));

  // --- structure and chrome ---
  // Standalone "01", "01 — Label", "01 / 03", "01. Label"; never dates, times or phone numbers.
  const numbered = texts.filter((e) => e.text.length <= 40 && (/^[([]?0\d[)\].:]?$/.test(e.text) || /^0\d\s*[—–·]\s*\S/.test(e.text) ||
    /^0\d\s+[/-]\s+\S/.test(e.text) || /^0\d[.:)]\s+\p{L}/u.test(e.text)))
    .filter((e) => !e.inTable && !e.inForm && !e.inCode);
  const counters = m.pseudos.filter((p) => /counter/.test(p.content) && /decimal-leading-zero/.test(p.content)).concat(m.pseudos.filter((p) => /^0\d$/.test(p.content)));
  const distinct = new Set(numbered.map((e) => /0(\d)/.exec(e.text)[1]));
  if (distinct.size >= 2 || counters.length >= 2) {
    const inOl = numbered.length > 0 && numbered.every((e) => e.inOl);
    fire('T20', inOl ? 'warn' : 'fail', numbered.length + counters.length,
      [...numbered.map((e) => ev(e, quote(e.text))), ...counters.map((p) => ({ selector: p.sel, value: `content ${p.content}` }))],
      inOl ? 'inside an ordered list: keep only if it is a real sequence' : '');
  }
  const h1 = els.find((e) => e.tag === 'h1' && e.y < m.vh);
  if (h1) {
    const centred = h1.align === 'center' && Math.abs(h1.x + h1.w / 2 - m.vw / 2) < m.vw * 0.06;
    const pill = els.find((e) => isPill(e) && e.h <= 48 && boxed(e) && (e.full || e.text) && (e.full || e.text).length <= 50 && !isNavish(e) && e.y + e.h <= h1.y + 4 && h1.y - e.y < 220 && Math.abs(e.x + e.w / 2 - m.vw / 2) < m.vw * 0.12);
    const ctas = els.filter((e) => isControl(e) && (e.full || e.text) && (e.full || e.text).length <= 32 && e.y > h1.y + h1.h - 4 && e.y < h1.y + h1.h + 420 && e.y < m.vh * 1.1);
    const pair = ctas.length >= 2 && ctas.slice(1).some((b) => Math.abs(b.y - ctas[0].y) < 14);
    if (centred && pill && pair) fire('T21', 'fail', 3, [ev(h1, 'centred h1'), ev(pill, 'pill above the headline', { text: (pill.full || pill.text).slice(0, 40) }), ...ctas.slice(0, 2).map((e) => ev(e, `CTA ${quote(e.full || e.text)}`))]);
  }
  function isNavish(e) { return e.inNav || (e.tag === 'a' && e.pos === 'fixed'); }
  const oneSided = (e, test) => {
    const b = e.border.map((x) => visibleBorder(x) && test(x));
    const n = b.filter(Boolean).length;
    return n >= 1 && n <= 2 && (b[0] || b[2]) && !b[1] && !b[3];
  };
  const rules = els.filter((e) => !e.inTable && !e.inForm && e.w >= m.vw * 0.3 && (oneSided(e, (x) => x.s === 'solid' && x.w <= 1.5) || (e.tag !== 'hr' && e.h <= 1.5 && e.bg[3] > 0.1 && !e.inSvg)));
  if (rules.length >= 5) fire('T22', rules.length >= 8 ? 'fail' : 'warn', rules.length, rules.slice(0, 6).map((e) => ev(e, '1px rule', { text: undefined, width: Math.round(e.w) })));
  const dashed = [...els, ...m.pseudos].filter((e) => !e.inForm && e.w >= 80 && e.border.some((b) => visibleBorder(b) && /dashed|dotted/.test(b.s)))
    .concat(els.filter((e) => /repeating-linear-gradient/.test(e.bgImage) && e.h <= 6 && e.w >= 80));
  if (dashed.length >= 2) fire('T32', 'fail', dashed.length, dashed.map((e) => { const b = e.border.find((x) => visibleBorder(x) && /dashed|dotted/.test(x.s)); return ev(e, b ? `${b.w}px ${b.s} ${hex(b.c)}` : 'repeating gradient rule', { text: undefined }); }));

  // Repeated sibling boxes in one row: same size, same radius, same treatment.
  const grids = [];
  for (const [, group] of kidsOf) {
    const cands = group.filter((e) => boxed(e) && e.h >= 90 && e.w >= 120 && e.w < m.vw * 0.6 && !e.inSvg && !/^(img|video|canvas|picture|svg|button|input)$/.test(e.tag));
    if (cands.length < 3) continue;
    const byRow = new Map();
    for (const e of cands) { const k = Math.round(e.y / 8); if (!byRow.has(k)) byRow.set(k, []); byRow.get(k).push(e); }
    for (const row of byRow.values()) {
      if (row.length < 3) continue;
      const a = row[0];
      const same = row.filter((e) => Math.abs(e.w - a.w) < 4 && Math.abs(e.h - a.h) < a.h * 0.12 && e.radius === a.radius && e.shadow === a.shadow && e.tag === a.tag);
      if (same.length >= 3 && (radiusPx(a) >= 4 || a.shadow)) grids.push({ a, n: same.length });
    }
  }
  if (grids.length) fire('T23', 'fail', grids.length, grids.map(({ a, n }) => ev(a, `${n} identical cards ${Math.round(a.w)}x${Math.round(a.h)}, radius ${a.radius}, shadow ${a.shadow ? a.shadow.slice(0, 50) : 'none'}`, { text: undefined })));
  const emojis = els.filter((e) => !e.inSvg && EMOJI.test(e.text) && e.size >= 16);
  const emojiLead = texts.filter((e) => /^(li|h[2-5]|p|span|a|button)$/.test(e.tag) && /^\p{Extended_Pictographic}/u.test(e.text) && !/^[©®™↔↕▪▫◻◼✓✔]/u.test(e.text));
  const tiles = els.filter((e) => e.w >= 24 && e.w <= 88 && Math.abs(e.w - e.h) < 4 && boxed(e) && !isControl(e) && radiusPx(e) >= e.w * 0.18 && (EMOJI.test(e.text) || under(e).some((k) => k.tag === 'svg' || k.tag === 'img' || EMOJI.test(k.text))) && !e.inNav);
  const loose = [...emojis, ...emojiLead.filter((e) => !emojis.includes(e))].filter((e) => !tiles.includes(e) && !tiles.some((t) => under(t).includes(e)));
  const icons = [...tiles, ...loose];
  if (icons.length >= 3) fire('T24', 'fail', icons.length, icons.map((e) => ev(e, tiles.includes(e) ? `icon tile ${Math.round(e.w)}px, radius ${e.radius}` : quote(e.text))));
  const roundable = els.filter((e) => boxed(e) && !e.inSvg && e.w < m.vw * 0.92 && e.w >= 24 && e.h >= 20 && e.tag !== 'body');
  const byRadius = new Map();
  for (const e of roundable) { const r = radiusPx(e); if (r >= 6) byRadius.set(e.radius, (byRadius.get(e.radius) || 0) + 1); }
  const topR = [...byRadius.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topR && roundable.length >= 10 && topR[1] / roundable.length >= 0.75) fire('T25', 'warn', topR[1], [{ selector: 'boxed elements', value: `${topR[1]} of ${roundable.length} share border-radius ${topR[0]}` }]);
  const pills = els.filter((e) => isPill(e) && boxed(e) && e.h >= 16 && e.h <= 72 && (e.full || e.text) && !e.inForm && (e.full || e.text).length <= 60);
  if (pills.length >= 4) fire('T33', 'warn', pills.length, pills.map((e) => ev(e, `radius ${e.radius}`, { text: (e.full || e.text).slice(0, 32) })));
  const stats = texts.filter((e) => e.size >= 30 && /^[~<>≈$£€+]?\d[\d.,]*\s?(%|x|×|\+|k|m|b|ms|s|h|★|\/\d)?\+?$/i.test(e.text) && !e.inTable && !/^0\d$/.test(e.text));
  const rowMates = stats.filter((e) => stats.some((o) => o !== e && Math.abs(o.y - e.y) < 12));
  if (rowMates.length >= 3) fire('T26', 'fail', rowMates.length, rowMates.map((e) => ev(e, `${e.size}px`)));
  // "A · B · C", "name / 01" and "WORD — fragment". One middot (a byline) only counts when it is everywhere.
  const small = texts.filter((e) => e.size <= 16 && e.text.length <= 70 && !e.inCode && !e.inTable);
  const dots = (e) => (e.text.match(/\s[·•]\s/g) || []).length;
  let chrome = small.filter((e) => dots(e) >= 2 || /\s\/\s*0\d$/.test(e.text) || /^\p{Lu}[\p{Lu}\s]{2,20}\s[—–]\s\S/u.test(e.text));
  const single = small.filter((e) => dots(e) === 1);
  if (single.length >= 5) chrome = chrome.concat(single);
  if (chrome.length >= 2) fire('T27', 'fail', chrome.length, chrome.map((e) => ev(e, quote(e.text))));
  const ARROW = /[→➔➜➝↗⟶»›↓]\s*$/u;
  const links = els.filter((e) => (e.tag === 'a' || e.tag === 'button') && e.full);
  const arrows = links.filter((e) => ARROW.test(e.full) || pseudoOf(e.i).some((p) => p.which === '::after' && /[→➔➜↗⟶»›]/u.test(p.content)) || under(e).some((k) => pseudoOf(k.i).some((p) => /^[→➔➜↗⟶]$/u.test(p.content))));
  if (arrows.length >= 3) fire('T28', 'fail', arrows.length, arrows.map((e) => ev(e, quote(e.full), { text: undefined })));

  // --- ornaments ---
  const hard = [...els.filter((e) => !e.inSvg), ...m.pseudos].flatMap((e) => shadows(e.shadow)
    .filter((s) => !s.inset && s.blur <= 1 && s.a >= 0.2 && Math.max(Math.abs(s.x), Math.abs(s.y)) >= 3 && s.spread <= 2).map((s) => ({ e, s })));
  if (hard.length) fire('T30', 'fail', hard.length, hard.map(({ e, s }) => ev(e, `box-shadow ${s.raw}`)));
  const spun = els.filter((e) => Math.abs(e.rot) >= 2 && Math.abs(e.rot) <= 30 && !e.inSvg && e.w * e.h <= area * 0.12 && e.w >= 30 && (letters(e.full || e.text) >= 2 || e.bg[3] > 0.1) && !/^(img|video|canvas|svg)$/.test(e.tag));
  if (spun.length) fire('T31', 'fail', spun.length, spun.map((e) => ev(e, `rotated ${e.rot}deg`, { text: (e.full || e.text).slice(0, 40) })));

  // --- quality floor ---
  if (probe390 && probe390.scrollWidth > 391) fire('T40', 'fail', 1, [{ selector: 'document', value: `scrollWidth ${probe390.scrollWidth} at 390 px` }, ...probe390.wide.slice(0, 4).map((w) => ({ selector: w.sel, value: `right edge ${w.right}px` }))]);

  // --- motion ---
  if (m.revealed.length >= 4) fire('T50', m.revealed.length >= 6 ? 'fail' : 'warn', m.revealed.length, m.revealed.slice(0, 5).map((sel) => ({ selector: sel, value: 'opacity 0 at load, visible after scroll' })));
  const endless = els.filter((e) => e.anim && /infinite/.test(e.animIter));
  const decorative = endless.filter((e) => (e.w <= 16 && e.h <= 16) || /marquee|scroll|ticker|pulse|blink|float|glow|bob/i.test(e.anim));
  if (decorative.length) fire('T51', 'warn', decorative.length, decorative.map((e) => ev(e, `animation ${e.anim} infinite`)));

  // --- copy ---
  const BUZZ = /\b(seamless(ly)?|effortless(ly)?|supercharge|unlock|elevate|empower|cutting-edge|next-gen(eration)?|world-class|revolutioni[sz]e|game-chang\w+|unleash|reimagin\w+|transformative|best-in-class)\b/gi;
  const buzz = [...new Map(texts.flatMap((e) => (e.text.match(BUZZ) || []).map((w) => [`${w.toLowerCase()}|${e.sel}`, { e, w }])))].map(([, v]) => v);
  if (buzz.length >= 2) fire('T60', 'warn', buzz.length, buzz.map(({ e, w }) => ev(e, quote(w))));
  const vague = links.filter((e) => /^(get started|learn more|start now|try it( free)?|discover more|explore|read more|sign up now|get started free)\s*[→›]?$/i.test(e.full));
  if (vague.length >= 2) fire('T61', 'warn', vague.length, vague.map((e) => ev(e, quote(e.full), { text: undefined })));
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
