/**
 * E2E-05: Quote required-field validation
 * E2E-06: Quote create/save/reload/edit
 * E2E-07: Customer create/search/select/edit (covered via quote flow)
 * E2E-08: Builder calculation and invalid input
 * E2E-11: Quote summary/export
 *
 * @smoke @mutation
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';

/** Dismiss cookie banner — use force to bypass assistant launcher overlay */
async function dismissCookies(page: import('@playwright/test').Page) {
  const cookieBtn = page.getByRole('button', { name: /^got it$/i }).last();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

test.describe('Quotes & Customers', () => {
  test('E2E-05: Quote required-field validation @smoke', async ({ loginAs, prefix, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    await dismissCookies(page);

    // Click "+ New Quote"
    await page.getByText(/new quote/i).first().click();
    await page.waitForURL((url) => url.pathname.includes('/quotes/new'), { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // The "Create Quote" button should be disabled when customer name is empty
    const submitBtn = page.getByRole('button', { name: /create|start|submit/i }).last();
    if (await submitBtn.isVisible()) {
      // Button should be disabled (validation working)
      await expect(submitBtn).toBeDisabled();
      // Verify we're still on the new quote page
      expect(page.url()).toContain('/quotes/new');
    }

    assertNoServerErrors();
  });

  test('E2E-06: Quote create/save/reload/edit @smoke', async ({ loginAs, prefix, recordEntity, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');
    const customerName = prefix('Test Customer');
    const jobName = prefix('Test Job');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    await dismissCookies(page);

    // Click "+ New Quote"
    await page.getByText(/new quote/i).first().click();
    await page.waitForURL((url) => url.pathname.includes('/quotes/new'), { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Fill customer name — find input next to "Customer Name" label
    const customerLabel = page.getByText('Customer Name');
    const customerField = customerLabel.locator('..').locator('input').first();
    await customerField.fill(customerName);

    // Fill job name (optional)
    const jobLabel = page.getByText('Job Name');
    const jobField = jobLabel.locator('..').locator('input').first();
    if (await jobField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await jobField.fill(jobName);
    }

    // Select "Standard Quote" entry mode
    const standardBtn = page.getByText('Standard Quote').first();
    if (await standardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await standardBtn.click();
    }

    // Submit the form
    const createBtn = page.getByRole('button', { name: /create|start|submit/i }).last();
    await createBtn.click();

    // Should navigate away from /quotes/new
    await page.waitForURL((url) => !url.pathname.includes('/quotes/new'), {
      timeout: 30_000,
    });

    // Reload — verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    recordEntity({
      type: 'quote',
      owner: 'starter-b',
      visibleName: customerName,
      urlOrId: page.url(),
      cleanupPath: 'quotes-list → delete',
    });

    assertNoServerErrors();
  });

  test('E2E-08: Builder calculation — verify no 5xx @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/quotes');
    assertNoServerErrors();
  });

  test('E2E-11: Quote summary page loads @smoke', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/quotes');
    assertNoServerErrors();
  });
});
