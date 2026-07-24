/**
 * Base Test Fixture — Guards and Evidence Capture
 *
 * Every test extends this fixture. It:
 * 1. Re-checks origin at test time
 * 2. Sets up console/pageerror/network failure capture
 * 3. Provides run context (run ID, manifest, prefixing)
 * 4. Filters noise via the allowlist
 */

import { test as base, expect, type Page, type ConsoleMessage, type Response } from '@playwright/test';
import { assertOrigin } from '../config/guard';
import { isConsoleNoise, isNetworkNoise } from '../config/noise-allowlist';
import { getRunId, prefixName, type ManifestEntry, recordManifest, getManifest, verifyOwnership, exportManifest } from './run-context';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

/** Evidence collected on failure */
export interface FailureEvidence {
  testId: string;
  severity: string;
  runId: string;
  account: string;
  startUrl: string;
  finalUrl: string;
  actions: string[];
  visibleFailure: string;
  responseStatus?: number;
  failedRequestUrl?: string;
  consoleErrors: string[];
  pageErrors: string[];
  screenshotPath?: string;
  tracePath?: string;
  reproducibility: string;
  customerImpact: string;
  cleanupStatus: string;
}

export interface E2EFixtures {
  /** The run ID for this test */
  runId: string;
  /** Prefix a name with the run ID */
  prefix: (name: string) => string;
  /** Record a created entity */
  recordEntity: (entry: Omit<ManifestEntry, 'createdAt'>) => void;
  /** Get all manifest entries */
  manifest: () => ManifestEntry[];
  /** Verify ownership of an entity */
  verifyOwner: (visibleName: string, owner: string) => boolean;
  /** Export manifest as JSON */
  exportManifest: () => string;
  /** Collected console errors (non-noise) */
  consoleErrors: string[];
  /** Collected page errors */
  pageErrors: string[];
  /** Assert no 5xx first-party responses occurred */
  assertNoServerErrors: () => void;
}

export const test = base.extend<E2EFixtures>({
  runId: async ({}, use) => {
    await use(getRunId());
  },

  prefix: async ({}, use) => {
    await use(prefixName);
  },

  recordEntity: async ({}, use) => {
    await use(recordManifest);
  },

  manifest: async ({}, use) => {
    await use(getManifest);
  },

  verifyOwner: async ({ runId }, use) => {
    await use((name, owner) => verifyOwnership(name, owner, runId));
  },

  exportManifest: async ({}, use) => {
    await use(exportManifest);
  },

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error' && !isConsoleNoise(msg.text())) {
        errors.push(msg.text());
      }
    });
    await use(errors);
  },

  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err: Error) => {
      errors.push(err.message);
    });
    await use(errors);
  },

  assertNoServerErrors: async ({ page, consoleErrors, pageErrors }, use) => {
    const serverErrors: string[] = [];
    page.on('response', (response: Response) => {
      const url = response.url();
      const status = response.status();
      // Only first-party, only 5xx
      if (
        status >= 500 &&
        !isNetworkNoise(url) &&
        new URL(url).origin === new URL(BASE_URL).origin
      ) {
        serverErrors.push(`${status} ${url}`);
      }
    });

    await use(() => {
      if (serverErrors.length > 0) {
        throw new Error(
          `[e2e:evidence] ${serverErrors.length} first-party 5xx response(s):\n${serverErrors.join('\n')}`
        );
      }
      if (pageErrors.length > 0) {
        throw new Error(
          `[e2e:evidence] ${pageErrors.length} page error(s):\n${pageErrors.join('\n')}`
        );
      }
    });
  },
});

/** Re-check origin at test time */
test.beforeAll(() => {
  assertOrigin(BASE_URL);
});

export { expect };
