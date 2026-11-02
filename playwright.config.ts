import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium' },
  webServer: [
    { command: 'node fixtures/demo/start.mjs', url: 'http://127.0.0.1:3001/health', reuseExistingServer: true, timeout: 30_000 },
    { command: 'npm run dev -- --hostname 127.0.0.1 --port 3000', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 60_000 },
  ],
});
