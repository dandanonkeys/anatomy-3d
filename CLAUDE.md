# anatomy-3d

Two static study apps, built with Vite and deployed by `.github/workflows/deploy.yml`:
- **Body Atlas** (`src/`): a Three.js 3D anatomy viewer. Labels change with the zoom tier. It has 2,828 Z-Anatomy structures, bony landmarks, groups, a Cells tab and a quiz mode with the course OIAN table.
- **Orgo Mechanisms** (`organic/`): an organic chemistry tool with animated mechanisms and quizzes, served at `/organic/`.

## How we work: orchestrator and workers
- The main session is the orchestrator. It plans, writes briefs and checks results. It doesn't do bulk work itself when a worker can do it.
- Workers are subagents on Haiku: `builder` writes code, `reviewer` checks a diff against a brief.
- Every brief states the **Goal**, the **Files to read**, and a **Done when:** check that can be run or seen (a command and its expected output, or a screenshot of a named view).
- Before accepting any worker's output, run its check yourself. If it fails, send it back with the failure output. Never pass on a worker's report unchecked.
- **Start of every session:** read this file, `docs/progress.md`, `docs/decisions.md` and `docs/known-issues.md`.
- **End of every session:** update `docs/progress.md`, add new decisions and gotchas, then run the `reflect` skill to propose skill or CLAUDE.md edits with evidence from the session. The user approves them before they are applied.

## Checks a "Done when:" can use
- `npm run build` exits 0 (Body Atlas)
- `npm run check:orgo` passes (Orgo validator and tests)
- Preview with `.claude/launch.json`: `atlas` (:3000), `atlas-build` (:4173), `orgo` (:5180). Screenshot the named view with no console errors.

## Folder map
- `src/`: Body Atlas. `main.js` (scene, picking, render loop), `ui.js`, `labels.js`, `landmarks.js`, `groups.js`, `systems.js`, `cells.js`, `quiz.js`, `style.css`
- `organic/`: Orgo Mechanisms. `src/` holds the engine, concepts, reactions and quiz. `tools/` holds `validate.mjs` and `quiz.test.mjs`.
- `public/models/`: one GLB per system, plus `manifest.json` and `details.json`
- `public/course/oian.json`: the course OIAN table (origin, insertion, action, nerve)
- `tools/`: model conversion from Z-Anatomy (`convert*.mjs`), the OIAN import from docx, and `tutor-import.mjs`
- `docs/`: `progress.md`, `decisions.md`, `known-issues.md`, `screenshots/`
- `.claude/`: `launch.json`, `agents/` (builder, reviewer), `skills/reflect/`
- `dist/`, `.playwright-mcp/`, `raw/`: generated and gitignored
