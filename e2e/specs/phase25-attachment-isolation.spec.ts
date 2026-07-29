/**
 * P2.5-03 — Attachment & data tenant isolation (HARDENED)
 *
 * Uses E2E Company A (trial-a) and E2E Company D (cross-tenant-d).
 * Avoids calling loginAs twice in one test (creates separate browser
 * contexts and causes 30s timeouts). Instead uses known slugs for
 * direct URL construction and single-login tests.
 *
 * @smoke @security @attachments
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

const SLUG_A = process.env.E2E_TRIAL_A_SLUG ?? 'e2e-trial-company-a';
const COMPANY_A_NAME = 'E2E Trial Company A';

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
    const { page, slug: slugD } = await loginAs('cross-tenant-d');

    // Try to access Company A's workspace directly
    await page.goto(`${BASE_URL}/${SLUG_A}/quotes`);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    // Should NOT stay on Company A's workspace
    const isDenied =
      currentUrl.includes(slugD) ||           // redirected to own workspace
      currentUrl.includes('/login') ||         // redirected to login
      currentUrl.includes('/404') ||           // 404 route
      !currentUrl.includes(SLUG_A);            // not on A's workspace

    expect(isDenied).toBeTruthy();

    // CRITICAL: must not see Company A's data in visible text
    const bodyText = (await page.innerText('body').catch(() => '')) ?? '';
    expect(bodyText).not.toContain(COMPANY_A_NAME);

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

      // Response body must not contain file metadata
      const bodyText = await response.text().catch(() => '');
      expect(bodyText).not.toMatch(/filename|content-disposition.*attachment/i);
    }

    assertNoServerErrors();
  });

  test('tampered download token is rejected safely', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('paid-c');

    const tamperedUrls = [
      `${BASE_URL}/api/attachments/tampered-token-xyz/download`,
      `${BASE_URL}/api/attachments/download`,
    ];

    for (const url of tamperedUrls) {
      const response = await page.request.get(url);

      expect(response.status()).toBeLessThan(500);

      if (response.status() < 400) {
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

  test('cross-tenant API call does not return foreign data', async ({ loginAs, assertNoServerErrors }) => {
    // Login as Company D
    const { page } = await loginAs('cross-tenant-d');

    // Try to access Company A's workspace via API
    const response = await page.request.get(`${BASE_URL}/${SLUG_A}/quotes`);

    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      // Strip script tags to check visible content only
      const visibleText = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
      expect(visibleText).not.toContain(COMPANY_A_NAME);
    }

    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });
});
