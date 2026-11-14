import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Schematic cell models, built from simple shapes. Proportions follow typical
// textbook sizes (1 unit = 10 µm) but shapes are idealised: these are NOT
// microscopy reconstructions. Each part: { key, name, level, partOf, desc,
// geometry, color, opacity?, side? }.

const C = {
  nucleus: '#7c6fd6', nucleolus: '#4a3fa8', chromatin: '#a99cf0', pore: '#d8d2ff',
  rer: '#4f9fd8', ser: '#6cc3c9', golgi: '#e6a23c', mito: '#e0663f', cristae: '#ffb08f',
  lyso: '#a6d65a', perox: '#d6c95a', centriole: '#cfd8dc', ribo: '#f4f4f4', vesicle: '#f2b8c6',
  cytoskel: '#9ea7ad',
};

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rr = (a, b) => a + (b - a) * rnd();

// Sphere with a wedge cut away (front-right quarter), so the inside shows.
function cutSphere(r, sx = 1, sy = 1, sz = 1, seg = 48) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7), Math.PI * 0.5, Math.PI * 1.5);
  g.scale(sx, sy, sz);
  return g;
}

function place(geom, pos, rot = [0, 0, 0], scale = 1) {
  const g = geom.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3().setScalar(1).multiplyScalar(scale));
  g.applyMatrix4(m);
  return g;
}

function merge(list) {
  const clean = list.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g;
  });
  return mergeGeometries(clean, false);
}

// Random point inside an ellipsoid shell, avoiding a sphere (e.g. the nucleus).
function inside(rx, ry, rz, avoid = null, minR = 0.15, maxR = 0.92) {
  for (let i = 0; i < 200; i++) {
    const p = [rr(-1, 1), rr(-1, 1), rr(-1, 1)];
    const d = Math.hypot(...p);
    if (d > maxR || d < minR) continue;
    const q = [p[0] * rx, p[1] * ry, p[2] * rz];
    if (avoid && Math.hypot(q[0] - avoid.c[0], q[1] - avoid.c[1], q[2] - avoid.c[2]) < avoid.r) continue;
    return q;
  }
  return [0, 0, 0];
}

const randRot = () => [rr(0, Math.PI), rr(0, Math.PI), rr(0, Math.PI)];

function tubeAlong(points, r, seg = 40, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

function wiggle(start, dir, len, n, amp) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    pts.push([start[0] + dir[0] * t + rr(-amp, amp), start[1] + dir[1] * t + rr(-amp, amp), start[2] + dir[2] * t + rr(-amp, amp)]);
  }
  return pts;
}

// ---------- shared organelle builders ----------
function nucleusParts(c, r, prefix = '') {
  const pores = [];
  for (let i = 0; i < 40; i++) {
    const u = rr(0, Math.PI * 2), v = Math.acos(rr(-1, 1));
    const n = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
    if (n[0] < -0.05 && n[2] > 0.05) continue; // skip the cut-away wedge (-x, +z)
    const g = new THREE.TorusGeometry(r * 0.06, r * 0.018, 6, 12);
    g.lookAt(new THREE.Vector3(...n));
    pores.push(place(g, n.map((x, i) => c[i] + x * r)));
  }
  const chrom = [];
  for (let i = 0; i < 7; i++) chrom.push(tubeAlong(wiggle(inside(r * 0.7, r * 0.7, r * 0.7).map((x, k) => x + c[k]), [rr(-1, 1), rr(-1, 1), rr(-1, 1)], r * 0.5, 6, r * 0.12), r * 0.025, 30, 5));
  return [
    { key: 'nucleus', name: `${prefix}Nucleus`, level: 2, color: C.nucleus, geometry: place(cutSphere(r, 1, 1, 1, 40), c),
      desc: 'Holds the cell’s DNA and controls gene expression. Bounded by the nuclear envelope, a double membrane continuous with the rough ER.' },
    { key: 'nucleolus', name: `${prefix}Nucleolus`, level: 3, partOf: `${prefix}Nucleus`, color: C.nucleolus, geometry: place(new THREE.SphereGeometry(r * 0.3, 24, 16), [c[0] - r * 0.25, c[1] + r * 0.1, c[2] - r * 0.2]),
      desc: 'Dense region inside the nucleus where ribosomal RNA is made and ribosome subunits are assembled.' },
    { key: 'pores', name: `${prefix}Nuclear pores`, level: 3, partOf: `${prefix}Nucleus`, color: C.pore, geometry: merge(pores),
      desc: 'Protein channels through the nuclear envelope that control traffic of RNA and proteins between nucleus and cytoplasm.' },
    { key: 'chromatin', name: `${prefix}Chromatin`, level: 3, partOf: `${prefix}Nucleus`, color: C.chromatin, geometry: merge(chrom),
      desc: 'DNA wound around histone proteins. Condenses into visible chromosomes only when the cell divides.' },
  ];
}

