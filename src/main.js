import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { SYSTEMS, LEVELS, TIERS, CELL_TYPES, CELL_LEVELS, CELL_TIERS, CELL_UNIT_M, tierFor } from './systems.js';
import { GROUPS, stripSide } from './groups.js';
import { computeLandmarks } from './landmarks.js';
import { CELL_BUILDERS, CELL_VIEWS, cellForStructure } from './cells.js';
import { Labels } from './labels.js';
import { initUI } from './ui.js';
import { initQuiz } from './quiz.js';
import './style.css';

// BVH-accelerated raycasting: picking, hover and label occlusion all raycast.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const BASE = import.meta.env.BASE_URL;
const canvas = document.getElementById('view');
const stage = document.getElementById('stage');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(0.6, 0.8, 1);
camera.add(key);
// Rim light from behind-left-above (in camera space) so silhouettes separate
// from the dark field.
const rim = new THREE.DirectionalLight(0xdfe8ff, 1.4);
rim.position.set(-0.7, 0.5, -0.5);
camera.add(rim, rim.target);
scene.add(camera, new THREE.HemisphereLight(0xf4f7ff, 0x8a7b70, 0.6));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.zoomSpeed = 1.1;
controls.screenSpacePanning = true;

window.scene = scene;
window.__THREE_CAMERA__ = camera;
window.__renderer__ = renderer;

// ---------- worlds ----------
function makeWorld(id, opts) {
  const group = new THREE.Group();
  group.name = id;
  scene.add(group);
  return {
    id, group, structures: new Map(), meshes: [],
    systemOn: Object.fromEntries(Object.entries(opts.systems).map(([k, v]) => [k, v.on])),
    loaded: new Set(), loading: new Map(),
    ...opts,
  };
}

const worlds = {
  body: makeWorld('body', {
    label: 'Body', systems: SYSTEMS, levels: LEVELS, tiers: TIERS, unitM: 1, radio: false,
    minDist: 0.04, maxDist: 6,
    home: { target: new THREE.Vector3(0, 0.88, 0), position: new THREE.Vector3(0, 0.94, 3.5) },
  }),
  cells: makeWorld('cells', {
    label: 'Cells', systems: CELL_TYPES, levels: CELL_LEVELS, tiers: CELL_TIERS, unitM: CELL_UNIT_M, radio: true,
    minDist: 0.08, maxDist: 60,
    home: { target: new THREE.Vector3(), position: new THREE.Vector3(0, 0.6, 4) },
  }),
};
let world = worlds.body;
worlds.cells.group.visible = false;

const state = { selected: null, hovered: null, isolated: false, tier: 0 };
const camMemory = {};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function sideOf(name) {
  if (/^right\b/i.test(name)) return 'Right';
  if (/^left\b/i.test(name)) return 'Left';
  return 'Midline or unpaired';
}

function baseColor(color, name) {
  const c = new THREE.Color(color);
  const hsl = {};
  c.getHSL(hsl);
  const j = (hash(name.replace(/\b(left|right)\b/gi, '')) - 0.5) * 0.12;
  return c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + j, 0.15, 0.92));
}

// A structure starts as a stub from the manifest (searchable, frameable) and
// gets its mesh when its system is loaded.
function stub(meta, w) {
  const center = new THREE.Vector3(...meta.center);
  const size = new THREE.Vector3(...meta.size);
  const s = {
    ...meta, world: w.id, mesh: null,
    center, box: new THREE.Box3().setFromCenterAndSize(center, size), radius: size.length() / 2,
    anchor: center.clone(), side: meta.side ?? sideOf(meta.name), hidden: !!meta.cover, fade: 0, xray: 0, px: 0,
  };
  w.structures.set(meta.id, s);
  return s;
}

