# Body Atlas

A browser-based 3D anatomy study viewer built with Three.js. You can zoom from the
whole body down to single wrist bones, and what's labelled changes with the scale
you're looking at. A **Cells** tab holds a library of cell types you can zoom into,
from whole cell to organelle to the structures inside organelles.

```bash
npm install
npm run dev        # http://localhost:3000
```

## What it does

- **Real anatomy models**: 2,828 structures from Z-Anatomy (built on
  BodyParts3D) in 11 systems: skeletal, joints & ligaments, muscular, nervous
  (brain gyri, cranial and peripheral nerves, spinal cord), cardiovascular,
  lymphatic, respiratory, digestive, urinary, endocrine, reproductive. Each
  system loads the first time you switch it on, so the first view loads about 10 MB
  rather than all 17 MB.
- **Bony landmarks and joints**: about 500 markers from the lab lists (greater
  trochanter, foramen magnum, vertebral processes, glenohumeral joint and so on).
  They appear as rings on the selected bone, or on bones that fill the view at the
  Detail tier. Their positions are **approximate** (see below).
- **Groups** for list items that are sets of structures: frontal, parietal,
  temporal and occipital lobes, cerebrum, brainstem, rotator cuff, quadriceps,
  hamstrings, erector spinae, brachial plexus terminal nerves, and so on.
  Selecting a group highlights every member.
- **Definitions and Latin names** for most structures (Wikipedia text via
  Z-Anatomy), and, for muscles, **your course OIAN table** (origin, insertion,
  action, nerve) when `public/course/oian.json` is present (see below).
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
- **System toggles**. Muscular, joints, lymphatic and reproductive start off;
  fasciae, pleura and omentum start hidden because they cover everything
  else (search for one to show it).
- **View cells**: a selected bone, muscle, nerve, vessel or organ has a
  *View cells* button that opens the matching cell in the Cells tab (osteocyte,
  muscle fiber, neuron, red blood cell, epithelial cell, sperm).
- Deep links: `?select=femur` opens with the first match selected; `?world=cells`
  opens the Cells tab. `C` switches tabs.

## Cells tab

Eight cell types: a generic animal cell, neuron, skeletal muscle fiber, red blood
cell, osteocyte, simple columnar epithelial cell, sperm and egg (oocyte). 84
labelled parts in three levels: whole cell or region → organelle →
sub-organelle (nucleolus, nuclear pores, chromatin, cristae, bound ribosomes,
Golgi vesicles, Z discs and A/I bands, nodes of Ranvier, synaptic vesicles,
cortical granules, junctions). Membranes and nuclei are cut away so the inside
shows. The same click, search, info panel and zoom tiers work here, with tiers
scaled to the cell on show and a scale bar in µm or nm.

**All cell models are schematic**: built in code (`src/cells.js`) from simple
shapes with textbook proportions, not from microscopy. Sizes are roughly right
(a red cell is 7.5 µm, the egg about 120 µm), but counts and shapes are
idealised, and some things are drawn larger than life so you can see them
(ribosomes, for example). Long cells (axon, muscle fiber, sperm tail) are
shortened.

## Quiz mode

Press `Q` (or the *Quiz* switch at the top of the panel). The quiz covers whichever
tab you're on: body structures or cell parts. Pick question types, systems (or
cell types), scale levels, *Ignore left / right*, and a length, then *Start quiz*.
In the body tab you can also include **bone landmarks and joints** and **lobes and
muscle groups**, and add **Muscle OIAN** questions (multiple choice on origin,
insertion, action or nerve, from your course table).
Leaving quiz mode puts the system toggles and camera back how they were.

- **Find the X**: the view frames the region (the whole body for level 1) and
  the labels are hidden. Click the structure, or press `←`/`→` to step through
  the structures in the quiz's systems and levels and `Enter` to choose. A wrong
  pick turns red and the right answer is highlighted and labelled.
- Landmarks: for *Find*, click the bone within about 2.5 cm of the landmark; for
  *Name*, the landmark is marked with a ring.
