// Lists every mesh node in the Z-Anatomy GLBs as: system \t name \t parent \t triangles \t bbox diagonal (m)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    let t = 0; for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? 0) / 3;
    const b = getBounds(n); const d = Math.hypot(...b.max.map((v, i) => v - b.min[i]));
    const ex = n.getExtras();
    console.log([ex.za_system, ex.za_name ?? n.getName(), n.getParentNode()?.getExtras()?.za_name ?? '', t, d.toFixed(3)].join('\t'));
  }
}
