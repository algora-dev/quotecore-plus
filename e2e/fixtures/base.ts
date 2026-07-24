/**
 * Combined Base Fixture — E2E test entry point
 *
 * Merges: auth, evidence capture, run context, manifest, noise filtering.
 * All specs import { test, expect } from this file.
 */
import { test as base, expect, type Page, type ConsoleMessage, type Response } from '@playwright/test';
import { assertOrigin } from '../config/guard';
import { isConsoleNoise, isNetworkNoise } from '../config/noise-allowlist';
import {
  getRunId,
  prefixName,
  type ManifestEntry,
  recordManifest,
  getManifest,
  verifyOwnership,
  exportManifest,
} from './run-context';
import { getAccount, getKnownAccountEmails } from '../config/accounts';
import { assertE2EAccount } from '../config/guard';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';
const AUTH_DIR = path.join(process.cwd(), '.auth');
try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch {}

function storageStatePath(fixture: string): string {
  return path.join(AUTH_DIR, `${fixture}.json`);
}

export interface E2EFixtures {
  /** Run ID for this test */
  runId: string;
  /** Prefix a name with the run ID */
  prefix: (name: string) => string;
  /** Record a created entity in the manifest */
  recordEntity: (entry: Omit<ManifestEntry, 'createdAt'>) => void;
  /** Get all manifest entries */
  manifest: () => ManifestEntry[];
  /** Verify ownership of an entity */
  verifyOwner: (visibleName: string, owner: string) => boolean;
  /** Export manifest as JSON */
  exportManifest: () => string;
  /** Console errors (non-noise) */
  consoleErrors: string[];
  /** Page errors */
  pageErrors: string[];
  /** Assert no first-party 5xx responses occurred */
  assertNoServerErrors: () => void;
  /** Login as a fixture account (with storage state caching) */
  loginAs: (fixture: string) => Promise<{ page: Page; email: string; slug: string }>;
  /** Fresh unauthenticated page */
  freshPage: () => Promise<Page>;
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

  assertNoServerErrors: async ({ page }, use) => {
    const serverErrors: string[] = [];
    page.on('response', (response: Response) => {
      const url = response.url();
      const status = response.status();
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
          `[e2e] ${serverErrors.length} first-party 5xx response(s):\n${serverErrors.join('\n')}`
        );
      }
    });
  },

  loginAs: async ({ browser }, use) => {
    await use(async (fixture: string) => {
      const account = getAccount(fixture);
      assertE2EAccount(account.email, getKnownAccountEmails());

      const statePath = storageStatePath(fixture);
      let context;
      if (fs.existsSync(statePath)) {
        context = await browser.newContext({ storageState: statePath });
      } else {
        context = await browser.newContext();
      }
      const page = await context.newPage();

      // Verify auth by hitting workspace
      await page.goto(`${BASE_URL}/${account.workspaceSlug}`);

      if (page.url().includes('/login')) {
        await page.goto(`${BASE_URL}/login`);
        await page.locator('input[name="email"]').fill(account.email);
        await page.locator('input[name="password"]').fill(account.password);
        await page.getByRole('button', { name: /log in/i }).click();
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
          timeout: 30_000,
        });
        await context.storageState({ path: statePath });
      }

      return { page, email: account.email, slug: account.workspaceSlug };
    });
  },

  freshPage: async ({ browser }, use) => {
    await use(async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      return page;
    });
  },
});

// Re-check origin at suite level
test.beforeAll(() => {
  assertOrigin(BASE_URL);
});

export { expect };
