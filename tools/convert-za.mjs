// Builds Body Atlas models from the Z-Anatomy web export plus a few BodyParts3D
// parts that Z-Anatomy lacks (or that carry a non-commercial licence there).
//
// Usage:
//   node tools/convert-za.mjs <za-glb-dir> <za-data-dir> <bp3d-models-dir>
//     za-glb-dir:      skeletal.glb … visceral.glb from the Z-Anatomy web export
//                      (github.com/nqwrc/3d-anatomy, public/models) + lexicon.json
//     za-data-dir:     definitions.json from the same project (public/data)
//     bp3d-models-dir: v1 Body Atlas output (BodyParts3D GLBs + manifest.json)
//
// Output: public/models/<system>.glb (meshopt), manifest.json, details.json.

import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const [zaDir, dataDir, bpDir] = process.argv.slice(2);
if (!zaDir || !dataDir || !bpDir) {
  console.error('Usage: node tools/convert-za.mjs <za-glb-dir> <za-data-dir> <bp3d-models-dir>');
  process.exit(1);
}
const OUT = path.resolve('public/models');

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

// ---------- naming, systems, levels ----------
// Z-Anatomy marks the patient's side with .l / .r.
function display(zaName) {
  const m = zaName.match(/^(.*)\.(l|r)$/);
  let base = (m ? m[1] : zaName).replace(/^\((.*)\)$/, '$1').replace(/\s+/g, ' ').trim();
  if (!m) return base;
  return `${m[2] === 'l' ? 'Left' : 'Right'} ${base[0].toLowerCase()}${base.slice(1)}`;
}
const baseName = (n) => n.replace(/\.(l|r)$/, '');
const slug = (n) => n.toLowerCase().replace(/\.(l|r)$/, '-$1').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const VISCERAL = [
  ['urinary', /kidney|renal|ureter|urethra|bladder/i],
  ['reproductive', /penis|testis|prostate|deferens|ejaculatory|epididymis|seminal/i],
  ['endocrine', /hypophysis|parathyroid|pineal|suprarenal|thyroid gland/i],
  ['respiratory', /lung|bronch|trachea|pleura|nasal cavity|epiglottis|pharynx/i],
];
function systemOf(zaSystem, name) {
  // Z-Anatomy files a few muscles and bursae under the nervous system.
  if (zaSystem === 'nervous' && /muscle|bursa|iliotibial/i.test(name)) return 'muscular';
  if (zaSystem !== 'visceral') return zaSystem;
  for (const [sys, re] of VISCERAL) if (re.test(name)) return sys;
  return 'digestive';
}

// Scale level from size on the body and depth in the Z-Anatomy hierarchy:
// 1 = organ or major structure, 2 = part, 3 = fine structure.
// Long thin nerves and vessels would otherwise count as "major" just for their
// length, so they are capped at part level unless they are core structures.
const CORE = /heart|aorta|vena cava|pulmonary trunk|spinal cord|cerebell|corpus callosum|gyrus|pons|medulla oblongata|midbrain|thalamus/i;
const SHEET = /omentum|mesocolon|meso-appendix|taenia|pleura|fascia|mucosa of nasal|aponeurosis/i;
function levelOf(diag, hasParent, system, name) {
  let l = diag >= 0.12 ? 1 : diag >= 0.045 ? 2 : 3;
  if (hasParent) l = Math.max(l, 2);
  if (['nervous', 'cardiovascular', 'lymphatic', 'joints'].includes(system) && !CORE.test(name)) l = Math.max(l, 2);
  if (SHEET.test(name)) l = Math.max(l, 2);
  return l;
}

// Triangle budget grows with size; the error limit lets thin tubes (nerves,
// vessels) collapse further than the budget.
const budget = (diag) => Math.round(Math.min(4000, Math.max(120, diag * 6500)));

// Z-Anatomy credits this kidney to a CC BY-NC model; BodyParts3D kidneys replace it.
const EXCLUDE = /^(Kidney|Renal pelvis)\.(l|r)$/;