function mitoParts(count, spot, size = 0.09, label = 'Mitochondria') {
  const outer = [], cristae = [];
  let first = null;
  for (let i = 0; i < count; i++) {
    const p = spot(), rot = randRot();
    first ??= p;
    const cap = new THREE.CapsuleGeometry(size, size * 2.6, 6, 14);
    outer.push(place(cap, p, rot));
    for (let k = -2; k <= 2; k++) {
      const plate = new THREE.BoxGeometry(size * 1.5, size * 0.06, size * 1.1);
      plate.translate(0, k * size * 0.55, 0);
      cristae.push(place(plate, p, rot));
    }
  }
  return [
    { key: 'mito', name: label, level: 2, color: C.mito, geometry: merge(outer), count, focus: first, focusR: size * 3,
      each: `about ${(size * 20).toFixed(1)} µm wide and ${((size * 4.6) * 10).toFixed(1)} µm long`,
      desc: 'Make most of the cell’s ATP by aerobic respiration. Have their own DNA and a double membrane; the inner membrane folds into cristae.' },
    { key: 'cristae', name: 'Cristae', level: 3, partOf: label, color: C.cristae, geometry: merge(cristae), focus: first, focusR: size * 2.5, each: 'set of folds inside every mitochondrion',
      desc: 'Folds of the inner mitochondrial membrane. They hold the electron transport chain and ATP synthase, and the folding increases their surface area.' },
  ];
}

function dots(count, spot, r, detail = 0) {
  const base = new THREE.IcosahedronGeometry(r, detail);
  const list = [];
  for (let i = 0; i < count; i++) list.push(place(base, spot()));
  return merge(list);
}

function erParts(nc, nr, cellR) {
  // Rough ER: curved sheets wrapped around the nucleus, studded with ribosomes.
  const sheets = [], ribos = [];
  for (let i = 0; i < 6; i++) {
    const r = nr * (1.25 + i * 0.12);
    const g = new THREE.SphereGeometry(r, 24, 10, Math.PI * (0.55 + rr(0, 0.3)), Math.PI * rr(0.5, 0.8), Math.PI * rr(0.2, 0.35), Math.PI * rr(0.25, 0.4));
    sheets.push(place(g, nc));
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k += 7) ribos.push(place(new THREE.IcosahedronGeometry(0.009, 0), [pos.getX(k) + nc[0], pos.getY(k) + nc[1], pos.getZ(k) + nc[2]]));
  }
  const ser = [];
  for (let i = 0; i < 6; i++) {
    const s = inside(cellR * 0.8, cellR * 0.7, cellR * 0.8, { c: nc, r: nr * 1.9 }, 0.45, 0.85);
    ser.push(tubeAlong(wiggle(s, [rr(-1, 1), rr(-1, 1), rr(-1, 1)], cellR * 0.35, 5, cellR * 0.08), 0.018, 30, 6));
  }
  return [
    { key: 'rer', name: 'Rough endoplasmic reticulum', level: 2, color: C.rer, geometry: merge(sheets),
      desc: 'Flattened membrane sacs studded with ribosomes. Makes proteins for membranes, lysosomes and secretion, and folds them.' },
    { key: 'boundribo', name: 'Bound ribosomes', level: 3, partOf: 'Rough endoplasmic reticulum', color: C.ribo, geometry: merge(ribos),
      desc: 'Ribosomes attached to the rough ER. They feed new protein chains straight into the ER.' },
    { key: 'ser', name: 'Smooth endoplasmic reticulum', level: 2, color: C.ser, geometry: merge(ser),
      desc: 'Tubular membranes without ribosomes. Make lipids and steroids, detoxify drugs and store calcium.' },
  ];
}

function golgiParts(c, size = 0.22) {
  const cis = [], ves = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.SphereGeometry(size * (1 - i * 0.06), 24, 6, 0, Math.PI * 2, 0, Math.PI * 0.32);
    g.scale(1, 0.25, 1);
    cis.push(place(g, [c[0], c[1] + i * size * 0.13, c[2]]));
  }
  for (let i = 0; i < 10; i++) ves.push(place(new THREE.SphereGeometry(size * 0.08, 10, 8), [c[0] + rr(-size, size), c[1] + rr(size * 0.5, size * 1.0), c[2] + rr(-size, size)]));
  return [
    { key: 'golgi', name: 'Golgi apparatus', level: 2, color: C.golgi, geometry: merge(cis),
      desc: 'Stack of flattened sacs (cisternae) that modifies, sorts and packages proteins and lipids from the ER.' },
    { key: 'golgives', name: 'Golgi vesicles', level: 3, partOf: 'Golgi apparatus', color: C.vesicle, geometry: merge(ves),
      desc: 'Small membrane sacs that bud from the Golgi and carry its products to the membrane, lysosomes or out of the cell.' },
  ];
}

function centrioles(c, s = 0.05) {
  const a = new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 1.6, 9, 1, true);
  return { key: 'centrioles', name: 'Centrioles', level: 2, color: C.centriole,
    geometry: merge([place(a, c), place(a, [c[0] + s * 0.9, c[1], c[2]], [Math.PI / 2, 0, 0])]),
    desc: 'A pair of short cylinders of microtubule triplets set at right angles. They form the centrosome, which organises the spindle in cell division.' };
}

function microtubules(c, R, n = 14) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const d = [rr(-1, 1), rr(-1, 1), rr(-1, 1)];
    const l = Math.hypot(...d);
    list.push(tubeAlong(wiggle(c, d.map((x) => x / l), R * 0.5, 6, R * 0.03), 0.006, 24, 4));
  }
  return { key: 'microtubules', name: 'Microtubules (cytoskeleton)', level: 3, color: C.cytoskel, geometry: merge(list),
    desc: 'Hollow protein tubes that radiate from the centrosome. They shape the cell, act as tracks for transport, and form the spindle.' };
}