const tmpV = new THREE.Vector3();
function attachMesh(s, mesh, w, color) {
  mesh.updateWorldMatrix(true, false);
  const m = mesh.matrixWorld.clone();
  mesh.removeFromParent();
  m.decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.updateMatrixWorld(true);
  mesh.name = s.name;
  s.color = baseColor(color, s.name);
  mesh.material = new THREE.MeshStandardMaterial({
    color: s.color.clone(), roughness: s.system === 'skeletal' ? 0.72 : 0.5, metalness: 0,
    emissive: 0x3346c4, emissiveIntensity: 0, side: s.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundsTree();
  s.box = new THREE.Box3().setFromObject(mesh);
  s.center = s.box.getCenter(new THREE.Vector3());
  s.radius = s.box.getSize(new THREE.Vector3()).length() / 2;
  // Label anchor: surface vertex nearest the box centre.
  const pos = mesh.geometry.attributes.position;
  let best = Infinity;
  const step = Math.max(1, Math.floor(pos.count / 400));
  s.samples = [];
  for (let i = 0; i < pos.count; i += step) {
    tmpV.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    s.samples.push(tmpV.clone());
    const d = tmpV.distanceToSquared(s.center);
    if (d < best) { best = d; s.anchor.copy(tmpV); }
  }
  s.homeAnchor = s.anchor.clone();
  s.mesh = mesh;
  mesh.userData.structure = s;
  w.meshes.push(mesh);
  w.group.add(mesh);
}

// ---------- body: manifest, lazy per-system loading ----------
let manifest = null;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loadingEl = document.getElementById('loading');

async function loadBodyManifest() {
  manifest = await (await fetch(`${BASE}models/manifest.json`)).json();
  for (const meta of manifest.structures) stub(meta, worlds.body);
  buildGroups();
}

function ensureSystem(sys) {
  const w = worlds.body;
  if (w.loaded.has(sys)) return Promise.resolve();
  if (w.loading.has(sys)) return w.loading.get(sys);
  const file = `${sys}.glb`;
  const bytes = manifest.files[file]?.bytes ?? 0;
  const size = bytes >= 1e5 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  showLoading(`Loading ${SYSTEMS[sys].label.toLowerCase()} models (${size})…`);
  const p = loader.loadAsync(`${BASE}models/${file}`).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const found = [];
    gltf.scene.traverse((o) => { if (o.isMesh) found.push(o); });
    for (const o of found) {
      const s = w.structures.get(o.name) ?? w.structures.get(o.parent?.name);
      if (s && !s.mesh) attachMesh(s, o, w, SYSTEMS[s.system].color);
    }
    w.loaded.add(sys);
    w.loading.delete(sys);
    if (w.loaded.has('skeletal')) buildLandmarks();
    hideLoading();
    ui.refreshCounts();
  }).catch((err) => {
    w.loading.delete(sys);
    showLoading(`The ${SYSTEMS[sys].label.toLowerCase()} models didn’t load (${err.message}). Turn the system off and on to retry.`);
    console.error(err);
  });
  w.loading.set(sys, p);
  return p;
}

let loadingMsgs = 0;
function showLoading(text) { loadingMsgs++; loadingEl.hidden = false; loadingEl.textContent = text; }
function hideLoading() { if (--loadingMsgs <= 0) { loadingMsgs = 0; loadingEl.hidden = true; } }

// ---------- groups (lobes, muscle groups) ----------
function buildGroups() {
  const w = worlds.body;
  const all = [...w.structures.values()].filter((s) => !s.kind);
  for (const g of GROUPS) {
    const members = all.filter((s) => s.system === g.system && g.match.test(stripSide(s.name)) && !(g.exclude?.test(stripSide(s.name))));
    if (!members.length) continue;
    const box = new THREE.Box3();
    for (const m of members) box.union(m.box);
    const center = box.getCenter(new THREE.Vector3());
    const id = `group-${g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    w.structures.set(id, {
      id, name: g.name, kind: 'group', system: g.system, level: 1, members, mesh: null, world: 'body',
      center, box, radius: box.getSize(new THREE.Vector3()).length() / 2, anchor: center.clone(),
      side: 'Both sides', hidden: false, fade: 1, xray: 0, px: 0, size: box.getSize(new THREE.Vector3()).toArray(),
    });
  }
}

// ---------- landmarks ----------
function buildLandmarks() {
  const w = worlds.body;
  const byName = new Map([...w.structures.values()].filter((s) => s.mesh).map((s) => [s.name, s]));
  const getBone = (bone, side) => {
    const name = side ? `${side} ${bone[0].toLowerCase()}${bone.slice(1)}` : bone;
    const s = byName.get(name);
    if (!s?.mesh) return null;
    const pos = s.mesh.geometry.attributes.position;
    const points = [];
    for (let i = 0; i < pos.count; i++) points.push(tmpV.fromBufferAttribute(pos, i).applyMatrix4(s.mesh.matrixWorld).toArray());
    return { points, structure: s };
  };
  for (const lm of computeLandmarks(getBone)) {
    if (!lm.bone) continue;
    const id = `lm-${lm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (w.structures.has(id)) continue;
    const center = new THREE.Vector3(...lm.point);
    const r = 0.012;
    w.structures.set(id, {
      id, name: lm.name, aliases: lm.aliases, kind: lm.kind, approx: true, system: lm.bone.system, level: 3,
      bone: lm.bone, partOf: lm.bone.name, mesh: null, world: 'body', side: lm.side ?? 'Midline or unpaired',
      center, anchor: center.clone(), radius: r, box: new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(r, r, r).multiplyScalar(2)),
      hidden: false, fade: 1, xray: 0, px: 0, size: [0, 0, 0],
    });
  }
  ui.refreshCounts();
}

