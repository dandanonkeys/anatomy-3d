// Mechanism player: draws molecules as SVG, animates curved arrows one at a
// time (numbered + colour-coded), then morphs atoms into the next state.
//
// Mechanism format (see concepts.js):
//   atoms:  { id: 'label' }                 label is what is printed (C, Br, H3C …)
//   states: [{ title, text, pos:{id:[x,y]}, bonds:'a-b a=b a~b a>b a:b',
//              lp:{id:[deg…]}, rad:{id:[deg…]}, charge:{id: n | [n, deg]},
//              tags:[[x, y, 'text', 'class']], arrows:[{from, to, kind, bend, why}] }]
//   bond codes: - single, = double, # triple, ~ partial (transition state),
//               > wedge (towards viewer, narrow at a), : hash (away from viewer)
//   arrow from: 'lp:ID:i' (i-th lone pair), 'rad:ID:i' (radical electron), 'bond:A-B'
//   arrow to:   'ID' (an atom), 'mid:A-B' (where a new bond forms), 'bond:A-B'
//   kind: 'pair' (two electrons, full head) | 'fish' (one electron, half head)
//   angles are degrees: 0 = right, 90 = down.

export const ARROW_COLORS = ['#f6b44e', '#5ccbf4', '#f489c4', '#93dc6e'];

const ARROW_MS = 750, ARROW_GAP = 260, MORPH_MS = 1150, HOLD_MS = 1300, GLOW_MS = 1600;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (d) => (d * Math.PI) / 180;
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const f = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------------- parsing ---------------- */

const BOND_RE = /^(\w+)([-=#~>:])(\w+)$/;
function parseBonds(str = '') {
  return str.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const m = tok.match(BOND_RE);
    if (!m) throw new Error(`Bad bond "${tok}"`);
    const [, a, c, b] = m;
    const order = c === '=' ? 2 : c === '#' ? 3 : 1;
    const style = c === '~' ? 'partial' : c === '>' ? 'wedge' : c === ':' ? 'hash' : 'plain';
    return { a, b, order, style, k: key(a, b) };
  });
}

function normState(s) {
  const charge = {}, chargeAt = {};
  for (const [id, v] of Object.entries(s.charge || {})) {
    if (Array.isArray(v)) { charge[id] = v[0]; chargeAt[id] = v[1]; } else charge[id] = v;
  }
  return {
    title: s.title || '', text: s.text || '',
    pos: s.pos, bonds: parseBonds(s.bonds), charge, chargeAt,
    lp: s.lp || {}, rad: s.rad || {}, tags: (s.tags || []).map(([x, y, t, cls]) => ({ x, y, t, cls: cls || 'note' })),
    arrows: (s.arrows || []).map((a) => ({ kind: 'pair', bend: 1, ...a })),
  };
}

/* ---------------- label metrics ---------------- */

// Split "H3C" into runs so digits print as subscripts.
function runs(label) {
  return label.match(/\d+|\D+/g).map((t) => ({ t, sub: /^\d+$/.test(t) }));
}
const boxCache = new Map();
function box(label) {
  if (boxCache.has(label)) return boxCache.get(label);
  let w = 0;
  for (const r of runs(label)) for (const ch of r.t) w += r.sub ? 9 : /[A-Z]/.test(ch) ? 14.5 : 11.5;
  const b = { hw: w / 2 + 2, hh: 12 };
  boxCache.set(label, b);
  return b;
}
// Distance from a label's centre to its edge along unit vector (ux, uy).
function edge(label, ux, uy) {
  const { hw, hh } = box(label);
  const tx = Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}

/* ---------------- frame composition ---------------- */