// ---------- cell types ----------
function animal() {
  seed = 11;
  const R = 1.0, nc = [-0.12, 0, -0.1], nr = 0.32;
  const spot = () => inside(R * 0.85, R * 0.72, R * 0.85, { c: nc, r: nr * 1.6 }, 0.35, 0.66);
  return [
    { key: 'membrane', name: 'Plasma membrane', level: 1, color: '#8fb3d9', opacity: 0.9, geometry: cutSphere(R, 1, 0.82, 1, 64),
      desc: 'Phospholipid bilayer with embedded proteins that encloses the cytoplasm and controls what enters and leaves the cell.' },
    ...nucleusParts(nc, nr),
    ...erParts(nc, nr, R),
    ...golgiParts([0.32, 0.18, -0.15]),
    ...mitoParts(12, spot),
    { key: 'lyso', name: 'Lysosomes', level: 2, color: C.lyso, geometry: dots(9, spot, 0.045, 2), count: 9, each: 'about 0.9 µm across (real ones 0.1–1.2 µm)',
      desc: 'Membrane sacs of digestive enzymes (acidic inside) that break down worn-out organelles, debris and engulfed material.' },
    { key: 'perox', name: 'Peroxisomes', level: 2, color: C.perox, geometry: dots(6, spot, 0.035, 2), count: 6, each: 'about 0.7 µm across',
      desc: 'Small sacs that break down fatty acids and neutralise hydrogen peroxide using the enzyme catalase.' },
    { key: 'vesicles', name: 'Secretory vesicles', level: 2, color: C.vesicle, geometry: dots(10, () => inside(R * 0.85, R * 0.72, R * 0.85, null, 0.78, 0.9), 0.04, 2),
      desc: 'Carry products from the Golgi to the plasma membrane and release them by exocytosis.' },
    centrioles([0.15, -0.25, -0.2]),
    microtubules([0.15, -0.25, -0.2], R),
    { key: 'freeribo', name: 'Free ribosomes', level: 3, color: C.ribo, each: 'drawn about 0.2 µm across; real ribosomes are ~25 nm, far too small to show to scale', geometry: dots(260, () => inside(R * 0.85, R * 0.72, R * 0.85, { c: nc, r: nr * 1.1 }, 0.2, 0.9), 0.009, 0),
      desc: 'Ribosomes floating in the cytosol. They make proteins that stay in the cytoplasm.' },
  ];
}

