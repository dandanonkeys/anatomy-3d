// Bony landmarks and joints from the lab structure lists. No dataset models
// these as separate meshes, so each one is placed by a geometric rule on its
// bone's mesh (e.g. "top 10% of the femur, most lateral point"). Positions are
// APPROXIMATE and labelled as such in the app.
//
// Rule steps run on the bone's vertices (world space, metres):
//   ['band', dir, a, b]  keep vertices whose distance from the extreme in `dir`,
//                        as a fraction of the extent, is between a and b
//   ['mid']              keep vertices close to the midline (|x| < 8 mm)
//   ['off', a, b]        keep vertices with a ≤ |x| ≤ b metres (paired midline features)
//   ['max', dir]         result: mean of the 4 vertices furthest along dir
//   ['min', dir]         result: mean of the 4 vertices least far along dir (a depression)
//   ['center']           result: bounding-box centre of the kept vertices (holes, regions)
//   ['snap']             result: the vertex nearest the bounding-box centre
// Directions combine with '+': 'sup+lat', and a weight: 'post*0.4'.
// 'lat'/'med' follow the bone's side; for a paired feature on a midline bone
// (pair: true) they follow the generated side.

const B = (name, steps, extra = {}) => ({ name, steps, ...extra });

const VERT_COMMON = [
  B('Body', [['band', 'ant', 0, 0.35], ['center']]),
  B('Vertebral foramen', [['band', 'ant', 0.42, 0.72], ['mid'], ['center']]),
  B('Vertebral arch', [['band', 'ant', 0.55, 0.85], ['band', 'sup', 0.2, 0.8], ['snap']]),
  B('Spinous process', [['max', 'post']]),
  B('Transverse process', [['band', 'ant', 0.35, 0.8], ['max', 'lat']], { pair: true }),
  B('Superior articular process', [['band', 'sup', 0, 0.2], ['band', 'ant', 0.4, 0.75], ['max', 'lat*0.6+sup']], { pair: true }),
  B('Inferior articular process', [['band', 'inf', 0, 0.2], ['band', 'ant', 0.45, 0.8], ['max', 'lat*0.6+inf']], { pair: true }),
];
const CERVICAL = [...VERT_COMMON, B('Transverse foramen', [['band', 'lat', 0, 0.3], ['band', 'ant', 0.15, 0.5], ['center']], { pair: true })];
const THORACIC = [...VERT_COMMON, B('Transverse costal facet', [['band', 'lat', 0, 0.12], ['max', 'ant']], { pair: true })];