function angleLerp(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

// Blend state A toward B (t in 0..1). Returns everything needed to draw.
function compose(labels, A, B, t) {
  const G = { pos: {}, atoms: [], bonds: [], dots: [], charges: [], tags: [], lpAng: {}, radAng: {}, bondOrder: {} };
  const ids = new Set([...Object.keys(A.pos), ...(B ? Object.keys(B.pos) : [])]);
  for (const id of ids) {
    const pa = A.pos[id], pb = B?.pos[id];
    let x, y, op;
    if (pa && pb) { x = lerp(pa[0], pb[0], t); y = lerp(pa[1], pb[1], t); op = 1; }
    else if (pa) { [x, y] = pa; op = B ? 1 - t : 1; }
    else { [x, y] = pb; op = t; }
    G.pos[id] = [x, y];
    G.atoms.push({ id, label: labels[id], x, y, op });
  }

  // bonds
  const ma = new Map(A.bonds.map((b) => [b.k, b]));
  const mb = new Map((B?.bonds || []).map((b) => [b.k, b]));
  for (const [k, b] of ma) {
    const o = mb.get(k);
    if (!B) G.bonds.push({ ...b, op: 1 });
    else if (o && o.order === b.order && o.style === b.style) G.bonds.push({ ...b, op: 1 });
    else G.bonds.push({ ...b, op: 1 - t });
    G.bondOrder[k] = b.order;
  }
  if (B) for (const [k, b] of mb) {
    const o = ma.get(k);
    if (!(o && o.order === b.order && o.style === b.style)) G.bonds.push({ ...b, op: t });
  }

  // lone pairs + radicals: same count → rotate smoothly, otherwise cross-fade
  const dots = (field, kind) => {
    const store = kind === 'lp' ? G.lpAng : G.radAng;
    const all = new Set([...Object.keys(A[field]), ...(B ? Object.keys(B[field]) : [])]);
    for (const id of all) {
      const la = A[field][id] || [], lb = B?.[field][id] || [];
      store[id] = la;
      if (!B) la.forEach((a, i) => G.dots.push({ id, kind, a, i, op: 1 }));
      else if (la.length === lb.length) la.forEach((a, i) => G.dots.push({ id, kind, a: angleLerp(a, lb[i], t), i, op: 1 }));
      else {
        la.forEach((a, i) => G.dots.push({ id, kind, a, i, op: 1 - t }));
        lb.forEach((a) => G.dots.push({ id, kind, a, i: -1, op: t }));
      }
    }
  };
  dots('lp', 'lp');
  dots('rad', 'rad');

  // charges
  const at = (S, id) => S.chargeAt[id] ?? -45;
  if (!B) for (const [id, v] of Object.entries(A.charge)) G.charges.push({ id, v, a: at(A, id), op: 1 });
  else {
    for (const [id, v] of Object.entries(A.charge)) {
      const same = B.charge[id] === v && at(B, id) === at(A, id);
      G.charges.push({ id, v, a: at(A, id), op: same ? 1 : 1 - t });
    }
    for (const [id, v] of Object.entries(B.charge)) {
      const same = A.charge[id] === v && at(B, id) === at(A, id);
      if (!same) G.charges.push({ id, v, a: at(B, id), op: t });
    }
  }

  // annotation tags
  A.tags.forEach((g) => G.tags.push({ ...g, op: B ? 1 - t : 1 }));
  if (B) B.tags.forEach((g) => G.tags.push({ ...g, op: t }));
  return G;
}

function dotPoint(G, labels, id, a, extra = 6) {
  const [x, y] = G.pos[id];
  const ux = Math.cos(rad(a)), uy = Math.sin(rad(a));
  const d = edge(labels[id], ux, uy) + extra;
  return { x: x + ux * d, y: y + uy * d, ux, uy };
}

/* ---------------- arrow geometry ---------------- */

function arrowGeom(G, labels, arr) {
  let S, src;
  const [ft, fa, fb] = arr.from.split(':');
  if (ft === 'lp' || ft === 'rad') {
    const list = (ft === 'lp' ? G.lpAng : G.radAng)[fa] || [];
    const ang = list[+fb || 0];
    if (ang === undefined) throw new Error(`No ${ft} ${fb} on ${fa}`);
    const p = dotPoint(G, labels, fa, ang, ft === 'lp' ? 7 : 6);
    S = [p.x, p.y];
    src = { kind: ft, id: fa, i: +fb || 0 };
  } else if (ft === 'bond') {
    const [a, b] = fa.split('-');
    const pa = G.pos[a], pb = G.pos[b];
    S = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    src = { kind: 'bond', k: key(a, b) };
  } else throw new Error(`Bad arrow source ${arr.from}`);

  let T, atomTarget = null;
  if (arr.to.startsWith('mid:') || arr.to.startsWith('bond:')) {
    const [a, b] = arr.to.split(':')[1].split('-');
    const pa = G.pos[a], pb = G.pos[b];
    T = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  } else {
    T = G.pos[arr.to];
    atomTarget = arr.to;
  }
  if (!T) throw new Error(`Bad arrow target ${arr.to}`);

  const dx = T[0] - S[0], dy = T[1] - S[1];
  const d = Math.hypot(dx, dy) || 1;
  const nx = dy / d, ny = -dx / d; // left of the direction of travel
  const k = clamp(d * 0.45, 30, 95) * arr.bend;
  // Sources on a bond start on the bond's face toward the target (for a
  // double bond that is the π line); along-the-bond targets use the bend side.
  if (src.kind === 'bond') {
    const [a, b] = arr.from.split(':')[1].split('-');
    const pa = G.pos[a], pb = G.pos[b];
    const bl = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
    let bx = -(pb[1] - pa[1]) / bl, by = (pb[0] - pa[0]) / bl;
    let side = bx * dx + by * dy;
    if (Math.abs(side) < 0.25 * d) side = (bx * nx + by * ny) * arr.bend;
    if (side < 0) { bx = -bx; by = -by; }
    const shift = G.bondOrder[src.k] >= 2 ? 4 : 2;
    S = [S[0] + bx * shift, S[1] + by * shift];
  }
  const C = [(S[0] + T[0]) / 2 + nx * k, (S[1] + T[1]) / 2 + ny * k];

  let E;
  const ex = T[0] - C[0], ey = T[1] - C[1], el = Math.hypot(ex, ey) || 1;
  const ux = ex / el, uy = ey / el;
  if (atomTarget) {
    const back = edge(labels[atomTarget], ux, uy) + 6;
    E = [T[0] - ux * back, T[1] - uy * back];
  } else {
    E = [T[0] - ux * 3, T[1] - uy * 3];
  }
  // nudge start slightly off the electrons so the dots stay visible
  const sx = C[0] - S[0], sy = C[1] - S[1], sl = Math.hypot(sx, sy) || 1;
  S = [S[0] + (sx / sl) * 5, S[1] + (sy / sl) * 5];
  return { S, C, E, ux, uy, nx: nx * Math.sign(arr.bend), ny: ny * Math.sign(arr.bend), src };
}

const qpt = (g, t) => [
  (1 - t) ** 2 * g.S[0] + 2 * (1 - t) * t * g.C[0] + t * t * g.E[0],
  (1 - t) ** 2 * g.S[1] + 2 * (1 - t) * t * g.C[1] + t * t * g.E[1],
];

function arrowSvg(g, arr, n, p, op, emph) {
  if (p <= 0 || op <= 0) return '';
  const color = ARROW_COLORS[n % ARROW_COLORS.length];
  const steps = Math.max(2, Math.round(28 * p));
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const [x, y] = qpt(g, (s / steps) * p);
    d += (s ? 'L' : 'M') + f(x) + ' ' + f(y);
  }
  const w = emph ? 3.6 : 2.7;
  let out = `<g class="arrow" opacity="${f(op)}">`;
  out += `<path d="${d}" class="arrow-halo" stroke-width="${w + 4}"/>`;
  out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (p >= 0.999) {
    const [tx, ty] = g.E, L = emph ? 16 : 14, W = emph ? 7.5 : 6.5;
    const bx = tx - g.ux * L, by = ty - g.uy * L;
    // perpendicular pointing away from the inside of the curve
    let px = -g.uy, py = g.ux;
    if (px * g.nx + py * g.ny < 0) { px = -px; py = -py; }
    const pts = arr.kind === 'fish'
      ? [[tx, ty], [bx + px * W * 1.2, by + py * W * 1.2], [bx + g.ux * 3, by + g.uy * 3]]
      : [[tx, ty], [bx + px * W, by + py * W], [bx - px * W, by - py * W]];
    const poly = pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
    out += `<polygon points="${poly}" class="arrow-halo" stroke-width="3"/>`;
    out += `<polygon points="${poly}" fill="${color}" stroke="${color}" stroke-width="1" stroke-linejoin="round"/>`;
  }
  if (p > 0.25) {
    const [mx, my] = qpt(g, 0.5);
    const bx = mx + g.nx * 17, by = my + g.ny * 17;
    out += `<g class="badge" opacity="${f(clamp((p - 0.25) / 0.2))}"><circle cx="${f(bx)}" cy="${f(by)}" r="10.5" fill="${color}"/>`;
    out += `<text x="${f(bx)}" y="${f(by)}" dy="0.36em" text-anchor="middle">${n + 1}</text></g>`;
  }
  return out + '</g>';
}

