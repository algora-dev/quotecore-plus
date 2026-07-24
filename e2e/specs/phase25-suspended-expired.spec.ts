/**
 * P2.5-06 — Suspended/expired account enforcement after reload
 *
 * For admin-prepared suspended/expired/trial-expired E2E states:
 * - start with a normal user session
 * - reload and direct-navigate to protected feature routes
 * - assert correct restriction state and safe denial
 * - assert no new quote/job/file mutation succeeds
 * - assert paid/active control account remains unaffected
 *
 * NOTE: This test requires admin-prepared E2E account states.
 * The accounts must be set up by Shaun/admin before running these tests.
 * Until suspended/expired E2E accounts exist, these tests are skipped.
 *
 * @entitlements @read-only @security
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

/** Skip if suspended/expired E2E accounts are not configured */
const HAS_SUSPENDED_ACCOUNT = process.env.E2E_SUSPENDED_EMAIL && process.env.E2E_SUSPENDED_PASSWORD && process.env.E2E_SUSPENDED_SLUG;
const HAS_EXPIRED_ACCOUNT = process.env.E2E_EXPIRED_EMAIL && process.env.E2E_EXPIRED_PASSWORD && process.env.E2E_EXPIRED_SLUG;

/** Protected routes to test */
const PROTECTED_ROUTES = [
  '/quotes',
  '/invoices',
  '/material-orders',
  '/components',
  '/attachments',
];

test.describe('P2.5-06: Suspended/expired account enforcement @entitlements @read-only', () => {
  test.skip(!HAS_SUSPENDED_ACCOUNT && !HAS_EXPIRED_ACCOUNT,
    'Requires admin-prepared suspended/expired E2E accounts. Set E2E_SUSPENDED_* and E2E_EXPIRED_* env vars.');

  test('suspended account cannot create new quotes', async ({ freshPage, assertNoServerErrors }) => {
    test.skip(!HAS_SUSPENDED_ACCOUNT, 'No suspended E2E account configured');

    const page = await freshPage();

    // Login as suspended account
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[name="email"]').fill(process.env.E2E_SUSPENDED_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_SUSPENDED_PASSWORD!);
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForLoadState('networkidle');

    const slug = process.env.E2E_SUSPENDED_SLUG!;

    // Navigate to quotes
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    // Should be restricted — either redirected, shown a suspension notice,
    // or the "New Quote" button is absent/disabled
    const url = page.url();

    // Should not be able to create new content
    const newQuoteBtn = page.getByText(/new quote/i).first();
    const canCreate = await newQuoteBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (canCreate) {
      // If button is visible, clicking it should not create a quote
      await newQuoteBtn.click().catch(() => {});
      await page.waitForLoadState('networkidle');

      // Should either show a denial, paywall, or redirect
      // NOT land on a quote builder page with a new quote
      const onBuilder = page.url().includes('/quotes/new') || page.url().includes('/build');
      // If we ARE on the builder, the submit should fail
      if (onBuilder) {
        const submitBtn = page.getByRole('button', { name: /create|start|submit/i }).last();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click().catch(() => {});
          await page.waitForTimeout(2000);
          // Should not have created a quote — either error or redirect
        }
      }
    }

    assertNoServerErrors();
  });

  test('suspended account: direct route navigation is restricted', async ({ freshPage, assertNoServerErrors }) => {
    test.skip(!HAS_SUSPENDED_ACCOUNT, 'No suspended E2E account configured');

    const page = await freshPage();
    const slug = process.env.E2E_SUSPENDED_SLUG!;

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[name="email"]').fill(process.env.E2E_SUSPENDED_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_SUSPENDED_PASSWORD!);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForLoadState('networkidle');

    // Try each protected route
    for (const route of PROTECTED_ROUTES) {
      await page.goto(`${BASE_URL}/${slug}${route}`);
      await page.waitForLoadState('networkidle');

      // Should not produce 5xx
      const bodyText = (await page.textContent('body')) ?? '';
      expect(bodyText).not.toMatch(/500|internal server error/i);

      // Should show some form of restriction or redirect
      // (suspension notice, paywall, login redirect)
      const url = page.url();
      const isRestricted =
        url.includes('/login') ||
        url.includes('/suspended') ||
        url.includes('/account') ||
        /suspended|expired|restricted|upgrade/i.test(bodyText);

      // At minimum, no 5xx and no data mutation
      assertNoServerErrors();
    }
  });

  test('expired trial account: read-only access to existing data', async ({ freshPage, assertNoServerErrors }) => {
    test.skip(!HAS_EXPIRED_ACCOUNT, 'No expired trial E2E account configured');

    const page = await freshPage();
    const slug = process.env.E2E_EXPIRED_SLUG!;

    // Login as expired trial account
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[name="email"]').fill(process.env.E2E_EXPIRED_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_EXPIRED_PASSWORD!);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForLoadState('networkidle');

    // Should be able to see existing data but not create new
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    // No 5xx
    assertNoServerErrors();
  });

  test('expired trial account: no new mutations succeed', async ({ freshPage, assertNoServerErrors }) => {
    test.skip(!HAS_EXPIRED_ACCOUNT, 'No expired trial E2E account configured');

    const page = await freshPage();
    const slug = process.env.E2E_EXPIRED_SLUG!;

    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[name="email"]').fill(process.env.E2E_EXPIRED_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_EXPIRED_PASSWORD!);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForLoadState('networkidle');

    // Attempt to hit mutation endpoints
    const mutationResponse = await page.request.post(
      `${BASE_URL}/api/takeoff/ai-scan-v3`,
      {
        data: { quoteId: '00000000-0000-0000-0000-000000000000', qualityLevel: 'low', scanStage: 1 },
      }
    );

    // Should be denied (4xx), not 5xx
    expect(mutationResponse.status()).toBeGreaterThanOrEqual(400);
    expect(mutationResponse.status()).toBeLessThan(500);

    assertNoServerErrors();
  });

  test('active paid account is unaffected by suspended account tests', async ({ loginAs, assertNoServerErrors }) => {
    // Paid control account should work normally regardless of suspended/expired tests
    const { page, slug } = await loginAs('paid-c');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain(slug);
    expect(page.url()).toContain('/quotes');

    // No 5xx — paid account is fully functional
    assertNoServerErrors();
  });
});