export const LANDMARK_RULES = [
  { bone: 'Femur', sided: true, items: [
    B('Head', [['band', 'sup', 0, 0.08], ['max', 'med']]),
    B('Neck', [['band', 'sup', 0.07, 0.11], ['band', 'med', 0.15, 0.5], ['snap']]),
    B('Greater trochanter', [['band', 'sup', 0, 0.1], ['max', 'lat']]),
    B('Lesser trochanter', [['band', 'sup', 0.13, 0.2], ['max', 'med+post']]),
    B('Gluteal tuberosity', [['band', 'sup', 0.17, 0.27], ['max', 'post+lat*0.5']]),
    B('Linea aspera', [['band', 'sup', 0.4, 0.6], ['max', 'post']]),
    B('Medial condyle', [['band', 'inf', 0, 0.05], ['max', 'med']]),
    B('Lateral condyle', [['band', 'inf', 0, 0.05], ['max', 'lat']]),
    B('Medial epicondyle', [['band', 'inf', 0.06, 0.12], ['max', 'med']]),
    B('Lateral epicondyle', [['band', 'inf', 0.06, 0.12], ['max', 'lat']]),
    B('Intercondylar fossa', [['band', 'inf', 0, 0.06], ['band', 'post', 0, 0.3], ['band', 'lat', 0.35, 0.65], ['min', 'inf']]),
  ] },
  { bone: 'Hip bone', label: 'os coxa', sided: true, items: [
    B('Ilium', [['band', 'sup', 0.05, 0.35], ['snap']], { kind: 'region' }),
    B('Ischium', [['band', 'sup', 0.72, 1], ['band', 'post', 0, 0.45], ['snap']], { kind: 'region' }),
    B('Pubis', [['band', 'sup', 0.62, 0.9], ['band', 'ant', 0, 0.25], ['snap']], { kind: 'region' }),
    B('Iliac crest', [['max', 'sup']]),
    B('Anterior superior iliac spine', [['band', 'sup', 0, 0.3], ['max', 'ant']]),
    B('Anterior inferior iliac spine', [['band', 'sup', 0.3, 0.48], ['max', 'ant']]),
    B('Posterior superior iliac spine', [['band', 'sup', 0, 0.3], ['max', 'post']]),
    B('Posterior inferior iliac spine', [['band', 'sup', 0.3, 0.45], ['max', 'post']]),
    B('Iliac fossa', [['band', 'sup', 0.08, 0.3], ['band', 'ant', 0.15, 0.55], ['max', 'med']]),
    B('Greater sciatic notch', [['band', 'sup', 0.42, 0.56], ['band', 'post', 0, 0.35], ['min', 'post']]),
    B('Ischial spine', [['band', 'sup', 0.56, 0.68], ['max', 'post+med']]),
    B('Lesser sciatic notch', [['band', 'sup', 0.68, 0.78], ['band', 'post', 0, 0.35], ['min', 'post']]),
    B('Ischial tuberosity', [['max', 'inf+post']]),
    B('Acetabulum', [['band', 'lat', 0, 0.3], ['band', 'sup', 0.42, 0.7], ['center']]),
    B('Obturator foramen', [['band', 'sup', 0.66, 0.92], ['band', 'ant', 0.1, 0.6], ['center']]),
  ] },
  { bone: 'Scapula', sided: true, items: [
    B('Glenoid fossa', [['band', 'sup', 0.15, 0.4], ['max', 'lat']]),
    B('Acromion process', [['band', 'sup', 0, 0.15], ['max', 'lat+post*0.3']]),
    B('Coracoid process', [['band', 'sup', 0, 0.35], ['max', 'ant']]),
    B('Spine', [['band', 'sup', 0.12, 0.35], ['band', 'lat', 0.3, 0.7], ['max', 'post']]),
    B('Supraspinous fossa', [['band', 'sup', 0.06, 0.22], ['band', 'lat', 0.35, 0.75], ['band', 'post', 0, 0.55], ['snap']]),
    B('Infraspinous fossa', [['band', 'sup', 0.4, 0.7], ['band', 'lat', 0.3, 0.7], ['band', 'post', 0, 0.5], ['snap']]),
    B('Subscapular fossa', [['band', 'sup', 0.35, 0.7], ['band', 'lat', 0.3, 0.7], ['band', 'ant', 0, 0.5], ['snap']]),
    B('Superior border', [['band', 'lat', 0.3, 0.6], ['max', 'sup']]),
    B('Medial border', [['band', 'sup', 0.4, 0.65], ['max', 'med']]),
    B('Lateral border', [['band', 'sup', 0.55, 0.8], ['max', 'lat']]),
    B('Superior angle', [['band', 'med', 0, 0.25], ['max', 'sup']]),
    B('Inferior angle', [['max', 'inf']]),
  ] },
  { bone: 'Clavicle', sided: true, items: [
    B('Acromial end', [['max', 'lat']]),
    B('Sternal end', [['max', 'med']]),
  ] },
  { bone: 'Humerus', sided: true, items: [
    B('Head', [['band', 'sup', 0, 0.1], ['max', 'med+post*0.4']]),
    B('Greater tubercle', [['band', 'sup', 0, 0.12], ['max', 'lat']]),
    B('Lesser tubercle', [['band', 'sup', 0.04, 0.14], ['max', 'ant+med*0.3']]),
    B('Intertubercular groove', [['band', 'sup', 0.05, 0.13], ['band', 'lat', 0.25, 0.55], ['max', 'ant']]),
    B('Deltoid tuberosity', [['band', 'sup', 0.35, 0.5], ['max', 'lat+ant*0.3']]),
    B('Trochlea', [['band', 'inf', 0, 0.06], ['band', 'med', 0.15, 0.5], ['max', 'inf']]),
    B('Capitulum', [['band', 'inf', 0, 0.08], ['band', 'lat', 0.1, 0.4], ['max', 'ant']]),
    B('Coronoid fossa', [['band', 'inf', 0.07, 0.14], ['band', 'med', 0.3, 0.55], ['band', 'ant', 0, 0.5], ['min', 'ant']]),
    B('Radial fossa', [['band', 'inf', 0.07, 0.14], ['band', 'lat', 0.3, 0.55], ['band', 'ant', 0, 0.5], ['min', 'ant']]),
    B('Olecranon fossa', [['band', 'inf', 0.06, 0.16], ['band', 'med', 0.4, 0.6], ['band', 'post', 0, 0.5], ['min', 'post']]),
    B('Medial epicondyle', [['band', 'inf', 0.04, 0.12], ['max', 'med']]),
    B('Lateral epicondyle', [['band', 'inf', 0.04, 0.12], ['max', 'lat']]),
  ] },
  { bone: 'Radius', sided: true, items: [
    B('Head', [['max', 'sup']]),
    B('Radial tuberosity', [['band', 'sup', 0.08, 0.18], ['max', 'med+ant*0.5']]),
    B('Styloid process', [['max', 'inf+lat*0.6']]),
  ] },
  { bone: 'Ulna', sided: true, items: [
    B('Olecranon process', [['max', 'sup+post*0.3']]),
    B('Coronoid process', [['band', 'sup', 0.04, 0.12], ['max', 'ant']]),
    B('Trochlear notch', [['band', 'sup', 0.02, 0.09], ['band', 'ant', 0, 0.6], ['min', 'ant']]),
    B('Head', [['band', 'inf', 0, 0.06], ['snap']]),
    B('Styloid process', [['max', 'inf+med*0.4+post*0.3']]),
  ] },
  { bone: 'Tibia', sided: true, items: [
    B('Medial condyle', [['band', 'sup', 0, 0.06], ['max', 'med']]),
    B('Lateral condyle', [['band', 'sup', 0, 0.06], ['max', 'lat']]),
    B('Intercondylar eminence', [['max', 'sup']]),
    B('Tibial tuberosity', [['band', 'sup', 0.05, 0.13], ['max', 'ant']]),
    B('Medial malleolus', [['band', 'med', 0, 0.3], ['max', 'inf']]),
  ] },
  { bone: 'Fibula', sided: true, items: [
    B('Head', [['max', 'sup']]),
    B('Lateral malleolus', [['max', 'inf']]),
  ] },
  { bone: 'Occipital bone', items: [
    B('Foramen magnum', [['band', 'inf', 0, 0.22], ['mid'], ['center']]),
    B('Occipital condyle', [['band', 'inf', 0, 0.08], ['max', 'lat*0.4+inf']], { pair: true }),
    B('External occipital protuberance', [['band', 'sup', 0.35, 0.65], ['max', 'post']]),
    B('Superior nuchal line', [['band', 'sup', 0.45, 0.58], ['max', 'post+lat*0.5']], { pair: true }),
    B('Inferior nuchal line', [['band', 'sup', 0.62, 0.76], ['max', 'post+lat*0.4']], { pair: true }),
    B('Lambdoid suture', [['max', 'sup']], { kind: 'suture' }),
  ] },
  { bone: 'Temporal bone', sided: true, items: [
    B('Mandibular fossa', [['band', 'inf', 0.12, 0.35], ['band', 'ant', 0, 0.35], ['band', 'lat', 0, 0.35], ['min', 'inf']]),
    B('External acoustic meatus', [['band', 'lat', 0, 0.15], ['band', 'sup', 0.45, 0.72], ['center']]),
    B('Styloid process', [['max', 'inf+med*0.3+ant*0.2']]),
    B('Mastoid process', [['band', 'post', 0, 0.35], ['max', 'inf']]),
    B('Squamous suture', [['band', 'lat', 0, 0.3], ['max', 'sup']], { kind: 'suture' }),
  ] },
  { bone: 'Frontal bone', items: [
    B('Coronal suture', [['band', 'sup', 0, 0.12], ['max', 'post']], { kind: 'suture' }),
  ] },
  { bone: 'Sphenoid bone', items: [
    B('Sella turcica', [['mid'], ['band', 'sup', 0, 0.3], ['band', 'post', 0.25, 0.6], ['min', 'sup']]),
    B('Lesser wing', [['band', 'sup', 0, 0.25], ['band', 'ant', 0, 0.35], ['max', 'lat']], { pair: true }),
    B('Greater wing', [['band', 'sup', 0.2, 0.6], ['max', 'lat']], { pair: true }),
    B('Optic canal', [['band', 'ant', 0, 0.35], ['band', 'sup', 0, 0.3], ['off', 0.008, 0.02], ['center']], { pair: true }),
    B('Superior orbital fissure', [['band', 'ant', 0, 0.4], ['band', 'sup', 0.3, 0.6], ['off', 0.015, 0.035], ['center']], { pair: true }),
  ] },
  { bone: 'Ethmoid bone', items: [
    B('Crista galli', [['max', 'sup']]),
    B('Cribriform plate', [['band', 'sup', 0, 0.15], ['off', 0.003, 0.012], ['center']], { pair: true }),
    B('Perpendicular plate', [['mid'], ['band', 'sup', 0.5, 1], ['center']]),
    B('Superior nasal concha', [['band', 'sup', 0.3, 0.5], ['off', 0.004, 0.014], ['center']], { pair: true }),
    B('Middle nasal concha', [['band', 'sup', 0.5, 0.8], ['off', 0.004, 0.016], ['center']], { pair: true }),
  ] },
  { bone: 'Mandible', items: [
    B('Mandibular condyle', [['band', 'lat', 0, 0.12], ['max', 'sup']], { pair: true }),
  ] },
  { bone: 'Maxilla', sided: true, items: [
    B('Alveolar process (tooth sockets)', [['max', 'inf']]),
    B('Hard palate (palatine process)', [['band', 'inf', 0.05, 0.25], ['band', 'med', 0, 0.2], ['snap']]),
  ] },
  { bone: 'Lacrimal bone', sided: true, items: [
    B('Lacrimal fossa', [['band', 'ant', 0, 0.4], ['snap']]),
  ] },
  { bone: 'Atlas (C1)', short: 'C1', items: [
    B('Anterior arch', [['max', 'ant']]),
    B('Posterior arch', [['band', 'post', 0, 0.25], ['snap']]),
    B('Posterior tubercle', [['max', 'post']]),
    B('Facet for dens', [['band', 'ant', 0, 0.22], ['mid'], ['min', 'ant']]),
    B('Transverse process', [['max', 'lat']], { pair: true }),
    B('Transverse foramen', [['band', 'lat', 0, 0.3], ['center']], { pair: true }),
    B('Vertebral foramen', [['band', 'ant', 0.3, 0.7], ['mid'], ['center']]),
  ] },
  { bone: 'Axis (C2)', short: 'C2', items: [
    B('Dens (odontoid process)', [['max', 'sup']]),
    ...CERVICAL,
  ] },
  ...['C3', 'C4', 'C5', 'C6', 'C7'].map((v) => ({ bone: `Vertebra ${v}`, short: v, items: CERVICAL })),
  ...Array.from({ length: 12 }, (_, i) => ({ bone: `Vertebra T${i + 1}`, short: `T${i + 1}`, items: THORACIC })),
  ...[1, 2, 3, 4, 5].map((i) => ({ bone: `Vertebra L${i}`, short: `L${i}`, items: VERT_COMMON })),
  { bone: 'Sacrum', items: [
    B('Body (S1)', [['band', 'sup', 0, 0.15], ['band', 'ant', 0, 0.35], ['center']]),
    B('Ala', [['band', 'sup', 0, 0.22], ['max', 'lat']], { pair: true }),
    B('Superior articular process', [['band', 'sup', 0, 0.12], ['band', 'post', 0.15, 0.6], ['max', 'sup+lat*0.3']], { pair: true }),
    B('Median sacral crest', [['band', 'sup', 0.3, 0.6], ['max', 'post']]),
    B('Sacral canal', [['band', 'sup', 0, 0.15], ['band', 'post', 0.3, 0.7], ['center']]),
    B('Sacral foramina', [['band', 'sup', 0.3, 0.55], ['off', 0.018, 0.034], ['max', 'ant']], { pair: true }),
  ] },
  // Spinal cord features, placed on the cord's white-matter mesh.
  { bone: 'White matter of spinal cord', label: 'spinal cord', items: [
    B('Cervical enlargement', [['band', 'sup', 0.08, 0.22], ['max', 'ant']], { kind: 'region' }),
    B('Lumbar enlargement', [['band', 'sup', 0.8, 0.9], ['max', 'ant']], { kind: 'region' }),
    B('Conus medullaris', [['max', 'inf']], { kind: 'region' }),
  ] },
];

