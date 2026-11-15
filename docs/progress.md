# Progress

## 2026-11-14
- Set up the orchestrator-and-workers system: CLAUDE.md, the docs, the builder and reviewer agents, and the reflect skill.
- State: on `main`, with uncommitted edits to `.github/workflows/deploy.yml`, `src/main.js`, `src/quiz.js` and `tools/tutor-import.mjs` from earlier work.
- Next: (empty)

## 2026-11-14 (later)
- Added a start screen ("Body Atlas", by Daniel Ionin & Claude) and an intro: after "Start learning" the skeleton assembles bone by bone, feet first, while the camera swings to the home view; other systems fade in after. Esc skips; reduced motion and deep links (`?select=`, `?world=`) skip it. Code: `src/main.js` (intro section), `index.html`, `src/style.css`. Screenshots: `docs/screenshots/intro-*.jpg`.
- Not committed yet. Not checked on a real phone.

## 2026-11-14 (Orgo intro)
- Orgo Mechanisms now has a start screen ("Orgo Mechanisms", by Daniel Ionin & Claude). After "Start learning", a distillation plays for 3.6 s: the flask bubbles over a flame, drops run down the condenser and the receiving flask fills. Then the app fades in with focus on search. Esc or a click skips it, and reduced motion skips it. Code: `organic/index.html`, `organic/style.css` (intro section), `organic/src/app.js` (intro block). Screenshots: `docs/screenshots/orgo-intro-*.jpg`.
- Checked: `npm run check:orgo` (41 pass), and a browser run of title, animation, app and Esc skip with no console errors. Not committed. Not checked on a phone or in Safari.
