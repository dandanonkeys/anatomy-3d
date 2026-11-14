import { defineConfig } from 'vite';

// Port 3000 matches threejs-devtools-mcp's DEV_PORT (parallax-threejs plugin).
export default defineConfig({
  // hmr.clientPort keeps hot reload working when the page is opened through
  // the devtools proxy (it does not forward the HMR websocket).
  server: { port: 3000, strictPort: true, hmr: { clientPort: 3000 } },
});