function neuron() {
  seed = 23;
  const R = 0.6, nc = [0, 0.03, -0.05], nr = 0.22;
  const dendrites = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const dir = [Math.cos(a) * 0.8 - 0.3, Math.sin(a) * 0.9 + 0.25, rr(-0.3, 0.3)];
    const start = dir.map((x) => x * R * 0.85);
    const main = wiggle(start, dir, 1.6, 6, 0.06);
    dendrites.push(tubeAlong(main, 0.06, 40, 8));
    for (let k = 0; k < 2; k++) {
      const from = main[3 + k * 2];
      dendrites.push(tubeAlong(wiggle(from, [dir[0] + rr(-0.6, 0.6), dir[1] + rr(-0.6, 0.6), dir[2] + rr(-0.4, 0.4)], 0.7, 4, 0.05), 0.03, 24, 6));
    }
  }
  // Axon runs to the right (+x).
  const axStart = [R * 0.95, -0.05, 0], L = 7;
  const axonPts = [[axStart[0] - 0.1, axStart[1], 0], ...Array.from({ length: 12 }, (_, i) => [axStart[0] + 0.3 + (i / 11) * L, Math.sin(i * 0.7) * 0.08, 0])];
  const axonCurve = new THREE.CatmullRomCurve3(axonPts.map((p) => new THREE.Vector3(...p)));
  const myelin = [], nodes = [], schwann = [];
  for (let t = 0.1; t < 0.88; t += 0.11) {
    const a = axonCurve.getPointAt(t), b = axonCurve.getPointAt(t + 0.095);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const seg = new THREE.CapsuleGeometry(0.11, len - 0.2, 6, 16);
    seg.rotateZ(Math.PI / 2);
    myelin.push(place(seg, mid.toArray(), [0, 0, Math.atan2(b.y - a.y, b.x - a.x)]));
    schwann.push(place(new THREE.SphereGeometry(0.05, 12, 8), [mid.x, mid.y + 0.12, mid.z + 0.03]));
    const n = axonCurve.getPointAt(Math.min(0.99, t + 0.103));
    const ring = new THREE.TorusGeometry(0.05, 0.012, 8, 20);
    ring.rotateY(Math.PI / 2);
    nodes.push(place(ring, n.toArray()));
  }
  const end = axonCurve.getPointAt(1);
  const term = [], knobs = [], synves = [];
  for (let i = 0; i < 5; i++) {
    const d = [1, rr(-0.9, 0.9), rr(-0.6, 0.6)];
    const pts = wiggle(end.toArray(), d, 0.7, 4, 0.04);
    term.push(tubeAlong(pts, 0.02, 20, 6));
    const k = pts[pts.length - 1];
    knobs.push(place(new THREE.SphereGeometry(0.075, 16, 12), k));
    for (let v = 0; v < 6; v++) synves.push(place(new THREE.SphereGeometry(0.012, 8, 6), [k[0] + rr(-0.04, 0.04), k[1] + rr(-0.04, 0.04), k[2] + rr(-0.04, 0.04)]));
  }
  const nissl = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.SphereGeometry(0.05, 10, 6);
    g.scale(1.6, 0.35, 1);
    nissl.push(place(g, inside(R * 0.8, R * 0.8, R * 0.8, { c: nc, r: nr * 1.25 }, 0.4, 0.85), randRot()));
  }
  const spot = () => inside(R * 0.8, R * 0.8, R * 0.8, { c: nc, r: nr * 1.3 }, 0.4, 0.85);
  const hill = new THREE.CylinderGeometry(0.06, 0.2, 0.35, 20);
  hill.rotateZ(Math.PI / 2);
  return [
    { key: 'soma', name: 'Cell body (soma)', level: 1, color: '#f0cf6a', opacity: 0.9, geometry: cutSphere(R, 1, 1, 1, 56),
      desc: 'Contains the nucleus and most organelles of the neuron and integrates incoming signals from the dendrites.' },
    ...nucleusParts(nc, nr).slice(0, 2),
    { key: 'nissl', name: 'Nissl bodies', level: 2, color: C.rer, geometry: merge(nissl),
      desc: 'Clumps of rough ER and ribosomes in the cell body that make the neuron’s proteins. They stain darkly with basic dyes.' },
    ...mitoParts(6, spot, 0.05),
    { key: 'dendrites', name: 'Dendrites', level: 1, color: '#e8bf55', geometry: merge(dendrites),
      desc: 'Branched extensions that receive signals from other neurons and carry them toward the cell body.' },
    { key: 'hillock', name: 'Axon hillock', level: 2, color: '#d8a942', geometry: place(hill, [R * 0.98, -0.05, 0]),
      desc: 'Cone where the axon leaves the cell body. Action potentials usually start at the initial segment just beyond it.' },
    { key: 'axon', name: 'Axon', level: 1, color: '#d9b14a', geometry: new THREE.TubeGeometry(axonCurve, 160, 0.04, 8, false),
      desc: 'Single long process that carries action potentials away from the cell body. Real axons can be up to a metre long; this one is shortened.' },
    { key: 'myelin', name: 'Myelin sheath', level: 2, partOf: 'Axon', color: '#f4f1ea', geometry: merge(myelin),
      desc: 'Fatty insulation wrapped around the axon (by Schwann cells in the PNS, oligodendrocytes in the CNS). Speeds conduction.' },
    { key: 'nodes', name: 'Nodes of Ranvier', level: 3, partOf: 'Axon', color: '#9aa8ff', geometry: merge(nodes),
      desc: 'Gaps between myelin segments where ion channels cluster. The impulse jumps from node to node (saltatory conduction).' },
    { key: 'schwann', name: 'Schwann cell nuclei', level: 3, partOf: 'Myelin sheath', color: C.nucleus, geometry: merge(schwann),
      desc: 'Each myelin segment in a peripheral nerve is one Schwann cell wrapped around the axon; its nucleus sits on the outside.' },
    { key: 'terminals', name: 'Axon terminals', level: 2, color: '#d9b14a', geometry: merge(term),
      desc: 'Fine branches at the end of the axon (telodendria) that reach the target cells.' },
    { key: 'knobs', name: 'Synaptic knobs (terminal boutons)', level: 2, partOf: 'Axon terminals', color: '#f2a65a', geometry: merge(knobs),
      desc: 'Swollen ends of the axon terminals that form synapses and release neurotransmitter.' },
    { key: 'synves', name: 'Synaptic vesicles', level: 3, partOf: 'Synaptic knobs (terminal boutons)', color: C.vesicle, geometry: merge(synves),
      desc: 'Small vesicles filled with neurotransmitter, released into the synaptic cleft when an action potential arrives.' },
  ];
}

