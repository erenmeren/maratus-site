// TEMPORARY palette trial. Remove this file, css/palette-trial.css and the marked lines in the five pages. See DESIGN.md.
// Loaded in <head> without defer, so a chosen palette is there before the first paint.
(function () {
  var root = document.documentElement, KEY = 'palette-trial', here = document.currentScript.src;
  var LIST = [['current', 'Current'], ['bubblegum', 'Bubblegum'], ['hot', 'Hot pink'], ['coral', 'Coral'], ['magenta', 'Magenta'], ['punch', 'Punch'],
    ['mustard', 'Mustard'], ['signal', 'Signal'], ['parrot', 'Parrot'], ['electric', 'Electric']];
  var now = 'current', rev = 0, own = { page: '#f6b8c1', accent: null, ink: null }, made = null, sheet = null, css = function (n) { return getComputedStyle(root).getPropertyValue('--' + n).trim(); };
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, put = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  var saved = function () { var v = get(KEY); return v === 'custom' && mine() ? v : LIST.some(function (p) { return p[0] === v; }) ? v : 'current'; };

  function mine() { var o = parse(get(KEY + '-custom')); return o && !o.id ? o : null; }

  // ---- colour sums: OKLCH in, hex out (chroma is reduced until the colour exists on a screen)
  var lin = function (x) { return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }, gam = function (x) { return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
  var lim = function (x, a, b) { return Math.max(a, Math.min(b, x)); }, part = function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); };
  var join = function (a) { return '#' + a.map(function (x) { return ('0' + Math.round(lim(x, 0, 255)).toString(16)).slice(-2); }).join(''); };
  var lum = function (h) { var c = part(h).map(function (x) { return lin(x / 255); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  var ratioOf = function (a, b) { a = lum(a); b = lum(b); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  var blend = function (a, b, k) { a = part(a); b = part(b); return join(a.map(function (x, i) { return x + (b[i] - x) * k; })); };
  function lch(h) {
    var c = part(h).map(function (x) { return lin(x / 255); }), r = c[0], g = c[1], b = c[2];
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
  }
  function raw(L, C, H) {
    var a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  function hex(L, C, H) {
    L = lim(L, 0, 1);
    var fits = function (q) { return q.every(function (x) { return x > -0.0005 && x < 1.0005; }); }, c = C, q = raw(L, c, H);
    if (!fits(q)) { var lo = 0, hi = C; for (var i = 0; i < 12; i++) { c = (lo + hi) / 2; if (fits(raw(L, c, H))) lo = c; else hi = c; } q = raw(L, lo, H); }
    return join(q.map(function (x) { return 255 * gam(lim(x, 0, 1)); }));
  }
  /** Moves the lightness of `h` (up or down) until it has every contrast in `need`: [[colour, ratio], ...]. Unchanged if it has them already. */
  function fit(h, up, need) {
    var ok = function (x) { return need.every(function (n) { return ratioOf(x, n[0]) >= n[1]; }); }, c, q = h, i;
    if (ok(h)) return h;
    for (c = lch(h), i = 1; i <= 100; i++) { q = hex(c[0] + (up ? i : -i) / 100, c[1], c[2]); if (ok(q)) return q; }
    return up ? '#ffffff' : '#000000';
  }

  /** All tokens from a page colour, and optionally an accent and an ink. The steps between tokens are those of the hand-made palettes. */
  function derive(page, accent, ink) {
    var P = lch(page), grey = P[1] < 0.03, H = P[2], vivid = lim(P[1] / 0.16, 0, 1), near = function (a, b) { return Math.abs((a - b + 540) % 360 - 180); };
    var light = ink ? lum(ink) > lum(page) : ratioOf(page, '#ffffff') > ratioOf(page, '#000000');         // light text on the page?
    // dark family: wine for warm pages, the page's own hue for pink, violet, blue and green
    var dh = grey ? 14 : H >= 15 && H < 118 ? 14 : H >= 118 && H < 275 ? H + 9 : H, dc = grey ? (light ? 0.012 : 0.06) : 0.045 + 0.045 * vivid, dl = light ? 0.2 : lim(0.16 + (P[0] - 0.64) * 0.55, 0.16, 0.26);
    if (light && !grey) { dh = H; dc = Math.min(dc, P[1] + 0.02); }
    var dark = light ? hex(dl, dc, dh) : fit(hex(dl, dc, dh), false, [[page, 5.6]]);
    if (!light && ratioOf(dark, page) < 5.6) dark = fit(hex(dl, dc, dh), false, [[page, 4.6]]);
    var deep = ink && !light ? ink : dark, ref = lum(deep) < 0.06 ? deep : dark, D = lch(ref);            // `ref`: the ink the grounds are made for
    if (ink && !light && D[1] > 0.02) { dh = D[2]; dc = D[1]; }
    var ink2 = fit(hex(D[0] + 0.075, D[1] + 0.015, dh), false, light ? [] : [[page, 4.6]]);
    var ox = light ? hex(P[0] < 0.3 ? Math.max(0.21, P[0] + 0.1) : lim(P[0] - 0.13, 0.17, 0.28), lim(dc, 0, 0.1), dh) : fit(hex(D[0] + 0.07, dc + 0.02, dh), false, [['#ffffff', 11]]);
    var night = hex(light ? (P[0] < 0.22 ? 0.17 : 0.14) : Math.min(D[0] - 0.035, 0.19), dc * 0.7, dh), dk = [[ox, 4.6], [night, 4.6]], on = [[ref, 4.6], [ink2, 4.6]];
    var fg = light ? fit(hex(0.82, Math.min(P[1], 0.1), H), true, dk.concat(on)) : fit(page, true, dk);    // the page colour where it is text on the dark side
    var rose = !grey && near(H, 2) < 42 && P[1] > 0.07 && P[0] >= 0.7 ? hex(P[0] - 0.06, P[1] + 0.045, H) : hex(0.79, 0.125, 4);
    rose = fit(rose, true, on.concat([[night, 4.6]]));
    var blush = fit(P[0] > 0.93 ? hex(P[0] - 0.035, P[1] + 0.012, H) : hex(0.955, grey ? 0.004 : 0.02 + 0.035 * vivid * (near(H, 100) < 60 ? 1.5 : 0.8), H), true, on);
    var amber = !grey && H > 22 && H < 68 && P[1] > 0.09, asked = accent || (amber ? hex(0.82, 0.17, 77) : hex(0.745, 0.17, 54));
    var tang = fit(asked, true, [[ref, 4.6], [ink2, 4.5], [ox, 4.5], [night, 4.6]]), T = lch(tang), stock = T[2] > 25 && T[2] < 100 && T[1] > 0.06;
    var peach = fit(hex(Math.max(0.885, T[0] + 0.03), Math.min(0.115, T[1] * 0.68), stock ? T[2] + (90 - T[2]) * 0.6 : T[2]), true, [[ref, 7], [ink2, 4.6]]);
    var orange = fit(hex(0.58, Math.min(0.2, T[1] * 1.15), stock ? 36 : T[2]), false, [[blush, 3.1]]);
    var mark = [orange, hex(0.87, Math.min(0.16, T[1]), stock ? 87 : T[2])].sort(function (a, b) { return ratioOf(b, page) - ratioOf(a, page); })[0];
    var on1 = fit(hex(0.95, grey ? 0.008 : 0.035, H), true, [[ox, 7]]), on2 = fit(hex(0.86, grey ? 0.015 : 0.04 + 0.05 * vivid, H), true, dk), line = light ? 0.75 : 0.3;
    var top1 = light ? ink || fit(hex(0.96, grey ? 0.006 : 0.025, H), true, [[page, 4.6]]) : deep, top2 = light ? fit(hex(0.88, grey ? 0.01 : 0.05, H), true, [[page, 4.6]]) : ink2;
    return { light: light, ink: top1, accent: tang, asked: asked, ratio: ratioOf(top1, page), v: {
      pink: page, rose: rose, blush: blush, tangerine: tang, peach: peach, orange: orange, mark: mark, oxblood: ox, ink: deep, 'ink-2': ink2, 'on-ox': on1, 'on-ox-2': on2, night: night,
      'ox-hover': blend(ox, fg, 0.2), 'pick-hover': blend(ox, fg, 0.2), ghost: blend(ox, fg, 0.14), 'blush-2': blend(blush, page, light ? 0.1 : 0.2), line: blend(page, blush, line),
      'peach-2': blend(peach, tang, 0.28), 'peach-lite': blend(peach, '#ffffff', 0.45), 'peach-line': blend(peach, tang, 0.5), 'peach-wire': blend(tang, ref, 0.28),
      'night-line': blend(night, fg, 0.16), code: on1, 'code-2': fit(blend(on2, night, 0.2), true, [[night, 4.6]]), 'line-ox': blend(ox, fg, 0.3), 'pink-fg': fg, 'pick-on': fg, 'page-ink': top1, 'page-ink-2': top2 } };
  }

  // ---- codes: "maratus-palette page=#dfb004 accent=#f57a1c ink=#350611", a link with ?palette=dfb004-f57a1c-350611, or just the colours
  function clean(t) { var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(t || '').trim()); return m ? '#' + (m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]).toLowerCase() : null; }
  function parse(t) {
    t = String(t || ''); var o = {}, w = /(?:[?&]palette=|maratus-palette\s+)([a-z]+)\b(?!\s*=)/i.exec(t), m = /[?&]palette=([^&#\s]+)/i.exec(t), l;
    if (w && LIST.some(function (p) { return p[0] === w[1].toLowerCase(); })) return { id: w[1].toLowerCase() };   // one of the ten by name
    ['page', 'accent', 'ink'].forEach(function (k) { var q = new RegExp('\\b' + k + '\\s*[=:]\\s*(#?[0-9a-f]+)', 'i').exec(t); o[k] = q ? clean(q[1]) : null; });
    if (!o.page) { l = (m ? m[1] : t.trim()).replace(/%23/g, '').split(/[-,\s]+/).map(clean); if (!l[0] || l.length > 3 || l.indexOf(null) >= 0) return null; o = { page: l[0], accent: l[1] || null, ink: l[2] || null }; }
    // a value that is what the page colour gives anyway stays automatic
    if (o.accent && o.accent === derive(o.page, null, o.ink).accent) o.accent = null;
    if (o.ink && o.ink === derive(o.page, o.accent, null).ink) o.ink = null;
    if (o.accent && o.accent === derive(o.page, null, o.ink).accent) o.accent = null;
    return o;
  }
  function code() { return [own.page, made.accent, made.ink].map(function (h) { return h.slice(1); }).join('-'); }
  function text() {
    var to = location.origin + location.pathname + '?palette=', h;
    if (now !== 'custom') return 'maratus-palette ' + now + '\n' + to + now;
    h = code().split('-'); return 'maratus-palette page=#' + h[0] + ' accent=#' + h[1] + ' ink=#' + h[2] + '\n' + to + h.join('-');
  }
  function apply(o, keep) { if (!o.id) return wear(o, keep); if (keep) put(KEY, o.id); set(o.id); }
  /** Writes the custom colours into one style element, under the same attribute the palettes use. */
  function wear(o, keep) {
    own = o; made = derive(o.page, o.accent, o.ink); rev++;
    if (!sheet) { sheet = document.createElement('style'); document.head.append(sheet); }
    sheet.textContent = 'html[data-palette="custom"]{' + Object.keys(made.v).map(function (k) { return '--' + k + ':' + made.v[k]; }).join(';') + '}.pt [data-p="custom"]{--p:' + o.page + '}';
    if (keep) { put(KEY + '-custom', code()); put(KEY, 'custom'); }
    set('custom');
  }

  function set(id) {
    now = id;
    if (id === 'custom') root.setAttribute('data-page', made.light ? 'dark' : 'light'); else root.removeAttribute('data-page');
    if (id === 'current') root.removeAttribute('data-palette'); else root.setAttribute('data-palette', id);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = css('pink');
    document.querySelectorAll('.pt button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.p === id)); });
    if (panel) show();
    clearTimeout(later); if (id === 'custom') later = setTimeout(scenes, 60); else scenes();   // a dragged colour does not redraw the 3D at every step
  }

  // ---- the circles: one row in the bar, one in the small menu
  function row() {
    var g = document.createElement('div'); g.className = 'pt'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Colour palette, a trial');
    LIST.forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.p = p[0]; b.title = p[1]; b.setAttribute('aria-label', 'Palette: ' + p[1]);
      b.addEventListener('click', function () { put(KEY, p[0]); set(p[0]); });
      g.append(b);
    });
    var c = document.createElement('button'); c.type = 'button'; c.dataset.p = 'custom'; c.title = 'Your own colour'; c.setAttribute('aria-label', 'Palette: your own colour'); c.setAttribute('aria-haspopup', 'dialog'); c.setAttribute('aria-expanded', 'false');
    c.addEventListener('click', function () { if (panel && panel.open && from === c) shut(true); else open(c, g); });
    g.append(c);
    return g;
  }
  document.addEventListener('DOMContentLoaded', function () {
    var top = document.querySelector('.top'), btn = document.querySelector('.top-btn'), small = document.querySelector('.menu nav');
    if (top && btn) top.insertBefore(row(), btn);
    if (small) small.prepend(row());
    set(now);
  });

  // ---- the panel: one element, put under the row it was opened from
  var panel = null, from = null, later = 0, $ = function (q) { return panel.querySelector(q); };
  function build() {
    panel = document.createElement('dialog'); panel.className = 'pt-panel'; panel.setAttribute('aria-labelledby', 'pt-title');
    var field = function (k, name) { return '<div class="pt-f"><label for="pt-' + k + '">' + name + '</label><input type="color" id="pt-' + k + '-c" data-k="' + k + '" aria-label="' + name + ', colour picker"><input type="text" id="pt-' + k + '" data-k="' + k + '" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off">' + (k === 'page' ? '' : '<button type="button" class="pt-auto" data-auto="' + k + '">Automatic</button>') + '</div>'; };
    panel.innerHTML = '<div class="pt-head"><strong id="pt-title">Your own colour</strong><button type="button" class="pt-x">Close</button></div>' + field('page', 'Page colour') + field('accent', 'Accent') + field('ink', 'Ink') +
      '<div class="pt-strip" aria-hidden="true">' + ['page', 'blush', 'rose', 'tangerine', 'peach', 'oxblood', 'ink'].map(function (k) { return '<i data-s="' + k + '"></i>'; }).join('') + '</div><p class="pt-ratio" role="status"></p><p class="pt-note"></p>' +
      '<label for="pt-out">Code to send</label><textarea id="pt-out" rows="3" readonly spellcheck="false"></textarea><div class="pt-act"><button type="button" class="pt-copy">Copy code</button><button type="button" class="pt-reset">Reset to Current</button></div><p class="pt-said" role="status"></p>' +
      '<label for="pt-in">Paste code</label><input type="text" id="pt-in" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="pt-bad"><p class="pt-bad" id="pt-bad" role="status"></p>';
    var change = function (k, v) { var o = { page: own.page, accent: own.accent, ink: own.ink }; o[k] = v; wear(o, true); };
    panel.addEventListener('input', function (e) {
      var k = e.target.dataset.k, v;
      if (k) { v = clean(e.target.value); e.target.setAttribute('aria-invalid', String(!v)); if (v) change(k, v); }
      if (e.target.id === 'pt-in') { v = parse(e.target.value); $('.pt-bad').textContent = v ? 'Applied' : e.target.value.trim() ? 'This is not a palette code or link yet' : ''; if (v) apply(v, true); }
    });
    panel.addEventListener('focusout', function (e) { if (e.target.dataset.k) { e.target.removeAttribute('aria-invalid'); setTimeout(show); } });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.auto) { change(b.dataset.auto, null); $('#pt-' + b.dataset.auto).focus(); }
      else if (b.className === 'pt-x') shut(true);
      else if (b.className === 'pt-copy') copy();
      else if (b.className === 'pt-reset') { put(KEY, 'current'); put(KEY + '-custom', ''); $('#pt-in').value = $('.pt-bad').textContent = ''; set('current'); say('Back to Current'); }
    });
    $('#pt-out').addEventListener('focus', function () { this.select(); });
  }
  function say(t) { var p = $('.pt-said'); p.textContent = t; clearTimeout(say.t); say.t = setTimeout(function () { p.textContent = ''; }, 4000); }
  /** Panel and colours agree; the field being typed in is left alone. */
  function show() {
    if (now !== 'custom') own = { page: css('pink'), accent: null, ink: null };   // one of the ten: its own values, until something is changed
    var d = now === 'custom' ? made : { accent: css('tangerine'), ink: css('ink'), ratio: ratioOf(css('pink'), css('ink')), v: { blush: css('blush'), rose: css('rose'), tangerine: css('tangerine'), peach: css('peach'), oxblood: css('oxblood') } }, v = { page: own.page, accent: own.accent || d.accent, ink: d.ink }, pass = d.ratio >= 4.5;
    ['page', 'accent', 'ink'].forEach(function (k) {
      $('#pt-' + k + '-c').value = v[k]; if (document.activeElement !== $('#pt-' + k)) $('#pt-' + k).value = v[k];
      var b = $('[data-auto=' + k + ']'); if (b) b.hidden = !own[k] || now !== 'custom';
    });
    panel.querySelectorAll('.pt-strip i').forEach(function (i) { i.style.background = i.dataset.s === 'page' ? own.page : i.dataset.s === 'ink' ? d.ink : d.v[i.dataset.s]; });
    $('.pt-ratio').dataset.pass = pass; $('.pt-ratio').textContent = 'Text on the page ' + (Math.floor(d.ratio * 100) / 100).toFixed(2) + ':1' + (pass ? ', passes AA' : ', below AA (4.5:1)');
    $('.pt-note').textContent = own.accent && own.accent !== d.accent ? 'Accent lightened to ' + d.accent + ' so dark text on it stays readable.' : '';
    $('#pt-out').value = text();
  }
  function copy() {
    var t = text(), hand = function () { var a = $('#pt-out'), ok = false; a.focus(); a.select(); try { ok = document.execCommand('copy'); } catch (e) { /* blocked */ } say(ok ? 'Copied' : 'Copying is blocked here. The code is selected: copy it with Ctrl or Cmd + C.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { say('Copied'); }, hand); else hand();
  }
  function open(b, g) {
    if (!panel) build();
    if (panel.open) shut(false);
    from = b; g.after(panel); panel.show(); b.setAttribute('aria-expanded', 'true');
    if (now !== 'custom' && mine()) wear(mine(), true); else show();
    $('#pt-page-c').focus({ preventScroll: true });
  }
  function shut(back) { if (!panel || !panel.open) return; panel.close(); from.setAttribute('aria-expanded', 'false'); if (back) from.focus(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel && panel.open) { e.stopImmediatePropagation(); e.preventDefault(); shut(true); } }, true);
  document.addEventListener('toggle', function (e) { if (panel && panel.open && e.target.matches('.menu') && e.target.open !== e.target.contains(panel)) shut(false); }, true);
  addEventListener('resize', function () { if (panel && panel.open && !from.offsetParent) shut(false); });

  // ---- the 3D: light bounced up from the ground, and the colours the device's screens are drawn with
  var MAP = { pink: 'pink', rose: 'rose', ox: 'oxblood', deep: 'ink', blush: 'blush', orange: 'orange', tang: 'tangerine' }, GROUNDS = ['pink', 'rose', 'oxblood', 'blush', 'tangerine', 'peach'];
  var screens = null, first = null, was = null, ratio = null, timer = 0;
  var rgb = function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); };
  function stages() {
    var h = window.__maratus, t = window.__maratusTech, v = window.__maratusDev, k = window.__maratusDocks;
    return [h && h.stage, t && t.stage, v && v.stage].concat(k ? k.views.map(function (q) { return q.st; }) : []).filter(Boolean);
  }
  /** The poses carry the light of today's grounds; each is moved by how far its nearest grounds have moved. */
  function bounce(c) {
    var sum = [0, 0, 0], all = 0;
    ratio.forEach(function (q) { var w = 1 / (0.002 + Math.pow(q.old[0] - c[0], 2) + Math.pow(q.old[1] - c[1], 2) + Math.pow(q.old[2] - c[2], 2)); all += w; for (var i = 0; i < 3; i++) sum[i] += w * q.k[i]; });
    return c.map(function (x, i) { return Math.min(1, x * sum[i] / all); });
  }
  function grounds() {   // today's values are read once, with the palette taken off
    if (!was) { root.removeAttribute('data-palette'); was = GROUNDS.map(function (n) { return rgb(css(n)); }); if (now !== 'current') root.setAttribute('data-palette', now); }
    ratio = now === 'current' ? null : GROUNDS.map(function (n, i) { var b = rgb(css(n)); return { old: was[i], k: b.map(function (x, j) { return x / was[i][j]; }) }; });
  }
  function dress(st) {
    var stamp = now === 'custom' ? now + rev : now;
    if (st.__pt === stamp) return false;
    if (!st.__pt) {
      if (now === 'current') return false;
      var g = st.hemi.groundColor, own = g.setRGB;
      g.setRGB = function (r, gr, b) { return own.apply(this, ratio ? bounce([r, gr, b]) : [r, gr, b]); };
    }
    st.__pt = stamp; st.paint(); st.dirty = true; return true;
  }
  function scenes() {
    if (!screens && now === 'current') return;
    if (!root.classList.contains('live')) return;
    grounds();
    if (!screens) { screens = import(new URL('screens.js', here).href).then(function (m) { first = Object.assign({}, m.INK); return m.INK; }).catch(function () { return null; }); }
    screens.then(function (INK) {
      if (!INK) return;
      for (var n in MAP) INK[n] = now === 'current' ? first[n] : now === 'custom' && n === 'pink' ? css('pink-fg') : css(MAP[n]);
      var tick = function () { if (stages().map(dress).some(Boolean)) document.dispatchEvent(new Event('visibilitychange')); };   // every page draws again on this
      tick(); if (!timer) timer = setInterval(tick, 120);   // models arrive later, on the Docks page one by one
    });
  }

  /** The stored choice; a custom one is made again from its three colours. */
  function start() { var id = saved(); if (id === 'custom') wear(mine()); else set(id); }
  addEventListener('pageshow', function (e) { if (e.persisted && (saved() !== now || now === 'custom')) start(); });
  // a shared link: its colours are put on and remembered, then the address is cleaned so that a reload keeps later changes
  var link = /[?&]palette=/.test(location.search) && parse(location.search);
  if (link) {
    apply(link, true);
    var u = new URL(location.href); u.searchParams.delete('palette'); try { history.replaceState(history.state, '', u); } catch (e) { /* file: */ }
  } else start();
  window.__paletteTrial = { derive: derive, parse: parse, contrast: ratioOf };
})();
