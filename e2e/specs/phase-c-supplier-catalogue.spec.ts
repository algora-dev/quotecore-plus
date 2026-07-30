/**
 * Phase C: Supplier System & Catalogue Tests
 *
 * Requires the deterministic `paid-c` supplier profile and
 * `E2E Supplier Catalogue Fixture` in the shared testing database.
 * Missing prerequisites are failures, never skips.
 *
 * @smoke @mutation @supplier
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';
const FIXTURE_CATALOGUE = 'E2E Supplier Catalogue Fixture (25 rows)';

async function dismissCookies(page: Page) {
  const button = page.getByRole('button', { name: /^got it$/i }).last();
  if (await button.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await button.click({ force: true });
  }
}

async function openCatalogueRows(page: Page, slug: string) {
  await page.goto(`${BASE_URL}/${slug}/supplier`);
  await page.waitForLoadState('domcontentloaded');
  await dismissCookies(page);

  await expect(page).toHaveURL(new RegExp(`/${slug}/supplier(?:\\?|$)`));
  await page.getByRole('button', { name: 'Catalogues', exact: true }).click();

  const catalogueSelect = page.locator('select').first();
  await expect(catalogueSelect).toBeVisible();
  await expect(catalogueSelect.locator('option', { hasText: FIXTURE_CATALOGUE })).toHaveCount(1);
  await catalogueSelect.selectOption({ label: FIXTURE_CATALOGUE });
  await page.getByRole('button', { name: 'Load Catalogue', exact: true }).click();

  await expect(page.getByText('Sample row preview:', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next: Select Rows', exact: true }).click();
  await expect(page.getByText('25 / 25 selected', { exact: true })).toBeVisible();
}

test.describe('Phase C: Supplier System & Catalogue @mutation @supplier', () => {
  test('C1: deterministic supplier catalogue loads exact mapped fields', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');
    await openCatalogueRows(page, slug);

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toContainText('TEST-001');
    await expect(firstRow).toContainText('Test Component');
    await expect(firstRow).toContainText('10.00');
    await expect(firstRow).toContainText('Ridge');
    assertNoServerErrors();
  });

  test('C2: oversized catalogue conversion is atomic', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');
    await openCatalogueRows(page, slug);

    const targetSelect = page.locator('select').last();
    const before = await targetSelect.locator('option:checked').textContent();
    await expect(page.getByText('25 / 25 selected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create 25 Components', exact: true }).click();
    await expect(
      page.getByText('Maximum 20 rows can be converted at once.', { exact: true })
    ).toBeVisible();

    await page.reload();
    await dismissCookies(page);
    await page.getByRole('button', { name: 'Catalogues', exact: true }).click();
    const catalogueSelect = page.locator('select').first();
    await catalogueSelect.selectOption({ label: FIXTURE_CATALOGUE });
    await page.getByRole('button', { name: 'Load Catalogue', exact: true }).click();
    await page.getByRole('button', { name: 'Next: Select Rows', exact: true }).click();
    await expect(page.locator('select').last().locator('option:checked')).toHaveText(before ?? '');
    assertNoServerErrors();
  });

  test('C3: supplier directory excludes private catalogue status labels', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');
    await page.goto(`${BASE_URL}/${slug}/supplier-directory`);
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    await expect(page).toHaveURL(new RegExp(`/${slug}/supplier-directory(?:\\?|$)`));
    await expect(page.locator('body')).not.toContainText(/draft|pending review/i);
    assertNoServerErrors();
  });

  test('C4: supplier directory search is always available', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');
    await page.goto(`${BASE_URL}/${slug}/supplier-directory`);
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    const search = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(search).toBeVisible();
    await search.fill('roof');
    await expect(search).toHaveValue('roof');
    assertNoServerErrors();
  });

  test('C5: supplier import API rejects unauthenticated and malformed requests', async ({ freshPage }) => {
    const anonymousPage = await freshPage();
    const unauthenticated = await anonymousPage.request.post(`${BASE_URL}/api/supplier-import`, {
      data: { sourceLibraryId: 'invalid', targetCollectionId: 'invalid', componentIds: [] },
    });
    expect(unauthenticated.status()).toBe(401);

    const body = await unauthenticated.json();
    expect(body).toMatchObject({ ok: false, message: 'Authentication required.' });
  });

  test('C6: authenticated catalogue conversion rejects missing fields as 400', async ({ loginAs }) => {
    const { page } = await loginAs('paid-c');
    const response = await page.request.post(`${BASE_URL}/api/supplier-catalogue-convert`, {
      data: { selectedRows: [] },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  test('C7: quoted commas remain within catalogue fields', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');
    await openCatalogueRows(page, slug);

    await expect(page.locator('tbody')).toContainText('Component, With Comma');
    await expect(page.locator('tbody')).toContainText('Note, with comma');
    assertNoServerErrors();
  });

  test('C8: long source descriptions remain intact before conversion', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');
    await openCatalogueRows(page, slug);

    await expect(page.locator('tbody')).toContainText('A'.repeat(75));
    await expect(page.locator('tbody')).toContainText('Full description here');
    assertNoServerErrors();
  });
});