function muscle() {
  seed = 31;
  const R = 1.0, L = 7;
  const shell = new THREE.CylinderGeometry(R, R, L, 64, 1, true, Math.PI * 0.5, Math.PI * 1.5);
  shell.rotateZ(Math.PI / 2);
  const fibrils = [], zd = [], aband = [], iband = [], sr = [], tt = [], nuclei = [];
  const fib = new THREE.CylinderGeometry(0.11, 0.11, L * 0.98, 12, 1);
  fib.rotateZ(Math.PI / 2);
  const centres = [];
  for (let y = -0.8; y <= 0.8; y += 0.26) for (let z = -0.8; z <= 0.8; z += 0.26) {
    if (Math.hypot(y, z) > 0.82) continue;
    centres.push([y, z]);
  }
  // One featured myofibril shows sarcomere banding; others are plain.
  const feat = centres.reduce((b, c) => (c[0] + c[1] > b[0] + b[1] ? c : b));
  for (const [y, z] of centres) if (c2s(y, z) !== c2s(...feat)) fibrils.push(place(fib, [0, y, z]));
  const S = 0.25; // sarcomere length 2.5 µm
  for (let x = -L / 2 + 0.05; x < L / 2 - S; x += S) {
    const zg = new THREE.CylinderGeometry(0.125, 0.125, 0.012, 14); zg.rotateZ(Math.PI / 2);
    zd.push(place(zg, [x, feat[0], feat[1]]));
    const ag = new THREE.CylinderGeometry(0.115, 0.115, S * 0.6, 14); ag.rotateZ(Math.PI / 2);
    aband.push(place(ag, [x + S / 2, feat[0], feat[1]]));
    const ig = new THREE.CylinderGeometry(0.105, 0.105, S * 0.19, 14); ig.rotateZ(Math.PI / 2);
    iband.push(place(ig, [x + S * 0.1, feat[0], feat[1]]), place(ig, [x + S * 0.9, feat[0], feat[1]]));
  }
  for (let x = -L / 2 + 0.2; x < L / 2; x += S * 2) {
    const ring = new THREE.TorusGeometry(0.86, 0.012, 6, 64, Math.PI * 1.5); ring.rotateY(Math.PI / 2); ring.rotateX(Math.PI * 0.5);
    tt.push(place(ring, [x, 0, 0]));
    const net = new THREE.TorusGeometry(0.8, 0.02, 6, 64, Math.PI * 1.5); net.rotateY(Math.PI / 2); net.rotateX(Math.PI * 0.5);
    sr.push(place(net, [x + S * 0.5, 0, 0]));
  }
  for (let i = 0; i < 7; i++) {
    const a = rr(Math.PI * 0.6, Math.PI * 1.9);
    const g = new THREE.SphereGeometry(0.12, 16, 10); g.scale(2.6, 0.5, 1);
    nuclei.push(place(g, [rr(-L / 2 + 0.4, L / 2 - 0.4), Math.cos(a) * 0.92, Math.sin(a) * 0.92], [a, 0, 0]));
  }
  const spot = () => [rr(-L / 2 + 0.3, L / 2 - 0.3), rr(-0.75, 0.75), rr(-0.75, 0.75)];
  return [
    { key: 'sarcolemma', name: 'Sarcolemma', level: 1, color: '#c25a50', opacity: 0.9, geometry: shell,
      desc: 'Plasma membrane of the muscle fiber. It carries the action potential and dips inward as T-tubules. (Fiber shortened; real fibers can be many cm long.)' },
    { key: 'myofibrils', name: 'Myofibrils', level: 2, color: '#d98a7e', geometry: merge(fibrils),
      desc: 'Rod-like bundles of contractile filaments that fill the fiber, made of sarcomeres repeated end to end.' },
    { key: 'zdisc', name: 'Z discs', level: 3, partOf: 'Sarcomere', color: '#222831', geometry: merge(zd),
      desc: 'Protein plates that mark each end of a sarcomere and anchor the thin (actin) filaments.' },
    { key: 'aband', name: 'A band (thick myosin filaments)', level: 3, partOf: 'Sarcomere', color: '#8e2f2a', geometry: merge(aband),
      desc: 'Dark band the length of the thick myosin filaments. Its length does not change during contraction.' },
    { key: 'iband', name: 'I band (thin actin filaments only)', level: 3, partOf: 'Sarcomere', color: '#f3c9c2', geometry: merge(iband),
      desc: 'Light band of thin actin filaments only, either side of a Z disc. It shortens as the fiber contracts.' },
    { key: 'sr', name: 'Sarcoplasmic reticulum', level: 2, color: C.ser, geometry: merge(sr),
      desc: 'Smooth ER of muscle that wraps each myofibril. It stores calcium and releases it to trigger contraction.' },
    { key: 'ttub', name: 'T-tubules', level: 3, color: '#9aa8ff', geometry: merge(tt),
      desc: 'Inward tubes of the sarcolemma that carry the action potential deep into the fiber, next to the sarcoplasmic reticulum.' },
    { key: 'nuclei', name: 'Peripheral nuclei', level: 2, color: C.nucleus, geometry: merge(nuclei),
      desc: 'Skeletal muscle fibers have many nuclei, pressed against the sarcolemma at the edge of the fiber.' },
    ...mitoParts(14, spot, 0.05),
  ];
}
const c2s = (y, z) => `${y.toFixed(2)},${z.toFixed(2)}`;

function rbc() {
  seed = 41;
  // Biconcave disc, 7.5 µm across, ~2 µm at the rim, ~1 µm in the middle.
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.375 * Math.sin((t * Math.PI) / 2) ** 0.8;
    const h = 0.05 + 0.055 * Math.sin(t * Math.PI) ** 0.7 * (0.55 + 0.45 * t);
    prof.push(new THREE.Vector2(Math.max(r, 0.001), h));
  }
  for (let i = 24; i >= 0; i--) prof.push(new THREE.Vector2(Math.max(prof[i].x, 0.001), -prof[i].y));
  const disc = new THREE.LatheGeometry(prof, 64, Math.PI * 0.5, Math.PI * 1.5);
  const spectrin = [];
  for (let i = 0; i < 30; i++) {
    const a = rr(Math.PI * 0.5, Math.PI * 2), b = a + rr(0.2, 0.5), r1 = rr(0.08, 0.33), r2 = rr(0.08, 0.33);
    spectrin.push(tubeAlong([[Math.cos(a) * r1, 0.07, Math.sin(a) * r1], [Math.cos((a + b) / 2) * (r1 + r2) / 2, 0.075, Math.sin((a + b) / 2) * (r1 + r2) / 2], [Math.cos(b) * r2, 0.07, Math.sin(b) * r2]], 0.004, 8, 4));
  }
  const hb = dots(220, () => {
    for (;;) {
      const a = rr(Math.PI * 0.5, Math.PI * 2), r = 0.35 * Math.sqrt(rnd());
      return [Math.cos(a) * r, rr(-0.04, 0.04), Math.sin(a) * r];
    }
  }, 0.008, 0);
  return [
    { key: 'membrane', name: 'Red blood cell membrane', level: 1, color: '#c8303f', opacity: 0.92, geometry: disc,
      desc: 'Flexible membrane of the biconcave disc (about 7.5 µm across). The shape gives a large surface for gas exchange and lets the cell squeeze through capillaries.' },
    { key: 'spectrin', name: 'Spectrin cytoskeleton', level: 2, color: C.cytoskel, geometry: merge(spectrin),
      desc: 'Mesh of spectrin and actin under the membrane that keeps the biconcave shape and lets the cell spring back after bending.' },
    { key: 'hb', name: 'Hemoglobin', level: 3, color: '#ff8a8a', geometry: hb,
      desc: 'Iron-containing protein that fills the cell (about 270 million molecules) and carries oxygen. Mature red cells have no nucleus or mitochondria.' },
  ];
}

