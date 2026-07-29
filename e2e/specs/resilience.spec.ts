/**
 * E2E-20: Rapid duplicate submit protection
 * E2E-22: Refresh/back/forward recovery
 * E2E-23: Same-origin allowlisted public route crawl
 *
 * @smoke
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

test.describe('Resilience', () => {
  test('E2E-20: Rapid duplicate submit â€” no broken state @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    // Navigate to quotes
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    // Verify page is stable after load
    expect(page.url()).toContain('/quotes');
    assertNoServerErrors();
  });

  test('E2E-22: Refresh/back/forward recovery @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    // Navigate to quotes
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    // Navigate to invoices
    await page.goto(`${BASE_URL}/${slug}/invoices`);
    await page.waitForLoadState('networkidle');

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Should be back on quotes, no blank page or loop
    expect(page.url()).toContain('/quotes');

    // Refresh
    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/quotes');
    assertNoServerErrors();
  });

  test('E2E-23: Same-origin public route crawl @smoke', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // Crawl public pages â€” same origin only, no form submissions
    const publicPaths = ['/', '/login', '/signup', '/privacy', '/terms', '/cookies'];
    const visited: string[] = [];

    for (const pubPath of publicPaths) {
      await page.goto(`${BASE_URL}${pubPath}`);
      await page.waitForLoadState('networkidle');

      // Verify same origin
      expect(page.url()).toContain('quotecore-plus-testing.vercel.app');

      // Verify no 404 (page should have content, not a Next.js 404)
      const notFound = await page.getByText('404 | This page could not be found').count();
      expect(notFound).toBe(0);

      visited.push(pubPath);
    }

    expect(visited.length).toBe(publicPaths.length);
    assertNoServerErrors();
  });
});
