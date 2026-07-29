/**
 * Auth Fixture â€” Login, Session Persistence, Storage State
 *
 * Phase 2: Adds storage state caching so login happens once per account
 * per test run, not on every test.
 */
import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';
import { getAccount } from '../config/accounts';
import { getKnownAccountEmails, assertE2EAccount } from '../config/guard';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';
const AUTH_DIR = path.join(process.cwd(), '.auth');

// Ensure .auth directory exists
try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch {}

function storageStatePath(fixture: string): string {
  return path.join(AUTH_DIR, `${fixture}.json`);
}

export interface AuthFixtures {
  /** Login as a specific fixture account, using cached storage state when available */
  loginAs: (fixture: string) => Promise<{ page: Page; email: string; slug: string }>;
  /** Create a fresh page (no cached auth) for a fixture */
  freshPage: (fixture: string) => Promise<{ page: Page; email: string }>;
}

export const test = base.extend<AuthFixtures>({
  loginAs: async ({ browser }, use) => {
    await use(async (fixture: string) => {
      const account = getAccount(fixture);
      const knownEmails = getKnownAccountEmails();
      assertE2EAccount(account.email, knownEmails);

      const statePath = storageStatePath(fixture);

      // Try cached storage state first
      let context;
      if (fs.existsSync(statePath)) {
        context = await browser.newContext({ storageState: statePath });
      } else {
        context = await browser.newContext();
      }

      const page = await context.newPage();

      // Verify we're authenticated by hitting the workspace
      await page.goto(`${BASE_URL}/${account.workspaceSlug}`);

      // If redirected to login, perform fresh login
      if (page.url().includes('/login')) {
        await page.goto(`${BASE_URL}/login`);
        await page.locator('input[name="email"]').fill(account.email);
        await page.locator('input[name="password"]').fill(account.password);
        await page.getByRole('button', { name: /log in/i }).click();
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
          timeout: 30_000,
        });

        // Save storage state for reuse
        await context.storageState({ path: statePath });
      }

      return { page, email: account.email, slug: account.workspaceSlug };
    });
  },

  freshPage: async ({ browser }, use) => {
    await use(async (fixture: string) => {
      const account = getAccount(fixture);
      assertE2EAccount(account.email, getKnownAccountEmails());

      const context = await browser.newContext();
      const page = await context.newPage();
      return { page, email: account.email };
    });
  },
});

export { expect };
