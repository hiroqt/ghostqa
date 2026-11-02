import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', browserName: 'chromium' },
  webServer: [
    { command: 'node fixtures/demo/start.mjs', url: 'http://127.0.0.1:3201/health', reuseExistingServer: false, timeout: 30_000, env: { GHOSTQA_FIXTURE_PORT: '3201' } },
    { command: 'npm run dev -- --hostname 127.0.0.1 --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 60_000, env: { ALLOWED_ORIGINS: 'http://127.0.0.1:3201', NEXT_PUBLIC_DEMO_ORIGIN: 'http://127.0.0.1:3201', MODEL_MODE: 'mock', NEXT_PUBLIC_MODEL_MODE: 'mock', ALLOW_LIVE_SITES: 'false', NEXT_PUBLIC_ALLOW_LIVE_SITES: 'false' } },
  ],
});
