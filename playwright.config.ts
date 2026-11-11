import { defineConfig } from '@playwright/test';

/**
 * Browsertests draaien tegen de PRODUCTIEBUILD (vite preview), in de Chrome die al op de
 * computer staat — er hoeft dus geen aparte testbrowser gedownload te worden.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    locale: 'nl-NL',
    launchOptions: {
      // Zorgt dat WebGL ook werkt als er (headless) geen grafische kaart beschikbaar is.
      args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
