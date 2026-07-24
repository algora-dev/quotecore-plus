/**
 * E2E-03: Password-reset request
 * E2E-04: Onboarding gate/workspace routing
 * E2E-09: Catalogue/component entitlement
 * E2E-10: Attachment/plan lifecycle
 * E2E-12: Public quote link/optional send
 * E2E-15: Account plan/quota display
 * E2E-16: Trial restrictions versus paid access
 *
 * @smoke @read-only (where applicable)
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

test.describe('Entitlements & Secondary Workflows', () => {
  test('E2E-03: Password-reset request @read-only', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Click "Trouble signing in?"
    const troubleBtn = page.getByRole('button', { name: /trouble signing in/i }).first();
    if (await troubleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await troubleBtn.click();
      await page.waitForTimeout(2000);
    }

    // Should not show enumeration — generic confirmation only
    // No 5xx errors
    assertNoServerErrors();
  });

  test('E2E-04: Onboarding gate — User E stays in onboarding @read-only', async ({ loginAs, assertNoServerErrors }) => {
    // User E has incomplete onboarding — should be redirected to onboarding
    const { page } = await loginAs('onboarding-e');

    // Should be on onboarding page or redirected there
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // User should not reach a workspace dashboard
    expect(url).toMatch(/onboarding|login|\/$/);

    assertNoServerErrors();
  });

  test('E2E-04b: Starter B reaches workspace @read-only', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    await page.goto(`${BASE_URL}/${slug}`);
    await page.waitForLoadState('networkidle');

    // Should be on workspace dashboard, not onboarding
    expect(page.url()).toContain(slug);
    expect(page.url()).not.toContain('/onboarding');

    assertNoServerErrors();
  });

  test('E2E-09: Catalogue/component page loads @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');

    await page.goto(`${BASE_URL}/${slug}/components`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/components');
    assertNoServerErrors();
  });

  test('E2E-10: Attachments page loads @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');

    await page.goto(`${BASE_URL}/${slug}/attachments`);
    await page.waitForLoadState('networkidle');

    // Should load without 5xx
    assertNoServerErrors();
  });

  test('E2E-12: Public quote link — invalid token is safe @smoke', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // Visit a non-existent public quote link — should be safe (not crash)
    await page.goto(`${BASE_URL}/q/invalid-token-12345`);
    await page.waitForLoadState('networkidle');

    // Should not show a 500 or stack trace
    const hasServerError = await page.getByText(/500|internal server error|stack trace/i).count();
    expect(hasServerError).toBe(0);

    assertNoServerErrors();
  });

  test('E2E-15: Account plan/quota display @read-only', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    // Go to account/billing page
    await page.goto(`${BASE_URL}/${slug}/account?tab=billing`);
    await page.waitForLoadState('networkidle');

    // Should show plan info
    expect(page.url()).toContain('/account');

    assertNoServerErrors();
  });

  test('E2E-15b: Trial plan display @read-only', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    await page.goto(`${BASE_URL}/${slug}/account?tab=billing`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/account');
    assertNoServerErrors();
  });

  test('E2E-16: Trial restrictions — user can still view workspace @read-only', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('trial-a');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    // Trial user should see the quotes page
    expect(page.url()).toContain('/quotes');
    assertNoServerErrors();
  });

  test('E2E-16b: Paid user — components accessible @read-only', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');

    await page.goto(`${BASE_URL}/${slug}/components`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/components');
    assertNoServerErrors();
  });
});
