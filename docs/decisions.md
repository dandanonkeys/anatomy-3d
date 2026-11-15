# Decisions

## 2026-11-14: Orchestrator and Haiku workers
The main session plans and checks; Haiku subagents do the bulk work. Each brief carries a runnable "Done when:" check that the orchestrator runs itself before accepting a result.

## 2026-11-14: Intro animates the real skeleton batch
The intro moves the skeletal BatchedMesh instances (`setMatrixAt`) instead of loading a separate model, so it ends exactly on the app's home view with no swap. Bones not yet launched get a zero-scale matrix rather than `setVisibleAt`, which `applyLook` owns.

## 2026-11-14: Orgo intro shows even on deep links
`select()` always writes `#id` into the URL, so a hash can't tell a shared link from a reload. The title screen always shows, and the hashed concept opens after Start. (Body Atlas skips its intro on `?select=`/`?world=` deep links, which it can tell apart.)
