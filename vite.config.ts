import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Op GitHub Pages draait de app in een submap (/<repo-naam>/); de deploy-workflow zet BASE_PATH.
  // Lokaal (dev, preview, tests) blijft het gewoon '/'.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
