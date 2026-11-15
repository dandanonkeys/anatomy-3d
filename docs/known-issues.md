# Known issues and gotchas

- Landmark positions are approximate (see the README's section "Data: real vs. schematic vs. approximate").
- Orgo Mechanisms has no build step. It is served as static files from `organic/`, so check it with the `orgo` preview, not `npm run build`.
- When the browser pane is hidden, its screenshot/JS tools hang. A headless check can use the Playwright cached by npx with `channel: 'chrome'` against the `atlas-build` server (:4173).
