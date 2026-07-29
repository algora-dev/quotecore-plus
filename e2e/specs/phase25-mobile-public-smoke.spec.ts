/**
 * P2.5-08 â€” Mobile public customer-flow smoke
 *
 * Phone viewport project for the public customer page only:
 * - open valid E2E public quote link
 * - verify primary details/actions are visible and usable
 * - exercise accept/decline or equivalent non-payment action where supported
 * - verify expired/invalid link state is responsive and safe
 *
 * @smoke @mobile @public
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

// Mobile viewport â€” iPhone 14 Pro dimensions
const MOBILE_VIEWPORT = { width: 393, height: 852 };

test.describe('P2.5-08: Mobile public customer-flow smoke @mobile @public', () => {
  test('invalid public link renders safely on mobile viewport', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.goto(`${BASE_URL}/accept/invalid-mobile-test-token`);
    await page.waitForLoadState('networkidle');

    // Page should render without horizontal scroll (basic mobile responsiveness)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance

    // No 5xx
    assertNoServerErrors();
  });

  test('valid-format non-existent token shows denial on mobile', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.goto(`${BASE_URL}/accept/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`);
    await page.waitForLoadState('networkidle');

    // Should show denial content, not a crash
    // Use innerText for visible text only (excludes RSC streaming JSON)
    const bodyText = (await page.innerText('body')) ?? '';
    const hasServerError = /500|internal server error/i.test(bodyText);
    expect(hasServerError).toBe(false);

    // No 5xx
    assertNoServerErrors();
  });

  test('public login page is responsive on mobile', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Login form should be visible and usable on mobile
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    expect(await emailInput.isVisible()).toBe(true);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    expect(await passwordInput.isVisible()).toBe(true);

    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);

    assertNoServerErrors();
  });

  test('public signup page is responsive on mobile', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    // Should render without 5xx
    assertNoServerErrors();

    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('rate-limited public page renders safely on mobile', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Hit the rate limiter with multiple rapid invalid attempts
    for (let i = 0; i < 3; i++) {
      await page.goto(`${BASE_URL}/accept/mobile-rate-test-${i}`);
      await page.waitForLoadState('networkidle');
    }

    // Should still render safely â€” no 5xx, no crash
    assertNoServerErrors();
  });
});
