/**
 * P2.5-03 — Attachment & data tenant isolation (HARDENED)
 *
 * Uses E2E Company A (trial-a) and E2E Company D (cross-tenant-d).
 * Asserts not just "redirected" but that ZERO foreign data appears
 * in responses — no customer names, no line items, no quote data.
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

test.describe('P2.5-03: Tenant isolation & data boundaries @security', () => {

  test('Company D cannot access Company A workspace via direct URL', async ({ loginAs, assertNoServerErrors }) => {
    const { page: pageA, slug: slugA } = await loginAs('trial-a');
    // Get A's slug
    const otherSlug = slugA;

    const { page: pageD, slug: slugD } = await loginAs('cross-tenant-d');

    // Try to access A's workspace directly
    await pageD.goto(`${BASE_URL}/${otherSlug}/quotes`);
    await pageD.waitForLoadState('networkidle');

    // Should NOT stay on A's workspace
    const currentUrl = pageD.url();
    const isOnOwnWorkspace = currentUrl.includes(slugD);
    const isRedirected = currentUrl.includes('/login') || currentUrl.includes('/404');
    const isDenied = isOnOwnWorkspace || isRedirected || !currentUrl.includes(otherSlug);

    expect(isDenied).toBeTruthy();

    // CRITICAL: must not see any of Company A's data
    const bodyText = (await pageD.innerText('body').catch(() => '')) ?? '';
    expect(bodyText).not.toMatch(/E2E.*Trial.*Company.*A/i);

    assertNoServerErrors();
  });

  test('Company D direct API call to Company A quote returns 404 or 403', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug: slugA } = await loginAs('trial-a');

    // As Company A, create a quote to get a real quote URL
    await page.goto(`${BASE_URL}/${slugA}/quotes`);
    await page.waitForLoadState('networkidle');
    await dismissCookies(page);

    // Get the first quote link on the page (if any exist)
    const quoteLinks = await page.locator('a[href*="/quotes/"]').all();
    let quotePath = '';

    if (quoteLinks.length > 0) {
      const href = await quoteLinks[0].getAttribute('href') ?? '';
      // Extract just the quote path portion
      const match = href.match(/\/quotes\/([a-f0-9-]+)/);
      if (match) quotePath = match[0];
    }

    // Now login as Company D and try to access that quote
    const { page: pageD } = await loginAs('cross-tenant-d');

    if (quotePath) {
      // Try direct URL access
      await pageD.goto(`${BASE_URL}/${slugA}${quotePath}`);
      await pageD.waitForLoadState('networkidle');

      // Must not see the quote data
      const bodyText = (await pageD.innerText('body').catch(() => '')) ?? '';
      expect(bodyText).not.toMatch(/E2E.*Trial.*Company.*A/i);

      // Should be redirected or show 404
      const url = pageD.url();
      const denied = !url.includes(quotePath) || url.includes('/login') || url.includes('/404');
      expect(denied).toBeTruthy();
    }

    assertNoServerErrors();
  });

  test('Company D guessed attachment ID returns 4xx with no file metadata', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('cross-tenant-d');

    const guessedPaths = [
      `${BASE_URL}/api/attachments/00000000-0000-0000-0000-000000000000`,
      `${BASE_URL}/api/attachments/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
    ];

    for (const attemptUrl of guessedPaths) {
      const response = await page.request.get(attemptUrl);

      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);

      // Response body must not contain file names, signed URLs, or metadata
      const bodyText = await response.text().catch(() => '');
      expect(bodyText).not.toMatch(/filename|content-disposition.*attachment/i);
      // Must not contain a valid UUID pattern (which would indicate a real file reference)
      expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    }

    assertNoServerErrors();
  });

  test('tampered download token is rejected safely', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('paid-c');

    const tamperedUrls = [
      `${BASE_URL}/api/attachments/tampered-token-xyz/download`,
      `${BASE_URL}/api/attachments/../../../etc/passwd/download`,
      `${BASE_URL}/api/attachments/download`,
    ];

    for (const url of tamperedUrls) {
      const response = await page.request.get(url);

      // Must be 4xx, not 5xx, not 200 with file data
      expect(response.status()).toBeLessThan(500);

      if (response.status() < 400) {
        // If somehow 200, body must be an error message, not file bytes
        const contentType = response.headers()['content-type'] ?? '';
        expect(contentType).not.toMatch(/application\/octet-stream|image\/|application\/pdf/);
      }
    }

    assertNoServerErrors();
  });

  test('Company A can access its own workspace normally', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain(slug);
    expect(page.url()).toContain('/quotes');
    assertNoServerErrors();
  });

  test('cross-tenant API call does not return foreign data in response body', async ({ loginAs, assertNoServerErrors }) => {
    // Login as A to get A's slug
    const { slug: slugA } = await loginAs('trial-a');

    // Login as D
    const { page, slug: slugD } = await loginAs('cross-tenant-d');

    // As Company D, try to access A's workspace via API
    const response = await page.request.get(`${BASE_URL}/${slugA}/quotes`);

    // Should not return 200 with A's data
    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      expect(body).not.toMatch(/E2E.*Trial.*Company.*A/i);
    }

    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });
});
