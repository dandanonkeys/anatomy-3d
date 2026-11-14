// Prints a summary of the Z-Anatomy GLBs: meshes, names, extras, bounds, triangles.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import path from 'node:path';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const root = doc.getRoot();
  const nodes = root.listNodes().filter((n) => n.getMesh());
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const b = getBounds(root.listScenes()[0]);
  const ex = nodes.slice(0, 3).map((n) => [n.getName(), n.getExtras(), n.getParentNode()?.getName()]);
  console.log(path.basename(f), 'meshNodes', nodes.length, 'meshes', root.listMeshes().length, 'tris', tris,
    'bounds', b.min.map((v) => v.toFixed(3)), b.max.map((v) => v.toFixed(3)), 'exts', root.listExtensionsUsed().map((e) => e.extensionName));
  console.log('  sample', JSON.stringify(ex));
}