// ---------- geometry helpers ----------
function bakePrimitive(prim, world) {
  const pos = prim.getAttribute('POSITION');
  const idx = prim.getIndices();
  const n = pos.getCount();
  const p = new Float32Array(n * 3);
  const v = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, v);
    const x = v[0], y = v[1], z = v[2];
    p[i * 3] = world[0] * x + world[4] * y + world[8] * z + world[12];
    p[i * 3 + 1] = world[1] * x + world[5] * y + world[9] * z + world[13];
    p[i * 3 + 2] = world[2] * x + world[6] * y + world[10] * z + world[14];
  }
  const ind = idx ? Uint32Array.from(idx.getArray()) : Uint32Array.from({ length: n }, (_, i) => i);
  const det = world[0] * (world[5] * world[10] - world[6] * world[9]) - world[4] * (world[1] * world[10] - world[2] * world[9]) + world[8] * (world[1] * world[6] - world[2] * world[5]);
  if (det < 0) for (let i = 0; i < ind.length; i += 3) [ind[i + 1], ind[i + 2]] = [ind[i + 2], ind[i + 1]];
  return { p, ind };
}

function weld(p, ind) {
  const map = new Map();
  const out = [];
  const remap = new Uint32Array(p.length / 3);
  for (let i = 0; i < p.length / 3; i++) {
    const k = `${p[i * 3].toFixed(5)},${p[i * 3 + 1].toFixed(5)},${p[i * 3 + 2].toFixed(5)}`;
    let j = map.get(k);
    if (j === undefined) { j = out.length / 3; out.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); map.set(k, j); }
    remap[i] = j;
  }
  const tri = [];
  for (let i = 0; i < ind.length; i += 3) {
    const a = remap[ind[i]], b = remap[ind[i + 1]], c = remap[ind[i + 2]];
    if (a !== b && b !== c && a !== c) tri.push(a, b, c);
  }
  return { p: new Float32Array(out), ind: new Uint32Array(tri) };
}

function compact(p, ind) {
  const remap = new Int32Array(p.length / 3).fill(-1);
  const out = [];
  const idx = new Uint32Array(ind.length);
  for (let i = 0; i < ind.length; i++) {
    const v = ind[i];
    if (remap[v] < 0) { remap[v] = out.length / 3; out.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); }
    idx[i] = remap[v];
  }
  return { p: new Float32Array(out), ind: idx };
}

function normals(p, ind) {
  const n = new Float32Array(p.length);
  for (let i = 0; i < ind.length; i += 3) {
    const a = ind[i] * 3, b = ind[i + 1] * 3, c = ind[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

function bounds(p) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]);
  }
  return { min, max };
}

function process1(parts, target) {
  // merge primitives, weld, simplify, compact, normals
  let total = 0;
  for (const q of parts) total += q.p.length;
  const p = new Float32Array(total);
  const inds = [];
  let off = 0;
  for (const q of parts) {
    p.set(q.p, off);
    for (const i of q.ind) inds.push(i + off / 3);
    off += q.p.length;
  }
  let { p: wp, ind } = weld(p, Uint32Array.from(inds));
  if (ind.length / 3 > target) {
    const [s] = MeshoptSimplifier.simplify(ind, wp, 3, target * 3, 0.02);
    ind = s;
  }
  const c = compact(wp, ind);
  return { ...c, n: normals(c.p, c.ind), b: bounds(c.p) };
}

