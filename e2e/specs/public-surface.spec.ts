/**
 * Public Surface Crawl — same-origin, allowlisted paths only
 *
 * E2E-23 extended: Crawl more public-facing pages.
 * Never follows external links, submits forms, downloads files, or mutates state.
 *
 * @smoke @read-only
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

test.describe('Public Surface', () => {
  test('Public pages render without errors @smoke @read-only', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    const publicPaths = [
      '/',
      '/login',
      '/signup',
      '/privacy',
      '/terms',
      '/cookies',
      '/contact',
    ];

    for (const path of publicPaths) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState('networkidle');

      // Same origin
      expect(page.url()).toContain('quotecore-plus-dev.vercel.app');

      // No 404
      const notFound = await page.getByText('404 | This page could not be found').count();
      expect(notFound).toBe(0);

      // No page error
      const errorText = await page.getByText(/application error|500/i).count();
      expect(errorText).toBe(0);
    }

    assertNoServerErrors();
  });

  test('Signup page loads @smoke @read-only', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/signup');

    // Should have some form elements
    const emailInput = page.locator('input[type="email"]').first();
    expect(await emailInput.isVisible()).toBe(true);

    assertNoServerErrors();
  });
});