// Joints: midpoint between two landmarks (or a landmark and a bone centre).
// Names refer to generated landmark ids: `${landmark} | ${bone}` with side.
export const JOINTS = [
  { name: 'Glenohumeral joint (ball and socket)', sided: true, a: ['Scapula', 'Glenoid fossa'], b: ['Humerus', 'Head'] },
  { name: 'Acromioclavicular joint', sided: true, a: ['Scapula', 'Acromion process'], b: ['Clavicle', 'Acromial end'] },
  { name: 'Sternoclavicular joint', sided: true, a: ['Clavicle', 'Sternal end'], b: ['Manubrium of sternum', null] },
  { name: 'Hip joint (ball and socket)', sided: true, a: ['Hip bone', 'Acetabulum'], b: ['Femur', 'Head'] },
  { name: 'Knee joint (hinge)', sided: true, a: ['Femur', 'Intercondylar fossa'], b: ['Tibia', 'Intercondylar eminence'] },
  { name: 'Elbow joint (hinge)', sided: true, a: ['Humerus', 'Trochlea'], b: ['Ulna', 'Trochlear notch'] },
  { name: 'Wrist joint', sided: true, a: ['Radius', 'Styloid process'], b: ['Ulna', 'Styloid process'] },
  { name: 'Ankle joint (hinge)', sided: true, a: ['Tibia', 'Medial malleolus'], b: ['Fibula', 'Lateral malleolus'] },
  { name: 'Sacroiliac joint', sided: true, a: ['Sacrum', 'Ala'], b: ['Hip bone', 'Posterior superior iliac spine'] },
];

