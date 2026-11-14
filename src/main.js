import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { SYSTEMS, TIERS, tierFor } from './systems.js';
import { Labels } from './labels.js';
import { initUI } from './ui.js';
import { initQuiz } from './quiz.js';
import './style.css';

// BVH-accelerated raycasting: picking, hover and label occlusion all raycast.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

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
// Rim light from behind the model (in camera space) so silhouettes, especially
// dark vessels and muscle, separate from the dark field.
// Light comes from behind-left-above, so only edges facing sideways catch it.
const rim = new THREE.DirectionalLight(0xdfe8ff, 1.4);
rim.position.set(-0.7, 0.5, -0.5);
camera.add(rim, rim.target); // target at the camera origin: direction stays fixed to the view
scene.add(camera, new THREE.HemisphereLight(0xf4f7ff, 0x8a7b70, 0.6));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.minDistance = 0.04;
controls.maxDistance = 6;
controls.zoomSpeed = 1.1;
controls.screenSpacePanning = true;

const HOME = { target: new THREE.Vector3(0, 0.86, 0.08), position: new THREE.Vector3(0, 0.92, 3.4) };
camera.position.copy(HOME.position);
controls.target.copy(HOME.target);

// Debug hooks for parallax-threejs / threejs-devtools.
window.scene = scene;
window.__THREE_CAMERA__ = camera;
window.__renderer__ = renderer;

// ---------- structures ----------
/** @type {Map<string, any>} */
const structures = new Map();
const meshes = [];
const systemOn = Object.fromEntries(Object.entries(SYSTEMS).map(([k, v]) => [k, v.on]));
const state = { selected: null, hovered: null, isolated: false, tier: 0 };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function sideOf(name) {
  if (/\bright\b/i.test(name)) return 'Right';
  if (/\bleft\b/i.test(name)) return 'Left';
  return 'Midline or paired';
}

// Base colour per structure: system colour with a small lightness shift so
// neighbouring parts (vertebrae, lung lobes, gyri) can be told apart.
function baseColor(s) {
  const c = new THREE.Color(SYSTEMS[s.system].color);
  const hsl = {};
  c.getHSL(hsl);
  const j = (hash(s.name.replace(/\b(left|right)\b/gi, '')) - 0.5) * 0.12;
  return c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + j, 0.15, 0.92));
}