// ---------- cells ----------
function buildCells() {
  const w = worlds.cells;
  if (w.built) return;
  w.built = true;
  for (const [type, build] of Object.entries(CELL_BUILDERS)) {
    for (const part of build()) {
      const id = `cell-${type}-${part.key}`;
      const mesh = new THREE.Mesh(part.geometry);
      const s = stub({ id, name: part.name, system: type, level: part.level, partOf: part.partOf ?? null, center: [0, 0, 0], size: [0, 0, 0] }, w);
      Object.assign(s, { desc: part.desc, schematic: true, baseOpacity: part.opacity ?? 1, doubleSide: true, side: null, fade: 1 });
      if (part.count) s.count = part.count;
      if (part.each) s.each = part.each;
      attachMesh(s, mesh, w, part.color);
      s.color = new THREE.Color(part.color);
      s.mesh.material.color.copy(s.color);
      s.size = s.box.getSize(new THREE.Vector3()).toArray();
      if (part.focus) { s.frameCenter = new THREE.Vector3(...part.focus); s.frameRadius = part.focusR; }
    }
    w.loaded.add(type);
  }
}

function cellHome(type) {
  const box = new THREE.Box3();
  for (const s of worlds.cells.structures.values()) if (s.system === type && s.mesh) box.union(s.box);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  worlds.cells.scaleRef = Math.min(r * 2, 12);
  const fit = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.95;
  return { target: c, position: c.clone().add(new THREE.Vector3(...(CELL_VIEWS[type] ?? [0, 0.3, 1])).normalize().multiplyScalar(fit)) };
}

// ---------- level of detail + see-through ----------
const ray = new THREE.Ray();
const hit = new THREE.Vector3();
let focalPx = 1;

function viewHeightAtTarget() {
  return 2 * camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
}

function smooth(x, a, b) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

const FADE_PX = { 1: [0, 0], 2: [2, 7], 3: [5, 14] };

function isHighlighted(s) {
  const sel = state.selected;
  if (!sel) return 0;
  if (s === sel) return 1;
  if (sel.members?.includes(s)) return 1;
  if (sel.bone === s) return 0.45;
  return 0;
}

function updateLOD(dt) {
  const vh = renderer.domElement.clientHeight;
  focalPx = vh / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  state.tier = tierFor(viewHeightAtTarget() / (world.scaleRef ?? 1), world.tiers);
  const tierLevel = world.tiers === TIERS ? [1, 1, 2, 3][state.tier] : [1, 2, 3][state.tier];
  const sel = state.selected;
  const focus = sel ? (sel.frameCenter ?? sel.center) : controls.target;
  const focusDist = camera.position.distanceTo(focus);
  ray.origin.copy(camera.position);
  ray.direction.copy(focus).sub(camera.position).normalize();
  const k = 1 - Math.exp(-dt * 10);

  for (const s of world.structures.values()) {
    if (!s.mesh) continue;
    const d = Math.max(0.0005, camera.position.distanceTo(s.center));
    s.px = (s.radius / d) * focalPx;
    const [a, b] = FADE_PX[s.level];
    const fadeGoal = b ? smooth(s.px, a, b) : 1;
    let xrayGoal = 0;
    const own = isHighlighted(s) > 0 || (sel?.bone && sel.bone === s);
    if (!own && state.tier >= 1 && s.px > vh * 0.25) {
      const blocks = ray.intersectBox(s.box, hit) && hit.distanceTo(camera.position) < focusDist - 0.002;
      const contains = s.box.containsPoint(focus);
      if (blocks && (!contains || s.level < tierLevel || sel)) xrayGoal = 1;
    }
    s.fade += (fadeGoal - s.fade) * k;
    s.xray += (xrayGoal - s.xray) * k;
    applyLook(s);
  }

  const dist = camera.position.distanceTo(controls.target);
  camera.near = THREE.MathUtils.clamp(dist * 0.03, 0.002, 0.2);
  camera.far = dist + Math.max(2.5, dist * 4);
  camera.updateProjectionMatrix();
}