// ---------- engine ----------
const DIRS = { sup: [0, 1, 0], inf: [0, -1, 0], ant: [0, 0, 1], post: [0, 0, -1] };

function dirVec(spec, sigma) {
  const v = [0, 0, 0];
  for (const term of spec.split('+')) {
    const [k, w = '1'] = term.split('*');
    const d = k === 'lat' ? [sigma, 0, 0] : k === 'med' ? [-sigma, 0, 0] : DIRS[k];
    for (let i = 0; i < 3; i++) v[i] += d[i] * +w;
  }
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
}

function run(points, steps, sigma) {
  let pts = points;
  for (const [op, ...args] of steps) {
    if (!pts.length) return null;
    if (op === 'band') {
      const d = dirVec(args[0], sigma);
      const pr = pts.map((p) => p[0] * d[0] + p[1] * d[1] + p[2] * d[2]);
      const max = Math.max(...pr), min = Math.min(...pr), ext = max - min || 1;
      pts = pts.filter((_, i) => { const f = (max - pr[i]) / ext; return f >= args[1] && f <= args[2]; });
    } else if (op === 'mid') {
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      pts = pts.filter((p) => Math.abs(p[0] - cx) < 0.008);
    } else if (op === 'off') {
      const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
      pts = pts.filter((p) => { const o = (p[0] - cx) * sigma; return o >= args[0] && o <= args[1]; });
    } else if (op === 'max' || op === 'min') {
      const d = dirVec(args[0], sigma);
      const s = op === 'max' ? 1 : -1;
      const sorted = pts.map((p) => [s * (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]), p]).sort((a, b) => b[0] - a[0]).slice(0, 4);
      return sorted.reduce((a, [, p]) => a.map((v, i) => v + p[i] / sorted.length), [0, 0, 0]);
    } else if (op === 'center' || op === 'snap') {
      const mn = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
      const mx = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
      const c = mn.map((v, i) => (v + mx[i]) / 2);
      if (op === 'center') return c;
      let best = pts[0], bd = Infinity;
      for (const p of pts) { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = p; } }
      return best;
    }
  }
  return null;
}

