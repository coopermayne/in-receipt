import { defineConfig, devices } from '@playwright/test';
import { SITE_PORT, SITE_URL } from './tests/support/site.mjs';

// Desktop specs run in all three desktop engines; mobile specs run against
// emulated phones. WebKit is Safari's engine, but Playwright's build is not
// iOS Safari itself: for iOS-only rendering bugs, also run `npm run test:ios`.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: SITE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', testMatch: /desktop/, use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-safari', testMatch: /desktop/, use: { ...devices['Desktop Safari'] } },
    { name: 'desktop-firefox', testMatch: /desktop/, use: { ...devices['Desktop Firefox'] } },
    { name: 'iphone-15', testMatch: /mobile/, use: { ...devices['iPhone 15'] } },
    { name: 'iphone-se', testMatch: /mobile/, use: { ...devices['iPhone SE'] } },
    { name: 'pixel-7', testMatch: /mobile/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node tests/support/site.mjs',
    port: SITE_PORT,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