function osteocyte() {
  seed = 53;
  const body = new THREE.SphereGeometry(0.45, 40, 24); body.scale(1.3, 0.55, 0.75);
  const lac = cutSphere(0.55, 1.3, 0.62, 0.82, 40);
  const nc = [0, 0, -0.03];
  const procs = [], canals = [], gaps = [];
  for (let i = 0; i < 22; i++) {
    const u = rr(0, Math.PI * 2), v = Math.acos(rr(-1, 1));
    const d = [Math.sin(v) * Math.cos(u), Math.cos(v) * 0.7, Math.sin(v) * Math.sin(u)];
    if (d[0] < -0.2 && d[2] > 0.2) continue;
    const start = [d[0] * 0.5, d[1] * 0.22, d[2] * 0.3];
    const pts = wiggle(start, d, 1.4, 6, 0.04);
    procs.push(tubeAlong(pts, 0.018, 30, 5));
    canals.push(tubeAlong(pts.slice(1), 0.035, 24, 8));
    gaps.push(place(new THREE.SphereGeometry(0.03, 10, 8), pts[pts.length - 1]));
  }
  const matrix = new THREE.BoxGeometry(4, 2.2, 3, 1, 1, 1);
  return [
    { key: 'matrix', name: 'Mineralised bone matrix', level: 1, color: '#e3d6ba', opacity: 0.18, geometry: matrix,
      desc: 'Hard matrix of collagen fibers and calcium phosphate (hydroxyapatite) crystals in which osteocytes are trapped.' },
    { key: 'lacuna', name: 'Lacuna', level: 2, color: '#cbbd9e', opacity: 0.55, geometry: lac,
      desc: 'Small cavity in the bone matrix that holds one osteocyte.' },
    { key: 'body', name: 'Osteocyte cell body', level: 1, color: '#f0e2c4', geometry: body,
      desc: 'Mature bone cell, derived from an osteoblast that became surrounded by matrix. It senses mechanical load and signals bone remodelling.' },
    { key: 'nucleus', name: 'Nucleus', level: 2, partOf: 'Osteocyte cell body', color: C.nucleus, geometry: place(new THREE.SphereGeometry(0.2, 24, 16), nc, [0, 0, 0], 1),
      desc: 'Holds the osteocyte’s DNA. Osteocytes live for years to decades inside the bone.' },
    { key: 'processes', name: 'Dendritic processes', level: 2, color: '#e6cf9f', geometry: merge(procs),
      desc: 'Long thin extensions of the osteocyte that reach neighbouring osteocytes and the bone surface.' },
    { key: 'canaliculi', name: 'Canaliculi', level: 2, color: '#b9a985', opacity: 0.4, geometry: merge(canals),
      desc: 'Tiny canals through the matrix that hold the dendritic processes. Nutrients and wastes diffuse along them.' },
    { key: 'gap', name: 'Gap junctions', level: 3, partOf: 'Dendritic processes', color: '#9aa8ff', geometry: merge(gaps),
      desc: 'Channels where processes of neighbouring osteocytes touch, letting ions and small molecules pass between cells.' },
  ];
}