/**
 * @param {(boneName: string, side: 'Left'|'Right'|null) => {points: number[][], structure: any} | null} getBone
 * @returns {Array<{name, aliases, bone, side, kind, point:number[]}>}
 */
export function computeLandmarks(getBone) {
  const out = [];
  const byKey = new Map();
  for (const rule of LANDMARK_RULES) {
    const sides = rule.sided ? ['Left', 'Right'] : [null];
    for (const side of sides) {
      const bone = getBone(rule.bone, side);
      if (!bone) continue;
      const boneSigma = side === 'Left' ? 1 : side === 'Right' ? -1 : 1;
      for (const item of rule.items) {
        const featureSides = !rule.sided && item.pair ? ['Left', 'Right'] : [side];
        for (const fs of featureSides) {
          const sigma = fs === 'Left' ? 1 : fs === 'Right' ? -1 : boneSigma;
          const point = run(bone.points, item.steps, sigma);
          if (!point) continue;
          const where = rule.short ?? `${side ? side.toLowerCase() + ' ' : ''}${rule.label ?? rule.bone.toLowerCase()}`;
          const sideWord = !rule.sided && fs ? `${fs.toLowerCase()} ` : '';
          const name = `${sideWord ? sideWord[0].toUpperCase() + sideWord.slice(1) : ''}${sideWord ? item.name.toLowerCase() : item.name} (${where})`;
          const lm = {
            name, aliases: [item.name, `${item.name} of ${rule.short ?? rule.label ?? rule.bone}`],
            bone: bone.structure, side: side ?? fs ?? null, kind: item.kind ?? 'landmark', point,
          };
          out.push(lm);
          byKey.set(`${rule.bone}|${item.name}|${side ?? fs ?? ''}`, lm);
        }
      }
    }
  }
  for (const j of JOINTS) {
    for (const side of j.sided ? ['Left', 'Right'] : [null]) {
      const end = ([bone, item]) => {
        if (item) return byKey.get(`${bone}|${item}|${side ?? ''}`)?.point ?? byKey.get(`${bone}|${item}|`)?.point;
        const b = getBone(bone, null);
        if (!b) return null;
        return run(b.points, [['band', 'sup', 0, 0.35], ['max', 'lat']], side === 'Left' ? 1 : -1);
      };
      const a = end(j.a), b = end(j.b);
      if (!a || !b) continue;
      const bone = getBone(j.a[0], side) ?? getBone(j.a[0], null) ?? getBone(j.b[0], side);
      out.push({
        name: side ? `${side} ${j.name[0].toLowerCase()}${j.name.slice(1)}` : j.name,
        aliases: [j.name.replace(/\s*\(.*\)$/, ''), j.name],
        bone: bone?.structure, side, kind: 'joint', point: a.map((v, i) => (v + b[i]) / 2),
      });
    }
  }
  return out;
}
