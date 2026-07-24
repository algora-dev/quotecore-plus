/**
 * E2E-01: Login, reload persistence, logout
 * E2E-02: Invalid login and unauthenticated direct route
 *
 * @smoke @read-only (01 parts) / @mutation (logout clears state)
 */
import { test, expect } from '../fixtures/base';
import { getAccount } from '../config/accounts';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

test.describe('Auth & Session', () => {
  test('E2E-01: Login, reload persistence, logout @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    // Verify we're on the workspace
    expect(page.url()).toContain(slug);

    // Reload — session should persist
    await page.reload();
    await page.waitForURL((url) => url.pathname.includes(slug), { timeout: 15_000 });

    // Still authenticated after reload
    expect(page.url()).not.toContain('/login');

    // Logout
    const logoutBtn = page.getByRole('button', { name: /logout/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Try link
      await page.getByRole('link', { name: /logout|sign out/i }).click();
    }

    await page.waitForURL((url) => url.pathname === '/' || url.pathname.includes('/login'), {
      timeout: 15_000,
    });

    // Protected route should now redirect to login
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 15_000 });

    assertNoServerErrors();
  });

  test('E2E-02: Invalid login shows error, no session @smoke', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.goto(`${BASE_URL}/login`);

    // Fill with wrong credentials
    await page.locator('input[name="email"]').fill('e2e-trial-a@quotecore.invalid');
    await page.locator('input[name="password"]').fill('WrongPassword123!');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should stay on login page or show error
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/login');

    // Try unauthenticated direct route — should redirect
    await page.goto(`${BASE_URL}/e2e-trial-company-a/quotes`);
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 15_000 });

    assertNoServerErrors();
  });
});
