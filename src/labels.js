import * as THREE from 'three';
import { TIERS } from './systems.js';

// Atlas-style labels: a dot on the structure, a hairline leader, and the name
// set off to the side. Which structures get labels depends on the zoom tier
// and on how large each structure is on screen.

const MAX_LABELS = 16;
const MIN_PX = { 1: 26, 2: 22, 3: 18 };
const CHAR_W = 6.9;
const LABEL_H = 20;
const RESELECT_MS = 160;

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
    this.v = new THREE.Vector3();
    for (let i = 0; i < MAX_LABELS; i++) this.pool.push(this.makeLabel());
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

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  project(p) {
    this.v.copy(p).project(this.camera);
    return { x: (this.v.x + 1) / 2 * this.w, y: (1 - this.v.y) / 2 * this.h, z: this.v.z };
  }

  visibleFromCamera(s) {
    const cam = this.camera.position;
    const dir = this.v.copy(s.anchor).sub(cam);
    const dist = dir.length();
    this.raycaster.set(cam, dir.normalize());
    this.raycaster.far = dist + 0.002;
    const blockers = [];
    for (const o of this.api.structures.values()) {
      if (o !== s && o.mesh.visible && o.xray < 0.5 && o.fade > 0.5) blockers.push(o.mesh);
    }
    const hits = this.raycaster.intersectObjects(blockers, false);
    return !hits.length || hits[0].distance > dist - 0.004;
  }

  choose() {
    const { state } = this.api;
    const tier = TIERS[state.tier];
    const cand = [];
    for (const s of this.api.structures.values()) {
      if (!s.mesh.visible || s.fade < 0.6 || s.xray > 0.5) continue;
      const isSel = s === state.selected;
      if (!isSel && (!tier.levels.includes(s.level) || s.px < MIN_PX[s.level])) continue;
      if (!isSel && s.px > this.h * 1.4) continue; // too big to label meaningfully
      const p = this.project(s.anchor);
      if (p.z > 1 || p.x < 8 || p.x > this.w - 8 || p.y < 8 || p.y > this.h - 8) continue;
      const pref = tier.levels.indexOf(s.level);
      cand.push({ s, score: isSel ? -1e9 : pref * 1000 - s.px });
    }
    cand.sort((a, b) => a.score - b.score);
    const out = [];
    for (const c of cand) {
      if (out.length >= MAX_LABELS * 2) break;
      if (c.s === state.selected || this.visibleFromCamera(c.s)) out.push(c.s);
    }
    return out;
  }

  update() {
    const now = performance.now();
    if (now - this.last > RESELECT_MS) {
      this.last = now;
      this.active = this.choose();
    }
    // Keep labels off the scale widget (bottom-left) and the Reset button (top-right).
    const placed = [{ x: 0, y: this.h - 76, w: 250, h: 76 }, { x: this.w - 130, y: 0, w: 130, h: 52 }];
    const centre = this.project(this.controls.target);
    let n = 0;
    for (const s of this.active) {
      if (n >= MAX_LABELS) break;
      if (!s.mesh.visible) continue;
      const p = this.project(s.anchor);
      if (p.z > 1) continue;
      const text = s.name;
      const w = text.length * CHAR_W + 12;
      const side = p.x < centre.x ? -1 : 1;
      const spot = this.place(p, side, w, placed, s === this.api.state.selected);
      if (!spot) continue;
      placed.push(spot.rect);
      const L = this.pool[n++];
      if (L.s !== s) {
        L.s = s;
        L.el._s = s;
        L.el.textContent = text;
        L.el.className = `label lvl-${s.level}`;
      }
      L.el.classList.toggle('is-selected', s === this.api.state.selected);
      L.el.classList.toggle('is-right', spot.side > 0);
      L.el.style.transform = `translate(${spot.rect.x}px, ${spot.rect.y}px)`;
      L.el.style.display = '';
      const lx = spot.side > 0 ? spot.rect.x : spot.rect.x + spot.rect.w;
      const ly = spot.rect.y + LABEL_H / 2;
      const kx = lx - spot.side * 10;
      L.line.setAttribute('points', `${p.x},${p.y} ${kx},${ly} ${lx},${ly}`);
      L.line.setAttribute('class', s === this.api.state.selected ? 'is-selected' : '');
      L.dot.setAttribute('cx', p.x);
      L.dot.setAttribute('cy', p.y);
      L.dot.setAttribute('class', s === this.api.state.selected ? 'is-selected' : '');
      L.line.style.display = L.dot.style.display = '';
    }
    for (let i = n; i < this.pool.length; i++) {
      const L = this.pool[i];
      L.el.style.display = L.line.style.display = L.dot.style.display = 'none';
      L.s = null;
    }
  }

  place(p, side, w, placed, force) {
    const tries = [
      [44, -26], [44, 18], [70, -48], [70, 40], [36, -4],
    ];
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
