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

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

test.describe('Phase B: Tenant Isolation @security @cross-tenant', () => {

  test('B1: Company D cannot list Company A quotes via direct API @smoke', async ({ loginAs, assertNoServerErrors }) => {
    // Get Company A's slug
    const { slug: slugA } = await loginAs('trial-a');

    // Login as Company D
    const { page, slug: slugD } = await loginAs('cross-tenant-d');

    // Try to access Company A's quotes via direct URL (server-rendered)
    const response = await page.request.get(`${BASE_URL}/${slugA}/quotes`);

    // Should not return 200 with A's data
    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      // Must not contain Company A's data
      expect(body).not.toMatch(/E2E.*Trial.*Company.*A/i);
    }

    // Must not be 5xx
    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });

  test('B2: Company D cannot list Company A component library via direct URL @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { slug: slugA } = await loginAs('trial-a');
    const { page } = await loginAs('cross-tenant-d');

    // Try to access Company A's components page
    const response = await page.request.get(`${BASE_URL}/${slugA}/components`);

    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      expect(body).not.toMatch(/E2E.*Trial.*Company.*A/i);
    }

    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });

  test('B3: Company D cannot read Company A takeoff data via direct URL @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { slug: slugA } = await loginAs('trial-a');
    const { page } = await loginAs('cross-tenant-d');

    // Try guessing a takeoff URL under Company A's workspace
    const guessedTakeoffUrl = `${BASE_URL}/${slugA}/quotes/00000000-0000-0000-0000-000000000000/takeoff`;
    const response = await page.request.get(guessedTakeoffUrl);

    if (response.status() === 200) {
      const body = await response.text().catch(() => '');
      // Must not contain takeoff data (measurements, areas, components)
      expect(body).not.toMatch(/roof.*area|measurement|component.*entries/i);
      expect(body).not.toMatch(/E2E.*Trial.*Company.*A/i);
    }

    expect(response.status()).toBeLessThan(500);
    assertNoServerErrors();
  });

  test('B4: Company D cannot save takeoff data to Company A quote @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { slug: slugA } = await loginAs('trial-a');
    const { page } = await loginAs('cross-tenant-d');

    // Try to POST takeoff save data to Company A's quote
    const response = await page.request.post(`${BASE_URL}/api/takeoff/ai-scan-v3`, {
      data: {
        quoteId: '00000000-0000-0000-0000-000000000000',
        qualityLevel: 'low',
        scanStage: 1,
        // Attempt to target Company A's workspace slug
        workspaceSlug: slugA,
      },
    });

    // Must be 4xx — not 200 (which would mean the write succeeded)
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    assertNoServerErrors();
  });

  test('B5: Non-supplier cannot see unpublished supplier catalogues in search @security', async ({ loginAs, assertNoServerErrors }) => {
    // Login as a regular (non-supplier) account
    const { page, slug } = await loginAs('starter-b');

    // Navigate to supplier directory
    await page.goto(`${BASE_URL}/${slug}/supplier-directory`);
    await page.waitForLoadState('networkidle');

    // The directory should only show published/approved suppliers
    // Unpublished or private catalogues must NOT appear
    const bodyText = (await page.innerText('body').catch(() => '')) ?? '';

    // Should not see "draft", "pending_review", or "private" status labels
    // on catalogue entries (those indicate unpublished content leaking)
    expect(bodyText).not.toMatch(/draft|pending.review|private/i);

    assertNoServerErrors();
  });

  test('B6: Company D cannot import components into Company A library @security', async ({ loginAs, assertNoServerErrors }) => {
    const { slug: slugA } = await loginAs('trial-a');
    const { page } = await loginAs('cross-tenant-d');

    // Try to hit the supplier-import API with Company A's slug
    const response = await page.request.post(`${BASE_URL}/api/supplier-import`, {
      data: {
        libraryId: '00000000-0000-0000-0000-000000000000',
        componentIds: ['00000000-0000-0000-0000-000000000000'],
        targetLibraryId: '00000000-0000-0000-0000-000000000000',
        workspaceSlug: slugA,
      },
    });

    // Must be 4xx — the import must not succeed
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    assertNoServerErrors();
  });
});