/* ---------------- molecule drawing ---------------- */

function bondEnds(G, labels, b) {
  const [ax, ay] = G.pos[b.a], [bx, by] = G.pos[b.b];
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const ea = edge(labels[b.a], ux, uy) + 3, eb = edge(labels[b.b], ux, uy) + 3;
  return { x1: ax + ux * ea, y1: ay + uy * ea, x2: bx - ux * eb, y2: by - uy * eb, nx: -uy, ny: ux };
}

function bondSvg(G, labels, b, color, glow) {
  const e = bondEnds(G, labels, b);
  if (Math.hypot(e.x2 - e.x1, e.y2 - e.y1) < 4) return '';
  const stroke = color || 'var(--mol)';
  const line = (o, extra = '') =>
    `<line x1="${f(e.x1 + e.nx * o)}" y1="${f(e.y1 + e.ny * o)}" x2="${f(e.x2 + e.nx * o)}" y2="${f(e.y2 + e.ny * o)}" stroke="${stroke}" ${extra}/>`;
  let out = `<g class="bond" opacity="${f(b.op)}">`;
  if (glow) out += `<line x1="${f(e.x1)}" y1="${f(e.y1)}" x2="${f(e.x2)}" y2="${f(e.y2)}" class="bond-glow" opacity="${f(glow)}"/>`;
  if (b.style === 'partial') out += line(0, 'stroke-dasharray="4 5" stroke-width="2.4"');
  else if (b.style === 'wedge') {
    const w = 6.5;
    out += `<polygon points="${f(e.x1)},${f(e.y1)} ${f(e.x2 + e.nx * w)},${f(e.y2 + e.ny * w)} ${f(e.x2 - e.nx * w)},${f(e.y2 - e.ny * w)}" fill="${stroke}"/>`;
  } else if (b.style === 'hash') {
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = lerp(e.x1, e.x2, t), y = lerp(e.y1, e.y2, t), w = 1 + 5.5 * t;
      out += `<line x1="${f(x + e.nx * w)}" y1="${f(y + e.ny * w)}" x2="${f(x - e.nx * w)}" y2="${f(y - e.ny * w)}" stroke="${stroke}" stroke-width="1.8"/>`;
    }
  } else if (b.order === 1) out += line(0);
  else if (b.order === 2) out += line(-3.6) + line(3.6);
  else out += line(-5.5) + line(0) + line(5.5);
  return out + '</g>';
}

