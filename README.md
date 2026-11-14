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

## Quiz mode

Press `Q` (or the *Quiz* switch at the top of the panel). Pick question types,
systems, scale levels, *Ignore left / right*, and a length, then *Start quiz*.
Leaving quiz mode puts the system toggles and camera back how they were.

- **Find the X**: the view frames the region (the whole body for level 1) and
  the labels are hidden. Click the structure, or press `←`/`→` to step through
  the structures in the quiz's systems and levels and `Enter` to choose. A wrong
  pick turns red and the right answer is highlighted and labelled.
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

- `attempts`: every answer with timestamp, type (`find`/`name`), concept,
  exact structure, system, level, what you answered, correct, and time taken.
- `concepts`: concept → attempts, correct, `lastResult`, `lastSeen`, history.
- `tutorQuiz`: a ready-made entry for the `quizzes` array of claude-tutor's
  progress file (`format` is `mcq` for *Find*, `fill` for *Name*).

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
`atlas.setSystem('muscular', true)`, `atlas.tierName()`. `atlas.quiz` drives
quiz mode (`setMode('quiz')`, `start()`, `answer('femur')`, `export()`).

## Credits

Models: **BodyParts3D**, © 2008 Life Science Integrated Database Center, licensed
under [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).
The converted GLB files in `public/models/` are a derivative work and carry the
same license.
