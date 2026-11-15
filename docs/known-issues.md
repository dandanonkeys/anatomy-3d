# Known issues and gotchas

- Landmark positions are approximate (see the README's section "Data: real vs. schematic vs. approximate").
- Orgo Mechanisms has no build step. It is served as static files from `organic/`, so check it with the `orgo` preview, not `npm run build`.
- When the browser pane is hidden, its screenshot/JS tools hang. A headless check can use the Playwright cached by npx with `channel: 'chrome'` against the `atlas-build` server (:4173).
- Port 5180 (the `orgo` preview) may already be held by another worktree's server, which serves *that* checkout's `organic/`. Check with `lsof -i :5180` before trusting it, or serve this checkout on another port.
- A hidden full-overlay SVG still catches clicks; give it `pointer-events: none` until it is shown (the Orgo intro's `#still` hit this).
