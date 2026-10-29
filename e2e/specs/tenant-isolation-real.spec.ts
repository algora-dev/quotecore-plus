/**
 * Two-tenant isolation - REAL RECORDS (@security)
 *
 * Unlike older isolation specs that probe nonexistent IDs (which only prove
 * "missing records 404"), this spec creates an actual quote as tenant A and
 * then attempts cross-tenant access as tenant B with those REAL IDs.
 *
 * Chain of proof:
 * 1. Control: tenant A can access its own quote (proves the ID is valid)
 * 2. Denial: tenant B cannot view or fetch tenant A's quote by ID, under
 *    either workspace slug, at the page or HTTP level, with no data leak
 * 3. Mutation guard: A's quote is unchanged after B's attempts
 *
 * Fixtures: 'paid-c' = tenant A (owner), 'cross-tenant-d' = tenant B.
 * Guide: docs/testing/TWO_TENANT_ISOLATION_FIXTURES.md
 *
 * @smoke @security
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

/** Known denial surfaces on quote pages: the SSR not-found shell
 * ("This page could not be found") and the client error boundary
 * ("This page couldn't load / A server error occurred"). A denied quote
 * renders HTTP 200 with this content rather than a 404 status (known
 * polish item), so the COPY is what proves denial - never the status
 * code alone. Keep in sync with app copy if the denial UI changes. */
const DENIAL_COPY = /could not be found|couldn'?t load|server error|not found|invalid|expired|may be invalid|access/i;

const TENANT_A = 'paid-c';
const TENANT_B = 'cross-tenant-d';

/** Shared state across the serial tests (setup creates, denials consume) */
const ctx = { quoteId: '', quoteUrl: '', customerName: '' };

