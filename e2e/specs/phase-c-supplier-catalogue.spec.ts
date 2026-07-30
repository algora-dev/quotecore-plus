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
const FIXTURE_COMPONENT_NAME = 'Test Component';
const FIXTURE_COMPONENT_SKU = 'TEST-001';

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

async function openTargetLibrary(page: Page, slug: string, collectionId: string) {
  await page.goto(`${BASE_URL}/${slug}/components`);
  await page.waitForLoadState('domcontentloaded');
  await dismissCookies(page);

  const librarySelect = page.locator('select').filter({
    has: page.locator(`option[value="${collectionId}"]`),
  }).first();
  await expect(librarySelect).toBeVisible();
  await librarySelect.selectOption(collectionId);

  const search = page.locator('input[placeholder^="Search Smart Components"]');
  await search.fill(FIXTURE_COMPONENT_NAME);
}

function fixtureComponentCards(page: Page) {
  return page.getByText(FIXTURE_COMPONENT_SKU, { exact: true }).locator(
    'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " group ")][1]'
  );
}

async function deleteFixtureComponents(page: Page, slug: string, collectionId: string) {
  await openTargetLibrary(page, slug, collectionId);

  while (await fixtureComponentCards(page).count()) {
    const previousCount = await fixtureComponentCards(page).count();
    const card = fixtureComponentCards(page).first();
    await expect(card).toContainText(FIXTURE_COMPONENT_NAME);
    await card.hover();
    await card.getByTitle('Click to delete').click();

    const modal = page.getByRole('heading', { name: /Delete Smart Component/ }).locator('..');
    await modal.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(fixtureComponentCards(page)).toHaveCount(previousCount - 1);
  }
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

  test('C2: selected catalogue row creates a component in the owned library', async ({ loginAs, assertNoServerErrors }) => {
    test.setTimeout(90_000);
    const { page, slug } = await loginAs('paid-c');
    await openCatalogueRows(page, slug);

    const targetCollectionId = await page.locator('select').last().inputValue();
    expect(targetCollectionId).not.toBe('');
    await deleteFixtureComponents(page, slug, targetCollectionId);

    try {
      await openCatalogueRows(page, slug);
      await page.locator('select').last().selectOption(targetCollectionId);
      await page.locator('thead input[type="checkbox"]').uncheck();
      await page.locator('tbody tr').first().locator('input[type="checkbox"]').check();
      await expect(page.getByText('1 / 25 selected', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Create 1 Component', exact: true }).click();
      await expect(page.getByText('Created 1 component from catalogue.', { exact: true })).toBeVisible();

      await openTargetLibrary(page, slug, targetCollectionId);
      const createdCard = fixtureComponentCards(page);
      await expect(createdCard).toHaveCount(1);
      await expect(createdCard).toContainText(FIXTURE_COMPONENT_NAME);
    } finally {
      await deleteFixtureComponents(page, slug, targetCollectionId);
    }

    assertNoServerErrors();
  });

  test('C3: oversized catalogue conversion is atomic', async ({ loginAs, assertNoServerErrors }) => {
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

  test('C4: supplier directory excludes private catalogue status labels', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');
    await page.goto(`${BASE_URL}/${slug}/supplier-directory`);
    await page.waitForLoadState('domcontentloaded');
    await dismissCookies(page);

    await expect(page).toHaveURL(new RegExp(`/${slug}/supplier-directory(?:\\?|$)`));
    await expect(page.locator('body')).not.toContainText(/draft|pending review/i);
    assertNoServerErrors();
  });

  test('C5: supplier directory search is always available', async ({ loginAs, assertNoServerErrors }) => {
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

  test('C6: supplier import API rejects unauthenticated and malformed requests', async ({ freshPage }) => {
    const anonymousPage = await freshPage();
    const unauthenticated = await anonymousPage.request.post(`${BASE_URL}/api/supplier-import`, {
      data: { sourceLibraryId: 'invalid', targetCollectionId: 'invalid', componentIds: [] },
    });
    expect(unauthenticated.status()).toBe(401);

    const body = await unauthenticated.json();
    expect(body).toMatchObject({ ok: false, message: 'Authentication required.' });
  });

  test('C7: authenticated catalogue conversion rejects missing fields as 400', async ({ loginAs }) => {
    const { page } = await loginAs('paid-c');
    const response = await page.request.post(`${BASE_URL}/api/supplier-catalogue-convert`, {
      data: { selectedRows: [] },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  test('C8: quoted commas remain within catalogue fields', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');
    await openCatalogueRows(page, slug);

    await expect(page.locator('tbody')).toContainText('Component, With Comma');
    await expect(page.locator('tbody')).toContainText('Note, with comma');
    assertNoServerErrors();
  });

  test('C9: long source descriptions remain intact before conversion', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');
    await openCatalogueRows(page, slug);

    await expect(page.locator('tbody')).toContainText('A'.repeat(75));
    await expect(page.locator('tbody')).toContainText('Full description here');
    assertNoServerErrors();
  });
});
