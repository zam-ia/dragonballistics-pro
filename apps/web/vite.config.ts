import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Non-visual integration fixture exercises a real bundled Worker in Playwright.
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        solverWorkerHarness: fileURLToPath(
          new URL('./solver-worker-harness.html', import.meta.url),
        ),
      },
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
});
