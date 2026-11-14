import * as THREE from 'three';

// Atlas-style labels: a dot on the structure, a hairline leader, and the name
// set off to the side. Which structures get labels depends on the zoom tier
// and on how large each structure is on screen. Bony landmarks (approximate,
// rule-placed points) get ring markers and show on the selected bone, or on
// bones that fill the view at the finest tier.

const MAX_LABELS = 16;
const MAX_LANDMARKS = 14;
const MIN_PX = { 1: 26, 2: 22, 3: 18 };
const CHAR_W = 6.9;
const LABEL_H = 20;
const RESELECT_MS = 220;
const isPoint = (s) => !s.mesh && !s.members;

export class Labels {
  constructor({ stage, camera, controls, api }) {
    this.stage = stage;
    this.camera = camera;
    this.controls = controls;
    this.api = api;
    this.root = stage.querySelector('#labels');
    this.svg = stage.querySelector('#leaders');
    this.pool = [];
    this.active = [];
    this.last = 0;
    this.w = 1;
    this.h = 1;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true; // three-mesh-bvh: stop at the first hit per mesh
    this.v = new THREE.Vector3();
    for (let i = 0; i < MAX_LABELS + MAX_LANDMARKS; i++) this.pool.push(this.makeLabel());
  }

  makeLabel() {
    const el = document.createElement('div');
    el.className = 'label';
    el.addEventListener('click', () => el._s && this.api.select(el._s, { fly: true }));
    this.root.appendChild(el);
    const ns = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'polyline');
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('r', '2.6');
    this.svg.append(line, dot);
    return { el, line, dot, s: null };
  }

  reset() { this.active = []; this.last = 0; }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  project(p) {
    this.v.copy(p).project(this.camera);
    return { x: (this.v.x + 1) / 2 * this.w, y: (1 - this.v.y) / 2 * this.h, z: this.v.z };
  }

  visibleFromCamera(s, ignore = null) {
    const cam = this.camera.position;
    const dir = this.v.copy(s.anchor).sub(cam);
    const dist = dir.length();
    const tol = Math.max(0.004, dist * 0.02);
    this.raycaster.set(cam, dir.normalize());
    this.raycaster.near = 0;
    this.raycaster.far = dist - tol;
    // Candidate blockers: bounding sphere crosses the ray before the label point.
    // Test nearest first and stop at the first hit.
    const ray = this.raycaster.ray;
    const list = [];
    for (const o of this.blockers) {
      if (o === s || o === ignore) continue;
      const near = o.center.distanceTo(cam) - o.radius;
      if (near < dist - tol && ray.distanceSqToPoint(o.center) <= o.radius * o.radius) list.push([Math.max(0, near), o.mesh]);
    }
    list.sort((a, b) => a[0] - b[0]);
    const hits = [];
    for (const [, mesh] of list) {
      mesh.raycast(this.raycaster, hits);
      if (hits.length) return false;
    }
    return true;
  }

  onScreen(p) { return p.z <= 1 && p.x > 8 && p.x < this.w - 8 && p.y > 8 && p.y < this.h - 8; }

  choose() {
    const { state } = this.api;
    this.blockers = [];
    for (const o of this.api.structures.values()) {
      if (o.mesh?.visible && o.xray < 0.5 && o.fade > 0.5 && (o.baseOpacity ?? 1) > 0.5) this.blockers.push(o);
    }
    const sel = state.selected;
    const tiers = this.api.tiers;
    const tier = tiers[state.tier];
    const finest = state.tier === tiers.length - 1;
    const cand = [];
    const points = [];
    for (const s of this.api.structures.values()) {
      if (s.members) { if (s === sel) cand.push({ s, score: -1e9 }); continue; }
      if (isPoint(s)) {
        const bone = s.bone;
        if (!bone?.mesh?.visible || bone.xray > 0.5) continue;
        const show = s === sel || bone === sel || sel?.bone === bone || (finest && bone.px > this.h * 0.3);
        if (!show) continue;
        const p = this.project(s.anchor);
        if (!this.onScreen(p)) continue;
        points.push({ s, score: s === sel ? -1e9 : Math.hypot(p.x - this.w / 2, p.y - this.h / 2) });
        continue;
      }
      if (!s.mesh?.visible || s.fade < 0.6 || s.xray > 0.5) continue;
      const isSel = s === sel;
      // Big (or merged, repeated) structures: anchor the label on the part of
      // the surface nearest the view centre, so it stays on screen when zoomed in.
      if (s.samples && s.homeAnchor) {
        if (s.px > this.h * 0.6) {
          const t = this.controls.target;
          let best = Infinity;
          for (const q of s.samples) { const d = q.distanceToSquared(t); if (d < best) { best = d; s.anchor.copy(q); } }
        } else s.anchor.copy(s.homeAnchor);
      }
      if (!isSel && (!tier.levels.includes(s.level) || s.px < MIN_PX[s.level])) continue;
      const p = this.project(s.anchor);
      if (!this.onScreen(p)) continue;
      const pref = tier.levels.indexOf(s.level);
      cand.push({ s, score: isSel ? -1e9 : pref * 1000 - s.px });
    }
    cand.sort((a, b) => a.score - b.score);
    points.sort((a, b) => a.score - b.score);
    const out = [];
    for (const c of cand) {
      if (out.length >= MAX_LABELS * 1.5) break;
      if (c.s === sel || c.s.members || this.visibleFromCamera(c.s)) out.push(c.s);
    }
    let n = 0;
    for (const c of points) {
      if (n >= MAX_LANDMARKS) break;
      const onSel = c.s === sel || sel === c.s.bone || sel?.bone === c.s.bone;
      if (onSel || this.visibleFromCamera(c.s, c.s.bone)) { out.push(c.s); n++; }
    }
    return out;
  }

  update() {
    const now = performance.now();
    if (now - this.last > RESELECT_MS) {
      this.last = now;
      this.active = this.choose();
    }
    const sel = this.api.state.selected;
    const placed = [];
    const centre = this.project(this.controls.target);
    let n = 0;
    const order = sel && this.active.includes(sel) ? [sel, ...this.active.filter((s) => s !== sel)] : this.active;
    for (const s of order) {
      if (n >= this.pool.length) break;
      if (s.mesh && !s.mesh.visible) continue;
      const p = this.project(s.anchor);
      if (p.z > 1) continue;
      const point = isPoint(s);
      // Landmark labels drop the "(left femur)" context: the dot sits on the bone.
      const text = point && s !== sel ? s.name.replace(/\s*\(.*\)$/, '') : s.name;
      const w = text.length * CHAR_W + 12;
      const side = p.x < centre.x ? -1 : 1;
      const spot = this.place(p, side, w, placed, s === sel);
      if (!spot) continue;
      placed.push(spot.rect);
      const L = this.pool[n++];
      if (L.s !== s || L.el.textContent !== text) {
        L.s = s;
        L.el._s = s;
        L.el.textContent = text;
        L.el.className = `label lvl-${s.level}${point ? ' is-landmark' : ''}${s.members ? ' is-group' : ''}`;
        L.el.title = point ? `${s.name}: approximate position` : '';
      }
      L.el.classList.toggle('is-selected', s === sel);
      L.el.style.transform = `translate(${spot.rect.x}px, ${spot.rect.y}px)`;
      L.el.style.display = '';
      const lx = spot.side > 0 ? spot.rect.x : spot.rect.x + spot.rect.w;
      const ly = spot.rect.y + LABEL_H / 2;
      const kx = lx - spot.side * 10;
      const cls = `${s === sel ? 'is-selected' : ''}${point ? ' is-landmark' : ''}`;
      L.line.setAttribute('points', `${p.x},${p.y} ${kx},${ly} ${lx},${ly}`);
      L.line.setAttribute('class', cls);
      L.dot.setAttribute('cx', p.x);
      L.dot.setAttribute('cy', p.y);
      L.dot.setAttribute('r', point ? '4' : '2.6');
      L.dot.setAttribute('class', cls);
      L.line.style.display = L.dot.style.display = s.members ? 'none' : '';
    }
    for (let i = n; i < this.pool.length; i++) {
      const L = this.pool[i];
      L.el.style.display = L.line.style.display = L.dot.style.display = 'none';
      L.s = null;
    }
  }

  place(p, side, w, placed, force) {
    const tries = [[44, -26], [44, 18], [70, -48], [70, 40], [36, -4]];
    for (const sd of [side, -side]) {
      for (const [dx, dy] of tries) {
        const x = sd > 0 ? p.x + dx : p.x - dx - w;
        const y = p.y + dy - LABEL_H / 2;
        const rect = { x, y, w, h: LABEL_H };
        if (x < 4 || y < 4 || x + w > this.w - 4 || y + LABEL_H > this.h - 4) continue;
        if (placed.some((r) => overlap(r, rect, 4))) continue;
        return { rect, side: sd };
      }
    }
    if (force) {
      const x = THREE.MathUtils.clamp(p.x + 44, 4, this.w - w - 4);
      return { rect: { x, y: Math.max(4, p.y - 36), w, h: LABEL_H }, side: 1 };
    }
    return null;
  }
}

function overlap(a, b, pad) {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}
