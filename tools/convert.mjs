// Convert BodyParts3D binary STL files into one meshopt-compressed GLB per body
// system, plus public/models/manifest.json with per-structure metadata.
//
// Usage: node tools/convert.mjs <stl-dir> <selection.json>
//   selection.json: [{ id, name, system, level }]  (see tools/selection.json)
//
// Geometry: BodyParts3D is in millimetres, Z-up. We convert to metres, Y-up,
// weld duplicate vertices, simplify to a per-level triangle budget, and compute
// smooth normals. All parts share one coordinate frame, so they line up.

import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const [stlDir, selectionPath] = process.argv.slice(2);
if (!stlDir || !selectionPath) {
  console.error('Usage: node tools/convert.mjs <stl-dir> <selection.json>');
  process.exit(1);
}
const OUT = path.resolve('public/models');
fs.mkdirSync(OUT, { recursive: true });

// Triangle budget by scale level (1 = whole-body scale, 3 = fine structure).
const BUDGET = { 1: 10000, 2: 4000, 3: 1800 };

function readSTL(file) {
  const buf = fs.readFileSync(file);
  const n = buf.readUInt32LE(80);
  if (84 + n * 50 !== buf.length) throw new Error(`${file}: not a binary STL`);
  const map = new Map();
  const pos = [];
  const idx = new Uint32Array(n * 3);
  for (let t = 0; t < n; t++) {
    for (let v = 0; v < 3; v++) {
      const o = 84 + t * 50 + 12 + v * 12;
      // mm Z-up  ->  m Y-up  (x, z, -y)
      const x = buf.readFloatLE(o) / 1000;
      const y = buf.readFloatLE(o + 8) / 1000;
      const z = -buf.readFloatLE(o + 4) / 1000;
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      let i = map.get(key);
      if (i === undefined) { i = pos.length / 3; pos.push(x, y, z); map.set(key, i); }
      idx[t * 3 + v] = i;
    }
  }
  // drop degenerate triangles produced by welding
  const clean = [];
  for (let t = 0; t < n; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    if (a !== b && b !== c && a !== c) clean.push(a, b, c);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(clean) };
}

function simplify(positions, indices, targetTris) {
  if (indices.length / 3 <= targetTris) return indices;
  const [out] = MeshoptSimplifier.simplify(indices, positions, 3, targetTris * 3, 0.02);
  return out;
}

function compact(positions, indices) {
  const remap = new Int32Array(positions.length / 3).fill(-1);
  const pos = [];
  const idx = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    if (remap[v] < 0) { remap[v] = pos.length / 3; pos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); }
    idx[i] = remap[v];
  }
  return { positions: new Float32Array(pos), indices: idx };
}

function normals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
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

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const selection = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
const bySystem = new Map();
for (const s of selection) {
  if (!bySystem.has(s.system)) bySystem.set(s.system, []);
  bySystem.get(s.system).push(s);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const manifest = { source: 'BodyParts3D', units: 'm', structures: [] };
let totalTris = 0;

for (const [system, items] of bySystem) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(system);
  const material = doc.createMaterial(system);
  for (const s of items) {
    const file = path.join(stlDir, `${s.id}.stl`);
    if (!fs.existsSync(file)) { console.warn('missing', s.id); continue; }
    const raw = readSTL(file);
    const simp = simplify(raw.positions, raw.indices, BUDGET[s.level]);
    const { positions, indices } = compact(raw.positions, simp);
    totalTris += indices.length / 3;
    const nrm = normals(positions, indices);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
      .setMaterial(material);
    const mesh = doc.createMesh(s.id).addPrimitive(prim);
    scene.addChild(doc.createNode(s.id).setMesh(mesh));
    const b = bounds(positions);
    manifest.structures.push({
      id: s.id, name: s.name, system: s.system, level: s.level, partOf: s.partOf ?? null, file: `${system}.glb`,
      center: b.min.map((v, k) => +((v + b.max[k]) / 2).toFixed(4)),
      size: b.min.map((v, k) => +(b.max[k] - v).toFixed(4)),
      tris: indices.length / 3,
    });
  }
  await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT, `${system}.glb`);
  await io.write(out, doc);
  console.log(`${system}: ${items.length} structures, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log(`total triangles: ${totalTris}`);
