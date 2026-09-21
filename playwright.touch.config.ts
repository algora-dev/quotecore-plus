import { defineConfig, devices } from '@playwright/test';
import { guardLocalOrigin } from './e2e/config/localGuard';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';

/**
 * M7 Touch Verification Harness (spec §14.7, 2026-09-21)
 *
 * WHY A SEPARATE CONFIG (recorded decision, not silent divergence):
 * the main playwright.config.ts aborts unless E2E_BASE_URL is the approved
 * deployed dev host and explicitly forbids localhost — its mutation suites
 * can therefore never cover uncommitted touch code. This config is the
 * complementary, equally-guarded harness: loopback ONLY, driving a local
 * `next dev` server started below. The main config is untouched.
 *
 * Named touch projects (spec §14.1: an iPhone-sized Chromium run is not an
 * iOS Safari run — these are EMULATION tiers, never physical-device proof):
 *   - touch-chromium : Pixel-7-sized Chromium with touch (primary driver)
 *   - touch-webkit   : iPhone-14-Pro descriptor on the WebKit engine
 *
 * Safety: only e2e/specs/takeoff-touch-precision.spec.ts (@touch) matches.
 */

// Load the shared e2e account credentials + the LOCAL app env (Supabase
// anon key for the password-grant login helper), then OVERRIDE the base URL
// to the local dev server (the local guard rejects anything else).
if (existsSync('.env.local')) {
  loadEnv({ path: '.env.local', quiet: true });
}
if (existsSync('.env.e2e')) {
  loadEnv({ path: '.env.e2e', quiet: true });
}
const BASE_URL = process.env.TOUCH_E2E_BASE_URL ?? 'http://localhost:3000';
guardLocalOrigin(BASE_URL);
process.env.E2E_BASE_URL = BASE_URL;

export default defineConfig({
  testDir: './e2e/specs',
  testMatch: /takeoff-touch-precision\.spec\.ts/,

  workers: 1,
  retries: 0,
  fullyParallel: false,

  reporter: [
    ['html', { outputFolder: 'playwright-report/touch-html', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'touch-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'touch-webkit',
      use: {
        ...devices['iPhone 14 Pro'],
      },
    },
  ],

  // Local dev server with the touch-relevant env overrides:
  //  - AI_TAKEOFF_ENABLED=true so the entitled AI-outline chip renders
  //    (the provider endpoint itself is ROUTE-MOCKED in the spec — no live
  //    provider, no credits spent; spec §14.1 mocked-API tier).
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
    env: {
      AI_TAKEOFF_ENABLED: 'true',
    },
  },
});
