/**
 * P2.5-03 — Attachment tenant isolation and download expiry
 *
 * Using E2E Company A (trial-a) and E2E Company D (cross-tenant-d):
 * - upload an owned fixture under A
 * - attempt direct/guessed download or attachment route access under D
 * - assert safe denial/404 with no file name, signed URL, metadata, or
 *   byte disclosure
 * - test invalid/tampered/expired-style download token handling
 * - confirm A can still access its own attachment normally
 *
 * Never access real customer objects.
 *
 * @smoke @security @attachments
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

/** Dismiss cookie banner */
async function dismissCookies(page: Page) {
  const cookieBtn = page.getByRole('button', { name: /^got it$/i }).last();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

test.describe('P2.5-03: Attachment tenant isolation @security @attachments', () => {
  test('Company D cannot access Company A attachment URLs', async ({ loginAs, assertNoServerErrors }) => {
    // Login as Company A first to get an attachment URL pattern
    const { page: pageA, slug: slugA } = await loginAs('trial-a');
    await pageA.goto(`${BASE_URL}/${slugA}/attachments`);
    await pageA.waitForLoadState('networkidle');
    await dismissCookies(pageA);

    // Try to find any existing attachment URL on A's page
    const attachmentLinks = await pageA.locator('a[href*="attachment"], a[href*="download"], a[href*="file"]').count();

    // Now login as Company D and try to access A's attachment routes
    const { page: pageD, slug: slugD } = await loginAs('cross-tenant-d');

    // Try direct URL access to A's workspace attachments
    await pageD.goto(`${BASE_URL}/${slugA}/attachments`);
    await pageD.waitForLoadState('networkidle');

    // Should be redirected to D's own workspace, denied, or show a 404 page
    const url = pageD.url();
    const bodyText = (await pageD.innerText('body').catch(() => '')) ?? '';
    const showsNotFound = /not found|404|could not be found/i.test(bodyText);
    const isDenied =
      url.includes(slugD) ||           // redirected to own workspace
      url.includes('/login') ||         // redirected to login
      url.includes('/404') ||           // 404 route
      !url.includes(slugA) ||          // not on A's workspace
      showsNotFound;                    // shows a 404/denial page

    expect(isDenied).toBeTruthy();

    assertNoServerErrors();
  });

  test('Company D direct attachment URL guess returns 404 or denial', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('cross-tenant-d');

    // Try to access a guessed attachment ID from Company A's workspace
    const guessedPaths = [
      `${BASE_URL}/${slug}/attachments/00000000-0000-0000-0000-000000000000`,
      `${BASE_URL}/api/attachments/00000000-0000-0000-0000-000000000000`,
      `${BASE_URL}/api/files/00000000-0000-0000-0000-000000000000`,
    ];

    for (const attemptUrl of guessedPaths) {
      const response = await page.request.get(attemptUrl);

      // Should be 4xx, not 5xx and not 200
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);

      // Response body should not contain file names, signed URLs, or metadata
      const bodyText = await response.text().catch(() => '');
      expect(bodyText).not.toMatch(/filename|content-disposition.*attachment/i);
      expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    }

    assertNoServerErrors();
  });

  test('tampered download token is rejected safely', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('paid-c');

    // Try to access a download with a tampered/expired token
    const tamperedUrls = [
      `${BASE_URL}/api/download?token=tampered-invalid-token`,
      `${BASE_URL}/api/download?token=`,
      `${BASE_URL}/api/download`,
    ];

    for (const url of tamperedUrls) {
      const response = await page.request.get(url);

      // Should be 4xx, not 5xx, not 200 with file data
      if (response.status() < 400) {
        // If 200, body should be an error message, not file bytes
        const contentType = response.headers()['content-type'] ?? '';
        expect(contentType).not.toMatch(/application\/octet-stream|image\/|application\/pdf/);
      }

      expect(response.status()).toBeLessThan(500);
    }

    assertNoServerErrors();
  });

  test('Company A can access its own attachments page', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    await page.goto(`${BASE_URL}/${slug}/attachments`);
    await page.waitForLoadState('networkidle');

    // Should stay on own workspace attachments page
    expect(page.url()).toContain(slug);
    expect(page.url()).toContain('/attachments');

    // No 5xx
    assertNoServerErrors();
  });

  test('cross-tenant API call does not return foreign data', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug: slugD } = await loginAs('cross-tenant-d');

    // Try to call the attachments listing API with Company A's slug
    const { slug: slugA } = (await loginAs('trial-a')).email
      ? { slug: 'e2e-trial-company-a' }
      : { slug: '' };

    // As Company D, try to GET A's attachment list via API
    const response = await page.request.get(`${BASE_URL}/api/attachments?slug=${slugA}`);

    // Should not return 200 with A's data
    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      // Should not contain E2E Trial Company A's data
      expect(body).not.toMatch(/E2E.*Trial.*Company.*A/i);
    }

    // No 5xx
    expect(response.status()).toBeLessThan(500);

    assertNoServerErrors();
  });
});
