import { defineConfig } from '@playwright/test';

// Tests de bout en bout dans un vrai navigateur (le Chrome installé, rien à télécharger).
// npm run test:e2e : construit le site, lance un serveur local avec une base neuve, puis joue les parcours.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8790',
    channel: 'chrome',
    headless: true,
    locale: 'fr-FR',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: './scripts/e2e-server.sh',
    url: 'http://localhost:8790/offline',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
