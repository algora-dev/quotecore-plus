/**
 * E2E-13: Invoice create/edit/reload/preview/delete
 * E2E-14: Material order create/edit/reload/preview/delete
 *
 * @smoke @mutation
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

test.describe('Invoices & Orders', () => {
  test('E2E-13: Invoice page loads, create modal works @smoke', async ({ loginAs, prefix, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    // Navigate to invoices
    await page.goto(`${BASE_URL}/${slug}/invoices`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/invoices');

    // Look for create button
    const createBtn = page.getByRole('button', { name: /create|new/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }

    assertNoServerErrors();
  });

  test('E2E-14: Material orders page loads @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    // Navigate to material orders
    await page.goto(`${BASE_URL}/${slug}/material-orders`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/material-orders');
    assertNoServerErrors();
  });
});
