import { defineConfig, devices } from '@playwright/test';
import { guardOrigin } from './e2e/config/guard';

/**
 * QuoteCore+ Phase 1 E2E Test Harness
 *
 * SAFETY: This config will abort before any browser launches unless
 * E2E_BASE_URL is exactly https://quotecore-plus-dev.vercel.app.
 *
 * See: docs/plans/phase-1-e2e-test-harness-plan.md
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

// Pre-browser guard: abort immediately if origin is not the approved dev host.
guardOrigin(BASE_URL);

export default defineConfig({
  // Run from project root
  testDir: './e2e/specs',

  // Single worker — no parallel mutation tests (safety rule 11)
  workers: 1,

  // No retries for mutation suites (safety rule 12 / acceptance criterion 13)
  retries: 0,

  // Fail on first-party errors (evidence contract section 8)
  reporter: [
    ['html', { outputFolder: 'playwright-report/html', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  // Browser config: Chromium desktop only
  use: {
    baseURL: BASE_URL,

    // Desktop Chromium
    ...devices['Desktop Chrome'],

    // Capture evidence on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Fail on page errors
    ignoreHTTPSErrors: false,

    // Navigation timeout
    navigationTimeout: 30_000,

    // Action timeout
    actionTimeout: 15_000,
  },

  // Projects: mutation (default) + read-only (retries allowed for diagnostics)
  projects: [
    {
      name: 'mutation',
      testMatch: /.*\.spec\.ts/,
      grepInvert: /@read-only/,
    },
    {
      name: 'read-only',
      testMatch: /.*\.spec\.ts/,
      grep: /@read-only/,
      retries: 1,
    },
  ],

  // No local web server — tests run against the deployed dev host only
  // No globalSetup/globalTeardown yet — added in Phase 2
});