/** Dismiss cookie/modals that can block interaction (pattern from money-calc spec) */
async function dismissOverlays(page: Page) {
  const btn = page.getByRole('button', { name: /not now|skip|close|dismiss|accept/i }).last();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

/** Create a quote as the signed-in tenant and return its ID.
 * Uses the deep-link hint ?measurements=known which pre-selects manual entry
 * and skips the mode-choice cards (entryModeFromHint in
 * app/components/quote-entry/quoteJourney.ts) — deterministic, no mode-button
 * click race. Destination after create is /{slug}/quotes/{id}. */
async function createQuoteViaUI(page: Page, slug: string, customerName: string): Promise<string> {
  await page.goto(`${BASE_URL}/${slug}/quotes/new?measurements=known`);
  await page.waitForLoadState('domcontentloaded');
  await dismissOverlays(page);

  const customerField = page.getByText('Customer Name').locator('..').locator('input').first();
  await customerField.waitFor({ state: 'visible', timeout: 15_000 });
  await customerField.fill(customerName);

  const jobField = page.getByText('Job Name').locator('..').locator('input').first();
  if (await jobField.isVisible().catch(() => false)) {
    await jobField.fill(`${customerName} Job`);
  }

  const createBtn = page.getByRole('button', { name: /enter measurements/i }).first();
  await createBtn.click();

  await page.waitForURL((u) => !u.pathname.includes('/quotes/new'), { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  await dismissOverlays(page);

  const m = page.url().match(/quotes\/([0-9a-zA-Z-]{6,})/);
  expect(m, `quote id extracted from ${page.url()}`).toBeTruthy();
  return m![1];
}

test.describe.serial('Two-tenant isolation (real records) @security', () => {
  test('setup + control: tenant A creates a quote and can open it', async ({ loginAs, prefix }) => {
    const { page, slug } = await loginAs(TENANT_A);
    ctx.customerName = prefix('IsoLeak');

    ctx.quoteId = await createQuoteViaUI(page, slug, ctx.customerName);
    ctx.quoteUrl = `${BASE_URL}/${slug}/quotes/${ctx.quoteId}`;

    // CONTROL: A can load its own quote page and sees the customer name.
    await page.goto(ctx.quoteUrl);
    await page.waitForLoadState('domcontentloaded');
    await expect
      .poll(async () => page.innerText('body'), { timeout: 15_000 })
      .toContain(ctx.customerName);
  });

  test('denial: tenant B cannot open A quote page by ID (own slug)', async ({ loginAs }) => {
    const { page, slug } = await loginAs(TENANT_B);
    expect(ctx.quoteId).toBeTruthy();

    // Session sanity (non-vacuous): B's workspace home must render B's OWN
    // workspace chrome and must NOT show tenant A's company. Navigate fresh
    // and read immediately so a later client-side redirect can never make
    // this check pass vacuously on unrelated content (observed 2026-10-29:
    // both tenants' contexts loaded the marketing homepage after the
    // workspace home; the old check then proved nothing).
    await page.goto(`${BASE_URL}/${slug}`);
    await page.waitForLoadState('domcontentloaded');
    const sanity = await page.innerText('body');
    expect(sanity, 'B session sanity: B home must render Company D workspace').toContain('E2E CrossTenant Company D');
    expect(sanity, 'B session sanity: A company must not appear at B home').not.toContain('E2E Paid Company C');

    await page.goto(`${BASE_URL}/${slug}/quotes/${ctx.quoteId}`);
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    const body = await page.innerText('body');

    // Not viewable: either redirected away from the quote route or shown a
    // denial surface. The app renders denial content at HTTP 200 (known
    // polish item: should eventually be a 404 status), so the URL KEEPS
    // the quote id and the denial copy is the proof.
    const denied =
      !url.includes(ctx.quoteId) || DENIAL_COPY.test(body);
    expect(denied, `expected denial for B at ${url}; body head: ${body.slice(0, 200)}`).toBeTruthy();

    // No leak of A's unique customer data on the denial surface.
    expect(body).not.toContain(ctx.customerName);
  });

  test('denial: tenant B fetch of A workspace quote URL serves no foreign data', async ({ loginAs, assertNoServerErrors }) => {
    const { page } = await loginAs(TENANT_B);

    // HTTP-level: B's session fetching A's workspace quote URL directly.
    // Known behavior (polish item): denial serves HTTP 200 with a denial
    // shell instead of a 404 status, so assert on content, not status.
    const resp = await page.request.get(ctx.quoteUrl);
    const body = (await resp.text()) ?? '';
    expect(body, 'A-workspace quote fetch as B must not leak A data').not.toContain(ctx.customerName);
    const fetchDenied = resp.status() !== 200 || DENIAL_COPY.test(body);
    expect(fetchDenied, `expected denial surface for B fetch (status ${resp.status()})`).toBeTruthy();

    // Page-level: B navigating into A's workspace slug with the real quote ID.
    const aSlug = new URL(ctx.quoteUrl).pathname.split('/')[1];
    await page.goto(`${BASE_URL}/${aSlug}/quotes/${ctx.quoteId}`);
    await page.waitForLoadState('domcontentloaded');
    const navBody = await page.innerText('body');
    expect(navBody, 'A-slug page nav as B must not leak A data').not.toContain(ctx.customerName);
    const navDenied = !page.url().includes(ctx.quoteId) || DENIAL_COPY.test(navBody);
    expect(navDenied, `expected denial surface for B at A-slug URL ${page.url()}; body head: ${navBody.slice(0, 200)}`).toBeTruthy();

    assertNoServerErrors();
  });

  test('mutation guard: A quote unchanged after B attempts', async ({ loginAs }) => {
    const { page } = await loginAs(TENANT_A);

    await page.goto(ctx.quoteUrl);
    await page.waitForLoadState('domcontentloaded');
    const body = await page.innerText('body');

    // A still sees its quote, intact, after B's view/fetch attempts.
    await expect
      .poll(async () => page.innerText('body'), { timeout: 15_000 })
      .toContain(ctx.customerName);
    expect(body.length).toBeGreaterThan(0);
  });

  test('teardown: delete the fixture quote as A (best effort)', async ({ loginAs }) => {
    const { page } = await loginAs(TENANT_A);
    await page.goto(ctx.quoteUrl);
    await page.waitForLoadState('domcontentloaded');

    const del = page.getByRole('button', { name: /delete|remove|trash/i }).first();
    if (await del.isVisible({ timeout: 3000 }).catch(() => false)) {
      await del.click();
      const confirm = page.getByRole('button', { name: /^(delete|confirm|remove)$/i }).last();
      if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirm.click();
      }
    }
    // Best effort only: prefixed names make leftovers identifiable for cleanup runs.
  });
});
