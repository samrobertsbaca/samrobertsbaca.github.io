// world of scorsby
// a planet with ears and a face. everyone on it is a scorsby.
(() => {
  'use strict';

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const params = new URLSearchParams(location.search);
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  // ------------------------------------------------------------------ colors of a scorsby
  const COLORS = [
    ['blue', '#00b4ff'], ['pink', '#ff5fae'], ['green', '#62d64a'], ['orange', '#ff9a3c'], ['purple', '#9b6bff'],
    ['yellow', '#ffd23f'], ['red', '#ff4a4a'], ['ghost', '#f4efe6'], ['rainbow', null],
  ];
  // the colors a unison omen can turn everyone
  const UNISON = [['red', '#ff4a4a'], ['pink', '#ff5fae'], ['orange', '#ff9a3c'], ['yellow', '#ffd23f'], ['green', '#62d64a'], ['blue', '#00b4ff'],
    ['purple', '#9b6bff'], ['gold', '#f2b705'], ['turquoise', '#21d4c6'], ['lavender', '#c3a6ff'], ['mint', '#8ff0b5'], ['coral', '#ff7f6b'],
    ['magenta', '#e83ad8'], ['lime', '#b6f03a'], ['peach', '#ffb38a'], ['sky blue', '#7fd2ff'], ['indigo', '#5b4cff'], ['bubblegum', '#ff9ad5'],
    ['tangerine', '#ff7a1a'], ['ghost', '#f4efe6']];
  const unisonColor = (seed) => UNISON[Math.floor(seed) % UNISON.length];
  const colorOf = (i, now, seed = 0) => typeof i === 'string' ? i : COLORS[i]?.[1] || `hsl(${(now / 12 + seed * 57) % 360},90%,62%)`;
  // red on red disappears, so a reddish scorsby wears a blue nose
  function reddish(col) {
    const [r, g, b] = rgbOf(col).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.25 || l < 0.2 || l > 0.85) return false;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return h < 22 || h > 312;
  }
  function rgbOf(col) {
    if (col[0] === '#') return [1, 3, 5].map((k) => parseInt(col.slice(k, k + 2), 16));
    const rgb = col.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
    const m = col.match(/hsl\(([\d.]+),([\d.]+)%,([\d.]+)%/);
    if (!m) return [128, 128, 128];
    const h = +m[1] / 360, sat = +m[2] / 100, l = +m[3] / 100;
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
  }
  const mixColor = (a, b, t = 0.5) => { const x = rgbOf(a), y = rgbOf(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',')})`; };
  function parseColor(v) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : clamp(parseInt(v, 10) || 0, 0, 8); }
  const RAINBOW = ['#ff4a6e', '#ff9a3c', '#ffd23f', '#62d64a', '#00b4ff', '#6b7bff', '#b06bff'];

  // ------------------------------------------------------------------ paper and ink
  const THEMES = {
    day: { paper: '#ffffff', ink: [29, 26, 94], wash: 'multiply', washA: 0.22, ocean: '#00b4ff', hatchA: 0.42 },
    night: { paper: '#3e3478', ink: [255, 255, 255], wash: 'screen', washA: 0.16, ocean: '#0aa6ec', hatchA: 0.3 },
  };
  let T = THEMES.day;
  const DARK = '#05060a'; // the bold outline of the scorsby logo
  const ink = (a = 1) => `rgba(${T.ink[0]},${T.ink[1]},${T.ink[2]},${a})`;
  // the little characters in the sky: ink by day, black by night (with light pupils so their eyes still show)
  const charInk = (a = 1) => T === THEMES.night ? `rgba(5,6,10,${a})` : ink(a);
  const pupil = () => T === THEMES.night ? ink(1) : DARK;
  // a pupil: a solid dot by day; at night a black ring you can see through
  const pupilDot = () => {
    if (T === THEMES.night) { c.strokeStyle = DARK; c.stroke(); }
    else { c.fillStyle = DARK; c.fill(); }
  };
  function setTheme(want = params.get('theme') || store.get('scorsby-theme') || 'day') {
    if (!THEMES[want]) want = 'day';
    T = THEMES[want]; document.body.dataset.theme = want; makeHatch();
  }

  // ------------------------------------------------------------------ canvas
  const cv = document.getElementById('sky');
  let c = cv.getContext('2d'); // let: the plant icons borrow the same drawing code for a moment
  let VW = 0, VH = 0, DPR = 1, baseR = 100, R = 100, L = 1, CX = 0, CY = 0, small = false;
  const zoom = { v: 1, target: 1, aim: null };

  // waking up: at first there is only the sleeping world and the welcome. then it wakes, and everything else arrives.
  // a tap or a key skips ahead. ?nointro skips it entirely.
  const T0 = performance.now(), INTRO = params.has('nointro') ? 0 : 1;
  const intro = { wake: T0 + 4600 * INTRO, faces: T0 + 4900 * INTRO, ui: T0 + 5200 * INTRO, sky: T0 + 5800 * INTRO, woke: !INTRO, shown: !INTRO };
  function hurryIntro() {
    const now = performance.now(), d = intro.wake - now - 250;
    if (d <= 0) return;
    for (const k of ['wake', 'faces', 'ui', 'sky']) intro[k] -= d;
  }
  // the sleeping world breathes; on waking it takes a little bounce
  function introScale(now) {
    if (!INTRO) return 1;
    const grow = clamp((now - T0) / 1600, 0, 1), arrive = 0.86 + 0.14 * (1 - (1 - grow) ** 3);
    if (now < intro.wake) return arrive * (1 + 0.012 * Math.sin((now - T0) / 650));
    const k = (now - intro.wake) / 900;
    return k > 1 ? 1 : 1 + 0.05 * Math.sin(k * Math.PI) * (1 - k);
  }
  const awake = (now) => clamp((now - intro.wake) / 1200, 0, 1); // 0 asleep, 1 fully awake
  // when a scorsby appears: after the world wakes, you first, then everyone else a few at a time
  const arrivedAt = (s) => Math.max(s.born, intro.faces + (s.mine ? 0 : 300 + hash(s.seed) * 1600));

  const scratch = document.createElement('canvas'), sx2 = scratch.getContext('2d');
  const mask = document.createElement('canvas'), mx2 = mask.getContext('2d');
  let maskImg = null, MW = 0, MH = 0, hatch = null;

  function makeHatch() {
    const t = document.createElement('canvas'); t.width = t.height = 48;
    const h = t.getContext('2d');
    h.strokeStyle = `rgba(10,20,70,${T.hatchA})`; h.lineWidth = 1.1; h.lineCap = 'round';
    for (let k = -48; k <= 96; k += 7) {
      h.beginPath();
      for (let x = 0; x <= 48; x += 6) {
        const y = x + k + (hash(k * 13 + x) - 0.5) * 0.9;
        if (x === 0) h.moveTo(x, y); else h.lineTo(x, y);
      }
      h.stroke();
    }
    hatch = sx2.createPattern(t, 'repeat');
  }

  // the whisper sits just under the header, however tall the header grows (fonts, wrapping)
  const topBar = document.getElementById('top');
  const underTop = () => {
    // the whisper sits up between the title and the corner, narrowing to fit the gap if it has to.
    // only when even a narrow whisper won't fit (phones) does it drop below the whole header.
    const vw = innerWidth, root = document.documentElement.style;
    const pres = document.getElementById('presence')?.getBoundingClientRect();
    const left = topBar.firstElementChild?.getBoundingClientRect();
    const room = pres && left ? 2 * Math.min(vw / 2 - left.right, pres.left - vw / 2) - 24 : 0;
    if (room >= 320) {
      root.setProperty('--whisper-w', `${Math.round(Math.min(600, room))}px`);
      root.setProperty('--under-top', `${Math.round(Math.max(76, left.bottom - 20))}px`);
    } else {
      root.removeProperty('--whisper-w');
      root.setProperty('--under-top', `${Math.round(topBar.getBoundingClientRect().bottom + 10)}px`);
    }
    fitPlanet();
  };
  if (topBar) { underTop(); if (window.ResizeObserver) new ResizeObserver(underTop).observe(topBar); }

  // the planet is as big as the screen allows, but its ears stay clear of the whisper's first lines
  function fitPlanet() {
    if (!VW || !VH) return;
    baseR = Math.min(VW * (small ? 0.3 : 0.24), VH * 0.25);
    const wh = document.getElementById('whisper');
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--under-top')) || 76;
    const fs = wh ? parseFloat(getComputedStyle(wh).fontSize) || 20 : 20;
    const room = (CY - (top + fs * 1.3 * 2.4 + 8)) / 1.5; // ears reach about one and a half radii above the middle
    if (room > 60) baseR = Math.min(baseR, room);
  }
  function resize() {
    VW = innerWidth || document.documentElement.clientWidth;
    VH = innerHeight || document.documentElement.clientHeight;
    if (!VW || !VH) { setTimeout(resize, 200); return; }
    DPR = Math.min(devicePixelRatio || 1, 2);
    cv.width = scratch.width = VW * DPR; cv.height = scratch.height = VH * DPR;
    c.setTransform(DPR, 0, 0, DPR, 0, 0); sx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    small = VW < 600;
    CX = VW / 2; CY = VH * (small ? 0.5 : 0.53);
    fitPlanet();
    MW = Math.ceil(VW / 6); MH = Math.ceil(VH / 6);
    mask.width = MW; mask.height = MH; maskImg = mx2.createImageData(MW, MH);
    makeHatch();
  }

  // ------------------------------------------------------------------ the planet
  const LAND = window.LAND || [];
  const NL = LAND.length / 2;
  const LX = new Float32Array(NL), LY = new Float32Array(NL), LZ = new Float32Array(NL);
  for (let i = 0; i < NL; i++) {
    const la = LAND[i * 2] * D2R, lo = LAND[i * 2 + 1] * D2R;
    LX[i] = Math.cos(la) * Math.cos(lo); LY[i] = Math.cos(la) * Math.sin(lo); LZ[i] = Math.sin(la);
  }
  const SPACING = Math.sqrt((4 * Math.PI) / 26000);
  const vec = (lat, lon) => {
    const la = lat * D2R, lo = lon * D2R;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const angle = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  const view = { lon: -40, lat: 18, vlon: 0, auto: true, idleAt: 0 };
  let cl0, sl0, cp0, sp0;
  function setView() {
    cl0 = Math.cos(view.lon * D2R); sl0 = Math.sin(view.lon * D2R);
    cp0 = Math.cos(view.lat * D2R); sp0 = Math.sin(view.lat * D2R);
  }
  function project(x, y, z, s = 1) {
    const sx = y * cl0 - x * sl0;
    const cc = x * cl0 + y * sl0;
    const sy = cp0 * z - sp0 * cc;
    const sz = sp0 * z + cp0 * cc;
    return [CX + sx * R * s, CY - sy * R * s, sz];
  }
  function viewOf(v) {
    const cc = v[0] * cl0 + v[1] * sl0;
    return [v[1] * cl0 - v[0] * sl0, cp0 * v[2] - sp0 * cc, sp0 * v[2] + cp0 * cc];
  }
  function unproject(px, py) {
    const x = (px - CX) / R, y = (CY - py) / R;
    const rho = Math.hypot(x, y);
    if (rho > 1) return null;
    const cc = Math.asin(rho), sc = Math.sin(cc), ccos = Math.cos(cc);
    const lat = rho ? Math.asin(ccos * sp0 + (y * sc * cp0) / rho) : view.lat * D2R;
    const lon = view.lon * D2R + Math.atan2(x * sc, rho * ccos * cp0 - y * sc * sp0);
    return [lat / D2R, ((lon / D2R + 540) % 360) - 180];
  }

  function sun(now = new Date()) {
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const doy = (now - start) / 86400000;
    const decl = -23.44 * Math.cos((TAU / 365) * (doy + 10));
    const hours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    return vec(decl, -15 * (hours - 12));
  }
  // where the moon is overhead right now (a low-precision lunar position, good to a degree or so)
  function moonVec(t = Date.now()) {
    const d = t / 86400000 - 10957.5;
    const M = (134.963 + 13.064993 * d) * D2R, F = (93.272 + 13.229350 * d) * D2R;
    const lam = (218.316 + 13.176396 * d + 6.289 * Math.sin(M)) * D2R, bet = 5.128 * Math.sin(F) * D2R, eps = 23.4397 * D2R;
    const ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps), Math.cos(lam));
    const dec = Math.asin(Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam));
    const gmst = 280.16 + 360.9856235 * d;
    return vec(dec / D2R, ((((ra / D2R - gmst) % 360) + 540) % 360) - 180);
  }
  let SUN = sun(), MOON = moonVec();
  setInterval(() => { SUN = sun(); MOON = moonVec(); }, 30000);
  const light = (v) => dot(v, SUN);

  // ------------------------------------------------------------------ hand-drawn lines
  let boil = 0; // the line redraws itself a few times a second, like animation drawn by hand
  function wobbleCircle(x, y, r, seed, amp = 1.1, over = 0.3) {
    const n = clamp((r * 0.7) | 0, 12, 72);
    const a0 = hash(seed) * TAU;
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + t * (TAU + over);
      const rr = r + (hash(seed + i * 3.17 + boil * 9.1) - 0.5) * 2 * amp - (over > 0.2 && t > 0.92 ? (t - 0.92) * r * 0.25 : 0);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
  }
  function wobbleLine(x1, y1, x2, y2, seed, amp = 0.9) {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, (len / 10) | 0);
    const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
    c.moveTo(x1, y1);
    for (let i = 1; i <= n; i++) {
      const t = i / n, j = i < n ? (hash(seed + i * 5.3 + boil * 7.7) - 0.5) * 2 * amp : 0;
      c.lineTo(x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j);
    }
  }
  function heartPath(x, y, r) {
    c.beginPath();
    c.moveTo(x, y + r * 0.9);
    c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.25, x, y - r * 0.45);
    c.bezierCurveTo(x + r * 0.7, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  }
  function lipsPath(x, y, w) {
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 0.5, y - w * 0.55, x, y - w * 0.16);
    c.quadraticCurveTo(x + w * 0.5, y - w * 0.55, x + w, y);
    c.quadraticCurveTo(x, y + w * 0.78, x - w, y);
  }
  // a wing: white feathers fanned out and layered, back to front
  function wing(x, y, s, side, flap) {
    // outline every feather thickly first, then fill them all, so only the outside edge shows
    const feathers = [[-1.05, 0.95], [-0.72, 0.86], [-0.4, 0.74], [-0.08, 0.6]].map(([a0, len]) => () => {
      const a = a0 - flap, dx = Math.cos(a) * side, dy = Math.sin(a);
      const L2 = s * len, W2 = s * 0.17;
      c.save(); c.translate(x + dx * L2 * 0.5, y + dy * L2 * 0.5); c.rotate(Math.atan2(dy, dx));
      c.beginPath(); c.ellipse(0, 0, L2 * 0.5, W2, 0, 0, TAU); c.restore();
    });
    const lw = c.lineWidth;
    c.lineWidth = lw * 2;
    for (const f of feathers) { f(); c.stroke(); }
    c.lineWidth = lw; c.fillStyle = T.paper;
    for (const f of feathers) { f(); c.fill(); }
  }

  // a cabinet of small drawings, in ink
  function doodle(kind, x, y, s, seed, now, lw = 1.3, extra = 0) {
    c.save();
    c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = charInk(0.95); c.fillStyle = charInk(0.95);
    switch (kind) {
      case 'angel': {
        // a winged eye with a halo. be not afraid.
        const flap = Math.sin(now / 170 + seed) * 0.3;
        wing(x - s * 0.24, y + s * 0.02, s * 0.62, -1, flap);
        wing(x + s * 0.24, y + s * 0.02, s * 0.62, 1, flap);
        wobbleCircle(x, y, s * 0.3, seed, 0.6, 0.15); c.fillStyle = T.paper; c.fill(); c.stroke();
        const lx = clamp((CX - x) / 400, -1, 1), ly = clamp((CY - y) / 400, -1, 1);
        c.beginPath(); c.arc(x + lx * s * 0.1, y + ly * s * 0.1, s * 0.13, 0, TAU); pupilDot();
        const hy = y - s * 0.5 + Math.sin(now / 700 + seed) * s * 0.04;
        c.beginPath(); c.ellipse(x, hy, s * 0.28, s * 0.075, 0, 0, TAU);
        c.strokeStyle = charInk(0.95); c.lineWidth = lw * 1.1; c.stroke();
        break;
      }
      case 'lips': {
        const pucker = 1 + 0.12 * Math.sin(now / 500 + seed);
        lipsPath(x, y, s * 0.4 * pucker); c.fillStyle = '#e8336b'; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(x - s * 0.4 * pucker, y); c.quadraticCurveTo(x, y + s * 0.06, x + s * 0.4 * pucker, y); c.stroke();
        break;
      }
      case 'spring': {
        const len = s * (1.1 + 0.25 * Math.sin(now / 420 + seed));
        const base = y + s * 0.8;
        c.beginPath();
        for (let i = 0; i <= 70; i++) {
          const t = i / 70, a = t * 7 * TAU;
          const px = x + Math.cos(a) * s * 0.12, py = base - t * len + Math.sin(a) * s * 0.05;
          i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.stroke();
        c.restore();
        doodle('head', x, base - len - s * 0.2, s * 0.75, seed, now, lw);
        return;
      }
      case 'bell': {
        // a plain golden bell. tap it and it swings and rings.
        const ring = extra ? now - extra : 1e9;
        const swing = ring < 2600 ? Math.sin(ring / 90) * Math.exp(-ring / 900) * 0.6 : Math.sin(now / 1500 + seed) * 0.06;
        const top = y - s * 0.5;
        c.translate(x, top); c.rotate(swing); c.translate(-x, -top);
        c.beginPath(); c.arc(x, top - s * 0.05, s * 0.06, 0, TAU); c.stroke();
        c.beginPath();
        c.moveTo(x - s * 0.1, top + s * 0.02);
        c.quadraticCurveTo(x - s * 0.32, top + s * 0.06, x - s * 0.32, y + s * 0.1);
        c.quadraticCurveTo(x - s * 0.34, y + s * 0.27, x - s * 0.46, y + s * 0.34);
        c.lineTo(x + s * 0.46, y + s * 0.34);
        c.quadraticCurveTo(x + s * 0.34, y + s * 0.27, x + s * 0.32, y + s * 0.1);
        c.quadraticCurveTo(x + s * 0.32, top + s * 0.06, x + s * 0.1, top + s * 0.02);
        c.closePath();
        c.fillStyle = '#ffd23f'; c.fill(); c.stroke();
        const cl = ring < 2600 ? Math.sin(ring / 90 - 1.2) * Math.exp(-ring / 900) * s * 0.14 : 0;
        c.beginPath(); c.arc(x + cl, y + s * 0.42, s * 0.07, 0, TAU); c.fillStyle = charInk(); c.fill();
        break;
      }
      case 'umbrella': {
        c.translate(x, y); c.rotate(Math.sin(now / 900 + seed) * 0.12); c.translate(-x, -y);
        const cy = y - s * 0.3, r = s * 0.48;
        c.beginPath(); c.moveTo(x - r, cy); c.arc(x, cy, r, Math.PI, 0);
        for (let k = 0; k < 4; k++) { const x0 = x + r - k * r / 2; c.quadraticCurveTo(x0 - r / 4, cy - r * 0.16, x0 - r / 2, cy); }
        c.fillStyle = T.paper; c.fill(); c.stroke();
        c.beginPath();
        for (let k = 1; k < 4; k++) { c.moveTo(x, cy - r); c.lineTo(x - r + k * r / 2, cy); }
        c.moveTo(x, cy - r); c.lineTo(x, cy - r - s * 0.06);
        c.moveTo(x, cy); c.lineTo(x, y + s * 0.3); c.arc(x + s * 0.06, y + s * 0.3, s * 0.06, Math.PI, 0, true);
        c.stroke();
        const fx = x + s * 0.24, fy = y + s * 0.18;
        c.beginPath(); c.arc(fx - s * 0.06, fy - s * 0.1, s * 0.035, 0, TAU); c.moveTo(fx + s * 0.095, fy - s * 0.1); c.arc(fx + s * 0.06, fy - s * 0.1, s * 0.035, 0, TAU);
        c.moveTo(fx + s * 0.08, fy - s * 0.02); c.arc(fx, fy - s * 0.02, s * 0.08, 0, TAU); c.fillStyle = T.paper; c.fill(); c.stroke();
        c.beginPath(); c.arc(fx, fy - s * 0.02, s * 0.025, 0, TAU); c.fillStyle = charInk(); c.fill();
        c.beginPath(); c.rect(fx - s * 0.06, fy + s * 0.06, s * 0.12, s * 0.2); c.moveTo(fx - s * 0.03, fy + s * 0.26); c.lineTo(fx - s * 0.03, fy + s * 0.4); c.moveTo(fx + s * 0.03, fy + s * 0.26); c.lineTo(fx + s * 0.03, fy + s * 0.4);
        c.moveTo(fx - s * 0.06, fy + s * 0.1); c.lineTo(x + s * 0.02, y + s * 0.12);
        c.stroke();
        break;
      }
      case 'sun': {
        // a little sunbean: a round sunny face with short wiggly rays, long and short in turn
        const spin = now / 4000 + seed;
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU + spin, r1 = s * 0.27, r2 = s * (k % 2 ? 0.36 : 0.44);
          const mx = (r1 + r2) / 2, bend = s * 0.03 * (k % 2 ? 1 : -1);
          c.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
          c.quadraticCurveTo(x + Math.cos(a) * mx - Math.sin(a) * bend, y + Math.sin(a) * mx + Math.cos(a) * bend, x + Math.cos(a) * r2, y + Math.sin(a) * r2);
        }
        c.strokeStyle = '#ff9a28'; c.lineWidth = lw * 1.4; c.stroke(); c.lineWidth = lw;
        wobbleCircle(x, y, s * 0.22, seed, 0.5); c.fillStyle = '#ffd23f'; c.fill(); c.strokeStyle = charInk(0.95); c.stroke();
        c.fillStyle = charInk();
        for (const sd of [-1, 1]) { c.beginPath(); c.arc(x + sd * s * 0.07, y - s * 0.04, s * 0.025, 0, TAU); c.fill(); }
        c.beginPath(); c.arc(x, y + s * 0.02, s * 0.09, 0.4, Math.PI - 0.4); c.stroke();
        break;
      }
      case 'globe': {
        c.beginPath(); wobbleLine(x, y + s * 0.4, x + Math.sin(seed) * s * 0.2, y + s * 1.1, seed, 0.6); c.stroke();
        c.beginPath(); c.arc(x + Math.sin(seed) * s * 0.2, y + s * 1.18, s * 0.08, 0, TAU); c.stroke();
        wobbleCircle(x, y, s * 0.4, seed); c.fillStyle = T.paper; c.fill(); c.stroke();
        c.save(); c.clip();
        wobbleCircle(x - s * 0.12 + Math.sin(now / 2000 + seed) * s * 0.3, y + s * 0.05, s * 0.18, seed + 4, 1.5);
        c.fillStyle = charInk(); c.fill(); c.restore();
        break;
      }
      case 'heart': heartPath(x, y, s * 0.32); c.fillStyle = '#ff5fae'; c.fill(); c.stroke(); break;
      case 'star': {
        c.beginPath();
        for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI + seed; wobbleLine(x - Math.cos(a) * s * 0.35, y - Math.sin(a) * s * 0.35, x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35, seed + k, 0.4); }
        c.stroke(); break;
      }
      case 'head':
      case 'head3': {
        wobbleCircle(x - s * 0.28, y - s * 0.3, s * 0.15, seed + 1, 0.5); c.fillStyle = T.paper; c.fill(); c.stroke();
        wobbleCircle(x + s * 0.28, y - s * 0.3, s * 0.15, seed + 2, 0.5); c.fill(); c.stroke();
        wobbleCircle(x, y, s * 0.4, seed, 0.7); c.fill(); c.stroke();
        const eyes = kind === 'head3' ? [[-0.15, 0.02], [0.15, 0.02], [0, -0.2]] : [[-0.14, -0.04], [0.14, -0.04]];
        for (const [ex, ey] of eyes) {
          c.beginPath(); c.arc(x + ex * s, y + ey * s, s * 0.085, 0, TAU); c.stroke();
          c.beginPath(); c.arc(x + ex * s + s * 0.015, y + ey * s, s * 0.035, 0, TAU); c.fillStyle = charInk(); c.fill();
        }
        c.beginPath(); c.arc(x, y + s * 0.1, s * 0.04, 0, TAU); c.fillStyle = charInk(); c.fill();
        c.beginPath(); c.arc(x, y + s * 0.1, s * 0.16, 0.35, Math.PI - 0.35); c.stroke();
        break;
      }
      case 'eye': {
        c.beginPath(); c.moveTo(x - s * 0.5, y); c.quadraticCurveTo(x, y - s * 0.45, x + s * 0.5, y); c.quadraticCurveTo(x, y + s * 0.45, x - s * 0.5, y);
        c.fillStyle = '#ffffff'; c.fill(); c.stroke(); // white, with a black pupil
        c.beginPath(); c.arc(x + Math.sin(now / 1500 + seed) * s * 0.12, y, s * 0.13, 0, TAU); c.fillStyle = DARK; c.fill();
        break;
      }
      case 'cactus': {
        // a symmetrical cactus, doing a little shimmy
        const shim = Math.sin(now / 240 + seed) * 0.14, wave = Math.sin(now / 160 + seed) * s * 0.05;
        c.translate(x, y + s * 0.5); c.rotate(shim); c.translate(-x, -(y + s * 0.5));
        c.beginPath();
        c.moveTo(x, y + s * 0.5); c.lineTo(x, y - s * 0.45);
        for (const sd of [-1, 1]) { c.moveTo(x, y); c.quadraticCurveTo(x + sd * s * 0.3, y, x + sd * s * 0.29, y - s * 0.3 + sd * wave); }
        c.strokeStyle = '#2f8a3a'; c.lineWidth = lw * 2.6; c.stroke(); break;
      }
      case 'tree': {
        c.beginPath(); wobbleLine(x, y + s * 0.5, x, y, seed, 0.3); c.stroke();
        wobbleCircle(x, y - s * 0.15, s * 0.28, seed, 0.7); c.fillStyle = '#7fd36b'; c.fill(); c.stroke();
        // and it smiles
        c.fillStyle = charInk();
        for (const sd of [-1, 1]) { c.beginPath(); c.arc(x + sd * s * 0.09, y - s * 0.2, s * 0.03, 0, TAU); c.fill(); }
        c.beginPath(); c.arc(x, y - s * 0.15, s * 0.025, 0, TAU); c.fill();
        c.beginPath(); c.arc(x, y - s * 0.15, s * 0.13, 0.5, Math.PI - 0.5); c.stroke();
        break;
      }
      case 'house': {
        // scorsby blue, with a red roof
        c.beginPath(); c.rect(x - s * 0.28, y - s * 0.05, s * 0.56, s * 0.45); c.fillStyle = '#00b4ff'; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(x - s * 0.36, y - s * 0.02); c.lineTo(x, y - s * 0.4); c.lineTo(x + s * 0.36, y - s * 0.02); c.closePath();
        c.fillStyle = '#ed1c24'; c.fill(); c.stroke();
        c.beginPath(); c.rect(x - s * 0.06, y + s * 0.18, s * 0.12, s * 0.22); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
        break;
      }
      case 'scorsby': {
        // the planted scorsby face: blue like scorsby, white eyes
        c.fillStyle = '#00b4ff';
        wobbleCircle(x - s * 0.28, y - s * 0.3, s * 0.15, seed + 1, 0.5); c.fill(); c.stroke();
        wobbleCircle(x + s * 0.28, y - s * 0.3, s * 0.15, seed + 2, 0.5); c.fill(); c.stroke();
        wobbleCircle(x, y, s * 0.4, seed, 0.7); c.fill(); c.stroke();
        for (const ex of [-0.14, 0.14]) {
          c.beginPath(); c.arc(x + ex * s, y - s * 0.04, s * 0.1, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
          c.beginPath(); c.arc(x + ex * s + s * 0.015, y - s * 0.04, s * 0.04, 0, TAU); c.fillStyle = DARK; c.fill();
        }
        c.beginPath(); c.arc(x, y + s * 0.1, s * 0.055, 0, TAU); c.fillStyle = '#ed1c24'; c.fill(); c.stroke();
        c.beginPath(); c.arc(x, y + s * 0.1, s * 0.17, 0.4, Math.PI - 0.4); c.stroke();
        break;
      }
      case 'flower': {
        c.beginPath(); wobbleLine(x, y + s * 0.5, x, y, seed, 0.3); c.stroke();
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + seed; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.15, y + Math.sin(a) * s * 0.15, s * 0.11, 0, TAU); c.fillStyle = '#7fc8ff'; c.fill(); c.stroke(); }
        c.beginPath(); c.arc(x, y, s * 0.07, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); c.stroke();
        break;
      }
      case 'pyramid': {
        // the scorsby pyramid, ears and all
        for (const sd of [-1, 1]) { c.beginPath(); c.arc(x + sd * s * 0.17, y - s * 0.4, s * 0.1, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); c.stroke(); }
        const tri = () => { c.beginPath(); c.moveTo(x, y - s * 0.46); c.lineTo(x + s * 0.5, y + s * 0.38); c.lineTo(x - s * 0.5, y + s * 0.38); c.closePath(); };
        tri(); c.fillStyle = '#ffd23f'; c.fill(); // golden, like sunsby
        c.save(); c.clip(); c.fillStyle = charInk(0.95);
        for (let k = 0; k < 4; k++) {
          const yy = y - s * 0.2 + k * s * 0.16;
          c.beginPath(); c.moveTo(x - s * 0.6, yy);
          for (let q = 0; q <= 8; q++) c.lineTo(x - s * 0.6 + q * s * 0.15, yy + (q % 2 ? -s * 0.025 : s * 0.02));
          c.lineTo(x + s * 0.6, yy + s * 0.08); c.lineTo(x - s * 0.6, yy + s * 0.08); c.closePath(); c.fill();
        }
        c.restore();
        tri(); c.stroke();
        c.beginPath(); c.moveTo(x - s * 0.06, y + s * 0.38); c.lineTo(x - s * 0.06, y + s * 0.27); c.arc(x, y + s * 0.27, s * 0.06, Math.PI, 0); c.lineTo(x + s * 0.06, y + s * 0.38);
        c.fillStyle = T.paper; c.fill(); c.stroke();
        break;
      }
      case 'smiletree': {
        // the tree of smiling faces: what a grove of planted trees grows into
        c.beginPath(); c.moveTo(x - s * 0.3, y + s * 0.48); c.lineTo(x + s * 0.3, y + s * 0.48); c.stroke();
        c.beginPath(); c.moveTo(x - s * 0.04, y + s * 0.48); c.quadraticCurveTo(x - s * 0.03, y + s * 0.28, x - s * 0.12, y + s * 0.2);
        c.lineTo(x + s * 0.12, y + s * 0.2); c.quadraticCurveTo(x + s * 0.03, y + s * 0.28, x + s * 0.04, y + s * 0.48); c.closePath();
        c.fillStyle = '#9a6531'; c.fill(); c.stroke();
        const faces = [[-0.24, 0.05, 0.13], [0.0, 0.08, 0.12], [0.22, 0.06, 0.11], [-0.14, -0.14, 0.11], [0.1, -0.13, 0.12], [-0.3, -0.12, 0.07],
          [0.3, -0.1, 0.08], [-0.03, -0.3, 0.09], [0.2, -0.29, 0.07], [-0.21, -0.3, 0.07], [-0.1, 0.22, 0.08], [0.12, 0.22, 0.08]];
        faces.forEach(([fx, fy, fr], k) => {
          const px = x + fx * s, py = y + fy * s + Math.sin(now / 700 + k + seed) * s * 0.01, r = fr * s;
          wobbleCircle(px, py, r, seed + k, 0.4); c.fillStyle = '#7fd36b'; c.fill(); c.stroke();
          const blink = (now / 1000 + k * 0.7 + seed) % 5 < 0.15;
          c.fillStyle = charInk();
          if (blink) { c.beginPath(); c.moveTo(px - r * 0.45, py - r * 0.2); c.lineTo(px - r * 0.15, py - r * 0.2); c.moveTo(px + r * 0.15, py - r * 0.2); c.lineTo(px + r * 0.45, py - r * 0.2); c.stroke(); }
          else for (const sd of [-1, 1]) { c.beginPath(); c.arc(px + sd * r * 0.3, py - r * 0.2, r * 0.09, 0, TAU); c.fill(); }
          c.beginPath(); c.arc(px, py + r * 0.05, r * 0.07, 0, TAU); c.fill();
          c.beginPath(); c.arc(px, py + r * 0.05, r * 0.45, 0.5, Math.PI - 0.5); c.stroke();
        });
        break;
      }
      case 'yolksby': {
        // yolksby. how well can you cook a fried egg? it wobbles, hops and blinks.
        const hop = Math.abs(Math.sin(now / 420 + seed)) * s * 0.14;
        c.translate(x, y); c.rotate(Math.sin(now / 600 + seed) * 0.18); c.translate(-x, -y);
        c.beginPath();
        for (let k = 0; k <= 16; k++) {
          const a = (k / 16) * TAU, rr = s * (0.42 + 0.07 * Math.sin(k * 2.7 + seed) + 0.03 * Math.sin(now / 200 + k * 1.3));
          const px = x + Math.cos(a) * rr * 1.2, py = y + Math.sin(a) * rr * 0.75;
          k ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.stroke(); // a white egg, day or night
        const yy = y - s * 0.04 - hop;
        const sq = 1 + 0.08 * Math.sin(now / 210 + seed);
        for (const sd of [-1, 1]) { c.beginPath(); c.arc(x + sd * s * 0.14, yy - s * 0.15, s * 0.065, 0, TAU); c.fillStyle = '#ffc21a'; c.fill(); c.stroke(); }
        c.beginPath(); c.ellipse(x, yy, s * 0.19 * sq, s * 0.19 / sq, 0, 0, TAU); c.fillStyle = '#ffc21a'; c.fill(); c.stroke();
        const awake = (now / 1000 + seed) % 4 < 2.6;
        if (awake) {
          c.beginPath(); c.arc(x - s * 0.07, yy - s * 0.05, s * 0.028, 0, TAU); c.moveTo(x + s * 0.098, yy - s * 0.05); c.arc(x + s * 0.07, yy - s * 0.05, s * 0.028, 0, TAU); c.fillStyle = DARK; c.fill();
        } else {
          c.beginPath(); c.arc(x - s * 0.07, yy - s * 0.06, s * 0.035, 0, Math.PI); c.moveTo(x + s * 0.105, yy - s * 0.06); c.arc(x + s * 0.07, yy - s * 0.06, s * 0.035, 0, Math.PI); c.stroke();
        }
        c.beginPath(); c.arc(x, yy + s * 0.04, s * 0.07, 0.2, Math.PI - 0.2); c.stroke();
        break;
      }
      case 'blocksby': {
        // a scorsby made of squares
        const b = s * 0.13, lilac = '#b9a4ff';
        c.fillStyle = lilac;
        c.beginPath(); c.rect(x - s * 0.42, y - s * 0.46, b * 1.6, b * 1.6); c.rect(x + s * 0.42 - b * 1.6, y - s * 0.46, b * 1.6, b * 1.6); c.fill(); c.stroke();
        c.beginPath(); c.rect(x - s * 0.36, y - s * 0.3, s * 0.72, s * 0.62); c.fill(); c.stroke();
        for (const sd of [-1, 1]) {
          c.beginPath(); c.rect(x + sd * s * 0.15 - b * 0.7, y - s * 0.16, b * 1.4, b * 1.4); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
          c.fillStyle = DARK; c.fillRect(x + sd * s * 0.15 - b * 0.3 + Math.sin(now / 900 + seed) * b * 0.25, y - s * 0.16 + b * 0.4, b * 0.6, b * 0.6);
        }
        c.fillStyle = '#ed1c24'; c.fillRect(x - b * 0.4, y + s * 0.02, b * 0.8, b * 0.8);
        c.fillStyle = DARK;
        for (const [dx, dy] of [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]]) c.fillRect(x + dx * b * 0.5 - b * 0.25, y + s * 0.14 + dy * b * 0.5, b * 0.5, b * 0.5);
        break;
      }
      case 'manyeye': {
        // the purple many-eyed one, from the book of blue roses
        const night = T === THEMES.night;
        wobbleCircle(x, y, s * 0.4, seed, 1.2, 0); c.fillStyle = night ? T.paper : '#8e6bff'; c.fill(); c.stroke();
        for (let k = 0; k < 9; k++) {
          const a = hash(seed + k) * TAU, rr = s * 0.28 * Math.sqrt(hash(seed + k * 3));
          const ex = x + Math.cos(a) * rr, ey = y + Math.sin(a) * rr, er = s * (0.05 + 0.04 * hash(k + seed));
          c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fillStyle = night ? T.paper : '#ffe14a'; c.fill(); c.lineWidth = lw * 0.7; c.stroke();
          c.beginPath(); c.arc(ex + Math.sin(now / 700 + k) * er * 0.3, ey, er * 0.45, 0, TAU); c.fillStyle = DARK; c.fill();
        }
        c.lineWidth = lw;
        c.beginPath(); for (const sd of [-1, 1]) { c.moveTo(x + sd * s * 0.15, y + s * 0.38); c.lineTo(x + sd * s * 0.2, y + s * 0.56); } c.stroke();
        break;
      }
      case 'bug': {
        // the dreamer from the cover of the book of blue roses
        c.beginPath();
        c.moveTo(x - s * 0.1, y - s * 0.3); c.quadraticCurveTo(x - s * 0.2, y - s * 0.6, x - s * 0.32, y - s * 0.62);
        c.moveTo(x + s * 0.1, y - s * 0.3); c.quadraticCurveTo(x + s * 0.2, y - s * 0.6, x + s * 0.32, y - s * 0.62); c.stroke();
        c.beginPath(); c.moveTo(x, y + s * 0.42);
        c.bezierCurveTo(x - s * 0.5, y + s * 0.1, x - s * 0.42, y - s * 0.38, x, y - s * 0.36);
        c.bezierCurveTo(x + s * 0.42, y - s * 0.38, x + s * 0.5, y + s * 0.1, x, y + s * 0.42);
        c.fillStyle = T === THEMES.night ? T.paper : '#d9cff5'; c.fill(); c.stroke();
        for (const sd of [-1, 1]) {
          c.beginPath(); c.arc(x + sd * s * 0.17, y - s * 0.05, s * 0.06, 0, TAU); c.fillStyle = T.paper; c.fill(); c.stroke();
          c.beginPath(); c.arc(x + sd * s * 0.17, y - s * 0.05, s * 0.028, 0, TAU); pupilDot();
        }
        c.beginPath(); c.arc(x, y + s * 0.08, s * 0.025, 0, TAU); c.fillStyle = charInk(); c.fill();
        c.beginPath(); c.arc(x, y + s * 0.12, s * 0.08, 0.3, Math.PI - 0.3); c.strokeStyle = charInk(); c.stroke();
        break;
      }
      case 'mushroom': {
        c.beginPath(); c.rect(x - s * 0.07, y - s * 0.05, s * 0.14, s * 0.4); c.fillStyle = T.paper; c.fill(); c.stroke();
        c.beginPath(); c.arc(x, y, s * 0.3, Math.PI, 0); c.closePath(); c.fillStyle = '#ff4a4a'; c.fill(); c.stroke();
        c.beginPath(); c.arc(x - s * 0.12, y - s * 0.14, s * 0.04, 0, TAU); c.arc(x + s * 0.1, y - s * 0.18, s * 0.05, 0, TAU); c.fillStyle = T.paper; c.fill();
        break;
      }
    }
    c.restore();
  }
  const MARKS = ['cactus', 'flower', 'tree', 'house', 'mushroom', 'heart', 'pyramid', 'eye', 'lips', 'head'];

  // the face, as drawn in /images/scorsbyface_big.png (and its blink)
  function drawFace(cx, cy, size, o = {}) {
    const s = size / 1900;
    const P = (x, y) => [cx + (x - 955) * s, cy + (y - 900) * s];
    const circ = (x, y, r, col) => { const [px, py] = P(x, y); c.beginPath(); c.arc(px, py, r * s, 0, TAU); c.fillStyle = col; c.fill(); };
    const col = o.color || '#00b4ff', k = o.ink || DARK;
    circ(440, 450, 395, k); circ(1470, 450, 395, k); circ(955, 965, 740, k);
    circ(440, 450, 300, col); circ(1470, 450, 300, col); circ(955, 965, 645, col);
    const lid = o.lid ?? 1;
    c.lineCap = 'round';
    for (const ex of [697, 1214]) {
      const [px, py] = P(ex, 883);
      if (o.hearts) { heartPath(px, py + 10 * s, 250 * s); c.fillStyle = '#ff3d6e'; c.fill(); continue; }
      if (lid < 0.5) {
        // closed eyes are smiles too
        const [ax, ay] = P(ex - 24 + (ex > 955 ? 54 : 0), 843);
        c.beginPath(); c.arc(ax, ay, 172 * s, 0, Math.PI); c.lineWidth = 95 * s; c.strokeStyle = k; c.stroke();
        continue;
      }
      c.beginPath(); c.arc(px, py, 258 * s, 0, TAU); c.fillStyle = '#fff'; c.fill();
      c.beginPath(); c.arc(px + (o.look?.[0] || 0) * 110 * s, py + (o.look?.[1] || 0) * 110 * s, 115 * s, 0, TAU);
      c.fillStyle = k; c.fill();
    }
    circ(955, 1096, 125, o.nose || '#ed1c24');
    const [mx, my] = P(955, 1268);
    if (o.sing > 0.04) {
      c.beginPath(); c.ellipse(mx, my + 40 * s, 120 * s, (60 + 230 * o.sing) * s, 0, 0, TAU); c.fillStyle = k; c.fill();
    } else {
      c.beginPath(); c.arc(mx, my, 172 * s, 0, Math.PI); c.lineWidth = 95 * s; c.strokeStyle = k; c.stroke();
    }
  }

  // ------------------------------------------------------------------ the world's state
  const peers = new Map();
  let me = null;
  const waves = [];      // love for everyone, rolling around the planet as a rainbow
  const hearts = [];     // contagious ripples of hearts
  const bursts = [];     // big love effects in the sky
  const sky = [], pops = [], raining = [];
  let marks = [], trails = [], tally = null;
  let loveWash = 0;
  let goldFlash = 0;
  let stormNow = 0;     // tap sunsby and everything flashes gold      // the paper blushes with color for a moment
  let myColor = 0; // everyone arrives as classic blue
  let myName = cleanName(store.get('scorsby-name') || '');
  let markMode = null, lastPlanted = '';

  function cleanName(n) {
    return String(n || '').normalize('NFKC').replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16).toLowerCase();
  }
  function scorsby(p, mine = false) {
    return {
      id: p.id, lat: p.lat, lon: p.lon, tz: p.tz || 0, c: p.c ?? 0, n: p.n || '', v: vec(p.lat, p.lon), mine, seed: Math.random() * 100,
      blink: 0, nextBlink: rand(1500, 6000), hearts: 0, sing: 0, singTarget: 0, freq: 0, lastSing: 0,
      lookX: 0, lookY: 0, born: performance.now(), leaving: 0, sx: -1e4, sy: -1e4, sz: -1, size: 0, ox: 0, oy: 0,
    };
  }
  function place(s, lat, lon) { s.lat = lat; s.lon = lon; s.v = vec(lat, lon); }
  function* everyone() { if (me) yield me; yield* peers.values(); }
  const crowd = () => peers.size + (me ? 1 : 0);
  const nameOf = (s) => s.n ? `${s.n} scorsby` : `a ${typeof s.c === 'string' ? '' : (COLORS[s.c]?.[0] || '') + ' '}scorsby`;

  // ------------------------------------------------------------------ omens: strange things that happen to everyone
  let omen = null;
  const OMEN_DUR = { eclipse: 11000, flock: 12000, sneeze: 3200, hearts: 10000, colorstorm: 9000, unison: 12000, ears: 6000, heartstar: 10000, thirdeye: 11000, goldrain: 10000, wings: 9000 };
  const OMEN_WORDS = {
    eclipse: 'moonsby is hugging sunsby. everyone gets a little night.',
    flock: 'the glongingstons are passing through.',
    sneeze: 'achoo. bless you, world.',
    hearts: 'it is raining. it is love.',
    colorstorm: 'colorstorm!',
    unison: (seed) => { const c = unisonColor(seed)[0]; return `for a moment, everyone is ${c === 'ghost' ? 'a ghost' : c}.`; },
    ears: 'the world is listening very hard.',
    heartstar: 'the heartstar rose. everyone, everywhere: loved.',
    thirdeye: 'the world opened its third eye. it sees you, kindly.',
    goldrain: 'and suddenly, without any explanation at all, it started raining gold.',
    wings: 'the world remembered it has wings.',
  };
  function startOmen(k, seed = Math.random() * 1e6) {
    if (!OMEN_DUR[k] || performance.now() < intro.ui) return;
    omen = { k, seed, born: performance.now(), dur: OMEN_DUR[k] };
    whisper(typeof OMEN_WORDS[k] === 'function' ? OMEN_WORDS[k](seed) : OMEN_WORDS[k], 5200, true, null, true);
    if (k === 'heartstar') { for (const s of everyone()) s.hearts = 6000; setMood('hearts', 6000); }
    if (k === 'thirdeye') setMood('third', OMEN_DUR[k]);
    if (k === 'sneeze') setMood('o', 2000);
    if (k === 'colorstorm') setMood(pick(['grin', 'teeth', 'tongue']), OMEN_DUR[k]);
    if (k === 'eclipse') setMood('sleepy', 8000);
    if (k === 'wings') setMood('angel', OMEN_DUR[k]);
    if (k === 'goldrain') { setMood('gold', OMEN_DUR[k]); for (let i = 0; i < 90; i++) raining.push({ gold: true, x: rand(0, VW), y: rand(-VH, -20), vy: rand(0.12, 0.22), sw: rand(0, TAU), s: rand(5, 9), at: performance.now() + rand(0, 6500) }); }
    if (k === 'hearts') for (let i = 0; i < 70; i++) raining.push({ x: rand(0, VW), y: rand(-VH, -20), vy: rand(0.04, 0.09), sw: rand(0, TAU), s: rand(7, 16), at: performance.now() + rand(0, 6000) });
  }
  const omenP = (k, now) => omen && omen.k === k ? (now - omen.born) / omen.dur : -1;
  const env = (p) => p < 0 || p > 1 ? 0 : smooth(0, 0.12, p) * (1 - smooth(0.82, 1, p));

  // ------------------------------------------------------------------ the world's own face
  const pointer = { x: -1, y: -1, down: false, dragging: false, onMe: false, moved: 0, held: false, seen: false };
  let planetBlink = 0, earPerk = 0;
  let visible = [];
  const moon = { x: 0, y: 0, r: 0, z: 0, awake: 0 };
  let lastActive = performance.now();

  // the world's face can be pulled like taffy, like the face on the mario 64 title screen.
  // offsets are in screen pixels; when you let go, each part springs back.
  const PARTS = ['eyeL', 'eyeR', 'nose', 'mouth', 'earL', 'earR', 'antL', 'antR', 'eye3', 'm0', 'm1', 'm2', 'm3', 'm4', 'm5', 'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
  const pull = Object.fromEntries(PARTS.map((k) => [k, { x: 0, y: 0, vx: 0, vy: 0, held: false }]));
  function updatePulls() {
    for (const k of PARTS) {
      const q = pull[k];
      if (q.held) continue;
      q.vx = (q.vx - q.x * 0.16) * 0.8; q.vy = (q.vy - q.y * 0.16) * 0.8;
      q.x += q.vx; q.y += q.vy;
      if (Math.abs(q.x) + Math.abs(q.y) + Math.abs(q.vx) + Math.abs(q.vy) < 0.05) { q.x = q.y = q.vx = q.vy = 0; }
    }
  }

  // all measured in the logo's own units (its blue head has a radius of 645)
  const FACE_BASE = {
    ex: 258, ey: -82, er: 258, pr: 115, nose: 125, ny: 131, mw: 172, my: 303, mc: 1, mo: 0, oh: 0,
    lidL: 1, lidR: 1, asym: 0, third: 0, many: 0, tongue: 0, teeth: 0, lips: 0, melt: 0, heart: 0, tilt: 0,
    squish: 0, cross: 0, blush: 0, scramble: 0, stalks: 0, orbit: 0, flip: 0, drip: 0, stache: 0, tall: 0, spin: 0,
    pixel: 0, googly: 0, heartnose: 0, gold: 0, antenna: 0, angel: 0,
    swirl: 0, jitter: 0, worm: 0, bubble: 0, garden: 0, clock: 0, meltdown: 0, swap: 0, wall: 0, hug: 0,
  };
  const MOODS = {
    smile: {}, grin: { mo: 1, mw: 190 }, o: { oh: 1, mw: 150 }, wink: { lidL: 0 }, tongue: { mo: 0.6, tongue: 1 },
    kiss: { lips: 1, mw: 130 }, odd: { asym: 0.32, tilt: 1 }, melt: { melt: 1 }, many: { many: 1 }, hearts: { heart: 1, mo: 0.5 },
    nose: { nose: 260 }, tiny: { er: 120, pr: 60, mw: 90, nose: 70, ex: 200 }, wide: { ex: 340, er: 190, pr: 90, mw: 230 },
    squish: { squish: 1 }, sleepy: { lidL: 0, lidR: 0, mw: 150 }, cyclops: { ex: 0, er: 330, pr: 150, ey: -40 },
    cross: { cross: 1 }, shy: { blush: 1, lidL: 0, lidR: 0 }, teeth: { mo: 1, mw: 210, teeth: 1 }, scramble: { scramble: 1 },
    stalks: { stalks: 1, er: 200, ex: 300 }, orbit: { orbit: 1, er: 200 }, flip: { flip: 1 }, drip: { drip: 1, mc: 0.6 },
    stache: { stache: 1 }, tall: { tall: 1 }, /*spin: { spin: 1 },*/ third: { third: 1 },
    pixel: { pixel: 1 }, googly: { googly: 1 }, heartnose: { heartnose: 1 }, gold: { gold: 1, mo: 0.6 }, antenna: { antenna: 1 }, angel: { angel: 1, lidL: 0, lidR: 0 },
    // a few that are simply unhinged
    swirl: { swirl: 1, mo: 0.35, mw: 150 }, bugeye: { er: 370, pr: 38, jitter: 1, oh: 1, mw: 120 }, worm: { worm: 1, mo: 0.75, mw: 180 },
    // and some unexpected ones
    bubble: { bubble: 1, oh: 1, mw: 70 }, garden: { garden: 1, mo: 0.4 }, meltdown: { meltdown: 1 },
    swap: { swap: 1, er: 210, nose: 150 }, // two noses for eyes, and an eye for a nose
    goofy: { wall: 1, hug: 1, er: 300, pr: 125, ex: 330, mw: 300, mc: 0.95, my: 260 }, // pupils as big as the nose, a grin hugging the face // a huge U grin, eyes bulging and looking out to the sides
    clock: { clock: 1, er: 120, pr: 60, ex: 330, ey: -210, mw: 110, my: 400, ny: 0, nose: 80 },
  };
  const pf = { cur: { ...FACE_BASE }, target: { ...FACE_BASE }, mood: 'smile', next: 7000, honk: 0, wink: 0, winkSide: -1, blink: 0, nextBlink: 3000, lx: 0, ly: 0, hit: null, hold: 0, sing: 0, singing: false, rings: [] };
  function setMood(m, hold = 0) {
    if (!MOODS[m] || (!intro.woke && m !== 'sleepy')) return; // nothing stirs the world before it wakes
    if (pf.mood !== m) pf.moodAt = performance.now();
    pf.mood = m; pf.target = { ...FACE_BASE, ...MOODS[m] }; pf.hold = performance.now() + hold;
    if (hold) pf.next = hold + rand(1000, 3000);
  }
  function nextMood() {
    // the world's mood follows the crowd
    const n = crowd();
    const strange = ['odd', 'melt', 'many', 'nose', 'tiny', 'wide', 'squish', 'cyclops', 'cross', 'scramble', 'stalks', 'orbit', 'flip', 'drip', 'stache', 'tall', 'spin', 'kiss', 'o', 'wink', 'pixel', 'googly', 'heartnose', 'antenna', 'angel', 'gold',
      'swirl', 'bugeye', 'worm', 'bubble', 'garden', 'clock', 'meltdown', 'swap', 'goofy'];
    const joyful = ['grin', 'tongue', 'hearts', 'teeth', 'grin', 'hearts'];
    const quiet = ['shy', 'tiny', 'wink', 'smile'];
    const pool = [...strange];
    if (n >= 3) pool.push(...joyful, ...joyful);
    else if (n >= 2) pool.push(...joyful);
    else pool.push(...quiet, ...quiet);
    return pick(pool);
  }
  function updatePlanetFace(now, dt) {
    // the spin winds up while it spins, then eases round to the nearest upright (no sudden snap)
    pf.spinA = (pf.spinA || 0) + (dt / 700) * pf.cur.spin;
    if (pf.mood === 'spin') pf.spinHome = null;
    else if (pf.spinA) {
      // the finale: a super fast whirl, three more turns, settling upright (face and ears together)
      if (pf.spinHome == null) pf.spinHome = (Math.ceil(pf.spinA / TAU) + 3) * TAU;
      pf.spinA += (pf.spinHome - pf.spinA) * 0.07;
      if (Math.abs(pf.spinHome - pf.spinA) < 0.002) { pf.spinA = 0; pf.spinHome = null; }
    }
    const idle = now - lastActive > 45000;
    if (idle && pf.mood !== 'sleepy' && now > pf.hold) setMood('sleepy');
    else if (!idle && pf.mood === 'sleepy' && now > pf.hold) setMood('smile');
    pf.next -= dt;
    if (pf.next < 0 && now > pf.hold && !idle) {
      pf.next = rand(5000, 10000);
      setMood(pf.mood !== 'smile' && Math.random() < 0.5 ? 'smile' : nextMood());
    }
    for (const k in pf.cur) pf.cur[k] += (pf.target[k] - pf.cur[k]) * 0.08;
    pf.nextBlink -= dt;
    if (pf.nextBlink < 0) { pf.blink = 1; pf.nextBlink = rand(2500, 7000); }
    pf.blink = Math.max(0, pf.blink - dt / 260);
    let tx, ty;
    if (pointer.seen) { tx = clamp((pointer.x - CX) / (VW * 0.45), -1, 1); ty = clamp((pointer.y - CY) / (VH * 0.45), -1, 1); }
    else if (crowd() <= 1) { tx = Math.sin(now / 2300) * 0.8; ty = Math.cos(now / 3100) * 0.5; } // alone, it looks around for someone
    else { tx = Math.sin(now / 3700) * 0.5; ty = Math.cos(now / 5100) * 0.3; }
    pf.lx += (tx - pf.lx) * 0.08; pf.ly += (ty - pf.ly) * 0.08;

    // the world sings along: when two or more scorsbys sing, it hums the note between them
    const singers = [...everyone()].filter((s) => s.sing > 0.08 && s.freq);
    const amp = singers.length ? singers.reduce((a, s) => a + s.sing, 0) / singers.length : 0;
    pf.sing += ((singers.length ? Math.min(1, amp * 1.3) : 0) - pf.sing) * 0.15;
    if (singers.length >= 2) {
      const f = Math.exp(singers.reduce((a, s) => a + Math.log(s.freq), 0) / singers.length);
      voices.sing('world', f, Math.min(1, amp) * 0.8, CX);
      if (!pf.singing) { pf.singing = true; whisper('the world is singing along.', 3000, false); }
      if (Math.random() < dt / 260) pf.rings.push({ born: now });
    } else if (pf.singing) { pf.singing = false; voices.hush('world'); }
  }

  // meltdown: the face's own pixels run downward. it is drawn off-screen, then copied back in thin
  // columns, each slid down and stretched by an amount that wanders across the face and over time.
  const faceBuf = document.createElement('canvas'), faceBufC = faceBuf.getContext('2d');
  function renderPlanetFace(now) {
    const f = pf.cur;
    const meltK = f.meltdown > 0.01 ? (pf.mood === 'meltdown' ? clamp((now - (pf.moodAt || now)) / 6000, 0, 1) : 1) * f.meltdown : 0;
    if (meltK <= 0.01) { drawPlanetFace(now); return; }
    if (faceBuf.width !== cv.width || faceBuf.height !== cv.height) { faceBuf.width = cv.width; faceBuf.height = cv.height; }
    faceBufC.setTransform(1, 0, 0, 1, 0, 0); faceBufC.clearRect(0, 0, faceBuf.width, faceBuf.height);
    faceBufC.setTransform(DPR, 0, 0, DPR, 0, 0); faceBufC.globalAlpha = 1;
    const main = c;
    c = faceBufC;
    try { drawPlanetFace(now); } finally { c = main; }
    const x0 = Math.max(0, Math.floor(CX - R)), x1 = Math.min(VW, Math.ceil(CX + R)), top = Math.max(0, CY - R * 1.1), h = Math.min(VH, CY + R * 1.1) - top;
    c.save(); c.beginPath(); c.arc(CX, CY, R, 0, TAU); c.clip();
    const k = meltK * meltK * (3 - 2 * meltK);
    for (let x = x0; x < x1; x += 2) {
      const u = (x - CX) / R;
      const n = 0.5 + 0.5 * Math.sin(u * 9 + 1.3 + now / 2400) * Math.sin(u * 3.1 - now / 1700); // where it runs most
      const slide = k * R * (0.04 + 0.32 * n) + R * 2.5 * k ** 4, stretch = 1 + k * (0.15 + 0.85 * n); // and at the end it all flushes out the bottom
      c.drawImage(faceBuf, x * DPR, top * DPR, 2 * DPR, h * DPR, x, top + slide, 2.4, h * stretch);
    }
    c.restore();
  }
  function drawPlanetFace(now) {
    // the face fades as you come closer, and is gone by the second zoom
    const A = 1 - smooth(1.02, 2.0, zoom.v);
    if (A <= 0.01) { pf.hit = null; return; }
    const f = pf.cur;
    L = R / 645;
    let cx = CX + pf.lx * R * 0.06, cy = CY + pf.ly * R * 0.045;
    if (f.jitter > 0.02) { cx += (Math.random() - 0.5) * R * 0.04 * f.jitter; cy += (Math.random() - 0.5) * R * 0.04 * f.jitter; }
    const blinkClosed = pf.blink > 0.2 && pf.blink < 0.8;
    const worldClosed = planetBlink > 0.15 && planetBlink < 0.85;
    const rot = f.tilt * Math.sin(now / 1300) * 0.22 + f.flip * Math.PI + pf.spinA;
    const sq = f.squish * Math.sin(now / 260);
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    // a pull in screen pixels, turned into the face's own units
    const loc = (k) => { const q = pull[k]; return [(q.x * cosR + q.y * sinR) / L, (-q.x * sinR + q.y * cosR) / L]; };
    const taffy = (x0, y0, x1, y1, w, col) => {
      if (Math.hypot(x1 - x0, y1 - y0) < 6) return;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'round'; c.stroke();
    };
    c.save();
    c.globalAlpha = A;
    c.translate(cx, cy); c.rotate(rot); c.scale(L * (1 + sq * 0.16 - f.tall * 0.12), L * (1 - sq * 0.13 + f.tall * 0.28));
    c.lineCap = 'round'; c.lineJoin = 'round';

    const pupils = []; // drawn after all the eye whites
    const eye = (x, y, r, closed, lx, ly, seed) => {
      if (r < 4) return;
      if (f.swap > 0.5) {
        wobbleCircle(x, y, r * 0.6, seed, 1 / L, 0); c.fillStyle = reddish(ocean()) ? '#00b4ff' : '#ed1c24'; c.fill();
        return;
      }
      if (f.swirl > 0.5 && !closed) {
        wobbleCircle(x, y, r, seed, 1 / L, 0); c.fillStyle = '#fff'; c.fill();
        c.beginPath();
        for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 6 + (now / 260) * (seed % 2 ? 1 : -1); const rr = r * 0.88 * t; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x, y); }
        c.lineWidth = r * 0.13; c.strokeStyle = DARK; c.stroke();
        return;
      }
      if (f.heart > 0.5) { heartPath(x, y + r * 0.05, r * 0.92); c.fillStyle = '#ff3d6e'; c.fill(); return; }
      if (f.pixel > 0.5) {
        if (closed) { c.fillStyle = DARK; c.fillRect(x - r * 0.7, y - r * 0.1, r * 1.4, r * 0.28); return; }
        c.fillStyle = '#fff'; c.fillRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
        const ps = r * 0.8; c.fillStyle = DARK; c.fillRect(x + lx * r * 0.35 - ps / 2, y + ly * r * 0.35 - ps / 2, ps, ps);
        return;
      }
      if (closed) {
        // closed eyes are smiles too
        c.beginPath(); c.arc(x, y - r * 0.155, r * 0.667, 0, Math.PI); c.lineWidth = r * 0.368; c.strokeStyle = DARK; c.stroke();
        return;
      }
      wobbleCircle(x, y, r, seed, 1 / L, 0); c.fillStyle = '#fff'; c.fill();
      const pr = r * (f.pr / f.er);
      const reach = (r - pr) * 0.7;
      pupils.push(() => { c.beginPath(); c.arc(x + lx * reach, y + ly * reach, pr, 0, TAU); c.fillStyle = DARK; c.fill(); });
    };

    // blush
    if (f.blush > 0.05) {
      c.globalAlpha = A * f.blush * 0.6;
      for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * 440, 190, 115, 62, 0, 0, TAU); c.fillStyle = '#ff7aa8'; c.fill(); }
      c.globalAlpha = A;
    }

    // antennae, like the dreamer bug
    const antTips = [];
    if (f.antenna > 0.02) {
      for (const sd of [-1, 1]) {
        const [px, py] = loc(sd < 0 ? 'antL' : 'antR');
        // they grow out of the head and draw back in, like a snail's eyes
        const tx = sd * (140 + 190 * f.antenna) + px * f.antenna, ty = -560 - 440 * f.antenna + Math.sin(now / 350 + sd) * 40 * f.antenna + py * f.antenna;
        antTips.push([tx, ty, 60 * f.antenna, sd < 0 ? 'antL' : 'antR']);
        c.beginPath(); c.moveTo(sd * 140, -560); c.quadraticCurveTo(sd * 125, -560 - 290 * f.antenna, tx, ty);
        c.lineWidth = 34; c.strokeStyle = DARK; c.stroke();
        c.beginPath(); c.arc(tx, ty, 60 * f.antenna, 0, TAU); c.fillStyle = '#ff5fae'; c.fill(); c.lineWidth = 22; c.stroke();
      }
    }
    // a halo, when the world remembers it is an angel
    if (f.angel > 0.02) {
      c.beginPath(); c.ellipse(0, -1010 + Math.sin(now / 700) * 20, 300 * f.angel, 70 * f.angel, 0, 0, TAU);
      c.lineWidth = 26; c.strokeStyle = DARK; c.stroke();
    }

    // the mouth: a round smile, opening wide when it grins or sings
    const [mpx, mpy] = loc('mouth');
    const my = lerp(f.my + f.melt * 70, -360, f.scramble) + mpy, w = f.mw * (1 + Math.min(0.6, Math.abs(mpx) / 600));
    const open = Math.max(f.mo, pf.sing * 0.9);
    c.save();
    c.translate(mpx, 0);
    if (f.scramble > 0.5) { c.translate(0, my); c.scale(1, -1); c.translate(0, -my); }
    if (f.lips > 0.5) {
      lipsPath(0, my + w * 0.3, w * 1.15); c.fillStyle = '#e8336b'; c.fill(); c.lineWidth = 26; c.strokeStyle = DARK; c.stroke();
      c.beginPath(); c.moveTo(-w * 1.15, my + w * 0.3); c.quadraticCurveTo(0, my + w * 0.42, w * 1.15, my + w * 0.3); c.stroke();
    } else if (f.oh > 0.5 && pf.sing < 0.3) {
      c.beginPath(); c.ellipse(0, my + w * 0.35, w * 0.55, w * 0.75 * f.oh, 0, 0, TAU); c.fillStyle = DARK; c.fill();
    } else if (open > 0.08) {
      const depth = w * f.mc * (0.95 + 0.4 * open);
      c.beginPath(); c.moveTo(-w, my); c.ellipse(0, my, w, depth, 0, 0, Math.PI); c.closePath();
      c.fillStyle = DARK; c.fill(); c.lineWidth = 60; c.strokeStyle = DARK; c.stroke();
      c.save(); c.clip();
      if (f.teeth > 0.3) {
        c.fillStyle = '#fff'; c.fillRect(-w, my - 10, w * 2, w * 0.28 * f.teeth);
      }
      if (f.tongue > 0.3) { c.beginPath(); c.ellipse(0, my + depth, w * 0.55, w * 0.45 * f.tongue, 0, 0, TAU); c.fillStyle = '#ff6f9c'; c.fill(); }
      c.restore();
    } else {
      c.beginPath();
      if (f.melt > 0.05) {
        for (let i = 0; i <= 24; i++) {
          const t = i / 24, a = t * Math.PI;
          const x = Math.cos(a) * w, y = my + Math.sin(a) * w * f.mc + f.melt * Math.sin(t * 12 + now / 300) * 18;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
      } else if (f.pixel > 0.5) {
        c.fillStyle = DARK;
        for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; c.rect(Math.cos(a) * w - 42, my + Math.sin(a) * w * f.mc - 42, 84, 84); }
        c.fill();
      } else if (f.hug > 0.5) c.arc(0, 0, 470, Math.PI * 0.16, Math.PI * 0.84); // a grin that follows the curve of the face
      else c.ellipse(0, my, w, w * f.mc, 0, 0, Math.PI);
      if (f.pixel <= 0.5 || f.melt > 0.05) { c.lineWidth = 95; c.strokeStyle = DARK; c.stroke(); }
    }
    c.restore();

    const eyeYs = lerp(f.ey, 330, f.scramble);
    const eyes = [];
    for (const sd of [-1, 1]) {
      const r = f.er * (1 + sd * f.asym) * (1 + 0.07 * Math.sin(now / 150 + sd) * f.wall); // bulging
      let x = sd * f.ex, y = eyeYs + sd * f.asym * 60 + f.melt * (120 + 40 * Math.sin(now / 600 + sd)) - f.stalks * 300;
      if (f.orbit > 0.02) {
        const a = now / 800 + (sd > 0 ? 0 : Math.PI);
        x = lerp(x, Math.cos(a) * 330, f.orbit); y = lerp(y, f.ny + Math.sin(a) * 270, f.orbit);
      }
      const [px, py] = loc(sd < 0 ? 'eyeL' : 'eyeR');
      if (px || py) {
        if (f.heart <= 0.5 && f.stalks <= 0.05 && f.pixel <= 0.5) taffy(x, y, x + px, y + py, r * 1.5, '#fff');
        x += px; y += py;
      }
      if (f.stalks > 0.05) {
        // eyes on wobbly stalks
        c.beginPath();
        const bx = sd * f.ex * 0.6, by = f.ey + 80;
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const px = lerp(bx, x, t) + Math.sin(t * 9 + now / 250 + sd) * 26 * f.stalks, py = lerp(by, y + r * 0.8, t);
          i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.lineWidth = 34; c.strokeStyle = DARK; c.stroke();
      }
      const lid = sd < 0 ? f.lidL : f.lidR;
      const closed = lid < 0.5 || blinkClosed || worldClosed || (pf.wink > now && sd === pf.winkSide);
      let lx = lerp(pf.lx, -sd * 0.9, f.cross), ly = lerp(pf.ly, 0.1, f.cross);
      if (f.wall > 0.02) { lx = lerp(lx, sd * 0.95, f.wall); ly = lerp(ly, -0.1, f.wall); } // looking out, away from each other
      if (f.googly > 0.02) { lx = lerp(lx, Math.sin(now / 95 + sd * 2.1) * 0.9, f.googly); ly = lerp(ly, 0.6 + Math.cos(now / 140 + sd) * 0.35, f.googly); }
      eye(x, y, r, closed, lx, ly, 300 + sd);
      eyes.push([x, y, r, sd]);
      if (f.drip > 0.05 && !closed) {
        for (let k = 0; k < 6; k++) {
          const ph = (now / 1100 + k / 6 + (sd > 0 ? 0.08 : 0)) % 1;
          // each drop leaves at its own angle: some spray far out, some fall almost straight down
          const out = 120 + 420 * hash(k * 7.3 + sd), up = 140 + 260 * hash(k * 3.1 - sd);
          const dx = x + sd * (r * 0.45 + ph * out), dy = y + r * 0.7 + ph * up + ph * ph * 420;
          const ang = Math.atan2(up + 840 * ph, sd * out); // the way it is falling
          const sz = 1.9 - ph * 0.7;
          c.globalAlpha = A * f.drip * (1 - ph * ph);
          c.save(); c.translate(dx, dy); c.rotate(ang - Math.PI / 2); c.scale(sz, sz);
          c.beginPath(); c.moveTo(0, -40); c.quadraticCurveTo(26, 10, 0, 24); c.quadraticCurveTo(-26, 10, 0, -40);
          c.restore();
          c.fillStyle = '#9be3ff'; c.fill(); c.lineWidth = 9; c.strokeStyle = DARK; c.stroke();
        }
        c.globalAlpha = A;
      }
    }
    const extra = [];
    const pulled = (k, x0, y0, r) => {
      const [px, py] = loc(k);
      if ((px || py) && f.heart <= 0.5 && f.pixel <= 0.5) taffy(x0, y0, x0 + px, y0 + py, r * 1.5, '#fff');
      extra.push([x0 + px, y0 + py, r, k]);
      return [x0 + px, y0 + py];
    };
    if (f.many > 0.02) {
      [[-470, -330, 95], [470, -350, 90], [-525, 150, 80], [525, 140, 85], [-230, -500, 70], [250, -505, 75]].forEach(([x0, y0, r0], i) => {
        const r = r0 * f.many, [x, y] = pulled('m' + i, x0, y0, r);
        eye(x, y, r, blinkClosed || worldClosed, pf.lx, pf.ly, 400 + i);
      });
    }
    if (f.third > 0.02) {
      const big = omenP('thirdeye', performance.now()) >= 0 ? 1.4 : 1;
      const lx = Math.sin(now / 900) * 0.8, ly = Math.cos(now / 1300) * 0.4;
      const r = 150 * f.third * big, [x, y] = pulled('eye3', 0, -430 - (big - 1) * 40, r);
      eye(x, y, r, worldClosed, pointer.seen ? pf.lx : lx, pointer.seen ? pf.ly : ly, 500);
    }

    for (const draw of pupils) draw();

    // the red nose, which honks (blue, when the world itself is red or pink)
    const noseCol = reddish(ocean()) ? '#00b4ff' : '#ed1c24';
    const honk = 1 + 0.9 * Math.max(0, (pf.honk - now) / 600);
    const [npx, npy] = loc('nose');
    const nr = f.nose * honk;
    taffy(0, f.ny + f.melt * 50, npx, f.ny + f.melt * 50 + npy, nr * 1.4, noseCol);
    const ny = f.ny + f.melt * 50 + npy;
    c.save(); c.translate(npx, 0);
    if (f.pixel > 0.5) { c.fillStyle = noseCol; c.fillRect(-nr, ny - nr, nr * 2, nr * 2); }
    else if (f.swap > 0.5) {
      const er2 = nr * 1.5;
      if (blinkClosed || worldClosed) { c.beginPath(); c.arc(0, ny - er2 * 0.155, er2 * 0.667, 0, Math.PI); c.lineWidth = er2 * 0.368; c.strokeStyle = DARK; c.stroke(); }
      else {
        wobbleCircle(0, ny, er2, 610, 1 / L, 0); c.fillStyle = '#fff'; c.fill();
        c.beginPath(); c.arc(pf.lx * er2 * 0.35, ny + pf.ly * er2 * 0.35, er2 * 0.45, 0, TAU); c.fillStyle = DARK; c.fill();
      }
    }
    else if (f.heartnose > 0.5) { heartPath(0, ny, nr * 1.15); c.fillStyle = noseCol; c.fill(); }
    else { wobbleCircle(0, ny, nr, 600, 1 / L, 0); c.fillStyle = noseCol; c.fill(); }
    if (f.stache > 0.05) {
      c.globalAlpha = A * f.stache;
      c.beginPath();
      for (const sd of [-1, 1]) {
        c.moveTo(0, ny + nr * 0.8);
        c.bezierCurveTo(sd * 120, ny + nr * 0.6, sd * 220, ny + nr * 1.6, sd * 300, ny + nr * 0.5);
        c.bezierCurveTo(sd * 330, ny + nr * 0.1, sd * 280, ny - nr * 0.3, sd * 250, ny + nr * 0.1);
      }
      c.lineWidth = 60; c.strokeStyle = DARK; c.stroke();
      c.globalAlpha = A;
    }
    c.restore();

    // bubblegum: one pink bubble swells out of the mouth, pops, he blinks twice, and that's the end
    if (f.bubble > 0.02 && pf.mood === 'bubble') {
      const t = now - (pf.moodAt || now), ph = t / 4200;
      if (t > 4200 + 1500) { setMood('smile'); } // a moment to take it in, then back to himself
      const bx = mpx, by0 = my + w * 0.35;
      if (ph < 0.9) {
        const r = (40 + 300 * ph ** 1.6) * f.bubble, by = by0 + r * 0.45;
        c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fillStyle = 'rgba(255,120,190,0.88)'; c.fill(); c.lineWidth = 14; c.strokeStyle = DARK; c.stroke();
        c.beginPath(); c.arc(bx - r * 0.35, by - r * 0.38, r * 0.22, Math.PI * 1.1, Math.PI * 1.6); c.lineWidth = Math.max(8, r * 0.07); c.strokeStyle = '#fff'; c.stroke();
      } else if (ph < 1) {
        if (pf.popped !== pf.moodAt) { pf.popped = pf.moodAt; tone.bubblePop(); pf.blink = 1; setTimeout(() => { pf.blink = 1; }, 380); } // snap! blink, blink
        const k = (ph - 0.9) / 0.1, R0 = (40 + 300 * 0.9 ** 1.6) * f.bubble, cy0 = by0 + R0 * 0.45; // the bubble at its biggest, the burst centered where it was
        c.globalAlpha = A * (1 - k * k);
        for (let i = 0; i < 14; i++) { // pink lines bursting outward
          const a = (i / 14) * TAU, r2 = R0, r1 = R0 * (0.55 + 0.4 * k); // reaching exactly to the bubble's edge // never past where the bubble was
          c.beginPath(); c.moveTo(bx + Math.cos(a) * r1, cy0 + Math.sin(a) * r1); c.lineTo(bx + Math.cos(a) * r2, cy0 + Math.sin(a) * r2);
          c.lineWidth = 16; c.strokeStyle = '#ff78be'; c.lineCap = 'round'; c.stroke();
        }
        c.globalAlpha = A;
      }
    }

    // garden: grass and flowers sprout from the top of the head and sway
    if (f.garden > 0.02) {
      const g = (pf.mood === 'garden' ? clamp((now - (pf.moodAt || now)) / 2500, 0, 1) : 1) * f.garden;
      c.lineCap = 'round';
      for (let i = 0; i < 28; i++) { // grass
        const a = -Math.PI / 2 + (i / 27 - 0.5) * 1.3, bx = Math.cos(a) * 625, by = Math.sin(a) * 625, len = (50 + hash(i * 3.3) * 60) * g;
        const lean = Math.sin(now / 700 + i) * 0.25 + (hash(i) - 0.5) * 0.6;
        c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + Math.cos(a + lean) * len * 0.5, by + Math.sin(a + lean) * len * 0.5, bx + Math.cos(a + lean * 2) * len, by + Math.sin(a + lean * 2) * len);
        c.lineWidth = 14; c.strokeStyle = '#2f8a3a'; c.stroke();
      }
      ['#ff5fae', '#ffd23f', '#7fc8ff', '#ffffff', '#ff9a3c', '#c3a6ff', '#ff5fae'].forEach((col, i) => { // flowers
        const a = -Math.PI / 2 + (i / 6 - 0.5) * 1.15, bx = Math.cos(a) * 625, by = Math.sin(a) * 625;
        const h = (150 + hash(i * 7.1) * 170) * g, sway = Math.sin(now / 900 + i * 1.3) * 0.18;
        const [fpx, fpy] = loc('f' + i); // flowers can be dragged, and spring back
        const tx = bx + Math.cos(a + sway) * h + fpx, ty = by + Math.sin(a + sway) * h + fpy;
        if (g > 0.5) extra.push([tx, ty, 30 * g * 1.7, 'f' + i]);
        c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + Math.cos(a) * h * 0.5, by + Math.sin(a) * h * 0.5, tx, ty); c.lineWidth = 12; c.strokeStyle = '#2f8a3a'; c.stroke();
        const pr = 30 * g;
        const petal = (q) => { const pa = (q / 6) * TAU + now / 2000; c.beginPath(); c.arc(tx + Math.cos(pa) * pr, ty + Math.sin(pa) * pr, pr * 0.75, 0, TAU); c.fillStyle = col; c.fill(); c.lineWidth = 8; c.strokeStyle = DARK; c.stroke(); };
        for (let q = 0; q < 6; q++) petal(q);
        // so no petal sits on top of all the others, the first one tucks over the last one too
        const a0 = now / 2000, a5 = (5 / 6) * TAU + now / 2000;
        c.save(); c.beginPath(); c.moveTo(tx, ty); c.arc(tx, ty, pr * 3, a5, a0 + TAU); c.closePath(); c.clip(); petal(0); c.restore();
        c.beginPath(); c.arc(tx, ty, pr * 0.6, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); c.stroke();
      });
    }

    // clock: numbers round the rim, and real hands telling the visitor's own time, pinned at the nose
    if (f.clock > 0.02) {
      c.globalAlpha = A * f.clock;
      c.fillStyle = DARK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '110px Scheme, "Instrument Serif", Georgia, serif';
      for (let h = 1; h <= 12; h++) { const a = (h / 12) * TAU - Math.PI / 2; c.fillText(String(h), Math.cos(a) * 530, Math.sin(a) * 530 + 6); }
      for (let m = 0; m < 60; m++) { if (m % 5 === 0) continue; const a = (m / 60) * TAU; c.beginPath(); c.arc(Math.cos(a) * 590, Math.sin(a) * 590, 9, 0, TAU); c.fill(); }
      const d = new Date(), sec = d.getSeconds() + d.getMilliseconds() / 1000, min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
      const hand = (frac, len, wdt, col) => { const a = frac * TAU - Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * len, Math.sin(a) * len); c.lineWidth = wdt; c.strokeStyle = col; c.lineCap = 'round'; c.stroke(); };
      hand(hr / 12, 270, 44, DARK); hand(min / 60, 400, 28, DARK); hand(sec / 60, 440, 10, noseCol);
      c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.fillStyle = noseCol; c.fill();
      c.globalAlpha = A;
    }

    // a worm wriggles out of the mouth and looks around
    if (f.worm > 0.02) {
      c.save(); c.translate(mpx, 0);
      const len = 620 * f.worm, pts = [];
      for (let i = 0; i <= 28; i++) {
        const t = i / 28;
        pts.push([Math.sin(t * 7 - now / 140) * 90 * t + Math.sin(now / 900) * 160 * t * t, my + w * 0.35 + t * len]);
      }
      const trace = () => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
      c.lineCap = 'round'; c.lineJoin = 'round';
      trace(); c.lineWidth = 130 * f.worm; c.strokeStyle = DARK; c.stroke();
      trace(); c.lineWidth = 92 * f.worm; c.strokeStyle = '#ff7fa8'; c.stroke();
      const [tx, ty] = pts[pts.length - 1];
      for (const sd of [-1, 1]) {
        c.beginPath(); c.arc(tx + sd * 30, ty - 20, 26 * f.worm, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 10; c.strokeStyle = DARK; c.stroke();
        c.beginPath(); c.arc(tx + sd * 30 + Math.sin(now / 300) * 8, ty - 18, 11 * f.worm, 0, TAU); c.fillStyle = DARK; c.fill();
      }
      c.restore();
    }
    // when it sings, little rings leave its mouth
    for (let i = pf.rings.length - 1; i >= 0; i--) {
      const k = (now - pf.rings[i].born) / 1600;
      if (k > 1) { pf.rings.splice(i, 1); continue; }
      wobbleCircle(0, my + w * 0.5, w * (0.6 + k * 2.4), 700 + i, 4 / L, 0);
      c.lineWidth = 14; c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; c.stroke();
    }
    c.restore();

    const toScreen = (x, y) => [cx + (x * cosR - y * sinR) * L, cy + (x * sinR + y * cosR) * L];
    pf.hit = {
      nose: [...toScreen(npx, ny), nr * L], eyes: eyes.map(([x, y, r, sd]) => [...toScreen(x, y), r * L, sd]),
      mouth: [...toScreen(mpx, my + w * 0.45), w * 0.9 * L], ants: antTips.map(([x, y, r, k]) => [...toScreen(x, y), Math.max(14, r * L * 1.6), k]),
      extra: extra.map(([x, y, r, k]) => [...toScreen(x, y), Math.max(12, r * L), k]),
    };
  }

  // ------------------------------------------------------------------ drawing the world
  function render(now, dt) {
    boil = Math.floor(now / 110);
    R = baseR * zoom.v * introScale(now); L = R / 645;
    const hue = (now / 70) % 360;
    const storm = Math.max(env(omenP('colorstorm', now)), env(omenP('thirdeye', now)) * 0.7);
    stormNow = env(omenP('colorstorm', now));
    updatePlanetFace(now, dt);
    updatePulls();
    blendWorld(now, storm);

    // white paper. colors bloom only when something happens.
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = T.paper; c.fillRect(0, 0, VW, VH);
    const bloom = Math.max(storm, smooth(0, 1, (loveWash - now) / 1500), env(omenP('goldrain', now)) * 0.5, env(omenP('heartstar', now)) * 0.6);
    if (bloom > 0.01) {
      c.globalCompositeOperation = T.wash;
      for (let k = 0; k < 4; k++) {
        const wx = VW * (0.5 + 0.45 * Math.sin(now / (19000 + k * 5000) + k * 2)), wy = VH * (0.5 + 0.4 * Math.cos(now / (23000 + k * 4000) + k));
        const wr = Math.max(VW, VH) * (0.35 + 0.1 * k);
        const g = c.createRadialGradient(wx, wy, 0, wx, wy, wr);
        g.addColorStop(0, `hsla(${(hue * 3 + k * 80) % 360},90%,65%,${T.washA * 1.6 * bloom})`); g.addColorStop(1, 'hsla(0,0%,100%,0)');
        c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      }
      c.globalCompositeOperation = 'source-over';
    }
    if (stormNow > 0.01 && c.createConicGradient) {
      // a spinning rainbow sky
      const g = c.createConicGradient(now / 500, CX, CY);
      RAINBOW.concat(RAINBOW[0]).forEach((col, i) => g.addColorStop(i / RAINBOW.length, col));
      c.save(); c.globalAlpha = 0.32 * stormNow; c.fillStyle = g; c.fillRect(0, 0, VW, VH); c.restore();
    }

    if (T === THEMES.night) renderStars(now, dt);
    renderSky(now, dt);
    const goldSky = env(omenP('goldrain', now));
    if (goldSky > 0.01) {
      // when it rains gold, the whole sky behind the world turns gold too
      c.save(); c.globalCompositeOperation = T === THEMES.night ? 'source-over' : 'multiply';
      c.globalAlpha = (T === THEMES.night ? 0.32 : 0.5) * goldSky;
      c.fillStyle = '#ffc93c'; c.fillRect(0, 0, VW, VH); c.restore();
    }
    if (goldFlash > now) {
      // tap sunsby: the sky behind the world flashes gold (the world itself turns gold for a moment)
      const k = (goldFlash - now) / 2200;
      c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55 * Math.sin(k * Math.PI) ** 0.6;
      c.fillStyle = '#ffc93c'; c.fillRect(0, 0, VW, VH); c.restore();
    }
    c.save(); c.globalAlpha = awake(now); renderSun(now); c.restore(); // sunsby and moonsby arrive as the world wakes
    renderRisingHeart(now);
    renderBursts(now, dt, false);

    const sp = omenP('sneeze', now);
    c.save();
    if (sp >= 0 && sp <= 1) {
      let sxs = 1, sys = 1;
      if (sp < 0.3) { const k = sp / 0.3; sxs = 1 - 0.05 * k; sys = 1 + 0.06 * k; }
      else { const k = (sp - 0.3) / 0.7; const w = Math.exp(-k * 4) * Math.cos(k * 22); sxs = 1 + 0.12 * w; sys = 1 - 0.1 * w; }
      c.translate(CX, CY); c.scale(sxs, sys); c.translate(-CX, -CY);
    }
    renderRays(now, hue, storm);
    c.save(); c.globalAlpha = awake(now); renderMoon(now, false); c.restore();
    if (pf.cur.angel > 0.02) renderWorldWings(now);
    renderEars(now);
    renderPlanet(now, dt);
    // little markers people planted sit on top of the world's face, like the scorsbys do
    renderMarks(now);
    if (markMode && pointer.seen && !pointer.down && unproject(pointer.x, pointer.y)) {
      // desktop: a see-through plant under the crosshair shows where it will land
      const ds = markSize();
      c.save(); c.globalAlpha = 0.45;
      doodle(markMode === 'head' ? 'scorsby' : markMode, pointer.x, pointer.y - ds * 0.3, ds, 7, now, 1.2 + zoom.v * 0.12);
      c.restore();
    }
    renderHearts(now);
    renderFaces(now, dt, storm);
    c.save(); c.globalAlpha = awake(now); renderMoon(now, true); c.restore();
    c.restore();

    renderFlock(now);
    renderRain(now, dt);
    renderBursts(now, dt, true);
    renderPops(now);
    if (omen && now - omen.born > omen.dur) omen = null;
  }

  function renderRays(now, hue, storm) {
    const n = 54, breathe = 1 + 0.02 * Math.sin((now / 8000) * TAU);
    const love = smooth(0, 1, (loveWash - now) / 1500);
    const on = clamp((now - intro.wake) / 250, 0, 1); // no halo while the world sleeps
    if (on <= 0) return;
    const flash = INTRO ? clamp(1 - (now - intro.wake) / 1600, 0, 1) ** 2 : 0; // it flashes on as the world wakes
    const many = Math.min(12, Math.max(0, crowd() - 1)); // more scorsbys, a thicker and wavier halo
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + now / 40000;
      const len = R * (0.07 + 0.09 * hash(i * 3.3 + boil * 0.2) + (storm + love) * 0.35 * hash(i + boil)) * breathe * on * (1 + 1.8 * flash);
      const r1 = R * 1.12;
      c.beginPath();
      wobbleLine(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1, CX + Math.cos(a) * (r1 + len), CY + Math.sin(a) * (r1 + len), i * 7 + (many ? boil : 0), 0.6 + many * 0.35);
      c.strokeStyle = `hsla(${(hue + i * 12) % 360},85%,58%,${Math.min(1, 0.6 + (storm + love + flash) * 0.4)})`;
      c.lineWidth = 1.8 + many * 0.4 + flash * 1.6; c.stroke();
    }
  }

  // the world is the color of everyone living on it, blended. all classic blue, and it is classic blue.
  let worldCol = '#00b4ff';
  function blendWorld(now, storm) {
    const unison = omenP('unison', now) >= 0 ? unisonColor(omen.seed)[1] : null;
    let r = 0, g = 0, b = 0, n = 0;
    for (const s of everyone()) {
      if (s.leaving) continue;
      const ci = storm > 0.2 ? 8 : unison || s.c;
      const w = ci === 8 ? 0.3 : 1;
      const [cr, cg, cb] = rgbOf(colorOf(ci, now, s.seed));
      r += cr * w; g += cg * w; b += cb * w; n += w;
    }
    worldCol = n ? `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})` : T.ocean;
  }
  const ocean = () => pf.cur.gold < 0.01 ? worldCol : mixColor(worldCol, '#ffc93c', pf.cur.gold);
  function renderEars(now) {
    const wig = Math.max(env(omenP('ears', now)), clamp((earPerk - now) / 1200, 0, 1));
    const lw = 70 * L;
    pf.ears = [];
    for (const side of [-1, 1]) {
      const wob = wig * Math.sin(now / 70 + side) * 0.08;
      const lift = 1 + wig * 0.08;
      let bx = CX + side * 515 * L * lift, by = CY - 515 * L * lift + wob * 100 * L;
      if (pf.spinA) { // when the face spins, the ears go round with it
        const a = pf.spinA, dx = bx - CX, dy = by - CY;
        bx = CX + dx * Math.cos(a) - dy * Math.sin(a); by = CY + dx * Math.sin(a) + dy * Math.cos(a);
      }
      const q = pull[side < 0 ? 'earL' : 'earR'];
      const ex = bx + q.x, ey = by + q.y;
      const er = 300 * L * (1 + wig * 0.06);
      wobbleCircle(ex, ey, er + lw, side * 31, 1.4, 0); c.fillStyle = DARK; c.fill();
      wobbleCircle(ex, ey, er, side * 37, 1.4, 0); c.fillStyle = ocean(); c.fill();
      const rb = Math.max(smooth(0, 1, (loveWash - now) / 1500), stormNow);
      if (rb > 0.01 && c.createConicGradient) {
        const g = c.createConicGradient(now / 300 * side, ex, ey);
        RAINBOW.concat(RAINBOW[0]).forEach((col, i) => g.addColorStop(i / RAINBOW.length, col));
        c.save(); c.clip(); c.globalAlpha = 0.85 * rb; c.fillStyle = g; c.fillRect(ex - er, ey - er, er * 2, er * 2); c.restore();
      }
      pf.ears.push([ex, ey, er, side < 0 ? 'earL' : 'earR']);
    }
  }

  function renderPlanet(now, dt) {
    // the bold outline first, then the blue head inside it
    wobbleCircle(CX, CY, R + 70 * L, 7, 1.6, 0); c.fillStyle = DARK; c.fill();
    c.beginPath(); c.arc(CX, CY, R, 0, TAU); c.fillStyle = ocean(); c.fill();

    // land, in deeper blue. love for everyone rolls over it as a rainbow.
    const rad = Math.max(1, R * SPACING * 0.74);
    const land = new Path2D();
    const x0 = -rad * 2, x1 = VW + rad * 2, y0 = -rad * 2, y1 = VH + rad * 2;
    for (let i = 0; i < NL; i++) {
      const x = LX[i], y = LY[i], z = LZ[i];
      const cc = x * cl0 + y * sl0;
      const sz = sp0 * z + cp0 * cc;
      if (sz <= 0) continue;
      const px = CX + (y * cl0 - x * sl0) * R, py = CY - (cp0 * z - sp0 * cc) * R;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      const r = rad * (0.55 + 0.45 * sz);
      land.moveTo(px + r, py); land.arc(px, py, r, 0, TAU);
    }
    c.fillStyle = `rgba(0,40,120,${0.42 - 0.22 * smooth(1.5, 2.8, zoom.v)})`; c.fill(land);


    // night, in ballpoint hatching
    const ecl = env(omenP('eclipse', now));
    const d = maskImg.data;
    for (let my = 0, k = 3; my < MH; my++) {
      const y = (CY - (my + 0.5) * (VH / MH)) / R;
      for (let mx = 0; mx < MW; mx++, k += 4) {
        const x = ((mx + 0.5) * (VW / MW) - CX) / R;
        const r2 = x * x + y * y;
        if (r2 >= 1.002) { d[k] = 0; continue; }
        const z = Math.sqrt(Math.max(0, 1 - r2));
        const Z = cp0 * y + sp0 * z, cc = -sp0 * y + cp0 * z;
        const X = cc * cl0 - x * sl0, Y = cc * sl0 + x * cl0;
        const l = X * SUN[0] + Y * SUN[1] + Z * SUN[2];
        d[k] = 255 * Math.max(clamp((0.05 - l) / 0.16, 0, 1), ecl * 0.95);
      }
    }
    mx2.putImageData(maskImg, 0, 0);
    sx2.globalCompositeOperation = 'source-over';
    sx2.clearRect(0, 0, VW, VH);
    sx2.fillStyle = hatch; sx2.fillRect(0, 0, VW, VH);
    sx2.globalCompositeOperation = 'destination-in';
    sx2.imageSmoothingEnabled = true;
    sx2.drawImage(mask, 0, 0, VW, VH);
    c.drawImage(scratch, 0, 0, VW, VH);

    renderLoveWaves();
    renderPlanetFace(now);
    planetBlink = Math.max(0, planetBlink - dt / 900);
  }

  // the rainbow of love for everyone, rolling over land and sea alike
  function renderLoveWaves() {
    if (performance.now() < intro.wake) return; // the sleeping world is left in peace
    if (!waves.length) return;
    const bw = 0.42 / 7;
    c.save(); c.beginPath(); c.arc(CX, CY, R, 0, TAU); c.clip();
    c.lineCap = 'butt'; c.globalAlpha = 0.88;
    for (const w of waves) {
      const ref = Math.abs(w.v[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
      const a = norm(cross(w.v, ref)), b = cross(w.v, a);
      for (let q = 0; q < 7; q++) {
        const r = w.radius - (q + 0.5) * bw;
        if (r <= 0 || r >= Math.PI) continue;
        const cr = Math.cos(r), sr = Math.sin(r);
        c.beginPath();
        let pen = false;
        for (let i = 0; i <= 120; i++) {
          const th = (i / 120) * TAU, ct = Math.cos(th), st = Math.sin(th);
          const [x, y, z] = project(w.v[0] * cr + (a[0] * ct + b[0] * st) * sr, w.v[1] * cr + (a[1] * ct + b[1] * st) * sr, w.v[2] * cr + (a[2] * ct + b[2] * st) * sr);
          if (z < -0.02) { pen = false; continue; }
          if (pen) c.lineTo(x, y); else { c.moveTo(x, y); pen = true; }
        }
        c.strokeStyle = RAINBOW[q]; c.lineWidth = bw * R * 1.2; c.stroke();
      }
    }
    c.restore();
  }

  function renderWorldWings(now) {
    const a = pf.cur.angel, flap = Math.sin(now / 400) * 0.18;
    c.save(); c.globalAlpha = Math.min(1, a * 1.5); c.lineWidth = Math.max(2, R * 0.012); c.strokeStyle = DARK;
    wing(CX - R * 1.0, CY + R * 0.22, R * 1.5 * a, -1, flap);
    wing(CX + R * 1.0, CY + R * 0.22, R * 1.5 * a, 1, flap);
    c.restore();
  }

  const GROVE_TREES = 4, GROVE_NEAR = Math.cos(4 * Math.PI / 180); // four trees within about 450 km of each other
  function groves() {
    const trees = marks.filter((m) => m.k === 'tree'), used = new Set(), found = [];
    for (const t of trees) {
      if (used.has(t)) continue;
      const near = trees.filter((o) => !used.has(o) && dot(o.v, t.v) > GROVE_NEAR);
      if (near.length < GROVE_TREES) continue;
      near.forEach((o) => used.add(o));
      found.push({ members: near, v: norm(near.reduce((a, o) => [a[0] + o.v[0], a[1] + o.v[1], a[2] + o.v[2]], [0, 0, 0])), t: Math.max(...near.map((o) => o.t)) });
    }
    return { found, used };
  }
  const markSize = () => clamp((small ? 11 : 9) * zoom.v, small ? 15 : 13, 44);
  function renderMarks(now) {
    const show = awake(now); // plants are always visible, even zoomed all the way out (once the world is awake)
    for (const m of marks) m.sx = -1e4;
    if (show <= 0 || !marks.length) return;
    const ds = markSize();
    const life = 6 * 3600 * 1000, t = Date.now();
    const { found, used } = groves();
    c.save();
    for (const m of marks) {
      if (used.has(m)) continue; // part of a grove
      const [px, py, pz] = project(...m.v);
      if (pz < 0.15) continue;
      const fade = clamp((life - (t - m.t)) / 600000, 0.25, 1);
      c.globalAlpha = show * fade * Math.min(1, pz * 3);
      doodle(m.k === 'head' ? 'scorsby' : m.k, px, py - ds * 0.3, ds, m.seed, now, 1.2 + zoom.v * 0.12);
      m.sx = px; m.sy = py - ds * 0.3; m.ss = ds;
    }
    for (const g of found) {
      const [px, py, pz] = project(...g.v);
      if (pz < 0.15) continue;
      const gs = ds * (1.6 + Math.min(1, (g.members.length - GROVE_TREES) * 0.1));
      c.globalAlpha = show * clamp((life - (t - g.t)) / 600000, 0.25, 1) * Math.min(1, pz * 3);
      doodle('smiletree', px, py - gs * 0.45, gs, g.members[0].seed, now, 1.2 + zoom.v * 0.12);
      g.members.forEach((m) => { m.sx = px; m.sy = py - gs * 0.45; m.ss = gs; });
    }
    c.restore();
  }

  // contagious hearts: a ring of hearts rolls out over the world; every scorsby it touches starts its own
  function renderHearts(now) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      const r = ((now - h.born) / 1000) * (h.gen ? 0.45 : 0.55);
      if (r > h.max) { hearts.splice(i, 1); continue; }
      const k = r / h.max;
      for (const s of everyone()) {
        if (h.seen.has(s.id) || angle(s.v, h.v) > r) continue;
        h.seen.add(s.id);
        s.hearts = 1500;
        if (h.gen < 2 && hearts.length < 40) hearts.push({ v: s.v, born: now, gen: h.gen + 1, max: 0.42, seen: new Set([...h.seen]), hue: h.hue + 40 });
      }
      const ref = Math.abs(h.v[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
      const a = norm(cross(h.v, ref)), b = cross(h.v, a);
      const n = h.gen ? 9 : 14, cr = Math.cos(r), sr = Math.sin(r);
      const size = (h.gen ? 6 : 9) * (1 - k * 0.6) * Math.min(1.6, zoom.v);
      for (let q = 0; q < n; q++) {
        const th = (q / n) * TAU + now / 2000;
        const ct = Math.cos(th), st = Math.sin(th);
        const v = [h.v[0] * cr + (a[0] * ct + b[0] * st) * sr, h.v[1] * cr + (a[1] * ct + b[1] * st) * sr, h.v[2] * cr + (a[2] * ct + b[2] * st) * sr];
        const [x, y, z] = project(v[0], v[1], v[2], 1.01);
        if (z <= 0.02) continue;
        c.globalAlpha = (1 - k) * Math.min(1, z * 4);
        heartPath(x, y, size); c.fillStyle = `hsl(${(h.hue + q * 9) % 360},95%,66%)`; c.fill();
        c.lineWidth = 1; c.strokeStyle = DARK; c.stroke();
      }
      c.globalAlpha = 1;
    }
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.radius = ((now - w.born) / 5200) * (Math.PI + 0.4);
      if (w.radius > Math.PI + 0.4) { waves.splice(i, 1); continue; }
      for (const s of everyone()) if (!w.seen.has(s.id) && angle(s.v, w.v) < w.radius) { w.seen.add(s.id); s.hearts = 1800; }
    }
  }

  function renderFaces(now, dt, storm) {
    const list = [...everyone()].map((s) => {
      const [x, y, z] = project(s.v[0], s.v[1], s.v[2], 1.015);
      s.sx = x; s.sy = y; s.sz = z;
      return s;
    }).filter((s) => s.sz > 0.05).sort((a, b) => a.sz - b.sz);

    for (const s of list) { s.ox *= 0.985; s.oy *= 0.985; }
    const zf = 1 + (zoom.v - 1) * 0.3;
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        let dx = (b.sx + b.ox) - (a.sx + a.ox), dy = (b.sy + b.oy) - (a.sy + a.oy);
        let d = Math.hypot(dx, dy);
        const min = (a.mine || b.mine ? 34 : 26) * (small ? 0.9 : 1) * zf;
        if (d >= min) continue;
        if (d < 0.01) { const t = rand(0, TAU); dx = Math.cos(t); dy = Math.sin(t); d = 1; }
        const push = (min - d) * 0.25, ux = dx / d, uy = dy / d;
        const wa = a.mine ? 0 : b.mine ? 1 : 0.5, wb = 1 - wa;
        a.ox -= ux * push * wa * 2; a.oy -= uy * push * wa * 2;
        b.ox += ux * push * wb * 2; b.oy += uy * push * wb * 2;
      }
    }
    const sneeze = env(omenP('sneeze', now));
    for (const s of list) { s.sx += s.ox + (sneeze ? rand(-3, 3) * sneeze : 0); s.sy += s.oy + (sneeze ? rand(-3, 3) * sneeze : 0); }

    // holding hands: scorsbys close to each other reach out (once they've arrived)
    const reach = 74 * zf;
    const pairs = new Set();
    const arrived = list.filter((s) => now - arrivedAt(s) > 700);
    for (const a of arrived) {
      const near = arrived.filter((b) => b !== a).map((b) => [b, Math.hypot(b.sx - a.sx, b.sy - a.sy)]).filter(([, d]) => d < reach).sort((p, q) => p[1] - q[1]).slice(0, 2);
      for (const [b] of near) pairs.add(a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
    }
    if (me) me.hands = [...pairs].filter((k) => k.split('|').includes(me.id)).length;
    const byId = new Map(list.map((s) => [s.id, s]));
    for (const key of pairs) {
      const [a, b] = key.split('|').map((id) => byId.get(id));
      const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2 + 3 + Math.sin(now / 300 + a.seed) * 2;
      c.beginPath();
      c.moveTo(a.sx, a.sy + a.size * 0.15); c.quadraticCurveTo((a.sx + mx) / 2, my + 8, mx - 3, my);
      c.moveTo(b.sx, b.sy + b.size * 0.15); c.quadraticCurveTo((b.sx + mx) / 2, my + 8, mx + 3, my);
      c.lineWidth = 2.2; c.strokeStyle = DARK; c.stroke();
      heartPath(mx, my, 5.5 * zf); c.fillStyle = mixColor(colorOf(a.c, now, a.seed), colorOf(b.c, now, b.seed)); c.fill();
      c.lineWidth = 1.3; c.stroke();
    }

    const unison = omenP('unison', now) >= 0 ? unisonColor(omen.seed)[1] : null;
    for (const s of list) {
      s.nextBlink -= dt;
      if (s.nextBlink < 0) { s.blink = 1; s.nextBlink = rand(2000, 7000); }
      if (s.blink > 0) s.blink = Math.max(0, s.blink - dt / 260);
      let lid = s.blink > 0.15 && s.blink < 0.85 ? 0 : 1;
      if (planetBlink > 0.15 && planetBlink < 0.85) lid = 0;
      if (light(s.v) < -0.15 || env(omenP('eclipse', now)) > 0.5) lid = 0; // asleep on the night side, smiling
      s.hearts = Math.max(0, s.hearts - dt);
      s.sing += (s.singTarget - s.sing) * 0.25;
      if (!s.mine && now - s.lastSing > 500) s.singTarget = 0;
      if (s.sing > 0.1) lid = 1;

      let tx, ty;
      if (pointer.seen && !s.mine) { tx = (pointer.x - s.sx) / 220; ty = (pointer.y - s.sy) / 220; }
      else { tx = (CX - s.sx) / (R * 2); ty = (CY - R * 0.2 - s.sy) / (R * 2); }
      const m = Math.hypot(tx, ty); if (m > 1) { tx /= m; ty /= m; }
      s.lookX += (tx - s.lookX) * 0.1; s.lookY += (ty - s.lookY) * 0.1;

      const grow = clamp((now - arrivedAt(s)) / 700, 0, 1);
      if (grow <= 0) continue;
      const fade = s.leaving ? Math.max(0, 1 - (now - s.leaving) / 900) : 1;
      const edge = Math.min(1, s.sz / 0.25);
      s.size = (s.mine ? (small ? 32 : 36) : (small ? 22 : 24)) * zf * (0.55 + 0.45 * edge) * (0.3 + 0.7 * grow) * (1 + s.sing * 0.25);

      c.save();
      c.globalAlpha = edge * fade;
      if (s.sing > 0.05) {
        const ph = (now / 600) % 1;
        for (let k = 0; k < 2; k++) {
          const p = (ph + k / 2) % 1;
          wobbleCircle(s.sx, s.sy, s.size * (0.6 + p * 1.6), s.seed + k, 0.8);
          c.strokeStyle = `rgba(255,255,255,${0.9 * s.sing * (1 - p)})`; c.lineWidth = 1.6; c.stroke();
        }
      }
      if (s.mine) {
        const p = (now / 2400) % 1;
        wobbleCircle(s.sx, s.sy, s.size * (0.62 + p * 0.5), 3, 0.7);
        c.strokeStyle = `rgba(255,255,255,${0.9 * (1 - p)})`; c.lineWidth = 1.6; c.stroke();
      }
      const ci = storm > 0.2 ? 8 : unison || s.c;
      const col = colorOf(ci, now, s.seed);
      drawFace(s.sx, s.sy - s.size * 0.06, s.size, { lid, look: [s.lookX, s.lookY], hearts: s.hearts > 0, sing: s.sing, color: col, nose: ci !== 8 && reddish(col) ? '#00b4ff' : undefined });
      c.restore();
    }
    visible = list;
  }

  // ---------- big love, in the sky
  function loveBurst(v, from, now) {
    loveWash = now + 3500;
    earPerk = now + 1500;
    setMood('hearts', 2600);
    const [fx, fy] = from || [CX, CY];
    // always: once the rainbow has rolled around the world, it keeps going, out across the universe
    bursts.push({ k: 'rings', born: now + 1900, dur: 3400 });
    // always: plus-sign sparkles all over
    bursts.push({ k: 'sparkle', born: now, dur: 3000, parts: Array.from({ length: 60 }, () => ({ x: rand(0, VW), y: rand(0, VH), s: rand(4, 11), d: rand(0, 1400) })) });
    // and one extra, different each time
    if (v === 0 || v === 1) bursts.push({ k: 'fountain', born: now, dur: 3200, parts: Array.from({ length: 70 }, (_, i) => ({ x: fx, y: fy, vx: rand(-0.35, 0.35), vy: rand(-0.75, -0.3), s: rand(5, 12), h: i * 13 })) });
    if (v === 2) bursts.push({ k: 'confetti', born: now, dur: 4200, parts: Array.from({ length: 36 }, () => { const a = rand(0, TAU); return { x: CX + Math.cos(a) * R * 1.05, y: CY + Math.sin(a) * R * 1.05, vx: Math.cos(a) * rand(0.05, 0.16), vy: Math.sin(a) * rand(0.05, 0.16) - 0.05, s: rand(14, 26), c: (Math.random() * 8) | 0, r: rand(-1, 1) }; }) });
    if (v === 3) bursts.push({ k: 'angels', born: now, dur: 4500, parts: Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU + rand(-0.2, 0.2); return { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R, vx: Math.cos(a) * rand(0.06, 0.12), vy: Math.sin(a) * rand(0.06, 0.12) - 0.03, s: rand(26, 40), seed: rand(0, 99) }; }) });
  }
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function renderBursts(now, dt, front) {
    if (performance.now() < intro.wake) return; // the sleeping world is left in peace
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], k = (now - b.born) / b.dur;
      if (k > 1) { if (front) bursts.splice(i, 1); continue; }
      if (k < 0) continue;
      if (b.k === 'rings' && !front) {
        const maxR = Math.hypot(VW, VH) * 0.95, bw = Math.max(16, R * 0.11);
        RAINBOW.forEach((col, q) => {
          const r = R * 1.15 + (maxR - R) * ease(k) - q * bw;
          if (r < R * 1.15) return;
          c.beginPath(); c.arc(CX, CY, r, 0, TAU);
          c.strokeStyle = col; c.globalAlpha = 0.95 * (1 - k * k); c.lineWidth = bw * 1.15; c.stroke();
        });
        c.globalAlpha = 1;
      }
      if (!front) continue;
      if (b.k === 'fountain') {
        for (const p of b.parts) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.0009 * dt;
          c.globalAlpha = 1 - k;
          heartPath(p.x, p.y, p.s); c.fillStyle = `hsl(${p.h % 360},95%,64%)`; c.fill(); c.lineWidth = 1.2; c.strokeStyle = DARK; c.stroke();
        }
        c.globalAlpha = 1;
      }
      if (b.k === 'sparkle') {
        for (const p of b.parts) {
          const t = (now - b.born - p.d) / 900;
          if (t < 0 || t > 1) continue;
          const s = p.s * Math.sin(t * Math.PI);
          c.beginPath(); c.moveTo(p.x - s, p.y); c.lineTo(p.x + s, p.y); c.moveTo(p.x, p.y - s); c.lineTo(p.x, p.y + s);
          c.strokeStyle = `hsl(${(p.x + now / 5) % 360},90%,58%)`; c.lineWidth = 2; c.stroke();
        }
      }
      if (b.k === 'angels') {
        for (const p of b.parts) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          c.globalAlpha = 1 - smooth(0.7, 1, k);
          doodle('angel', p.x, p.y, p.s, p.seed, now, 1.3);
        }
        c.globalAlpha = 1;
      }
      if (b.k === 'confetti') {
        for (const p of b.parts) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 0.00002 * dt;
          c.save(); c.globalAlpha = 1 - smooth(0.7, 1, k);
          c.translate(p.x, p.y); c.rotate(Math.sin(now / 300 + p.r * 5) * 0.4);
          drawFace(0, 0, p.s, { color: colorOf(p.c, now, p.r), hearts: true });
          c.restore();
        }
      }
    }
  }

  // ---------- the sky
  const SKY_KINDS = ['angel', 'angel', 'lips', 'spring', 'bell', 'umbrella', 'globe', 'sun', 'head3', 'heart', 'eye', 'yolksby', 'yolksby', 'blocksby', 'manyeye', 'bug'];
  function spawnSky(anywhere) {
    const fromLeft = Math.random() < 0.5;
    const kind = pick(SKY_KINDS);
    sky.push({
      kind, s: rand(20, small ? 32 : 40), seed: rand(0, 1000),
      x: anywhere ? rand(0, VW) : fromLeft ? -50 : VW + 50, y: kind === 'umbrella' && !anywhere ? -40 : rand(VH * 0.1, VH * 0.85),
      vx: (fromLeft ? 1 : -1) * rand(0.008, 0.025), bob: rand(0, TAU), born: performance.now(), ring: 0,
    });
  }
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: rand(2, 4.5), per: rand(2600, 7000), ph: rand(0, TAU) }));
  let shooting = null, nextShoot = performance.now() + rand(4000, 9000);
  function renderStars(now, dt) {
    c.save();
    c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    const n = small ? 36 : stars.length;
    for (let i = 0; i < n; i++) {
      const st = stars[i];
      const tw = Math.max(0, Math.sin(now / st.per * TAU + st.ph)) ** 3; // mostly resting, now and then a glint
      if (tw < 0.03) continue;
      const x = st.x * VW, y = st.y * VH, a = st.s * (0.6 + 0.6 * tw);
      c.globalAlpha = 0.55 * tw; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(x - a, y); c.lineTo(x + a, y); c.moveTo(x, y - a); c.lineTo(x, y + a); c.stroke();
    }
    // a shooting star every so often
    if (!shooting && now > nextShoot) {
      const ang = rand(0.35, 0.7) * (Math.random() < 0.5 ? 1 : -1);
      shooting = { x: rand(0.15, 0.85) * VW, y: rand(0.02, 0.35) * VH, ang, born: now, dur: rand(700, 1100), len: rand(0.28, 0.45) * Math.max(VW, VH) };
    }
    if (shooting) {
      const k = (now - shooting.born) / shooting.dur;
      if (k >= 1) { shooting = null; nextShoot = now + rand(6000, 16000); }
      else {
        const dx = Math.sign(shooting.ang) * Math.cos(Math.abs(shooting.ang)), dy = Math.sin(Math.abs(shooting.ang));
        const head = shooting.len * k, tail = Math.max(0, head - shooting.len * 0.35);
        const hx = shooting.x + dx * head, hy = shooting.y + dy * head, tx = shooting.x + dx * tail, ty = shooting.y + dy * tail;
        const g = c.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.85)');
        c.globalAlpha = Math.sin(k * Math.PI) ** 0.5; c.strokeStyle = g; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx, hy); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(hx - 3, hy); c.lineTo(hx + 3, hy); c.moveTo(hx, hy - 3); c.lineTo(hx, hy + 3); c.stroke();
      }
    }
    c.restore();
  }

  function renderSky(now, dt) {
    const want = small ? 5 : 9;
    if (now < intro.sky) return;
    const filling = now < intro.sky + 5000;
    if (sky.length < want && Math.random() < (filling ? 0.035 : 0.02)) spawnSky(filling);
    for (let i = sky.length - 1; i >= 0; i--) {
      const d = sky[i];
      d.x += d.vx * dt;
      if (d.kind === 'umbrella') d.y += 0.012 * dt;
      const y = d.y + Math.sin(now / 1400 + d.bob) * 10;
      d.cy = y;
      if (d.x < -80 || d.x > VW + 80 || d.y > VH + 80) { sky.splice(i, 1); continue; }
      const dd = Math.hypot(d.x - CX, y - CY);
      c.globalAlpha = smooth(R * 1.3, R * 1.6, dd) * Math.min(1, (now - d.born) / 1200);
      if (c.globalAlpha > 0.02) doodle(d.kind, d.x, y, d.s, d.seed, now, 1.4, d.ring);
      c.globalAlpha = 1;
    }
  }
  function renderPops(now) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i], k = (now - p.born) / 600;
      if (k > 1) { pops.splice(i, 1); continue; }
      c.beginPath();
      for (let q = 0; q < 10; q++) {
        const a = (q / 10) * TAU + p.seed, r1 = 6 + k * 22, r2 = r1 + 8 * (1 - k);
        wobbleLine(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1, p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2, q, 0.3);
      }
      c.strokeStyle = `hsla(${(p.seed * 50) % 360},85%,55%,${1 - k})`; c.lineWidth = 1.8; c.stroke();
    }
  }

  // the moon's real phase: 0 new, 0.5 full, from a known new moon and the synodic month
  function moonPhase(t = Date.now()) {
    const SYN = 29.530588853, NEW = Date.UTC(2000, 0, 6, 18, 14);
    return ((((t - NEW) / 86400000) % SYN) + SYN) % SYN / SYN;
  }
  function phaseName(p) {
    const names = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
    return names[Math.round(p * 8) % 8];
  }

  // sunsby and moonsby are scorsbys too
  function orbFace(x, y, r, o) {
    const k = r / 645, P = (px, py) => [x + px * k, y + py * k];
    const circ = (px, py, rr, col) => { const [qx, qy] = P(px, py); wobbleCircle(qx, qy, rr * k, o.seed + px + py, 0.8, 0); c.fillStyle = col; c.fill(); };
    circ(-515, -515, 395, DARK); circ(515, -515, 395, DARK); circ(0, 0, 740, DARK);
    circ(-515, -515, 300, o.fill); circ(515, -515, 300, o.fill); circ(0, 0, 645, o.fill);
    for (const [a, b, cr] of o.spots || []) circ(a, b, cr, o.spot);
    if (o.phase != null) {
      // the part of moonsby in shadow, as the real moon is tonight (lit from the right while waxing)
      // the shadow covers the whole of moonsby, ears and all
      const t = Math.cos(o.phase * TAU), hr = 645 * k, big = 1060 * k;
      c.save(); c.translate(x, y); if (o.phase > 0.5) c.scale(-1, 1);
      c.beginPath(); c.arc(0, 0, hr, 0, TAU);
      for (const sd of [-1, 1]) { c.moveTo(sd * 515 * k + 300 * k, -515 * k); c.arc(sd * 515 * k, -515 * k, 300 * k, 0, TAU); }
      c.clip();
      c.beginPath();
      c.moveTo(0, -big);
      c.arc(0, 0, big, -Math.PI / 2, Math.PI / 2, true);
      c.ellipse(0, 0, big * Math.abs(t), big, 0, Math.PI / 2, -Math.PI / 2, t > 0);
      c.fillStyle = 'rgba(40,40,90,0.42)'; c.fill();
      c.restore();
    }
    if (o.cheeks) for (const sd of [-1, 1]) { const [px, py] = P(sd * 430, 190); c.beginPath(); c.ellipse(px, py, 115 * k, 62 * k, 0, 0, TAU); c.fillStyle = o.cheeks; c.fill(); }
    c.lineCap = 'round';
    for (const ex of [-258, 258]) {
      const [px, py] = P(ex, -82);
      if (o.hearts) { heartPath(px, py, 230 * k); c.fillStyle = '#ff3d6e'; c.fill(); }
      else if (o.closed) { c.beginPath(); c.arc(px, py - 40 * k, 172 * k, 0, Math.PI); c.lineWidth = 95 * k; c.strokeStyle = DARK; c.stroke(); }
      else {
        c.beginPath(); c.arc(px, py, 250 * k, 0, TAU); c.fillStyle = '#fff'; c.fill();
        c.beginPath(); c.arc(px + (o.look?.[0] || 0) * 100 * k, py + (o.look?.[1] || 0) * 100 * k, 112 * k, 0, TAU); c.fillStyle = DARK; c.fill();
      }
    }
    circ(0, 131, o.noseR || 125, o.nose);
    const [mx, my] = P(0, 303);
    c.beginPath(); c.arc(mx, my, 172 * k, 0, Math.PI); c.lineWidth = 95 * k; c.strokeStyle = DARK; c.stroke();
  }

  // place sunsby or moonsby off in the direction of the real sun or moon, gliding as the world turns
  function placeOrb(st, v, avoid) {
    const [vx, vy] = viewOf(v);
    const l = Math.hypot(vx, vy);
    // when it points almost straight at you (or away), its direction on screen means little: lean on the old one
    if (l > 1e-3) {
      const w = 0.04 * smooth(0.05, 0.5, l);
      st.dx += (vx / l - st.dx) * w; st.dy += (-vy / l - st.dy) * w;
      const m = Math.hypot(st.dx, st.dy) || 1; st.dx /= m; st.dy /= m;
    }
    const dist = R * 2.05;
    let a = Math.atan2(st.dy, st.dx), x, y;
    for (let k = 0; k < 10; k++) {
      x = CX + Math.cos(a) * dist; y = CY + Math.sin(a) * dist;
      // it may wander off the left and right edges, but stays between the header and the buttons
      y = clamp(y, 120, VH - 200);
      if (Math.hypot(x - CX, y - CY) < R * 1.6) x = CX + (Math.cos(a) < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (R * 1.6) ** 2 - (y - CY) ** 2));
      // and the moon steps aside rather than sitting right on top of the sun
      if (!avoid || Math.hypot(x - avoid[0], y - avoid[1]) > avoid[2]) break;
      a += 0.3;
    }
    if (!st.ok) Object.assign(st, { x, y, ok: true });
    st.x += (x - st.x) * 0.08; st.y += (y - st.y) * 0.08;
    return [st.x, st.y];
  }

  const sunAt = { dx: 1, dy: -0.4, x: 0, y: 0, ok: false };
  const moonAt = { dx: -1, dy: -0.4, x: 0, y: 0, ok: false };
  function renderSun(now) {
    // sunsby: off in the direction the light comes from, wide awake
    let [x, y] = placeOrb(sunAt, SUN);
    const ecl = env(omenP('eclipse', now));
    const r = R * 0.17;
    c.save();
    c.beginPath();
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU + now / 9000, r1 = r * 1.3, r2 = r * (1.75 + 0.3 * hash(k + boil * 0.3));
      wobbleLine(x + Math.cos(a) * r1, y + Math.sin(a) * r1, x + Math.cos(a) * r2, y + Math.sin(a) * r2, k, 0.6);
    }
    c.strokeStyle = '#ff9a28'; c.lineWidth = 2.4; c.lineCap = 'round'; c.stroke();
    const look = [clamp((CX - x) / R, -1, 1) * 0.8, clamp((CY - y) / R, -1, 1) * 0.8];
    orbFace(x, y, r, { fill: '#ffd23f', nose: '#ff7a1a', cheeks: 'rgba(255,120,120,0.45)', closed: ecl > 0.3, look, seed: 11 });
    c.restore();
    moon.sunX = x; moon.sunY = y; moon.sunR = r; sunAt.r = r;
  }

  function renderMoon(now, front) {
    // moonsby: pale and sleepy. in an eclipse it goes over and gives sunsby a hug.
    // moonsby sits where the real moon is, relative to sunsby
    const ecl = env(omenP('eclipse', now));
    const r = R * 0.15 * (1 + ecl * 0.15);
    let [x, y] = placeOrb(moonAt, MOON, moon.sunX != null ? [moon.sunX, moon.sunY, (moon.sunR + r) * 2.2] : null);
    const z = 0;
    if (ecl > 0 && moon.sunX != null) {
      const side = moon.sunX > CX ? -1 : 1;
      const hx = moon.sunX + side * moon.sunR * 1.55, hy = moon.sunY + moon.sunR * 0.1;
      x += (hx - x) * ecl; y += (hy - y) * ecl;
    }
    const isFront = ecl > 0.2; // behind the world, unless it has gone over to hug sunsby
    if (isFront !== front) return;
    Object.assign(moon, { x, y, r, z });
    orbFace(x, y, r, {
      fill: '#f4ecc9', spot: '#e2d6a6', spots: [[-300, 260, 90], [330, 300, 70], [380, -250, 60], [-420, -80, 50], [80, 480, 55]],
      nose: '#c9b98a', noseR: 105, closed: !(moon.awake > now), cheeks: ecl > 0.3 ? 'rgba(255,120,150,0.5)' : null, seed: 3, phase: moonPhase(),
    });
    if (ecl > 0.35) {
      // little hearts rise from the hug
      const mx = (x + moon.sunX) / 2;
      for (let i = 0; i < 4; i++) {
        const t = (now / 1100 + i / 4) % 1;
        c.globalAlpha = ecl * (1 - t);
        heartPath(mx + Math.sin(t * 6 + i) * r * 0.4, y - r * 1.2 - t * r * 2.2, r * 0.22); c.fillStyle = '#ff3d6e'; c.fill();
        c.lineWidth = 1.2; c.strokeStyle = DARK; c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  function renderRisingHeart(now) {
    const p = omenP('heartstar', now);
    if (p < 0) return;
    const o = env(p), rise = smooth(0, 0.5, p);
    const x = CX, y = CY - R * (0.2 + 1.45 * rise), r = R * (0.25 + 0.2 * rise);
    c.save(); c.globalAlpha = o;
    c.beginPath();
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * TAU + now / 2000, r1 = r * 1.2, r2 = r * (1.6 + 0.3 * hash(k + boil));
      wobbleLine(x + Math.cos(a) * r1, y + Math.sin(a) * r1, x + Math.cos(a) * r2, y + Math.sin(a) * r2, k, 0.8);
    }
    c.strokeStyle = '#ff5fae'; c.lineWidth = 2.2; c.stroke();
    heartPath(x, y, r); c.fillStyle = '#ff3d6e'; c.fill(); c.lineWidth = 2; c.strokeStyle = ink(); c.stroke();
    c.restore();
  }

  function renderFlock(now) {
    const p = omenP('flock', now);
    if (p < 0) return;
    const dir = omen.seed % 2 ? 1 : -1;
    for (let i = 0; i < 7; i++) {
      const t = p * 1.25 - i * 0.04;
      if (t < 0 || t > 1) continue;
      const x = dir > 0 ? -60 + t * (VW + 120) : VW + 60 - t * (VW + 120);
      const y = VH * 0.24 + Math.sin(t * 9 + i) * 26 + (i % 3) * 30 - 30;
      const s = 26 + (i % 3) * 6;
      const flap = Math.sin(now / 110 + i) * 0.35;
      c.save(); c.lineWidth = 1.2; c.strokeStyle = charInk();
      wing(x - s * 0.3, y + s * 0.05, s * 0.6, -1, flap);
      wing(x + s * 0.3, y + s * 0.05, s * 0.6, 1, flap);
      c.restore();
      doodle(i % 3 === 1 ? 'head3' : 'head', x, y, s, i * 11, now, 1.4);
    }
  }

  function renderRain(now, dt) {
    for (let i = raining.length - 1; i >= 0; i--) {
      const h = raining[i];
      if (now < h.at) continue;
      h.y += h.vy * dt; h.sw += dt / 500;
      if (h.y > VH + 30) { raining.splice(i, 1); continue; }
      const x = h.x + Math.sin(h.sw) * (h.gold ? 3 : 14);
      if (h.gold) {
        c.beginPath(); c.moveTo(x, h.y - h.s * 1.6); c.quadraticCurveTo(x + h.s, h.y, x, h.y + h.s * 0.8); c.quadraticCurveTo(x - h.s, h.y, x, h.y - h.s * 1.6);
        c.fillStyle = '#ffc93c'; c.fill(); c.lineWidth = 1; c.strokeStyle = ink(); c.stroke();
        continue;
      }
      heartPath(x, h.y, h.s * 0.5);
      c.fillStyle = `hsla(${(h.x * 0.5) % 60 + 320},90%,65%,0.9)`; c.fill();
      c.lineWidth = 1.1; c.strokeStyle = ink(); c.stroke();
    }
  }

  // ------------------------------------------------------------------ words, softly, above the world
  const whisperEl = document.getElementById('whisper');
  let whisperTimer = 0, whisperUntil = 0, nextQuote = performance.now() + 25000;
  let typer = 0;
  // whispers that come from everyone (messages, love, omens) queue up and take turns
  const waiting = [];
  let waitTimer = 0;
  function nextWhisper() {
    clearTimeout(waitTimer);
    if (!waiting.length) return;
    const now = performance.now();
    if (now < whisperUntil) { waitTimer = setTimeout(nextWhisper, whisperUntil - now + 80); return; }
    const w = waiting.shift();
    whisper(w.text, waiting.length > 2 ? Math.min(w.ms, 3000) : w.ms, true, w.link); // a long line moves a little faster
    if (waiting.length) waitTimer = setTimeout(nextWhisper, whisperUntil - performance.now() + 80);
  }
  // where a whisper's lines break: two (or more) sentences get a line each if each fits on one line;
  // otherwise the browser balances the lines. measured once, with the cursor on the end.
  function planLines(host, chars) {
    const spaces = [];
    chars.forEach((ch, j) => { if (ch === ' ') spaces.push(j); });
    const probe = document.createElement('span'); probe.style.visibility = 'hidden';
    host.appendChild(probe);
    const build = (forced) => {
      probe.textContent = '';
      const words = [];
      let start = 0;
      for (const sp of [...spaces, chars.length]) {
        const w = document.createElement('span'); w.textContent = chars.slice(start, sp).join('') + (sp === chars.length ? '▌' : '');
        if (sp === chars.length) w.style.whiteSpace = 'nowrap';
        probe.append(w); words.push([w, start - 1]);
        if (sp < chars.length) probe.append(sp === forced ? document.createElement('br') : document.createTextNode(' '));
        start = sp + 1;
      }
      const out = new Set(); let top = null, lines = 0;
      for (const [w, before] of words) {
        if (top === null || w.offsetTop > top + 2) { if (top !== null) out.add(before); top = w.offsetTop; lines++; }
      }
      return [out, lines];
    };
    let [breaks, lines] = build(-1);
    if (lines > 1) {
      const ends = spaces.filter((j) => /[.!?)]/.test(chars[j - 1] || '') && j < chars.length - 1)
        .sort((a, b) => Math.abs(a - chars.length / 2) - Math.abs(b - chars.length / 2));
      for (const e of ends) {
        const [b2, l2] = build(e);
        if (l2 === 2) { breaks = b2; breaks.add(e); break; }
      }
    }
    probe.remove();
    return breaks;
  }
  function whisper(text, ms = 4200, urgent = true, link = null, queue = false) {
    const now = performance.now();
    if (queue && (now < whisperUntil || waiting.length)) {
      waiting.push({ text, ms, link });
      if (waiting.length > 10) waiting.splice(0, waiting.length - 10);
      nextWhisper();
      return;
    }
    if (!urgent && now < whisperUntil) return;
    whisperEl.classList.remove('on');
    clearTimeout(whisperTimer); clearInterval(typer);
    whisperTimer = setTimeout(() => {
      whisperEl.textContent = '';
      whisperEl.classList.toggle('quote', !!link);
      let host = whisperEl;
      if (link) { host = document.createElement('a'); host.href = link.u; host.target = '_blank'; host.rel = 'noopener'; whisperEl.appendChild(host); }
      const full = link ? `“${text}”` : text;
      const chars = [...full];
      const breaks = planLines(host, chars); // the line breaks are decided before typing, so nothing jumps around
      const line = document.createElement('span'); line.style.whiteSpace = 'pre';
      const head = document.createTextNode(''), tail = document.createElement('span'), tailText = document.createTextNode('');
      tail.style.whiteSpace = 'nowrap'; // the cursor always rides with the last word
      const cursor = document.createElement('span'); cursor.className = 'cursor'; cursor.textContent = '▌';
      tail.append(tailText, cursor); line.append(head, tail); host.appendChild(line);
      let i = 0;
      whisperEl.classList.add('on');
      typer = setInterval(() => {
        i += 1;
        const shown = chars.slice(0, i).map((ch, j) => (breaks.has(j) ? '\n' : ch)).join('');
        const k = Math.max(shown.lastIndexOf(' '), shown.lastIndexOf('\n'));
        head.data = shown.slice(0, k + 1); tailText.data = shown.slice(k + 1);
        if (i % 3 === 0) tone.tick();
        if (i < chars.length) return;
        clearInterval(typer);
        if (link) { const t = document.createElement('span'); t.className = 'from'; t.textContent = `— ${link.t} →`; host.appendChild(t); }
        whisperTimer = setTimeout(() => whisperEl.classList.remove('on'), ms);
      }, 26);
    }, whisperEl.textContent ? 500 : 0);
    whisperUntil = now + ms + 600 + text.length * 26;
  }
  // now and then, the world remembers something: a line from the blog, a saying, the news
  const SAYINGS = [
    'maybe u should sit under a tree :-)', 'you can never unscorb.', 'dare to combine.', 'in this dream, you are a revolutionary peacemaker.',
    'go for gold.', 'joy, joy, joy. ever-new joy!', 'smile! scorbies love you.', 'love always wins.', 'you are the one you seek.',
    'scorsby never left. scorsby only played.', 'just scorsbin.', 'r͡rombo dombo di di dai.', 'experience all from the center.', 'we beglong.',
  ];
  const NEWS = [
    '>>> THIS JUST IN: there is no new news today.', '>>> THIS JUST IN: everyone is loved. more at eleven.',
    '>>> THIS JUST IN: local planet smiles for no reason.', '>>> THE FUTURE IS NOW. embrace your lil freak :-)',
    '>>> THIS JUST IN: a scrillion scorsbys, all scorsbin.', '>>> BREAKING: sunsby and moonsby seen hugging.',
  ];
  setInterval(() => {
    const now = performance.now();
    if (now < nextQuote || now < whisperUntil) return;
    nextQuote = now + rand(35000, 70000);
    const r = Math.random();
    if (r < 0.5 && window.QUOTES?.length) {
      const [q, pi] = pick(window.QUOTES);
      const [t, u] = window.POSTS[pi];
      whisper(q, 9000, false, { t, u });
    } else whisper(r < 0.78 ? pick(SAYINGS) : pick(NEWS), 5000, false);
  }, 3000);
  const side = (v) => { const l = light(v); return l > 0.1 ? 'day' : l < -0.1 ? 'night' : 'twilight'; };

  function fmtDay(d) {
    if (!d) return '';
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
  }
  function updatePresence() {
    const n = crowd();
    document.getElementById('here').textContent =
      !net.live ? (dreaming ? `dreaming of ${peers.size} scorsbys` : 'the hearth is resting') :
      n <= 1 ? 'you are the only scorsby here' : `${n} scorsbys here`;
    const el = document.getElementById('today');
    if (tally) {
      el.textContent = `love today ♥ ${tally.today.toLocaleString()}`;
      if (tally.best?.n) {
        const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = ' · '; el.appendChild(sep);
        const rec = document.createElement('span'); rec.className = tally.best.day === tally.day ? 'rec record' : 'rec';
        [...`record ♥ ${tally.best.n.toLocaleString()} ${tally.best.day === tally.day ? '(today!)' : 'on ' + fmtDay(tally.best.day)}`].forEach((ch, i) => {
          const l = document.createElement('span'); l.textContent = ch; l.style.setProperty('--i', i); rec.appendChild(l);
        });
        el.appendChild(rec);
      }
    } else el.textContent = '';
  }
  function setTally(t) {
    if (!t) return;
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date());
    tally = { ...t, day };
    if (t.record) { whisper(`a new record for love! ♥ ${t.today.toLocaleString()} today.`, 5000, true, null, true); bursts.push({ k: 'rings', born: performance.now(), dur: 2800 }); }
    updatePresence();
  }

  function tick() {
    const d = new Date();
    const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).toLowerCase();
    if (!clockEl.firstChild) clockEl.innerHTML = '<span class="ck"></span><span class="dot"> · </span><span class="ck"></span><span class="dot"> · </span><span class="ck">now here</span>';
    const [a, b] = clockEl.querySelectorAll('.ck');
    a.textContent = date; b.textContent = time;
    // date, time and now here never break in the middle. if they can't share a line, each gets its own, without the dots.
    if (!clockEl.classList.contains('stacked')) {
      const tops = [...clockEl.querySelectorAll('.ck')].map((e) => e.offsetTop);
      if (tops.some((t) => t !== tops[0])) clockEl.classList.add('stacked');
    }
  }
  const clockEl = document.getElementById('clock');
  const restack = () => { clockEl.classList.remove('stacked'); tick(); };
  addEventListener('resize', restack);
  document.fonts?.ready.then(restack); // the header settles once its fonts arrive
  setInterval(tick, 1000); tick();

  // ------------------------------------------------------------------ the hearth
  const net = { ws: null, live: false, tries: 0, url: '' };
  const meta = document.querySelector('meta[name="hearth"]')?.content.trim();
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  // where the hearth is: named in the page, or local development, or (served by the hearth worker itself) right here
  net.url = params.get('hearth') || meta || (local && location.port !== '8787' ? `ws://${location.hostname}:8787/hearth`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/hearth`);
  let dreaming = false;

  function connect() {
    if (!net.url) return alone();
    let ws;
    try { ws = new WebSocket(`${net.url}?tz=${-new Date().getTimezoneOffset()}&c=${encodeURIComponent(myColor)}&n=${encodeURIComponent(myName)}`); } catch { return alone(); }
    net.ws = ws;
    ws.onopen = () => { net.live = true; net.tries = 0; updatePresence(); };
    ws.onmessage = (e) => { try { receive(JSON.parse(e.data)); } catch (err) { console.warn(err); } };
    ws.onclose = () => {
      const was = net.live;
      net.live = false; net.ws = null;
      for (const id of [...peers.keys()]) if (!id.startsWith('dream')) peers.delete(id);
      updatePresence();
      if (was) whisper('the hearth flickered. finding it again…');
      if (!me) alone();
      setTimeout(connect, Math.min(30000, 1500 * 2 ** net.tries++));
    };
  }
  setInterval(() => { if (net.live) net.ws.send('ping'); }, 25000);
  function send(m) { if (net.live && net.ws?.readyState === 1) net.ws.send(JSON.stringify(m)); }

  let welcomed = false;
  function welcome() {
    if (welcomed) return;
    welcomed = true;
    whisper('welcome to planet scorsby, a world of peace, love, and joy for everyone everywhere. please enjoy your stay :-)', 6500);
  }
  function alone() {
    if (me) return;
    const tz = -new Date().getTimezoneOffset();
    me = scorsby({ id: 'me', lat: rand(-20, 50), lon: clamp(tz / 4, -170, 170) + rand(-6, 6), tz, c: myColor, n: myName }, true);
    faceToward(me);
    updatePresence();
    welcome();
  }
  setInterval(() => { if (!net.live && !omen && Math.random() < 0.5) startOmen(pick(Object.keys(OMEN_DUR))); }, 70000);

  const addMark = (m) => marks.push({ v: vec(m.lat, m.lon), k: m.k, n: m.n || '', t: m.at || m.t || Date.now(), seed: rand(0, 99), sx: -1e4 });
  function planted(m) {
    const before = groves().found.length;
    addMark(m);
    if (m.k === 'tree' && groves().found.length > before) whisper('the trees grew together into a tree of smiles.', 4200, true, null, true);
  }
  setInterval(() => { const t = Date.now(); marks = marks.filter((m) => t - m.t < 6 * 3600 * 1000); }, 60000);

  function receive(m) {
    const now = performance.now();
    switch (m.t) {
      case 'hello': {
        const old = me;
        me = scorsby(m.you, true);
        for (const p of m.here) peers.set(p.id, scorsby(p));
        trails = m.trails || [];
        marks = []; (m.marks || []).forEach(addMark);
        setTally(m.tally);
        if (!old) faceToward(me);
        updatePresence();
        if (!old) welcome();
        break;
      }
      case 'join': {
        const s = scorsby(m.p);
        peers.set(s.id, s);
        updatePresence();
        earPerk = now + 1400; setMood('o', 1200); setTimeout(() => setMood('grin', 2500), 1200);
        whisper(`${nameOf(s)} arrived on the ${side(s.v)} side.`, 3800, false);
        tone.arrive();
        break;
      }
      case 'leave': {
        const s = peers.get(m.id);
        if (!s) break;
        s.leaving = now;
        voices.hush(m.id);
        setTimeout(() => { peers.delete(m.id); updatePresence(); }, 900);
        whisper(`${nameOf(s)} went home.`, 3000, false);
        break;
      }
      case 'move': { const s = peers.get(m.id); if (s) place(s, m.lat, m.lon); break; }
      case 'color': { const s = peers.get(m.id); if (s) s.c = m.c; break; }
      case 'name': {
        const s = me && m.id === me.id ? me : peers.get(m.id);
        if (s) s.n = m.n;
        if (s === me && m.n !== myName) { myName = m.n; store.set('scorsby-name', m.n); nameIn.value = m.n; paintSwatch(); }
        break;
      }
      case 'blink': { const s = peers.get(m.id); if (s) s.blink = 1; break; }
      case 'poke': {
        setTally(m.tally);
        if (me && m.from === me.id) break;
        hearts.push({ v: vec(m.lat, m.lon), born: now, gen: 0, max: 0.8, seen: new Set([m.from]), hue: rand(300, 360) });
        tone.poke();
        break;
      }
      case 'mark': planted(m); break;
      case 'unmarked': whisper(`your ${lastPlanted || 'plant'} needs a moment to take root. try again in a few seconds.`, 3600); break;
      case 'omen': startOmen(m.k, m.seed); break;
      case 'say': {
        // a message for everyone (already boinked by the hearth)
        const s = me && m.id === me.id ? me : peers.get(m.id);
        if (s) s.blink = 1;
        const who = s === me ? 'you' : s ? nameOf(s) : 'someone';
        whisper(`${who}: “${String(m.text || '').slice(0, 80)}”`, 5200 + String(m.text || '').length * 45, true, null, true);
        break;
      }
      case 'echo': {
        // a kind message from earlier, heard again while the world is quiet
        const who = m.n ? `${m.n} scorsby` : 'a scorsby', text = String(m.text || '').slice(0, 80);
        whisper(`earlier, ${who}: “${text}”`, 5200 + text.length * 45, true, null, true);
        break;
      }
      case 'said': {
        clearTimeout(sayWait); sayBtn.disabled = false;
        if (m.ok) { sayIn.value = ''; youWin.hidden = true; }
        else whisper({
          wait: 'one message at a time. try again in a little while.',
          empty: 'that message was empty. try some words.',
          link: 'links can\'t travel here, only words.',
          resting: 'the hearth couldn\'t check that one just now. try again soon.',
        }[m.why] || 'that message got lost on the way.', 3600);
        break;
      }
      case 'together':
        planetBlink = 1;
        for (const s of everyone()) s.blink = 1;
        whisper('you blinked together. the world blinked too.');
        tone.together();
        break;
      case 'all': {
        trails.push({ a: m.a, t: m.at || Date.now(), k: 'all' });
        setTally(m.tally);
        if (me && m.from === me.id) break;
        const v = vec(...m.a);
        waves.push({ v, born: now, radius: 0, seen: new Set() });
        const from = peers.get(m.from);
        loveBurst(m.v ?? 0, from && from.sz > 0 ? [from.sx, from.sy] : null, now);
        whisper(`${from ? nameOf(from) : 'someone'} loves you.`, 4200, true, null, true);
        tone.swell();
        break;
      }
      case 'sing': {
        const s = peers.get(m.id);
        if (!s) break;
        if (!s.singTarget) whisper(`${nameOf(s)} is singing.`, 3200, false);
        s.singTarget = m.a; s.freq = m.f; s.lastSing = now;
        voices.sing(m.id, m.f, m.a, s.sx);
        break;
      }
      case 'hush': { const s = peers.get(m.id); if (s) s.singTarget = 0; voices.hush(m.id); break; }
    }
  }

  function faceToward(s) {
    view.lon = s.lon + 25; view.lat = clamp(s.lat * 0.6, -30, 40); setView();
    view.auto = false; view.idleAt = performance.now() + 6000;
  }

  // ------------------------------------------------------------------ touching
  const tip = document.getElementById('tip');
  function hit(x, y) {
    let best = null, bd = small ? 26 : 18;
    for (const s of visible) {
      const d = Math.hypot(s.sx - x, s.sy - y);
      if (d < Math.max(bd, s.size * 0.55) && (!best || d < bd)) { best = s; bd = d; }
    }
    return best;
  }
  function hitPart(x, y) {
    if (!pf.hit || 1 - smooth(1.02, 2.0, zoom.v) < 0.5) return null;
    for (const [ax, ay, ar, k] of pf.hit.ants) if (Math.hypot(x - ax, y - ay) < ar) return k;
    for (const [ax, ay, ar, k] of pf.hit.extra) if (Math.hypot(x - ax, y - ay) < ar) return k;
    const [nx, ny, nr] = pf.hit.nose;
    if (Math.hypot(x - nx, y - ny) < nr * 1.3) return 'nose';
    for (const [ex, ey, er, sd] of pf.hit.eyes) if (Math.hypot(x - ex, y - ey) < er) return sd < 0 ? 'eyeL' : 'eyeR';
    const [mx, my, mr] = pf.hit.mouth;
    if (Math.hypot(x - mx, y - my) < mr) return 'mouth';
    for (const [ex, ey, er, k] of pf.ears || []) if (Math.hypot(x - ex, y - ey) < er) return k;
    return null;
  }
  const hitSky = (x, y) => sky.find((d) => Math.hypot(d.x - x, (d.cy ?? d.y) - y) < d.s * 0.7);
  const hitMoon = (x, y) => moon.r && Math.hypot(moon.x - x, moon.y - y) < moon.r * 1.2;
  const hitMark = (x, y) => marks.find((m) => Math.hypot(m.sx - x, m.sy - y) < m.ss * 0.5);
  function localTime(tz) {
    const d = new Date(Date.now() + (tz + new Date().getTimezoneOffset()) * 60000);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  function showTip(s, x, y, text) {
    if (!s && !text) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.textContent = text || (s.mine ? `you · ${nameOf(s)} · drag to wander · hold to love everyone` : `${nameOf(s)} · ${localTime(s.tz)} there`);
    // stay on screen: slide in from the edges (and wrap, if it's long)
    const half = tip.offsetWidth / 2, ax = s ? s.sx : x;
    tip.style.left = `${clamp(ax, half + 10, Math.max(half + 10, VW - half - 10))}px`;
    tip.style.top = `${Math.max(tip.offsetHeight + 26, s ? s.sy - s.size * 0.4 : y - 14)}px`;
  }

  let tipHold = null; // a tapped scorsby's tip, held for a moment on touch screens
  const touches = new Map();
  let pinch = null, holdTimer = 0, lastTap = 0;
  cv.addEventListener('pointerdown', (e) => {
    tone.wake(); lastActive = performance.now();
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    try { cv.setPointerCapture(e.pointerId); } catch {}
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom.target };
      clearTimeout(holdTimer); pointer.down = false;
      return;
    }
    Object.assign(pointer, { down: true, x: e.clientX, y: e.clientY, moved: 0, held: false, seen: e.pointerType === 'mouse' });
    const s = hit(e.clientX, e.clientY);
    pointer.onMe = s && s.mine;
    pointer.part = s ? null : hitPart(e.clientX, e.clientY);
    if (pointer.part) { const q = pull[pointer.part]; q.held = true; pointer.px0 = e.clientX - q.x; pointer.py0 = e.clientY - q.y; }
    if (pointer.onMe) holdTimer = setTimeout(() => { if (pointer.moved < 6) { pointer.held = true; loveEveryone(); } }, 650);
  });
  cv.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      zoom.target = clamp(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, 0.75, 7);
      return;
    }
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (e.pointerType === 'mouse') pointer.seen = true;
    lastActive = performance.now();
    if (!pointer.down) {
      const s = hit(e.clientX, e.clientY);
      const mk = !s && hitMark(e.clientX, e.clientY);
      cv.classList.toggle('pointing', !!(s || mk || markMode || (sunAt.r && Math.hypot(e.clientX - sunAt.x, e.clientY - sunAt.y) < sunAt.r * 1.3) || hitPart(e.clientX, e.clientY) || hitSky(e.clientX, e.clientY) || hitMoon(e.clientX, e.clientY)));
      if (mk) {
        const left = Math.max(1, Math.round((6 * 3600 * 1000 - (Date.now() - mk.t)) / 3600000));
        showTip(null, mk.sx, mk.sy - mk.ss * 0.4, `${mk.n ? mk.n + ' scorsby' : 'someone'}'s ${mk.k} · fades in ~${left}h`);
      } else showTip(s);
      return;
    }
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    if (pointer.moved < 6) return;
    clearTimeout(holdTimer);
    showTip(null);
    if (pointer.part) {
      const q = pull[pointer.part];
      let x = e.clientX - pointer.px0, y = e.clientY - pointer.py0;
      const d = Math.hypot(x, y), max = R * 1.4;
      if (d > max) { x *= max / d; y *= max / d; }
      q.x = x; q.y = y; q.vx = q.vy = 0;
      return;
    }
    if (pointer.onMe && me) {
      const ll = unproject(e.clientX, e.clientY);
      if (ll) { place(me, ll[0], ll[1]); sendMove(); }
    } else {
      pointer.dragging = true; cv.classList.add('grabbing');
      const k = (90 / R) * 0.9;
      view.lon -= dx * k; view.lat = clamp(view.lat + dy * k, -70, 70);
      view.vlon = -dx * k; view.auto = false; setView();
    }
  });
  const endPointer = (e) => {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    clearTimeout(holdTimer);
    const wasTap = pointer.down && pointer.moved < 6 && !pointer.held;
    if (pointer.part) {
      const q = pull[pointer.part];
      q.held = false;
      if (Math.hypot(q.x, q.y) > R * 0.25) tone.boing(Math.hypot(q.x, q.y) / R);
      pointer.part = null;
    }
    pointer.down = false; pointer.dragging = false; cv.classList.remove('grabbing');
    view.idleAt = performance.now() + 5000;
    if (e.pointerType !== 'mouse') pointer.seen = false;
    if (pointer.onMe && pointer.moved >= 6) { sendMove(true); whisper(`you wandered to the ${side(me.v)} side.`, 2600, false); }
    if (!wasTap || e.type === 'pointercancel') return;
    tap(e.clientX, e.clientY, e.pointerType);
  };
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('pointerleave', () => { if (!pointer.down) { pointer.seen = false; showTip(null); } });

  function heartsAt(v, from) {
    hearts.push({ v, born: performance.now(), gen: 0, max: 0.8, seen: new Set([from || '']), hue: rand(300, 360) });
    tone.poke();
  }

  function tap(x, y, type = 'mouse') {
    const now = performance.now();
    tipHold = null; if (type !== 'mouse') showTip(null);
    if (markMode) {
      const ll = unproject(x, y);
      if (!ll) return;
      const m = { lat: ll[0], lon: ll[1], k: markMode, n: myName, at: Date.now() };
      if (net.live) send({ t: 'mark', lat: m.lat, lon: m.lon, k: m.k }); else planted(m);
      whisper(`you planted a ${markMode}. it will fade in six hours.`, 3200);
      lastPlanted = m.k;
      markMode = null; document.body.classList.remove('marking');
      tone.chime();
      return;
    }
    const s = hit(x, y);
    if (s) {
      if (type !== 'mouse') tipHold = { s, until: now + 2800 };
      if (s.mine) { s.blink = 1; send({ t: 'blink' }); tone.blink(); }
      else { s.blink = 1; heartsAt(s.v, s.id); send({ t: 'poke', lat: s.lat, lon: s.lon }); }
      return;
    }
    const d = hitSky(x, y);
    if (d) {
      if (d.kind === 'bell') { d.ring = now; tone.bell(); return; }
      sky.splice(sky.indexOf(d), 1);
      pops.push({ x: d.x, y: d.cy ?? d.y, born: now, seed: rand(0, 99) });
      tone.pop();
      return;
    }
    if (sunAt.r && Math.hypot(x - sunAt.x, y - sunAt.y) < sunAt.r * 1.3) {
      goldFlash = now + 2200;
      setMood('gold', 2200);
      setTheme('day'); store.set('scorsby-theme', 'day');
      whisper(pick(['sunsby says: good morning.', 'sunsby says: go for gold.', 'the day is here. everything is golden.']), 2600);
      tone.omen('goldrain');
      return;
    }
    if (hitMoon(x, y)) {
      moon.awake = now + 4000;
      setTheme('night'); store.set('scorsby-theme', 'night');
      whisper(`moonsby says goodnight. tonight is a ${phaseName(moonPhase())}.`, 3600);
      tone.chime();
      return;
    }
    if (pf.hit) {
      const [nx, ny, nr] = pf.hit.nose;
      if (Math.hypot(x - nx, y - ny) < nr * 1.3) {
        pf.honk = now + 600; tone.honk();
        if (Math.random() < 0.35) whisper(pick(['honk.', 'boop.', 'the world says honk.', 'hee hee.']), 1800);
        return;
      }
      for (const [ex, ey, er, sd] of pf.hit.eyes) {
        if (Math.hypot(x - ex, y - ey) < er) { pf.wink = now + 900; pf.winkSide = sd; tone.blink(); return; }
      }
    }
    const ll = unproject(x, y);
    if (ll) {
      if (now - lastTap < 320) { zoomAt(x, y, 2); lastTap = 0; return; }
      lastTap = now;
      // touching the world sends out a contagious ripple of hearts
      heartsAt(vec(ll[0], ll[1]), me?.id);
      send({ t: 'poke', lat: ll[0], lon: ll[1] });
    }
  }

  function zoomAt(x, y, factor) {
    const ll = unproject(x, y);
    zoom.target = clamp(zoom.target * factor, 0.75, 7);
    if (ll && factor > 1) zoom.aim = ll;
  }
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0016);
    zoom.target = clamp(zoom.target * f, 0.75, 7);
    if (f > 1) { const ll = unproject(e.clientX, e.clientY); if (ll) zoom.aim = ll; }
  }, { passive: false });
  document.getElementById('zoom-in').addEventListener('click', () => { zoom.target = clamp(zoom.target * 1.6, 0.75, 7); });
  document.getElementById('zoom-out').addEventListener('click', () => { zoom.target = clamp(zoom.target / 1.6, 0.75, 7); });

  let lastMove = 0;
  function sendMove(force) {
    const now = performance.now();
    if (!force && now - lastMove < 180) return;
    lastMove = now;
    send({ t: 'move', lat: me.lat, lon: me.lon });
  }

  let lastAll = -1e9;
  function loveEveryone() {
    if (!me) return;
    const now = performance.now();
    if (now - lastAll < 4000) return whisper('the last love is still spreading.', 2000);
    lastAll = now;
    const v = (Math.random() * 4) | 0;
    waves.push({ v: me.v, born: now, radius: 0, seen: new Set() });
    me.hearts = 2400;
    loveBurst(v, me.sz > 0 ? [me.sx, me.sy] : null, now);
    send({ t: 'all', v, h: me.hands || 0 }); // one point of love, and one more for every hand you are holding
    if (!net.live) trails.push({ a: [me.lat, me.lon], t: Date.now(), k: 'all' });
    whisper(peers.size ? 'you loved everyone. everyone felt it.' : 'you loved everyone, even the ones not here yet.');
    tone.swell();
  }
  document.getElementById('act-all').addEventListener('click', () => { tone.wake(); loveEveryone(); });

  // the i-love-you-all button: a rectangle whose edge is a ring of little cloud bumps, always rolling around it
  const loveBtn = document.getElementById('act-all'), cloudCv = loveBtn.querySelector('.cloud'), cg = cloudCv?.getContext('2d');
  const SHADOW = 6, BUMP = 7;
  function drawCloudButton(now) {
    if (!cg || !loveBtn.offsetWidth) return;
    const bw = loveBtn.offsetWidth, bh = loveBtn.offsetHeight, W = bw + SHADOW + 2, H = bh + SHADOW + 2;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (cloudCv.width !== Math.round(W * dpr) || cloudCv.height !== Math.round(H * dpr)) {
      cloudCv.width = Math.round(W * dpr); cloudCv.height = Math.round(H * dpr);
      cloudCv.style.width = `${W}px`; cloudCv.style.height = `${H}px`;
    }
    cg.setTransform(dpr, 0, 0, dpr, 0, 0); cg.clearRect(0, 0, W, H);
    // bump centers march around the inside edge of the button
    const x0 = BUMP + 1, y0 = BUMP + 1, w = bw - 2 * BUMP - 2, h = bh - 2 * BUMP - 2, P = 2 * (w + h);
    const n = Math.max(8, Math.round(P / (BUMP * 1.55))), step = P / n, phase = (now / 45) % step;
    const at = (t) => {
      t = ((t % P) + P) % P;
      if (t < w) return [x0 + t, y0];
      if (t < w + h) return [x0 + w, y0 + (t - w)];
      if (t < 2 * w + h) return [x0 + w - (t - w - h), y0 + h];
      return [x0, y0 + h - (t - 2 * w - h)];
    };
    const shape = (dx, dy) => {
      cg.beginPath(); cg.rect(x0 + dx, y0 + dy, w, h);
      for (let k = 0; k < n; k++) { const [px, py] = at(k * step + phase); cg.moveTo(px + dx + BUMP, py + dy); cg.arc(px + dx, py + dy, BUMP, 0, TAU); }
    };
    const css = getComputedStyle(document.body);
    const ink = css.getPropertyValue('--ui').trim() || '#05060a';
    const hover = loveBtn.matches(':hover'), pressed = loveBtn.matches(':active');
    if (!pressed) { shape(SHADOW - 1, SHADOW); cg.fillStyle = ink; cg.fill('nonzero'); }
    shape(0, 0); cg.lineWidth = 4; cg.strokeStyle = ink; cg.stroke();
    let fill = T === THEMES.night ? '#05060a' : (css.getPropertyValue('--paper').trim() || '#fff');
    if (hover) {
      const g = cg.createLinearGradient(0, 0, bw, 0), off = (now / 1400) % 1;
      RAINBOW.concat(RAINBOW[0]).forEach((col, i) => g.addColorStop(((i / RAINBOW.length) + off) % 1, col));
      fill = g;
    }
    shape(0, 0); cg.fillStyle = fill; cg.fill('nonzero');
  }

  addEventListener('keydown', (e) => {
    lastActive = performance.now();
    if (e.key === 'Escape') { markMode = null; document.body.classList.remove('marking'); closeWindows(); return; }
    if (['BUTTON', 'INPUT'].includes(e.target.tagName)) return;
    if (e.key === ' ' && me) { me.blink = 1; send({ t: 'blink' }); tone.blink(); e.preventDefault(); }
    if (e.key === '+' || e.key === '=') zoom.target = clamp(zoom.target * 1.4, 0.75, 7);
    if (e.key === '-') zoom.target = clamp(zoom.target / 1.4, 0.75, 7);
  });

  // ------------------------------------------------------------------ windows: you.exe, plant.exe, sing.exe
  const sayIn = document.getElementById('say-in'), sayBtn = document.querySelector('#say-form button');
  let sayWait = 0;
  const youWin = document.getElementById('you-win'), plantWin = document.getElementById('plant-win'), card = document.getElementById('sing-card');
  function closeWindows(except) { for (const w of [youWin, plantWin, card]) if (w !== except) w.hidden = true; }
  document.addEventListener('pointerdown', (e) => {
    for (const w of [youWin, plantWin, card]) {
      if (w.hidden || w.contains(e.target) || e.target.closest('#act-you, #act-plant, #act-sing')) continue;
      w.hidden = true;
    }
  }, true);
  document.querySelectorAll('.win .x').forEach((b) => b.addEventListener('click', () => { b.closest('.win').hidden = true; }));

  const colorBtn = document.getElementById('act-you');
  const nameIn = document.getElementById('name-in');
  function paintSwatch() {
    const sw = colorBtn.querySelector('.sw');
    sw.style.background = typeof myColor === 'string' ? myColor : COLORS[myColor][1] || 'conic-gradient(#ff5fae,#ffd23f,#62d64a,#00b4ff,#9b6bff,#ff5fae)';
    colorBtn.querySelector('.label').textContent = myName ? `${myName} scorsby` : 'you';
  }
  COLORS.forEach(([name, hex], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.title = name; b.setAttribute('aria-label', name);
    b.style.background = hex || 'conic-gradient(#ff5fae,#ffd23f,#62d64a,#00b4ff,#9b6bff,#ff5fae)';
    b.addEventListener('click', () => {
      myColor = i; paintSwatch();
      if (me) { me.c = i; me.hearts = 900; }
      send({ t: 'color', c: i });
      whisper(i === 8 ? 'you are every color now.' : `you are a ${name} scorsby now.`, 2600);
      tone.blink();
    });
    document.getElementById('swatches').appendChild(b);
  });
  nameIn.value = myName;
  // or any color at all
  document.getElementById('swatches').appendChild(document.getElementById('custom'));
  const picker = document.getElementById('custom-color');
  picker.value = typeof myColor === 'string' ? myColor : '#00b4ff';
  let colorTimer = 0;
  picker.addEventListener('input', () => {
    // your scorsby changes as you drag through the colors; everyone else hears once you settle
    myColor = picker.value.toLowerCase(); paintSwatch();
    document.getElementById('custom').style.background = myColor;
    if (me) me.c = myColor;
    clearTimeout(colorTimer); colorTimer = setTimeout(() => send({ t: 'color', c: myColor }), 250);
  });
  picker.addEventListener('change', () => {
    myColor = picker.value.toLowerCase(); paintSwatch();
    document.getElementById('custom').style.background = myColor;
    if (me) { me.c = myColor; me.hearts = 900; }
    send({ t: 'color', c: myColor });
    whisper('you are your very own color now.', 2600);
    tone.blink();
  });
  let nameTimer = 0;
  function applyName(quiet) {
    const n = cleanName(nameIn.value);
    if (n === myName) return;
    myName = n;
    store.set('scorsby-name', myName);
    if (me) me.n = myName;
    send({ t: 'name', n: myName });
    paintSwatch();
    if (!quiet) whisper(myName ? `hello, ${myName} scorsby.` : 'you are a scorsby with no name. that is okay too.', 3000);
  }
  // your name changes as you type it
  nameIn.addEventListener('input', () => {
    if (me) me.n = cleanName(nameIn.value);
    colorBtn.querySelector('.label').textContent = cleanName(nameIn.value) ? `${cleanName(nameIn.value)} scorsby` : 'you';
    clearTimeout(nameTimer); nameTimer = setTimeout(() => applyName(true), 700);
  });
  document.getElementById('name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(nameTimer);
    const was = myName;
    applyName(true);
    nameIn.value = myName;
    youWin.hidden = true;
    if (myName && myName !== was) whisper(`hello, ${myName} scorsby.`, 3000);
    tone.chime();
  });
  colorBtn.addEventListener('click', () => { closeWindows(youWin); youWin.hidden = !youWin.hidden; });

  // a message, for everyone here. the hearth turns any unkind word into "boink".
  document.getElementById('say-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = sayIn.value.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!text) return;
    if (!net.live) { whisper('the hearth is resting, so nobody can hear messages right now.', 3600); return; }
    if (/https?:|www\.|\w\.(com|net|org|io|gg|co|us|uk|xyz|ly|me|tv|app|dev|info|biz|ru|cn|link|site|online|shop)\b|@\w/i.test(text)) { whisper('links can\'t travel here, only words.', 3200); return; }
    send({ t: 'say', text });
    sayBtn.disabled = true;
    clearTimeout(sayWait);
    sayWait = setTimeout(() => { sayBtn.disabled = false; whisper('that message got lost on the way. try again?', 3000); }, 10000);
  });
  paintSwatch();

  MARKS.forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'plant'; b.title = k; b.setAttribute('aria-label', k);
    const icon = document.createElement('canvas'); icon.width = icon.height = 64;
    b.appendChild(icon);
    b.addEventListener('click', () => {
      markMode = k; plantWin.hidden = true; document.body.classList.add('marking');
      if (zoom.target < 2) zoom.target = 2.4;
      whisper(`tap the world to plant your ${k}.`, 3500);
    });
    document.getElementById('plants').appendChild(b);
  });
  function paintPlantIcons() {
    const saved = c;
    document.querySelectorAll('#plants canvas').forEach((cnv, i) => {
      const g = cnv.getContext('2d');
      g.clearRect(0, 0, 64, 64);
      c = g; doodle(MARKS[i] === 'head' ? 'scorsby' : MARKS[i], 32, 36, 46, i * 7, 0, 2.4);
    });
    c = saved;
  }
  document.getElementById('act-plant').addEventListener('click', () => { closeWindows(plantWin); plantWin.hidden = !plantWin.hidden; if (!plantWin.hidden) paintPlantIcons(); });

  // ------------------------------------------------------------------ sound
  let ac = null, master = null, soundOn = false;
  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = soundOn ? 1 : 0;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const soundBtn = document.getElementById('act-sound');
  function setSound(on) {
    soundOn = on;
    audio();
    master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.3);
    soundBtn.setAttribute('aria-pressed', on);
    soundBtn.textContent = on ? 'sound on' : 'sound off';
  }
  soundBtn.addEventListener('click', () => setSound(!soundOn));

  const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784];
  const tone = {
    wake() { if (ac && ac.state === 'suspended') ac.resume(); },
    note(f, len = 1.6, vol = 0.06, type = 'sine', delay = 0) {
      if (!soundOn || !ac) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.1);
    },
    chime() { [0, 2, 4].forEach((k, i) => this.note(PENTA[k + 2] * 2, 2.2, 0.04, 'sine', i * 0.12)); },
    blink() { this.note(880, 0.25, 0.02, 'triangle'); },
    tick() { this.note(1760, 0.03, 0.006, 'square'); },
    poke() { [0, 2, 4].forEach((k, i) => this.note(PENTA[k + 4], 0.9, 0.03, 'triangle', i * 0.07)); },
    pop() { this.note(pick(PENTA) * 2, 0.35, 0.04, 'square'); this.note(pick(PENTA) * 3, 0.3, 0.02, 'sine', 0.05); },
    // a bubblegum pop: a sharp snap of noise and a quick little "plip" that drops in pitch
    bubblePop() {
      if (!soundOn || !ac) return;
      const t = ac.currentTime, n = Math.floor(ac.sampleRate * 0.05);
      const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.12));
      const snap = ac.createBufferSource(); snap.buffer = buf;
      const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 0.8;
      const sg = ac.createGain(); sg.gain.value = 0.16;
      snap.connect(hp); hp.connect(sg); sg.connect(master); snap.start(t);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.05);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
    },
    boing(stretch = 1) {
      if (!soundOn || !ac) return;
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(180 + 120 * Math.min(2, stretch), t); o.frequency.exponentialRampToValueAtTime(90, t + 0.5);
      const lfo = ac.createOscillator(), depth = ac.createGain(); lfo.frequency.value = 18; depth.gain.value = 30; lfo.connect(depth); depth.connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 0.65); lfo.stop(t + 0.65);
    },
    honk() {
      if (!soundOn || !ac) return;
      const t = ac.currentTime;
      for (const [f, d] of [[392, 0], [330, 0.13]]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t + d); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + d + 0.12);
        const g = ac.createGain(); g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.04, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.14);
        const lp = ac.createBiquadFilter(); lp.frequency.value = 1400;
        o.connect(lp); lp.connect(g); g.connect(master); o.start(t + d); o.stop(t + d + 0.16);
      }
    },
    // the bell always rings, even with the sound off: you asked it to
    bell() {
      audio();
      const t = ac.currentTime;
      for (const [f, v, l] of [[880, 0.09, 3], [1318.5, 0.035, 2.4], [1760, 0.03, 2], [2637, 0.018, 1.2]]) {
        const o = ac.createOscillator(); o.frequency.value = f;
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + l);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + l + 0.05);
      }
    },
    arrive() { this.note(392, 2.4, 0.03); },
    together() { [0, 2, 4, 7].forEach((k, i) => this.note(PENTA[k], 3, 0.04, 'sine', i * 0.05)); },
    omen(k) {
      const seqs = { eclipse: [0, 1, 0], flock: [4, 5, 7, 8, 7], sneeze: [8, 0], hearts: [5, 7, 8, 7, 5], colorstorm: [0, 2, 4, 5, 7, 8], unison: [2, 2, 2], ears: [6, 6], heartstar: [0, 4, 7, 8], thirdeye: [0, 7, 0, 8], goldrain: [8, 7, 5, 4, 2, 0], wings: [0, 4, 7, 8] };
      (seqs[k] || [0]).forEach((n, i) => this.note(PENTA[n], 2.2, 0.035, 'sine', i * 0.16));
    },
    swell() {
      if (!soundOn || !ac) return;
      const t = ac.currentTime;
      for (const f of [196, 261.6, 329.6, 392, 523.3, 659.3]) {
        const o = ac.createOscillator(); o.frequency.value = f; o.detune.value = rand(-6, 6);
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 1.2);
        g.gain.linearRampToValueAtTime(0, t + 5.2);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 5.3);
      }
      [4, 5, 7, 8].forEach((k, i) => this.note(PENTA[k] * 2, 1.4, 0.025, 'sine', 0.2 + i * 0.1));
    },
  };

  const voices = (() => {
    const map = new Map();
    function voice(id) {
      let v = map.get(id);
      if (v) return v;
      audio();
      const o1 = ac.createOscillator(), o2 = ac.createOscillator();
      o1.type = 'sine'; o2.type = 'triangle';
      const vib = ac.createOscillator(), vibAmt = ac.createGain();
      vib.frequency.value = rand(4.6, 5.6); vibAmt.gain.value = 5;
      vib.connect(vibAmt); vibAmt.connect(o1.detune); vibAmt.connect(o2.detune);
      const g2 = ac.createGain(); g2.gain.value = 0.18;
      const g = ac.createGain(); g.gain.value = 0;
      const pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(pan); pan.connect(master);
      o1.start(); o2.start(); vib.start();
      v = { o1, o2, g, pan, timer: 0 };
      map.set(id, v);
      return v;
    }
    return {
      sing(id, f, a, x, glide = 0.06) {
        if (!ac && !soundOn) return;
        const v = voice(id), t = ac.currentTime;
        v.o1.frequency.setTargetAtTime(f, t, glide);
        v.o2.frequency.setTargetAtTime(f * 2, t, glide);
        v.g.gain.setTargetAtTime(Math.min(0.12, a * 0.16), t, 0.08);
        if (v.pan.pan) v.pan.pan.setTargetAtTime(clamp((x - CX) / (R * 1.4), -0.9, 0.9), t, 0.2);
        clearTimeout(v.timer);
        v.timer = setTimeout(() => this.hush(id), 600);
      },
      hush(id) {
        const v = map.get(id);
        if (!v) return;
        v.g.gain.setTargetAtTime(0, ac.currentTime, 0.15);
        clearTimeout(v.timer);
        v.timer = setTimeout(() => { try { v.o1.stop(); v.o2.stop(); } catch {} map.delete(id); }, 1500);
      },
    };
  })();

  // ------------------------------------------------------------------ singing
  const singBtn = document.getElementById('act-sing');
  const mic = { stream: null, analyser: null, buf: null, on: false, lastSend: 0, wasSinging: false, f: 0, amp: 0, heard: 0 };
  singBtn.addEventListener('click', () => {
    if (mic.on) return stopSinging();
    closeWindows(card); card.hidden = !card.hidden;
  });
  document.getElementById('sing-no').addEventListener('click', () => { card.hidden = true; });
  document.getElementById('sing-yes').addEventListener('click', async () => {
    card.hidden = true;
    try {
      audio();
      // the noise filter treats a long held note as noise and fades it out, so it stays off
      mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
      const src = ac.createMediaStreamSource(mic.stream);
      mic.analyser = ac.createAnalyser(); mic.analyser.fftSize = 2048;
      mic.buf = new Float32Array(mic.analyser.fftSize);
      src.connect(mic.analyser); // to the analyser only. it is never played or sent.
      mic.on = true;
      singBtn.setAttribute('aria-pressed', 'true'); singBtn.textContent = 'singing';
      if (!soundOn) setSound(true);
      whisper('sing anything. everyone hears you as a scorsby.', 4000);
    } catch {
      whisper('your voice stayed closed. that is okay too.', 3000);
    }
  });
  function stopSinging() {
    mic.stream?.getTracks().forEach((t) => t.stop());
    mic.on = false; mic.stream = null;
    singBtn.setAttribute('aria-pressed', 'false'); singBtn.textContent = 'sing';
    if (me) me.singTarget = 0;
    send({ t: 'hush' });
    voices.hush('me');
  }

  // autocorrelation pitch finding. only two numbers ever leave: pitch and loudness.
  function pitch(buf, rate) {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    if (rms < 0.006) return [0, rms];
    let r1 = 0, r2 = buf.length - 1;
    for (let i = 0; i < buf.length / 2; i++) if (Math.abs(buf[i]) < 0.2) { r1 = i; break; }
    for (let i = 1; i < buf.length / 2; i++) if (Math.abs(buf[buf.length - i]) < 0.2) { r2 = buf.length - i; break; }
    const b = buf.subarray(r1, r2), n = b.length;
    const acf = new Float32Array(n);
    for (let lag = 0; lag < n; lag++) { let s = 0; for (let i = 0; i < n - lag; i++) s += b[i] * b[i + lag]; acf[lag] = s; }
    let d = 0; while (d < n - 1 && acf[d] > acf[d + 1]) d++;
    let maxv = -1, maxp = -1;
    for (let i = d; i < n; i++) if (acf[i] > maxv) { maxv = acf[i]; maxp = i; }
    if (maxp <= 0 || maxp >= n - 1) return [0, rms];
    const x1 = acf[maxp - 1], x2 = acf[maxp], x3 = acf[maxp + 1];
    const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    const f = rate / (a ? maxp - bb / (2 * a) : maxp);
    return f > 70 && f < 1300 ? [f, rms] : [0, rms];
  }

  function listen(now) {
    if (!mic.on || !me) return;
    mic.analyser.getFloatTimeDomainData(mic.buf);
    const [f, rms] = pitch(mic.buf, ac.sampleRate);
    const amp = clamp((rms - 0.006) * 11, 0, 1);
    if (f && amp > 0.02) {
      // follow the voice in log space: big leaps land at once, small wobbles are smoothed
      const jump = mic.f ? Math.abs(Math.log2(f / mic.f)) : 1;
      mic.f = mic.f && jump < 0.5 ? Math.exp(Math.log(mic.f) * 0.45 + Math.log(f) * 0.55) : f;
      mic.amp += (amp - mic.amp) * 0.5;
      mic.heard = now;
    } else if (mic.f && now - mic.heard < 260) {
      mic.amp *= 0.97; // a breath or a soft consonant: the note carries on
    } else { mic.f = 0; mic.amp = 0; }

    if (mic.f) {
      me.singTarget = mic.amp; me.freq = mic.f;
      voices.sing('me', mic.f, mic.amp * 0.35, me.sx, 0.03); // your own voice follows you every frame
      if (now - mic.lastSend > 100) { // everyone else hears you ten times a second
        mic.lastSend = now;
        send({ t: 'sing', f: Math.round(mic.f * 10) / 10, a: Math.round(mic.amp * 100) / 100 });
      }
      mic.wasSinging = true;
    } else {
      me.singTarget = 0;
      if (mic.wasSinging) { mic.wasSinging = false; send({ t: 'hush' }); voices.hush('me'); }
    }
  }

  // ------------------------------------------------------------------ dreaming (?dream=5 to preview with imaginary scorsbys)
  function dream(n) {
    dreaming = true;
    const names = ['glonk', 'lumi', 'tonka', 'briar', 'oreo', 'kimchi', 'dorf', 'bean', 'pip', 'moss'];
    const scale = PENTA.map((f) => f * 0.75);
    for (let i = 0; i < n; i++) {
      const id = `dream${i}`;
      const spot = (() => { for (let k = 0; k < 50; k++) { const j = ((Math.random() * NL) | 0) * 2; if (LAND[j] > -45) return [LAND[j], LAND[j + 1]]; } return [0, 0]; })();
      const s = scorsby({ id, lat: spot[0], lon: spot[1], tz: Math.round(spot[1] / 15) * 60, c: (Math.random() * 9) | 0, n: Math.random() < 0.7 ? names[i % names.length] : '' });
      s.born = performance.now() + i * 400;
      peers.set(id, s);
      const life = () => {
        const r = Math.random();
        if (r < 0.3) s.blink = 1;
        else if (r < 0.45) heartsAt(s.v, id);
        else if (r < 0.5) {
          waves.push({ v: s.v, born: performance.now(), radius: 0, seen: new Set() });
          loveBurst((Math.random() * 4) | 0, s.sz > 0 ? [s.sx, s.sy] : null, performance.now());
          whisper(`${nameOf(s)} loves you.`, 3600, true, null, true);
          tone.swell();
        } else if (r < 0.72) {
          const notes = Array.from({ length: 4 + ((Math.random() * 5) | 0) }, () => pick(scale));
          notes.forEach((f, k) => setTimeout(() => {
            for (let q = 0; q < 6; q++) setTimeout(() => receive({ t: 'sing', id, f, a: 0.5 + 0.3 * Math.sin(q) }), q * 90);
          }, k * 560));
        } else {
          place(s, clamp(s.lat + rand(-4, 4), -50, 70), s.lon + rand(-6, 6));
        }
        setTimeout(life, rand(2500, 9000));
      };
      setTimeout(life, rand(1500, 6000));
    }
    updatePresence();
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && me) me.blink = 1; });

  // ------------------------------------------------------------------ the loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(64, now - last); last = now;
    if (VW) {
      zoom.v += (zoom.target - zoom.v) * 0.12;
      if (zoom.aim) {
        view.lon += (((zoom.aim[1] - view.lon + 540) % 360) - 180) * 0.08;
        view.lat += (clamp(zoom.aim[0], -70, 70) - view.lat) * 0.08;
        view.auto = false; view.idleAt = now + 6000; setView();
        if (Math.abs(zoom.target - zoom.v) < 0.01) zoom.aim = null;
      }
      if (!pointer.down && now > view.idleAt) view.auto = true;
      if (view.auto) view.vlon += (-0.004 * dt / Math.max(1, zoom.v) - view.vlon) * 0.02;
      else if (!pointer.down) view.vlon *= 0.94;
      if (!pointer.down) { view.lon += view.vlon; setView(); }
      if (!intro.woke && now >= intro.wake) {
        intro.woke = true;
        setMood('grin', 1800); pf.blink = 1; lastActive = now;
        tone.chime();
      }
      if (!intro.shown && now >= intro.ui) { intro.shown = true; document.body.classList.remove('intro'); }
      listen(now);
      render(now, dt);
      drawCloudButton(now);
      if (tipHold) {
        if (now < tipHold.until && tipHold.s.sz > 0 && !pointer.down) showTip(tipHold.s);
        else { tipHold = null; showTip(null); }
      }
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  setTheme(); resize(); setView();
  if (INTRO) {
    setMood('sleepy', intro.wake - T0);
    setTimeout(welcome, 700);
    // any tap or key wakes it sooner
    const hurry = () => hurryIntro();
    addEventListener('pointerdown', hurry, { capture: true }); addEventListener('keydown', hurry);
  } else document.body.classList.remove('intro');
  connect();
  if (!net.url) alone();
  const n = parseInt(params.get('dream'), 10);
  if (n > 0) dream(Math.min(n, 40));
  if (params.get('omen')) setTimeout(() => startOmen(params.get('omen')), 1500);
  if (params.get('mood')) setTimeout(() => setMood(params.get('mood'), 30000), Math.max(1500, intro.ui - performance.now() + 500)); // ?mood=worm to see one face for 30s
  if (params.has('debug')) window.heartstar = { get visible() { return visible; }, get ac() { return ac; }, get master() { return master; }, get soundOn() { return soundOn; }, mic, pitch, hit, tap, planted, bursts, pf, pull, hitPart, sunAt, view, moon, peers, get me() { return me; }, faceToward, startOmen, setMood, zoom, loveBurst, MOODS, waves, sky };
  requestAnimationFrame(frame);
})();