async function load() {
  const manifest = await (await fetch(`${import.meta.env.BASE_URL}models/manifest.json`)).json();
  const byFile = new Map();
  for (const s of manifest.structures) {
    if (!byFile.has(s.file)) byFile.set(s.file, []);
    byFile.get(s.file).push(s);
  }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loading = document.getElementById('loading');
  let done = 0;
  await Promise.all([...byFile.keys()].map(async (file) => {
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}`);
    const group = new THREE.Group();
    group.name = file.replace('.glb', '');
    gltf.scene.updateMatrixWorld(true);
    const found = [];
    gltf.scene.traverse((o) => { if (o.isMesh) found.push(o); });
    const metaById = new Map(byFile.get(file).map((s) => [s.id, s]));
    for (const o of found) {
      const meta = metaById.get(o.name) ?? metaById.get(o.parent?.name);
      if (meta) register(o, meta, group);
    }
    scene.add(group);
    loading.textContent = `Loading models… ${++done} of ${byFile.size} systems`;
  }));
  loading.remove();
}

const tmpV = new THREE.Vector3();
function register(mesh, meta, group) {
  mesh.updateWorldMatrix(true, false);
  const world = mesh.matrixWorld.clone();
  mesh.removeFromParent();
  world.decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.updateMatrixWorld(true);
  mesh.name = meta.name;
  const color = baseColor(meta);
  mesh.material = new THREE.MeshStandardMaterial({
    color, roughness: meta.system === 'skeletal' ? 0.72 : 0.5, metalness: 0,
    emissive: 0x3346c4, emissiveIntensity: 0,
  });
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundsTree();
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;

  // Label anchor: the surface vertex nearest the bounding-box centre, so a
  // leader line points at the structure itself (not the air inside a rib).
  const pos = mesh.geometry.attributes.position;
  let best = Infinity;
  const anchor = new THREE.Vector3();
  const step = Math.max(1, Math.floor(pos.count / 400));
  for (let i = 0; i < pos.count; i += step) {
    tmpV.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const d = tmpV.distanceToSquared(center);
    if (d < best) { best = d; anchor.copy(tmpV); }
  }

  const s = {
    ...meta, mesh, box, center, radius, anchor, color,
    side: sideOf(meta.name), hidden: false,
    fade: 1, // 0..1 from level-of-detail
    xray: 0, // 0..1 how much it is see-through because it blocks the view
    px: 0,
  };
  mesh.userData.structure = s;
  structures.set(meta.id, s);
  meshes.push(mesh);
  group.add(mesh);
}

// ---------- level of detail + see-through ----------
const ray = new THREE.Ray();
const hit = new THREE.Vector3();
const ndc = new THREE.Vector3();
let focalPx = 1;

function viewHeightAtTarget() {
  return 2 * camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
}

function smooth(x, a, b) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Fine structures fade in once they are big enough on screen to read.
const FADE_PX = { 1: [0, 0], 2: [2, 7], 3: [5, 14] };

function updateLOD(dt) {
  const vh = renderer.domElement.clientHeight;
  focalPx = vh / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const viewH = viewHeightAtTarget();
  state.tier = tierFor(viewH);
  const tierLevel = [1, 1, 2, 3][state.tier];
  const focus = state.selected ? state.selected.center : controls.target;
  const focusDist = camera.position.distanceTo(focus);
  ray.origin.copy(camera.position);
  ray.direction.copy(focus).sub(camera.position).normalize();
  const k = 1 - Math.exp(-dt * 10);

  for (const s of structures.values()) {
    const d = Math.max(0.001, camera.position.distanceTo(s.center));
    s.px = (s.radius / d) * focalPx;
    const [a, b] = FADE_PX[s.level];
    const fadeGoal = b ? smooth(s.px, a, b) : 1;

    // See-through: structures between the camera and what you are looking
    // at turn translucent once you are zoomed in past their scale.
    let xrayGoal = 0;
    if (s !== state.selected && state.tier >= 1 && s.px > vh * 0.25) {
      const blocks = ray.intersectBox(s.box, hit) && hit.distanceTo(camera.position) < focusDist - 0.002;
      const contains = s.box.containsPoint(focus);
      if (blocks && (!contains || s.level < tierLevel || state.selected)) xrayGoal = 1;
    }
    s.fade += (fadeGoal - s.fade) * k;
    s.xray += (xrayGoal - s.xray) * k;
    applyLook(s);
  }

  // Tight near/far around what is in view keeps depth precision high when
  // zoomed in on small parts (prevents z-fighting at contact surfaces).
  const dist = camera.position.distanceTo(controls.target);
  camera.near = THREE.MathUtils.clamp(dist * 0.03, 0.002, 0.2);
  camera.far = dist + 2.5;
  camera.updateProjectionMatrix();
}

const MARK_SEL = new THREE.Color(0x3346c4);
const MARK_WRONG = new THREE.Color(0xc4332f);
function applyLook(s) {
  const m = s.mesh.material;
  const visibleSystem = systemOn[s.system] && !s.hidden && (!state.isolated || s === state.selected);
  const opacity = s.fade * (1 - 0.85 * s.xray);
  s.mesh.visible = visibleSystem && s.fade > 0.02;
  const transparent = opacity < 0.98;
  if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
  m.opacity = opacity;
  m.depthWrite = !transparent || opacity > 0.6;
  s.mesh.renderOrder = transparent ? 2 : 0;
  const sel = s === state.selected ? 0.12 + 0.3 * pulse : 0;
  const hov = s === state.hovered && s !== state.selected ? 0.2 : 0;
  // Quiz feedback: a wrong click is marked red until the next question.
  const wrong = s.quizMark === 'wrong' ? 0.55 : 0;
  m.emissive.setHex(wrong ? 0xc4332f : 0x3346c4);
  m.emissiveIntensity = wrong || sel + hov;
  // Tint the surface itself too: glow alone washes out to pale lilac on bone.
  m.color.copy(s.color);
  if (wrong) m.color.lerp(MARK_WRONG, 0.6);
  else if (sel) m.color.lerp(MARK_SEL, 0.75);
}

export function isPickable(s) {
  return s.mesh.visible && s.fade > 0.5 && s.xray < 0.5;
}

// ---------- camera flights ----------
let flight = null;
let pulse = 0;
let pulseT = 1;

function flyTo(target, position, ms = 850) {
  if (reduceMotion) ms = 0;
  flight = {
    t0: performance.now(), ms,
    fromT: controls.target.clone(), toT: target.clone(),
    fromP: camera.position.clone(), toP: position.clone(),
  };
}

function frame(s) {
  const fit = (s.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.8;
  const dir = camera.position.clone().sub(controls.target).normalize();
  flyTo(s.center, s.center.clone().addScaledVector(dir, Math.max(fit, controls.minDistance * 1.5)));
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

function pick(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const candidates = meshes.filter((m) => isPickable(m.userData.structure));
  const hits = raycaster.intersectObjects(candidates, false);
  return hits[0]?.object.userData.structure ?? null;
}

let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; flight = null; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 5) return;
  const s = pick(e.clientX, e.clientY);
  if (api.onPick?.(s)) return; // quiz mode takes clicks over
  if (s) api.select(s, { fly: true }); else api.select(null);
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

// ---------- public API (UI + tests) ----------
const api = {
  structures,
  systems: systemOn,
  state,
  select(s, { fly = false } = {}) {
    if (typeof s === 'string') s = api.find(s);
    state.selected = s;
    if (s) {
      if (!systemOn[s.system]) api.setSystem(s.system, true);
      s.hidden = false;
      pulseT = 0;
      if (fly) frame(s);
    } else if (state.isolated) {
      state.isolated = false;
    }
    ui.showInfo(s);
  },
  find(q) {
    q = q.toLowerCase();
    return [...structures.values()].find((s) => s.name.toLowerCase() === q || s.id.toLowerCase() === q) ?? null;
  },
  search(q, limit = 8) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    const scored = [];
    for (const s of structures.values()) {
      const n = s.name.toLowerCase();
      if (!words.every((w) => n.includes(w))) continue;
      const score = (n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2) + s.level * 0.1 + n.length * 0.002;
      scored.push([score, s]);
    }
    return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
  },
  setSystem(sys, on) {
    systemOn[sys] = on;
    if (!on && state.selected?.system === sys) api.select(null);
    ui.syncSystems();
  },
  frame(s = state.selected) { if (s) frame(s); },
  // Fly so a sphere (centre [x,y,z] in metres, radius) fills the view, looking from the front.
  frameSphere(center, radius) {
    const c = new THREE.Vector3(...center);
    const fit = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15;
    flyTo(c, c.clone().add(new THREE.Vector3(0, 0.05, 1).normalize().multiplyScalar(Math.max(fit, 0.08))));
  },
  home() { flyTo(HOME.target, HOME.position); },
  // Screen position (px, relative to the stage) of a structure's label anchor; z > 1 means behind the camera.
  toScreen(s) {
    camera.updateMatrixWorld();
    const v = s.anchor.clone().project(camera);
    return { x: (v.x + 1) / 2 * stage.clientWidth, y: (1 - v.y) / 2 * stage.clientHeight, z: v.z };
  },
  isPickable,
  isolate(on = !state.isolated) { state.isolated = on && !!state.selected; ui.showInfo(state.selected); },
  hide(s = state.selected) {
    if (!s) return;
    s.hidden = true;
    api.select(null);
    ui.syncHidden();
  },
  showAll() {
    for (const s of structures.values()) s.hidden = false;
    state.isolated = false;
    ui.syncHidden();
    ui.showInfo(state.selected);
  },
  hiddenCount() { let n = 0; for (const s of structures.values()) if (s.hidden) n++; return n; },
  reset() { api.select(null); flyTo(HOME.target, HOME.position); },
  // Instant camera placement for scripted checks: distance in metres from target.
  view(target, dist, dir = [0, 0.05, 1]) {
    const t = Array.isArray(target) ? new THREE.Vector3(...target) : (api.find(target)?.center ?? HOME.target);
    flight = null;
    controls.target.copy(t);
    camera.position.copy(t).addScaledVector(new THREE.Vector3(...dir).normalize(), dist);
    controls.update();
  },
  tierName() { return TIERS[state.tier].name; },
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
  ui.updateScale(viewHeightAtTarget(), focalPx / camera.position.distanceTo(controls.target), state.tier);
});

document.getElementById('reset-view').addEventListener('click', () => api.reset());

load().then(() => {
  ui.ready();
  const q = new URLSearchParams(location.search).get('select');
  if (q) api.select(api.search(q)[0] ?? null, { fly: true });
}).catch((err) => {
  document.getElementById('loading').textContent = `Models failed to load: ${err.message}. Check that public/models exists (run npm run convert).`;
  console.error(err);
});