// ---------- read Z-Anatomy ----------
const definitions = JSON.parse(fs.readFileSync(path.join(dataDir, 'definitions.json'), 'utf8'));
const lexicon = JSON.parse(fs.readFileSync(path.join(zaDir, 'lexicon.json'), 'utf8'));
const items = [];
for (const file of fs.readdirSync(zaDir).filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(path.join(zaDir, file));
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const ex = node.getExtras();
    const zaName = ex.za_name ?? node.getName();
    if (EXCLUDE.test(zaName)) continue;
    const world = node.getWorldMatrix();
    const parts = mesh.listPrimitives().map((pr) => bakePrimitive(pr, world));
    const raw = bounds(parts[0].p);
    for (const q of parts.slice(1)) { const b = bounds(q.p); for (let k = 0; k < 3; k++) { raw.min[k] = Math.min(raw.min[k], b.min[k]); raw.max[k] = Math.max(raw.max[k], b.max[k]); } }
    const diag = Math.hypot(...raw.max.map((v, k) => v - raw.min[k]));
    const parent = node.getParentNode();
    const parentName = parent?.getExtras()?.za_name ?? null;
    items.push({ zaName, zaSystem: ex.za_system ?? file.replace('.glb', ''), parts, diag, parentName });
  }
}
console.log('Z-Anatomy meshes:', items.length);

// ---------- BodyParts3D extras, fitted into the Z-Anatomy frame ----------
const bpManifest = JSON.parse(fs.readFileSync(path.join(bpDir, 'manifest.json'), 'utf8'));
const bpBy = new Map(bpManifest.structures.map((s) => [s.name, s]));
const zaBox = new Map(items.map((it) => {
  const b = bounds(it.parts.flatMap((q) => [...q.p]));
  return [it.zaName, b];
}));
// Reference bones present in both datasets: fit z = s * bp + t per axis.
const REFS = [
  ['Right femur', 'Femur.r'], ['Left femur', 'Femur.l'], ['Right humerus', 'Humerus.r'], ['Left humerus', 'Humerus.l'],
  ['Right hip bone', 'Hip bone.r'], ['Left hip bone', 'Hip bone.l'], ['Sacrum', 'Sacrum'], ['Mandible', 'Mandible'],
  ['Occipital bone', 'Occipital bone'], ['Body of sternum', 'Body of sternum'], ['Right tibia', 'Tibia.r'], ['Left tibia', 'Tibia.l'],
];
const pairs = [];
for (const [bpName, zaName] of REFS) {
  const a = bpBy.get(bpName), b = zaBox.get(zaName);
  if (!a || !b) { console.warn('alignment ref missing:', bpName, zaName, !!a, !!b); continue; }
  for (let k = 0; k < 3; k++) {
    pairs.push([k, a.center[k] - a.size[k] / 2, b.min[k]]);
    pairs.push([k, a.center[k] + a.size[k] / 2, b.max[k]]);
  }
}
// least squares for a shared scale s and per-axis offsets t[k]
function fit() {
  // minimise sum (s*x + t_k - y)^2 ; t_k = mean_k(y - s x); solve s
  let num = 0, den = 0;
  const mx = [0, 0, 0], my = [0, 0, 0], cnt = [0, 0, 0];
  for (const [k, x, y] of pairs) { mx[k] += x; my[k] += y; cnt[k]++; }
  for (let k = 0; k < 3; k++) { mx[k] /= cnt[k]; my[k] /= cnt[k]; }
  for (const [k, x, y] of pairs) { num += (x - mx[k]) * (y - my[k]); den += (x - mx[k]) ** 2; }
  const s = num / den;
  const t = mx.map((m, k) => my[k] - s * m);
  const rms = Math.sqrt(pairs.reduce((a, [k, x, y]) => a + (s * x + t[k] - y) ** 2, 0) / pairs.length);
  return { s, t, rms };
}
const align = fit();
console.log(`BodyParts3D -> Z-Anatomy fit: scale ${align.s.toFixed(4)}, offset ${align.t.map((v) => v.toFixed(4))}, rms ${(align.rms * 1000).toFixed(1)} mm`);