const MARK_SEL = new THREE.Color(0x3346c4);
const MARK_WRONG = new THREE.Color(0xc4332f);
function applyLook(s) {
  const m = s.mesh.material;
  const visibleSystem = world.systemOn[s.system] && !s.hidden && (!state.isolated || isHighlighted(s) > 0);
  const opacity = s.fade * (1 - 0.85 * s.xray) * (s.baseOpacity ?? 1);
  s.mesh.visible = visibleSystem && s.fade > 0.02;
  const transparent = opacity < 0.98;
  if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
  m.opacity = opacity;
  m.depthWrite = !transparent || opacity > 0.6;
  s.mesh.renderOrder = transparent ? 2 : 0;
  const hl = isHighlighted(s);
  const sel = hl ? (0.12 + 0.3 * pulse) * hl : 0;
  const hov = s === state.hovered && !hl ? 0.2 : 0;
  const wrong = s.quizMark === 'wrong' ? 0.55 : 0;
  m.emissive.setHex(wrong ? 0xc4332f : 0x3346c4);
  m.emissiveIntensity = wrong || sel + hov;
  m.color.copy(s.color);
  if (wrong) m.color.lerp(MARK_WRONG, 0.6);
  else if (hl) m.color.lerp(MARK_SEL, 0.75 * hl);
}

function isPickable(s) {
  return !!s.mesh && s.mesh.visible && s.fade > 0.5 && s.xray < 0.5 && (s.baseOpacity ?? 1) > 0.3;
}

// ---------- camera flights ----------
let flight = null;
let pulse = 0;
let pulseT = 1;

function flyTo(target, position, ms = 850) {
  if (reduceMotion) ms = 0;
  flight = { t0: performance.now(), ms, fromT: controls.target.clone(), toT: target.clone(), fromP: camera.position.clone(), toP: position.clone() };
}

function frame(s) {
  const r = s.frameRadius ?? (s.kind && !s.members ? Math.max(s.radius, 0.07) : s.radius);
  const c = s.frameCenter ?? s.center;
  const fit = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.8;
  const dir = camera.position.clone().sub(controls.target).normalize();
  flyTo(c, c.clone().addScaledVector(dir, Math.max(fit, controls.minDistance * 1.5)));
}

function stepFlight(now) {
  if (!flight) return;
  const t = flight.ms ? Math.min(1, (now - flight.t0) / flight.ms) : 1;
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  controls.target.lerpVectors(flight.fromT, flight.toT, e);
  camera.position.lerpVectors(flight.fromP, flight.toP, e);
  if (t >= 1) flight = null;
}

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pickHit(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const candidates = world.meshes.filter((m) => isPickable(m.userData.structure));
  const h = raycaster.intersectObjects(candidates, false)[0];
  return h ? { s: h.object.userData.structure, point: h.point } : null;
}
const pick = (x, y) => pickHit(x, y)?.s ?? null;

let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; flight = null; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 5) return;
  const h = pickHit(e.clientX, e.clientY);
  if (api.onPick?.(h?.s ?? null, h?.point ?? null)) return; // quiz mode takes clicks over
  if (h) api.select(h.s, { fly: true }); else api.select(null);
});

let hoverEvent = null;
canvas.addEventListener('pointermove', (e) => { hoverEvent = e; });
canvas.addEventListener('pointerleave', () => { hoverEvent = null; state.hovered = null; ui.hover(null); });

function updateHover() {
  if (!hoverEvent || down) return;
  const e = hoverEvent;
  hoverEvent = null;
  state.hovered = pick(e.clientX, e.clientY);
  ui.hover(state.hovered, e.clientX, e.clientY);
}