function epithelial() {
  seed = 61;
  const H = 2.2, W = 0.45;
  const body = new THREE.CylinderGeometry(W, W, H, 6, 1, true, Math.PI * 0.33, Math.PI * 1.67);
  const nbr = [];
  for (const dx of [-1, 1]) nbr.push(place(new THREE.CylinderGeometry(W, W, H, 6, 1, false), [dx * W * 1.74, 0, 0]));
  const villi = [];
  for (let x = -W * 0.8; x <= W * 0.8; x += 0.09) for (let z = -W * 0.8; z <= W * 0.8; z += 0.09) {
    if (Math.hypot(x, z) > W * 0.85) continue;
    villi.push(place(new THREE.CapsuleGeometry(0.025, 0.16, 3, 6), [x, H / 2 + 0.11, z]));
  }
  const ring = (y, r, t) => { const g = new THREE.TorusGeometry(r, t, 6, 6, Math.PI * 1.67); g.rotateX(Math.PI / 2); g.rotateY(-Math.PI * 0.17); return place(g, [0, y, 0]); };
  const desmo = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 0.5 + i * 0.9;
    if (Math.cos(a) > 0.3 && Math.sin(a) > 0.3) continue;
    desmo.push(place(new THREE.BoxGeometry(0.02, 0.12, 0.12), [Math.cos(a) * W * 0.9, rr(-0.4, 0.6), Math.sin(a) * W * 0.9], [0, -a, 0]));
  }
  const nc = [0, -0.45, 0];
  const spot = () => [rr(-W * 0.6, W * 0.6), rr(-0.1, 0.8), rr(-W * 0.6, W * 0.6)];
  const n = nucleusParts(nc, 0.22).slice(0, 2);
  n[0].geometry = place(cutSphere(0.22, 1, 1.6, 1, 32), nc);
  return [
    { key: 'cell', name: 'Simple columnar epithelial cell', level: 1, color: '#d99aa0', opacity: 0.9, geometry: body,
      desc: 'Tall cell from a single-layer lining, such as the small intestine, where it absorbs and secretes. Its apical surface faces the lumen.' },
    { key: 'neighbours', name: 'Neighbouring epithelial cells', level: 1, color: '#c98990', opacity: 0.5, geometry: merge(nbr),
      desc: 'Epithelial cells sit side by side in a continuous sheet, joined by cell junctions, with no blood vessels between them.' },
    { key: 'villi', name: 'Microvilli (brush border)', level: 2, color: '#f2c1c6', geometry: merge(villi),
      desc: 'Finger-like folds of the apical membrane, supported by actin, that greatly increase the absorbing surface.' },
    { key: 'tight', name: 'Tight junction', level: 3, partOf: 'Junctional complex', color: '#9aa8ff', geometry: ring(H / 2 - 0.08, W * 0.98, 0.018),
      desc: 'Seal around the top of the cell that stops substances leaking between cells, so they must pass through the cell.' },
    { key: 'adherens', name: 'Adherens junction', level: 3, partOf: 'Junctional complex', color: '#7fc28a', geometry: ring(H / 2 - 0.2, W * 0.98, 0.016),
      desc: 'Belt of cadherin proteins linked to actin inside the cell, just below the tight junction, that holds neighbouring cells together.' },
    { key: 'desmo', name: 'Desmosomes', level: 3, color: '#e6a23c', geometry: merge(desmo),
      desc: 'Spot welds between cells, anchored to intermediate filaments, that resist pulling forces.' },
    { key: 'basement', name: 'Basement membrane', level: 2, color: '#b9c3c9', geometry: place(new THREE.BoxGeometry(W * 6, 0.06, W * 2.4), [0, -H / 2 - 0.04, 0]),
      desc: 'Thin sheet of extracellular matrix under the epithelium that anchors it to the connective tissue below.' },
    ...n,
    ...golgiParts([0, 0.15, 0], 0.18),
    ...mitoParts(8, spot, 0.045),
    { key: 'vesicles', name: 'Secretory vesicles', level: 2, color: C.vesicle, geometry: dots(10, () => [rr(-W * 0.6, W * 0.6), rr(0.6, 0.95), rr(-W * 0.6, W * 0.6)], 0.04, 2),
      desc: 'Carry mucus or enzymes to the apical surface for release.' },
  ];
}

function sperm() {
  seed = 71;
  const head = new THREE.SphereGeometry(0.25, 40, 24); head.scale(1.0, 0.62, 0.3);
  const acro = new THREE.SphereGeometry(0.27, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.42); acro.rotateZ(-Math.PI / 2); acro.scale(1.0, 0.66, 0.34);
  const nucl = new THREE.SphereGeometry(0.2, 32, 20); nucl.scale(0.95, 0.55, 0.25);
  const mid = new THREE.CylinderGeometry(0.05, 0.05, 0.55, 16); mid.rotateZ(Math.PI / 2);
  const helix = [];
  for (let i = 0; i <= 160; i++) { const t = i / 160; helix.push([-0.3 - t * 0.55, Math.cos(t * 50) * 0.055, Math.sin(t * 50) * 0.055]); }
  const tail = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; tail.push([-0.85 - t * 4.3, Math.sin(t * 9) * 0.18 * t, 0]); }
  const tailCurve = new THREE.CatmullRomCurve3(tail.map((p) => new THREE.Vector3(...p)));
  const tailG = new THREE.TubeGeometry(tailCurve, 200, 0.03, 8, false);
  const endPiece = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; endPiece.push([-5.15 - t * 0.4, Math.sin(9 + t) * 0.18, 0]); }
  return [
    { key: 'head', name: 'Head', level: 1, color: '#9fb8b2', opacity: 0.6, geometry: head,
      desc: 'Flattened oval head (about 5 µm long) that carries the paternal DNA.' },
    { key: 'acrosome', name: 'Acrosome', level: 2, partOf: 'Head', color: '#e6a23c', geometry: acro,
      desc: 'Cap over the front of the head, derived from the Golgi, holding enzymes that digest a path through the zona pellucida.' },
    { key: 'nucleus', name: 'Nucleus (condensed DNA)', level: 2, partOf: 'Head', color: C.nucleus, geometry: nucl,
      desc: 'Very tightly packed haploid nucleus (23 chromosomes).' },
    { key: 'neck', name: 'Neck (centriole)', level: 3, color: C.centriole, geometry: place(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 10), [-0.27, 0, 0], [0, 0, Math.PI / 2]),
      desc: 'Short region holding the centriole from which the flagellum’s axoneme grows.' },
    { key: 'midpiece', name: 'Midpiece', level: 2, color: '#b7cac5', geometry: place(mid, [-0.57, 0, 0]),
      desc: 'Section behind the head packed with mitochondria that supply ATP for swimming.' },
    { key: 'mitosheath', name: 'Mitochondrial sheath', level: 3, partOf: 'Midpiece', color: C.mito, geometry: tubeAlong(helix, 0.018, 320, 6),
      desc: 'Mitochondria wound in a tight spiral around the midpiece.' },
    { key: 'tail', name: 'Tail (flagellum, principal piece)', level: 1, color: '#9fb8b2', geometry: tailG,
      desc: 'Long whip-like flagellum (about 45 µm) whose beating drives the cell. Its core is a 9+2 axoneme of microtubules.' },
    { key: 'endpiece', name: 'End piece', level: 3, partOf: 'Tail (flagellum, principal piece)', color: '#cfe0db', geometry: tubeAlong(endPiece, 0.015, 20, 6),
      desc: 'Thin last part of the flagellum, where only the axoneme remains.' },
  ];
}