const BP_EXTRAS = {
  'Right lateral ventricle': { system: 'nervous', parent: null },
  'Left lateral ventricle': { system: 'nervous', parent: null },
  'Third ventricle': { system: 'nervous', parent: null },
  'Right kidney': { system: 'urinary', parent: null },
  'Left kidney': { system: 'urinary', parent: null },
};
const bpDocs = new Map();
for (const [name, extra] of Object.entries(BP_EXTRAS)) {
  const meta = bpBy.get(name);
  if (!meta) { console.warn('missing BP extra', name); continue; }
  if (!bpDocs.has(meta.file)) bpDocs.set(meta.file, await io.read(path.join(bpDir, meta.file)));
  const node = bpDocs.get(meta.file).getRoot().listNodes().find((n) => n.getName() === meta.id);
  const world = node.getWorldMatrix();
  const parts = node.getMesh().listPrimitives().map((pr) => bakePrimitive(pr, world));
  for (const q of parts) for (let i = 0; i < q.p.length; i += 3) for (let k = 0; k < 3; k++) q.p[i + k] = align.s * q.p[i + k] + align.t[k];
  const b = bounds(parts[0].p);
  items.push({
    zaName: name, display: name, zaSystem: extra.system, parts, parentName: extra.parent,
    diag: Math.hypot(...b.max.map((v, k) => v - b.min[k])), source: 'BodyParts3D', fma: meta.id,
  });
}

// ---------- write per-system GLBs ----------
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.glb')) fs.rmSync(path.join(OUT, f));

const zaToDisplay = new Map(items.map((it) => [it.zaName, it.display ?? display(it.zaName)]));
const bySystem = new Map();
for (const it of items) {
  it.system = systemOf(it.zaSystem, it.zaName);
  if (!bySystem.has(it.system)) bySystem.set(it.system, []);
  bySystem.get(it.system).push(it);
}

const manifest = {
  sources: ['Z-Anatomy (CC BY-SA 4.0), based on BodyParts3D (CC BY-SA 2.1 JP)', 'BodyParts3D (CC BY-SA 2.1 JP)'],
  units: 'm', files: {}, structures: [],
};
const details = {};
const usedIds = new Set();
let totalTris = 0;

for (const [system, list] of bySystem) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(system);
  const material = doc.createMaterial(system);
  let sysTris = 0;
  for (const it of list) {
    const g = process1(it.parts, budget(it.diag));
    if (g.ind.length < 3) continue;
    let id = slug(it.zaName);
    while (usedIds.has(id)) id += '-x';
    usedIds.add(id);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.p).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.n).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.ind).setBuffer(buffer))
      .setMaterial(material);
    scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)));
    const tris = g.ind.length / 3;
    sysTris += tris;
    const name = zaToDisplay.get(it.zaName);
    const base = baseName(it.zaName);
    manifest.structures.push({
      id, name, system, level: levelOf(it.diag, !!it.parentName, system, it.zaName),
      ...(SHEET.test(it.zaName) ? { cover: true } : {}),
      partOf: it.parentName ? zaToDisplay.get(it.parentName) ?? display(it.parentName) : null,
      file: `${system}.glb`,
      center: g.b.min.map((v, k) => +((v + g.b.max[k]) / 2).toFixed(4)),
      size: g.b.min.map((v, k) => +(g.b.max[k] - v).toFixed(4)),
      tris, source: it.source ?? 'Z-Anatomy', ...(it.fma ? { fma: it.fma } : {}),
    });
    const def = definitions[base] ?? definitions[`(${base})`] ?? definitions[it.zaName];
    const lex = lexicon[base] ?? lexicon[`(${base})`];
    if (def || lex?.la) details[id] = { ...(def ? { def } : {}), ...(lex?.la ? { latin: lex.la } : {}) };
  }
  await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT, `${system}.glb`);
  await io.write(out, doc);
  const bytes = fs.statSync(out).size;
  manifest.files[`${system}.glb`] = { bytes, tris: sysTris };
  totalTris += sysTris;
  console.log(`${system.padEnd(15)} ${String(list.length).padStart(4)} structures  ${String(sysTris).padStart(8)} tris  ${(bytes / 1e6).toFixed(2)} MB`);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
fs.writeFileSync(path.join(OUT, 'details.json'), JSON.stringify(details));
console.log(`total: ${manifest.structures.length} structures, ${totalTris} triangles; details for ${Object.keys(details).length}`);
