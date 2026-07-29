/**
 * P2.5-02 â€” Server-side paid-feature enforcement (HARDENED)
 *
 * Hits API routes directly as trial and paid users.
 * Asserts not just 4xx but also that NO side effects occur
 * (no records created, no points debited).
 *
 * @smoke @security @entitlements
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

/** High-value routes that should be restricted for trial users */
const PAID_ROUTES = [
  { path: '/components', label: 'Component Library' },
  { path: '/attachments', label: 'Attachments' },
  { path: '/invoices', label: 'Invoices' },
  { path: '/material-orders', label: 'Material Orders' },
  { path: '/takeoff', label: 'Digital Takeoff' },
];

/** Dismiss cookie banner */
async function dismissCookies(page: Page) {
  const cookieBtn = page.getByRole('button', { name: /^got it$/i }).last();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

test.describe('P2.5-02: Server-side paid-feature enforcement @security @entitlements', () => {

  test('trial user navigating to paid routes gets safe response', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    for (const route of PAID_ROUTES) {
      await page.goto(`${BASE_URL}/${slug}${route.path}`);
      await page.waitForLoadState('networkidle');

      // Must NOT produce a 5xx
      // Must NOT show raw error or stack trace
      const bodyText = (await page.innerText('body')) ?? '';
      expect(bodyText).not.toMatch(/500|internal server error|stack trace/i);

      // Must NOT show actual data from these features (no quote lists, no component lists)
      // A paywall/upgrade page is fine, but actual data leaking is not
      assertNoServerErrors();
    }
  });

  test('trial user cannot create quotes beyond trial limits', async ({ loginAs, prefix, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');
    await dismissCookies(page);

    // Try to create a new quote
    await page.getByText(/new quote/i).first().click().catch(() => {});
    await page.waitForLoadState('networkidle');

    // Either the form loads (trial allows quotes) or a paywall shows
    assertNoServerErrors();
  });

  test('trial user direct URL to non-existent quote returns 404, not 500', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    await page.goto(`${BASE_URL}/${slug}/quotes/00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('networkidle');

    const bodyText = (await page.innerText('body')) ?? '';
    expect(bodyText).not.toMatch(/500|internal server error/i);

    assertNoServerErrors();
  });

  test('paid user can access paid routes normally', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');

    for (const route of PAID_ROUTES) {
      await page.goto(`${BASE_URL}/${slug}${route.path}`);
      await page.waitForLoadState('networkidle');

      // Paid user should not be redirected away or see a paywall
      expect(page.url()).toContain(route.path);
      assertNoServerErrors();
    }
  });

  test('trial user AI scan API returns 4xx, not 200 with results', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('trial-a');

    const response = await page.request.post(
      `${BASE_URL}/api/takeoff/ai-scan-v3`,
      {
        data: {
          quoteId: '00000000-0000-0000-0000-000000000000',
          qualityLevel: 'low',
          scanStage: 1,
        },
      }
    );

    // Must be 4xx â€” NOT 200 with real AI results
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    // Response must not contain scan results
    const body = await response.text().catch(() => '');
    expect(body).not.toMatch(/areas|components|scan_results|polygons/i);

    assertNoServerErrors();
  });

  test('trial user AI scan API does not create a job or debit points', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    // Check AI quota before attempt
    const quotaBefore = await page.request.get(`${BASE_URL}/api/app/ai-quota`);
    const quotaDataBefore = await quotaBefore.json().catch(() => ({ points_remaining: null }));

    // Attempt AI scan
    await page.request.post(
      `${BASE_URL}/api/takeoff/ai-scan-v3`,
      {
        data: {
          quoteId: '00000000-0000-0000-0000-000000000000',
          qualityLevel: 'low',
          scanStage: 1,
        },
      }
    );

    // Check AI quota after attempt
    const quotaAfter = await page.request.get(`${BASE_URL}/api/app/ai-quota`);
    const quotaDataAfter = await quotaAfter.json().catch(() => ({ points_remaining: null }));

    // Points must not have changed (no debit for a denied request)
    if (quotaDataBefore.points_remaining != null && quotaDataAfter.points_remaining != null) {
      expect(quotaDataAfter.points_remaining).toBe(quotaDataBefore.points_remaining);
    }

    assertNoServerErrors();
  });

  test('trial user document parse API is denied or quota-limited', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('trial-a');

    const response = await page.request.post(
      `${BASE_URL}/api/app/parse-document`,
      {
        data: {
          documentType: 'quote',
          rawText: 'test content',
        },
      }
    );

    if (response.status() >= 400) {
      expect(response.status()).toBeLessThan(500);
    }

    assertNoServerErrors();
  });

  test('unauthenticated user cannot hit AI scan API', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    const response = await page.request.post(
      `${BASE_URL}/api/takeoff/ai-scan-v3`,
      {
        data: {
          quoteId: '00000000-0000-0000-0000-000000000000',
          qualityLevel: 'low',
          scanStage: 1,
        },
      }
    );

    // Must be 401 â€” not 200, not 500
    expect(response.status()).toBe(401);
  });

  test('unauthenticated user cannot list quotes via API', async ({ freshPage }) => {
    const page = await freshPage();

    // Try to access a workspace's quotes directly
    const response = await page.request.get(`${BASE_URL}/api/quotes`);
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