function egg() {
  seed = 83;
  const R = 5.2;
  const nc = [-1.2, 0.6, -1.0], nr = 1.1;
  const corona = [];
  for (let i = 0; i < 160; i++) {
    const u = rr(0, Math.PI * 2), v = Math.acos(rr(-1, 1));
    const d = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
    if (d[0] < -0.1 && d[2] > 0.1) continue;
    const g = new THREE.SphereGeometry(0.42, 10, 8); g.scale(1, 1, 0.7);
    corona.push(place(g, d.map((x) => x * (R + 1.55)), randRot()));
  }
  const cg = dots(140, () => {
    for (;;) {
      const u = rr(0, Math.PI * 2), v = Math.acos(rr(-1, 1));
      const d = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
      if (d[0] < -0.1 && d[2] > 0.1) continue;
      return d.map((x) => x * (R - 0.25));
    }
  }, 0.07, 1);
  const n = nucleusParts(nc, nr).slice(0, 2);
  n[0].name = 'Nucleus (germinal vesicle)';
  n[0].desc = 'Large nucleus of the oocyte. In an ovulated (secondary) oocyte the chromosomes are actually held in meiosis II; this is a simplified view.';
  n[1].partOf = 'Nucleus (germinal vesicle)';
  return [
    { key: 'zona', name: 'Zona pellucida', level: 1, color: '#e8e2f2', opacity: 0.35, geometry: cutSphere(R + 0.9, 1, 1, 1, 64),
      desc: 'Thick glycoprotein coat around the oocyte. Sperm must bind to and digest through it; it hardens after fertilisation to block other sperm.' },
    { key: 'corona', name: 'Corona radiata', level: 2, color: '#e8b98a', geometry: merge(corona),
      desc: 'Layer of follicle (granulosa) cells that stays attached to the ovulated oocyte.' },
    { key: 'membrane', name: 'Oocyte plasma membrane (oolemma)', level: 1, color: '#f0cfa8', opacity: 0.85, geometry: cutSphere(R, 1, 1, 1, 64),
      desc: 'Plasma membrane of the egg, about 100–120 µm across, one of the largest human cells.' },
    { key: 'cortical', name: 'Cortical granules', level: 3, color: '#b58ad6', geometry: cg,
      desc: 'Vesicles just under the membrane that release enzymes after fertilisation to harden the zona and block polyspermy.' },
    ...n,
    { key: 'polar', name: 'First polar body', level: 2, color: '#f0cfa8', geometry: place(new THREE.SphereGeometry(0.75, 24, 16), [-2.0, R + 0.35, -2.4]),
      desc: 'Small cell from the first meiotic division, holding a discarded set of chromosomes, in the space under the zona.' },
    ...mitoParts(30, () => inside(R * 0.9, R * 0.9, R * 0.9, { c: nc, r: nr * 1.5 }, 0.2, 0.85), 0.12),
  ];
}

// Default viewing direction per cell, pointing at its cut-away side.
export const CELL_VIEWS = {
  animal: [-0.6, 0.35, 1], neuron: [-0.35, 0.45, 1], muscle: [-0.3, 0.7, 1], rbc: [0.6, 0.55, 1],
  osteocyte: [-0.6, 0.35, 1], epithelial: [0.6, 0.3, 1], sperm: [0, 0.35, 1], egg: [-0.6, 0.35, 1],
};

export const CELL_BUILDERS = { animal, neuron, muscle, rbc, osteocyte, epithelial, sperm, egg };

// Which cell best represents a body structure (for "View cells").
export function cellForStructure(s) {
  const n = s.name.toLowerCase();
  if (s.system === 'skeletal' || s.kind === 'landmark' || s.kind === 'joint') return /cartilage|disc|meniscus/.test(n) ? null : 'osteocyte';
  if (s.system === 'muscular') return /fascia|tendon|aponeurosis|bursa|sheath/.test(n) ? null : 'muscle';
  if (s.system === 'nervous') return /ventricle|plexus choroid|choroid/.test(n) ? null : 'neuron';
  if (s.system === 'cardiovascular') return 'rbc';
  if (s.system === 'reproductive') return /testis|epididymis|deferens|seminal|ejaculatory/.test(n) ? 'sperm' : null;
  if (['digestive', 'respiratory', 'urinary', 'endocrine'].includes(s.system)) return 'epithelial';
  return 'animal';
}