// ---------- details: definitions, Latin names, course OIAN ----------
let details = null;
let detailsP = null;
function loadDetails() {
  detailsP ??= fetch(`${BASE}models/details.json`).then((r) => r.json()).then((d) => { details = d; }).catch(() => { details = {}; });
  return detailsP;
}

const normMuscle = (n) => stripSide(n).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(muscle|muscles|the|of)\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
let oian = null;
fetch(`${BASE}course/oian.json`).then((r) => (r.ok ? r.json() : null)).then((d) => {
  if (!d) return;
  oian = d.map((e) => ({ ...e, key: normMuscle(e.muscle) }));
  ui.refreshInfo();
}).catch(() => {});

function oianFor(s) {
  if (!oian || (s.system !== 'muscular' && !s.members)) return null;
  const n = normMuscle(s.name);
  let best = null;
  for (const e of oian) {
    const keys = [e.key, ...(e.alt ?? []).map(normMuscle)];
    for (const k of keys) {
      if (!k) continue;
      if (n === k || new RegExp(`(^| )${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(n)) {
        if (!best || k.length > best.len) best = { e, len: k.length };
      }
    }
  }
  return best?.e ?? null;
}

// ---------- world switching ----------
function setWorld(id) {
  if (world.id === id) return;
  camMemory[world.id] = { target: controls.target.clone(), position: camera.position.clone() };
  state.selected = null;
  state.hovered = null;
  state.isolated = false;
  world.group.visible = false;
  world = worlds[id];
  world.group.visible = true;
  if (id === 'cells') buildCells();
  controls.minDistance = world.minDist;
  controls.maxDistance = world.maxDist;
  const mem = camMemory[id];
  if (mem) { controls.target.copy(mem.target); camera.position.copy(mem.position); }
  else api.home(true);
  ui.setWorld(world);
  labels.reset();
}

// ---------- public API (UI, quiz, tests) ----------
const api = {
  get structures() { return world.structures; },
  get systems() { return world.systemOn; },
  get systemDefs() { return world.systems; },
  get levels() { return world.levels; },
  get tiers() { return world.tiers; },
  get world() { return world.id; },
  get worldDef() { return world; },
  worlds,
  state,
  select(s, { fly = false } = {}) {
    if (typeof s === 'string') s = api.find(s);
    if (s && s.world && s.world !== world.id) setWorld(s.world);
    state.selected = s;
    if (s) {
      if (s.members) for (const m of s.members) { if (!world.systemOn[m.system]) api.setSystem(m.system, true); m.hidden = false; }
      else if (!world.systemOn[s.system]) api.setSystem(s.system, true);
      if (s.bone) s.bone.hidden = false;
      s.hidden = false;
      pulseT = 0;
      if (fly) frame(s);
      if (world.id === 'body') loadDetails().then(() => { if (state.selected === s) ui.showInfo(s); });
    } else if (state.isolated) {
      state.isolated = false;
    }
    ui.showInfo(s);
  },
  find(q) {
    q = q.toLowerCase();
    return [...world.structures.values()].find((s) => s.name.toLowerCase() === q || s.id.toLowerCase() === q) ?? null;
  },
  search(q, limit = 10) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    const scored = [];
    for (const s of world.structures.values()) {
      const hay = [s.name, ...(s.aliases ?? [])].map((x) => x.toLowerCase());
      if (!hay.some((n) => words.every((w) => n.includes(w)))) continue;
      const n = hay[0];
      const score = (hay.some((h) => h.startsWith(q)) ? 0 : n.includes(q) ? 1 : 2) + (s.members ? -0.5 : 0) + s.level * 0.1 + (s.kind && !s.members ? 0.3 : 0) + n.length * 0.002;
      scored.push([score, s]);
    }
    return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
  },
  setSystem(sys, on) {
    if (world.radio) {
      if (!on) return;
      for (const k of Object.keys(world.systemOn)) world.systemOn[k] = k === sys;
      if (state.selected && state.selected.system !== sys) api.select(null);
      const h = cellHome(sys);
      flyTo(h.target, h.position, 600);
    } else {
      world.systemOn[sys] = on;
      if (on && world.id === 'body') ensureSystem(sys);
      if (!on && state.selected?.system === sys) api.select(null);
    }
    ui.syncSystems();
  },
  ensureLoaded(s) {
    if (!s || world.id !== 'body') return Promise.resolve();
    const systems = new Set(s.members ? s.members.map((m) => m.system) : [s.bone?.system ?? s.system]);
    return Promise.all([...systems].map((x) => (worlds.body.loaded.has(x) ? null : ensureSystem(x))));
  },
  frame(s = state.selected) { if (s) frame(s); },
  frameSphere(center, radius) {
    const c = new THREE.Vector3(...center);
    const fit = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15;
    flyTo(c, c.clone().add(new THREE.Vector3(0, 0.05, 1).normalize().multiplyScalar(Math.max(fit, controls.minDistance * 2))));
  },
  home(instant = false) {
    let h = world.home;
    if (world.radio) h = cellHome(Object.keys(world.systemOn).find((k) => world.systemOn[k]));
    if (instant) { controls.target.copy(h.target); camera.position.copy(h.position); flight = null; }
    else flyTo(h.target, h.position);
  },
  toScreen(s) {
    camera.updateMatrixWorld();
    const v = s.anchor.clone().project(camera);
    return { x: (v.x + 1) / 2 * stage.clientWidth, y: (1 - v.y) / 2 * stage.clientHeight, z: v.z };
  },
  isPickable,
  isolate(on = !state.isolated) { state.isolated = on && !!state.selected; ui.showInfo(state.selected); },
  hide(s = state.selected) {
    if (!s) return;
    if (s.members) for (const m of s.members) m.hidden = true;
    else if (s.mesh) s.hidden = true;
    api.select(null);
    ui.syncHidden();
  },
  showAll() {
    for (const s of world.structures.values()) s.hidden = false;
    state.isolated = false;
    ui.syncHidden();
    ui.showInfo(state.selected);
  },
  hiddenCount() { let n = 0; for (const s of world.structures.values()) if (s.hidden && s.mesh && !s.cover) n++; return n; },
  reset() { api.select(null); api.home(); },
  view(target, dist, dir = [0, 0.05, 1]) {
    const t = Array.isArray(target) ? new THREE.Vector3(...target) : (api.find(target)?.center ?? world.home.target);
    flight = null;
    controls.target.copy(t);
    camera.position.copy(t).addScaledVector(new THREE.Vector3(...dir).normalize(), dist);
    controls.update();
  },
  tierName() { return world.tiers[state.tier].name; },
  setWorld,
  details(s) { return details?.[s.id] ?? null; },
  oianFor,
  get oian() { return oian; },
  cellFor(s) { return s && world.id === 'body' ? cellForStructure(s) : null; },
  viewCells(type) {
    setWorld('cells');
    api.setSystem(type, true);
    api.select(null);
    api.home();
  },
  landmarksOf(bone) { return [...worlds.body.structures.values()].filter((s) => s.bone === bone); },
  loadedSystems() { return [...world.loaded]; },
  unitM: () => world.unitM,
};
window.atlas = api;

const labels = new Labels({ stage, camera, controls, api });
const ui = initUI(api);
initQuiz(api);

// ---------- loop ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  labels.resize(w, h);
}
new ResizeObserver(resize).observe(stage);
resize();

let lastT = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  stepFlight(now);
  controls.update();
  pulseT = Math.min(1, pulseT + dt / 0.9);
  pulse = reduceMotion ? 0 : Math.sin(pulseT * Math.PI);
  updateLOD(dt);
  updateHover();
  renderer.render(scene, camera);
  labels.update();
  const dist = camera.position.distanceTo(controls.target);
  ui.updateScale(viewHeightAtTarget(), focalPx / dist / world.unitM, state.tier);
});

document.getElementById('reset-view').addEventListener('click', () => api.reset());

controls.minDistance = world.minDist;
controls.maxDistance = world.maxDist;
api.home(true);

loadBodyManifest().then(async () => {
  ui.ready();
  await Promise.all(Object.entries(worlds.body.systemOn).filter(([, on]) => on).map(([k]) => ensureSystem(k)));
  const params = new URLSearchParams(location.search);
  if (params.get('world') === 'cells') setWorld('cells');
  const q = params.get('select');
  if (q) { const s = api.search(q)[0]; await api.ensureLoaded(s); api.select(s ?? null, { fly: true }); }
}).catch((err) => {
  showLoading(`Models failed to load: ${err.message}. Check that public/models exists (see README: rebuilding the models).`);
  console.error(err);
});