- **Name this**: a structure is highlighted with labels and hover names hidden.
  Type its name and press `Enter`. Matching ignores case, punctuation, word
  order, filler words (*of, the, bone, muscle*) and small typos, and ignores
  left/right if that option is on. With it off, naming the right structure on
  the wrong side is marked wrong and told apart. `Enter` on an empty box shows
  the answer (counts as a miss). `F` frames the structure.
- `Enter` or `N` goes to the next question, `Esc` ends the quiz. A missed
  structure comes back three questions later (once). The results screen lists
  misses and has *Practise misses*.
- Every answer is saved in this browser (localStorage), so a reload doesn't lose
  it. The setup screen shows saved results with *Export all* and *Clear*.

### Exporting to claude-tutor

*Export for claude-tutor* (results screen) or *Export all* (setup screen)
downloads `body-atlas-quiz-<date>.json` (`schema: "body-atlas-quiz/1"`):

- `attempts`: every answer with timestamp, type (`find`/`name`/`oian`), concept,
  exact structure, system, level, what you answered, correct, and time taken.
- `concepts`: concept → attempts, correct, `lastResult`, `lastSeen`, history.
- `tutorQuiz`: a ready-made entry for the `quizzes` array of claude-tutor's
  progress file (`format` is `fill` for *Name*, `mcq` for *Find* and *OIAN*).

A concept is the structure name, without the side when *Ignore left / right* is
on (so left and right femur both train "Femur"). Merge an export into
claude-tutor with:

```bash
node tools/tutor-import.mjs ~/Downloads/body-atlas-quiz-2026-11-13-20-15.json --topic anatomy-physiology-1 --dry-run
node tools/tutor-import.mjs ~/Downloads/body-atlas-quiz-2026-11-13-20-15.json --topic anatomy-physiology-1
```

It appends the quiz to `~/.claude/learning/progress/<topic>.json`, recomputes
weak/strong areas and the overall score, updates SM-2 spaced repetition per
concept the same way the claude-tutor dashboard does (a concept counts as
recalled only if every attempt at it in the export was right), updates
`index.json`, and keeps the previous file as `.bak`. Importing the same export
twice does nothing. The topic defaults to the one typed on the quiz setup
screen. After that, claude-tutor's session reminder counts the structures that
are due, `/review` shows your weak structures, and `/quiz anatomy-physiology-1`
can drill them in text. You can also skip the script and tell Claude to "add
this Body Atlas export to my anatomy-physiology-1 progress" with the file
attached; the `tutorQuiz` block is already in the plugin's format.

## Data: real vs. schematic vs. approximate

