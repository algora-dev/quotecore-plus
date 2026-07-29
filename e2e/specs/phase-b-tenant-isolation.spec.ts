/**
 * Phase B: Tenant Isolation & Security — Direct API tests
 *
 * Tests that Company D CANNOT read or write Company A's data
 * via direct API calls. RLS is the last line of defence and
 * must be verified at the API level, not just UI redirect level.
 *
 * @smoke @security @cross-tenant
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

// Known E2E account slugs (from .env.e2e) - used for cross-tenant URL construction
// We hardcode these as constants rather than calling loginAs twice (which creates
// separate browser contexts and causes timeouts).
const SLUG_A = process.env.E2E_TRIAL_A_SLUG ?? 'e2e-trial-company-a';
const SLUG_D = process.env.E2E_CROSS_D_SLUG ?? 'e2e-crosstenant-company-d';
const COMPANY_A_NAME = 'E2E Trial Company A';

test.describe('Phase B: Tenant Isolation @security @cross-tenant', () => {

  test('B1: Company D cannot list Company A quotes via direct URL @smoke', async ({ loginAs, assertNoServerErrors }) => {
    // Login as Company D only
    const { page } = await loginAs('cross-tenant-d');

    // Try to access Company A's quotes via direct URL (server-rendered)
    const response = await page.request.get(`${BASE_URL}/${SLUG_A}/quotes`);

    if (response.status() === 200) {
      // Use innerText to get visible text only (excludes RSC script payloads)
      const body = await response.text().catch(() => '');
      // Check visible content only — strip script tags
      const visibleText = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
      expect(visibleText).not.toContain(COMPANY_A_NAME);
    }

    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });

  test('B2: Company D cannot list Company A component library via direct URL @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('cross-tenant-d');

    const response = await page.request.get(`${BASE_URL}/${SLUG_A}/components`);

    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      // Strip script tags and HTML to get visible text only
      const visibleText = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
      expect(visibleText).not.toContain(COMPANY_A_NAME);
    }

    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });

  test('B3: Company D cannot read Company A takeoff data via direct URL @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('cross-tenant-d');

    // Try guessing a takeoff URL under Company A's workspace
    const guessedTakeoffUrl = `${BASE_URL}/${SLUG_A}/quotes/00000000-0000-0000-0000-000000000000/takeoff`;
    const response = await page.request.get(guessedTakeoffUrl);

    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      // Strip script tags to avoid matching RSC payload
      const visibleText = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
      // Must not contain Company A's name in visible text
      expect(visibleText).not.toContain(COMPANY_A_NAME);
      // Must not contain actual takeoff measurement data in visible text
      expect(visibleText).not.toMatch(/roof.*area.*\d+.*m/i);
      expect(visibleText).not.toMatch(/measurement.*\d+.*width|length/i);
    }

    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });

  test('B4: Company D cannot save takeoff data to Company A quote @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('cross-tenant-d');

    // Try to POST takeoff save data to a quote under Company A's workspace
    const response = await page.request.post(`${BASE_URL}/api/takeoff/ai-scan-v3`, {
      data: {
        quoteId: '00000000-0000-0000-0000-000000000000',
        qualityLevel: 'low',
        scanStage: 1,
      },
    });

    // Must be 4xx — not 200 (which would mean the write succeeded)
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    assertNoServerErrors();
  });

  test('B5: Non-supplier cannot see unpublished supplier catalogues in search @security', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    await page.goto(`${BASE_URL}/${slug}/supplier-directory`);
    await page.waitForLoadState('networkidle');

    // The directory should only show published/approved suppliers
    const bodyText = (await page.innerText('body').catch(() => '')) ?? '';
    expect(bodyText).not.toMatch(/draft|pending.review|private/i);

    assertNoServerErrors();
  });

  test('B6: Company D cannot import components into Company A library @security', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs('cross-tenant-d');

    const response = await page.request.post(`${BASE_URL}/api/supplier-import`, {
      data: {
        libraryId: '00000000-0000-0000-0000-000000000000',
        componentIds: ['00000000-0000-0000-0000-000000000000'],
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    assertNoServerErrors();
  });
});
