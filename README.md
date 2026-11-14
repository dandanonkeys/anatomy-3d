# Body Atlas

A browser-based 3D anatomy study viewer built with Three.js. You can zoom from the
whole body down to single wrist bones, and what's labelled changes with the scale
you're looking at.

```bash
npm install
npm run dev        # http://localhost:3000
```

## What it does

- **Real anatomy models**: 401 structures from BodyParts3D, all in one shared
  coordinate frame, so every part sits where it belongs.
- **Zoom tiers** (shown bottom-left, with a live scale bar): *Whole body → Region →
  Organ → Detail*, set by how many metres of body fill the view.
  - Labels: the whole-body tier labels organs and major bones. Region adds parts
    (ribs, vertebrae, lung lobes). Organ and Detail label parts and fine
    structures (gyri, papillary muscles, coronary branches, carpals, teeth). Labels
    hidden behind other structures are skipped.
  - Fine structures fade in once they're big enough on screen to read.
  - Coarse structures between you and what you're looking at turn see-through
    as you zoom in past their scale (zoom to the heart and the heart wall and
    sternum ghost out to show the coronary arteries and papillary muscles).
    You can click through see-through structures.
- **Click** a structure to select it: it's highlighted, the camera flies to fit
  it, and the panel shows its system, scale level, FMA parent ("Part of"), side,
  real extent in cm, and FMA ID. Then *Frame*, *Isolate* or *Hide* it.
- **Search** (press `/`): type part of a name, use ↑/↓ and Enter. Choosing a result
  turns its system on if needed and flies to it. `Esc` deselects, `F` frames the
  selection.
- **System toggles** for skeletal, muscular, cardiovascular, respiratory,
  digestive, urinary and nervous. Muscular is off by default because it covers
  the rest.
- Deep link: `?select=femur` opens with the first match selected.

## Data: real vs. placeholder

All geometry is real (BodyParts3D, built from a CT/MRI-based human model). There's
**no placeholder geometry**. Limits to know about:

- It's a **curated subset** (401 of the ~930 parts in the
  [GitHub mirror](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)). The
  mirror itself has gaps: **no frontal, parietal, nasal, maxilla or zygomatic
  bones** (so the skull is open and the brain shows), **no cerebrum as one
  mesh** (the brain is shown as separate gyri plus deep structures), and the
  heart is one "wall of heart" mesh plus coronary vessels and papillary muscles,
  with no separate chambers or valves.
- Meshes are **simplified** for the web (triangle budgets of 10k, 4k and 1.8k by
  level). Fine for studying shapes and positions, but not for surface detail.
- **System and scale-level tags are mine.** They're assigned by rules in
  `tools/selection.json` (built from name patterns), not from an authoritative
  ontology. "Part of" comes from the FMA parent in the dataset.
- Muscles are a representative set (limb and trunk), not complete.

## Rebuilding the models

`public/models/*.glb` and `manifest.json` are generated:

```bash
node tools/convert.mjs <dir-with-BodyParts3D-STLs> tools/selection.json
```

The converter welds vertices, converts mm Z-up to m Y-up, simplifies with
meshoptimizer, and writes one meshopt-compressed GLB per system (about 10 MB total).
STLs come from `assets/BodyParts3D_data/stl/<FMAID>.stl` in the mirror above. To
add structures, add rows to `tools/selection.json` (`id`, `name`, `system`, `level`,
`partOf`) and rerun.

## Debugging hooks

`window.scene`, `window.__THREE_CAMERA__` and `window.__renderer__` are exposed for
the parallax-threejs / threejs-devtools tooling. `window.atlas` is a small scripting
API: `atlas.view('Liver', 0.4)`, `atlas.select('lunate')`,
`atlas.setSystem('muscular', true)`, `atlas.tierName()`.

## Credits

Models: **BodyParts3D**, © 2008 Life Science Integrated Database Center, licensed
under [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).
The converted GLB files in `public/models/` are a derivative work and carry the
same license.
