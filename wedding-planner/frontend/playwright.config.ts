import { defineConfig, devices } from '@playwright/test';
import { AUTH_TEST_SECRET } from './e2e/support/sso-stub';

// Hermetic e2e: Playwright boots BOTH servers. The backend runs with the
// DB_TEST_MODE + AUTH_TEST_MODE seams (in-memory seed + locally-signed tokens),
// so the suite is networkless — it never contacts Supabase or kubitksso.pl.
// The frontend's proxy.conf.json already forwards /api → http://localhost:3000.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node src/server.js',
      cwd: '../backend',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        DB_TEST_MODE: '1',
        AUTH_TEST_MODE: '1',
        AUTH_TEST_SECRET,
      },
    },
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