function labelSvg(a) {
  let inner = '', shifted = false;
  for (const r of runs(a.label)) {
    if (r.sub) { inner += `<tspan class="sub" dy="5">${esc(r.t)}</tspan>`; shifted = true; }
    else { inner += `<tspan${shifted ? ' dy="-5"' : ''}>${esc(r.t)}</tspan>`; shifted = false; }
  }
  return `<text class="atom" x="${f(a.x)}" y="${f(a.y)}" dy="0.35em" text-anchor="middle" opacity="${f(a.op)}">${inner}</text>`;
}

/* ---------------- player ---------------- */

export function createPlayer(svg, { onChange } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const P = { states: [], labels: {}, i: 0, phase: 'idle', t0: 0, idleAt: 0, prog: [], playing: false, speed: 1, focus: null, glow: null, raf: 0 };

  const emit = () => onChange?.({ index: P.i, count: P.states.length, phase: P.phase, playing: P.playing, speed: P.speed });

  function viewBoxFor(states) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of states) {
      for (const [x, y] of Object.values(s.pos)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (const t of s.tags) { x0 = Math.min(x0, t.x - 60); x1 = Math.max(x1, t.x + 60); y0 = Math.min(y0, t.y - 14); y1 = Math.max(y1, t.y + 14); }
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const w = Math.max(600, x1 - x0 + 110), h = Math.max(300, y1 - y0 + 90);
    return `${f(cx - w / 2)} ${f(cy - h / 2)} ${f(w)} ${f(h)}`;
  }

  function load(mech) {
    cancelAnimationFrame(P.raf); P.raf = 0;
    P.labels = mech.atoms;
    P.states = mech.states.map(normState);
    svg.setAttribute('viewBox', viewBoxFor(P.states));
    P.playing = false; P.focus = null; P.glow = null;
    enter(0, true);
  }

  function enter(i, animate) {
    P.i = i;
    const n = P.states[i].arrows.length;
    if (animate && n && !reduce.matches) { P.phase = 'arrows'; P.prog = new Array(n).fill(0); P.t0 = performance.now(); }
    else { P.phase = 'idle'; P.prog = new Array(n).fill(1); P.idleAt = performance.now(); }
    emit(); kick();
  }

  function startMorph() {
    if (P.i >= P.states.length - 1) return;
    if (reduce.matches) { finishMorph(); return; }
    P.phase = 'morph'; P.t0 = performance.now(); emit(); kick();
  }
  function finishMorph() {
    const A = P.states[P.i], B = P.states[P.i + 1];
    const old = new Map(A.bonds.map((b) => [b.k, b]));
    const fresh = B.bonds.filter((b) => { const o = old.get(b.k); return !o || o.order !== b.order || o.style !== b.style; }).map((b) => b.k);
    P.glow = fresh.length ? { keys: new Set(fresh), t0: performance.now() } : null;
    enter(P.i + 1, true);
  }

  function kick() { if (!P.raf) P.raf = requestAnimationFrame(tick); }

  function tick(now) {
    P.raf = 0;
    let busy = false;
    if (P.phase === 'arrows') {
      const el = (now - P.t0) * P.speed;
      let done = true;
      P.prog = P.prog.map((_, k) => { const p = clamp((el - k * (ARROW_MS + ARROW_GAP)) / ARROW_MS); if (p < 1) done = false; return p; });
      if (done) { P.phase = 'idle'; P.idleAt = now; emit(); }
      busy = true;
    }
    if (P.phase === 'morph') {
      if ((now - P.t0) * P.speed >= MORPH_MS) finishMorph();
      busy = true;
    }
    if (P.phase === 'idle' && P.playing) {
      if (P.i >= P.states.length - 1) { P.playing = false; emit(); }
      else {
        const hold = HOLD_MS + 500 * P.states[P.i].arrows.length;
        if ((now - P.idleAt) * P.speed >= hold) startMorph();
        busy = true;
      }
    }
    if (P.glow && now - P.glow.t0 < GLOW_MS) busy = true;
    draw(now);
    if (busy) kick();
  }

  function draw(now = performance.now()) {
    const A = P.states[P.i];
    if (!A) return;
    const morphing = P.phase === 'morph';
    const mt = morphing ? ease(clamp(((now - P.t0) * P.speed) / MORPH_MS)) : 0;
    const G = compose(P.labels, A, morphing ? P.states[P.i + 1] : null, mt);
    const GA = morphing ? compose(P.labels, A, null, 0) : G;

    // electrons currently in use → tinted with their arrow's colour
    const tintDot = new Map(), tintBond = new Map();
    const geoms = A.arrows.map((arr) => arrowGeom(GA, P.labels, arr));
    if (!morphing) geoms.forEach((g, n) => {
      if (P.prog[n] <= 0 || (P.focus !== null && P.focus !== n)) return;
      const c = ARROW_COLORS[n % ARROW_COLORS.length];
      if (g.src.kind === 'bond') tintBond.set(g.src.k, c); else tintDot.set(`${g.src.kind}:${g.src.id}:${g.src.i}`, c);
    });

    const glowAmt = P.glow ? clamp(1 - (now - P.glow.t0) / GLOW_MS) : 0;
    let out = '';
    for (const b of G.bonds) out += bondSvg(G, P.labels, b, tintBond.get(b.k), glowAmt && P.glow.keys.has(b.k) ? glowAmt * b.op : 0);
    for (const a of G.atoms) out += labelSvg(a);
    for (const d of G.dots) {
      const c = tintDot.get(`${d.kind}:${d.id}:${d.i}`);
      const p = dotPoint(G, P.labels, d.id, d.a, d.kind === 'lp' ? 7 : 6);
      const cls = c ? 'dot is-used' : 'dot';
      const fill = c ? ` fill="${c}"` : '';
      if (d.kind === 'lp') {
        const ox = -p.uy * 3.6, oy = p.ux * 3.6;
        out += `<g opacity="${f(d.op)}" class="${cls}"><circle cx="${f(p.x + ox)}" cy="${f(p.y + oy)}" r="2.4"${fill}/><circle cx="${f(p.x - ox)}" cy="${f(p.y - oy)}" r="2.4"${fill}/></g>`;
      } else {
        out += `<g opacity="${f(d.op)}" class="${cls}"><circle cx="${f(p.x)}" cy="${f(p.y)}" r="3.2"${fill}/></g>`;
      }
    }
    for (const c of G.charges) {
      const p = dotPoint(G, P.labels, c.id, c.a, 11);
      const sym = c.v > 0 ? '+' : '−';
      out += `<g class="charge" opacity="${f(c.op)}"><circle cx="${f(p.x)}" cy="${f(p.y)}" r="8.5"/><text x="${f(p.x)}" y="${f(p.y)}" dy="0.34em" text-anchor="middle">${sym}</text></g>`;
    }
    for (const t of G.tags) out += `<text class="tag tag-${t.cls}" x="${f(t.x)}" y="${f(t.y)}" text-anchor="middle" opacity="${f(t.op)}">${esc(t.t)}</text>`;

    const arrowOp = morphing ? clamp(1 - mt / 0.3) : 1;
    geoms.forEach((g, n) => {
      const dim = P.focus !== null && P.focus !== n;
      out += arrowSvg(g, A.arrows[n], n, P.prog[n] ?? 0, arrowOp * (dim ? 0.18 : 1), P.focus === n);
    });
    svg.innerHTML = out;
  }

  return {
    load,
    next() {
      if (P.phase === 'arrows') { P.prog = P.prog.map(() => 1); P.phase = 'idle'; P.idleAt = performance.now(); emit(); draw(); return; }
      if (P.phase === 'morph') { finishMorph(); P.prog = P.prog.map(() => 1); P.phase = 'idle'; emit(); draw(); return; }
      startMorph();
    },
    prev() { P.playing = false; enter(Math.max(0, P.i - 1), false); },
    goTo(i) { P.playing = false; enter(clamp(i, 0, P.states.length - 1), true); },
    replay() { enter(P.i, true); },
    restart() { P.playing = false; enter(0, true); },
    toggle() {
      if (P.playing) { P.playing = false; emit(); return; }
      P.playing = true;
      if (P.i >= P.states.length - 1) enter(0, true);
      else { if (P.phase === 'idle') P.idleAt = performance.now() - HOLD_MS * 2; emit(); kick(); }
    },
    setSpeed(s) { P.speed = s; emit(); },
    focus(n) { P.focus = n; draw(); },
  };
}
