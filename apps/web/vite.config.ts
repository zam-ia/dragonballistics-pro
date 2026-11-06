import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // The test fixture is bundled only for the dedicated Playwright build.
      // Normal production builds do not expose an extra diagnostic HTML page.
      input: mode === 'worker-e2e'
        ? {
            app: fileURLToPath(new URL('./index.html', import.meta.url)),
            solverWorkerHarness: fileURLToPath(new URL('./solver-worker-harness.html', import.meta.url)),
          }
        : fileURLToPath(new URL('./index.html', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
}));
