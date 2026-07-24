/**
 * Auth Fixture — Login and Session Management
 *
 * Safety Rule 3: Only named ordinary E2E accounts.
 * Safety Rule 4: No admin, service-role, or provider credentials.
 *
 * Phase 2 will add storage state persistence.
 * For now, login is performed via the UI on each test.
 */

import { test as base, expect, type Page } from '@playwright/test';
import { getAccount, getKnownAccountEmails } from '../config/accounts';
import { assertE2EAccount } from '../config/guard';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

export interface AuthFixtures {
  /** Login as a specific fixture account and return the authenticated page */
  loginAs: (fixture: string) => Promise<{ page: Page; email: string }>;
}

export const test = base.extend<AuthFixtures>({
  loginAs: async ({ page }, use) => {
    await use(async (fixture: string) => {
      const account = getAccount(fixture);
      const knownEmails = getKnownAccountEmails();

      // Guard: verify this is a known E2E account
      assertE2EAccount(account.email, knownEmails);

      // Navigate to login
      await page.goto(`${BASE_URL}/login`);

      // Fill login form
      await page.getByLabel(/email/i).fill(account.email);
      await page.getByLabel(/password/i).fill(account.password);

      // Submit
      await page.getByRole('button', { name: /sign in|log in|login/i }).click();

      // Wait for navigation away from login page
      await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 30_000,
      });

      return { page, email: account.email };
    });
  },
});

export { expect };
