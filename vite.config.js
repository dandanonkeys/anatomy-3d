import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Port 3000 matches threejs-devtools-mcp's DEV_PORT (parallax-threejs plugin).
export default defineConfig({
  // hmr.clientPort keeps hot reload working when the page is opened through
  // the devtools proxy (it does not forward the HMR websocket).
  server: { port: 3000, strictPort: true, hmr: { clientPort: 3000 } },
  // Two pages: the Body Atlas at / and Orgo Mechanisms at /organic/.
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        organic: resolve(import.meta.dirname, 'organic/index.html'),
      },
    },
  },
});
