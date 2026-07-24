/**
 * E2E-24: Cross-tenant access denial
 * E2E-25: Ordinary user attempts admin routes
 *
 * @smoke @cross-tenant
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

test.describe('Access Boundaries', () => {
  test('E2E-24: Company A cannot access Company D data @smoke @cross-tenant', async ({ loginAs, assertNoServerErrors }) => {
    // Login as trial-a (Company A)
    const { page, slug } = await loginAs('trial-a');

    // Try to access Company D's workspace directly
    const otherSlug = 'e2e-crosstenant-company-d';
    await page.goto(`${BASE_URL}/${otherSlug}/quotes`);

    // Should NOT show Company D's data — either redirect, 404, or deny
    // The app should redirect back to the user's own workspace or show a denial
    const url = page.url();

    // User should either be redirected to their own workspace or to login
    const isDenied =
      url.includes(slug) ||           // redirected to own workspace
      url.includes('/login') ||        // redirected to login
      url.includes('/404') ||          // 404 page
      url.includes('error');           // error page

    // At minimum, we should NOT see Company D's quotes
    // (We can't check for specific D names without creating fixtures first)
    expect(isDenied || !url.includes(otherSlug)).toBeTruthy();

    assertNoServerErrors();
  });

  test('E2E-25: Ordinary user cannot access admin routes @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('trial-a');

    // Try to access admin dashboard
    await page.goto(`${BASE_URL}/admin`);

    // Should be redirected away from admin — to login, home, or denied
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const isDenied =
      url.includes('/login') ||
      url.includes('/admin/login') ||
      !url.includes('/admin') ||
      url === `${BASE_URL}/`;

    // Should NOT see admin dashboard content
    const adminHeading = await page.getByText('Admin dashboard').count();
    expect(adminHeading).toBe(0);

    assertNoServerErrors();
  });
});