| What | Source | Status |
|---|---|---|
| 2,823 body meshes | [Z-Anatomy](https://www.z-anatomy.com/) (CC BY-SA 4.0), itself built on BodyParts3D (CC BY-SA 2.1 JP); web GLBs from the [3d-anatomy](https://github.com/nqwrc/3d-anatomy) project | Real (scan-based), simplified |
| Kidneys, lateral and third ventricles | BodyParts3D, fitted into the Z-Anatomy frame (4.2 mm RMS) | Real, simplified |
| Definitions | Wikipedia via Z-Anatomy (CC BY-SA 3.0) | Real text, shortened |
| Latin names | Z-Anatomy lexicon (Terminologia Anatomica) | Real |
| ~500 landmarks and joints | Rule-placed points on bone meshes (`src/landmarks.js`) | **Approximate** |
| Lobes and muscle groups | Name rules (`src/groups.js`) | Grouping is mine |
| 8 cell types, 84 parts | Built in code (`src/cells.js`) | **Schematic** |
| OIAN facts | Your course's master list, extracted locally | Course material, not in git |

Limits to know about:

- **Landmarks are approximate.** Each one is found by a geometric rule on its
  bone (e.g. "top 10% of the femur, most lateral point" for the greater
  trochanter). They're usually in the right spot, but check them against your lab
  models or atlas before an exam, especially for small or hole-type features
  (foramina, fissures, canals), where the marker sits at the opening's centre.
- **Not in any dataset** (14 of the 316 lab-list items): longitudinal and
  transverse cerebral fissures, gray matter of the brain, arbor vitae,
  arachnoid and pia mater, cranial dura (only the spinal dura is modelled),
  olfactory bulb, filum terminale, gray commissure, spinal nerves grouped by
  level (cervical, thoracic, lumbar, sacral, coccygeal).
- **Licence**: Z-Anatomy credits two embedded models as non-commercial (an inner
  ear and a kidney). The inner ear isn't in this export, and the Z-Anatomy
  kidney is replaced by BodyParts3D kidneys, so the body models here are CC BY-SA.
  The Z-Anatomy export also credits "Brainder" and "White matter" models from the
  University of Washington with no stated licence; these may be part of the
  brain meshes.
- Meshes are **simplified** for the web (about 2.0 M triangles in total, capped at
  4,000 per structure), so they're fine for shapes and positions but not for fine
  surface detail.
- **System and level tags**: Z-Anatomy's systems, with organs split into
  respiratory, digestive, urinary, endocrine and reproductive by name, and a few
  muscles Z-Anatomy files under "nervous" moved to muscular. Scale levels come
  from size and nesting, with long nerves and vessels capped at "part" level.

## Rebuilding the models

`public/models/*.glb`, `manifest.json` and `details.json` are generated:

```bash
node tools/convert-za.mjs <za-glb-dir> <za-data-dir> <bp3d-v1-models-dir>
```

- `za-glb-dir`: the seven GLBs and `lexicon.json` from 3d-anatomy's
  `public/models` and `public/data`.
- `za-data-dir`: `definitions.json` from 3d-anatomy's `public/data`.
- `bp3d-v1-models-dir`: the v1 BodyParts3D output (made by `tools/convert.mjs`
  from `tools/selection.json`), used for the kidneys and ventricles.

The converter bakes transforms, welds vertices, simplifies by size with
meshoptimizer, splits organs into systems, fits the BodyParts3D parts into the
Z-Anatomy frame, and writes one meshopt-compressed GLB per system.
`tools/list-za.mjs` and `tools/inspect-za.mjs` print what's in the source GLBs.

### Course OIAN data (local only)

```bash
python3 -I tools/oian-from-docx.py "<Muscles OIAN - Master List>.docx"
```

This writes `public/course/oian.json` (48 muscles and groups), which the app loads
if it's there. `public/course/` is git-ignored because it's your instructor's
material.

## Debugging hooks

`window.scene`, `window.__THREE_CAMERA__` and `window.__renderer__` are exposed for
the parallax-threejs / threejs-devtools tooling. `window.atlas` is a small scripting
API: `atlas.view('Liver', 0.4)`, `atlas.select('lunate')`,
`atlas.setSystem('muscular', true)`, `atlas.tierName()`, `atlas.setWorld('cells')`,
`atlas.viewCells('neuron')`. `atlas.quiz` drives quiz mode (`setMode('quiz')`,
`start()`, `answer('femur')`, `export()`).

Performance (Apple M4, 1280×800): 60 fps at every zoom level with the default
systems (about 1,300 draw calls and 1.1 M triangles at whole-body scale) and with
all 11 systems at whole-body scale (2,100 draw calls, 1.8 M triangles). With all
11 systems on and zoomed into the thorax, the label refresh (every 0.22 s) takes
a frame of about 37 ms.

## Credits

- Body models: **Z-Anatomy**, the open-source atlas of anatomy (CC BY-SA 4.0),
  based on **BodyParts3D**, © 2008 Database Center for Life Science
  ([CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en)).
  Web export by the [3d-anatomy](https://github.com/nqwrc/3d-anatomy) project.
  "Brainder" and "White matter" models from the University of Washington and
  "Cranial Nerves and Foramina" by University of Dundee, CAHID (CC BY 4.0) are
  credited upstream as part of Z-Anatomy.
- Kidneys and ventricles: BodyParts3D (CC BY-SA 2.1 JP).
- Definitions: Wikipedia (CC BY-SA 3.0), via Z-Anatomy.
- The converted files in `public/models/` are derivative works under the same
  share-alike terms.
