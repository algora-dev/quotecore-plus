/**
 * Public-link lifecycle - REAL TOKEN (@security, QC-02)
 *
 * Replaces invented-token-only coverage: mints a REAL acceptance link via the
 * send panel's Copy-URL mode (display path, applyExpiry=false - no email is
 * sent, no allowance consumed), then proves the full lifecycle:
 *
 * Chain of proof:
 * 1. Positive control: the valid token renders the quote with seeded markers
 *    (unique customer name, sender company, captured total) for an
 *    unauthenticated visitor.
 * 2. Tampered token (one flipped hex char, valid UUID shape) denies.
 * 3. Expired token (acceptance_token_expires_at pushed to yesterday) denies.
 * 4. Withdrawn token (withdrawn_at stamped) denies.
 * 5. Deleted quote: the same token denies and the fixture quote is removed
 *    from A's list (strict teardown).
 *
 * Denial assertions check BOTH the rendered page text AND the raw HTTP body
 * (fetch from page context), so RSC/inline payload leaks cannot hide.
 *
 * Requires SUPABASE_ACCESS_TOKEN in the runner environment for the
 * expired/withdrawn lifecycle transitions (Management API; these cannot be
 * driven by UI without emailing a real address). Leftovers are identifiable
 * by the E2E-...-PubLink customer-name prefix for a Management-API sweep.
 *
 * @security @public
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';
const SUPABASE_PROJECT = 'bcqrrrvbzlfmfgvotzqw';

const TENANT_A = 'paid-c';
const COMPANY_A = 'E2E Paid Company C';

/** Known denial copy on /accept/*: the invalid-link shell and the expired UI. */
const DENIAL_COPY = /may be invalid|link (has )?expired|no longer valid|could not be found|not found/i;

const ctx = {
  quoteId: '',
  customerName: '',
  acceptUrl: '',
  token: '',
  markers: [] as string[],
};

/** Run SQL against the testing DB via the Supabase Management API. */
async function managementSql(query: string): Promise<void> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN missing: expired/withdrawn lifecycle variants need Management API access');
  }
  const resp = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`Management API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
}

/** Dismiss cookie/modals that can block interaction (pattern from tenant spec). */
async function dismissOverlays(page: Page) {
  const btn = page.getByRole('button', { name: /not now|skip|close|dismiss|accept/i }).last();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

/** Create a draft quote via the builder deep-link (mirrors tenant-isolation-real). */
async function createQuoteViaUI(page: Page, slug: string, customerName: string): Promise<string> {
  await page.goto(`${BASE_URL}/${slug}/quotes/new?measurements=known`);
  const customerField = page.getByText('Customer Name').locator('..').locator('input').first();
  await customerField.waitFor({ state: 'visible', timeout: 15_000 });
  await customerField.fill(customerName);

  const createBtn = page.getByRole('button', { name: /enter measurements/i }).first();
  await createBtn.click();

  await page.waitForURL((u) => !u.pathname.includes('/quotes/new'), { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  await dismissOverlays(page);

  const m = page.url().match(/quotes\/([0-9a-zA-Z-]{6,})/);
  expect(m, `quote id extracted from ${page.url()}`).toBeTruthy();
  return m![1];
}

/** Assert none of the seeded markers appear in a text blob (page or raw body). */
function assertNoMarkersIn(text: string, where: string) {
  for (const marker of ctx.markers) {
    expect(text, `${where} must not leak seeded marker "${marker}"`).not.toContain(marker);
  }
}

/** Load a URL unauthenticated and return { url, bodyText, rawBody }. */
async function loadPublic(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const bodyText = await page.innerText('body');
  const rawBody = await page.evaluate(async (u: string) => {
    const resp = await fetch(u);
    return `${resp.status} ${(await resp.text()).slice(0, 20000)}`;
  }, url);
  return { finalUrl: page.url(), bodyText, rawBody };
}

test.describe.serial('Public link lifecycle (real token) @security', () => {
  test('setup: A creates + confirms quote and mints a real public link', async ({ loginAs, prefix }) => {
    test.setTimeout(120_000);
    const { page, slug } = await loginAs(TENANT_A);
    ctx.customerName = prefix('PubLink');
    ctx.quoteId = await createQuoteViaUI(page, slug, ctx.customerName);

    // Confirm the draft via the real completion flow. The builder uses a
    // guided step accordion: open step "3 Review" to reveal the completion
    // card, then save to Job Space (confirms the draft).
    await page.getByRole('button', { name: /3 Review/i }).click();
    const saveBtn = page.getByRole('button', { name: /save & go to job space/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 15_000 });
    await saveBtn.click();
    await page.waitForURL((u) => u.pathname.includes('/summary'), { timeout: 30_000 });

    // Build the customer-facing document: the send panel refuses to mint a
    // link until customer quote lines exist ("Build your customer quote
    // first"). Add one custom line via the editor's Add Line modal, then
    // Save Quote.
    await page.goto(`${BASE_URL}/${slug}/quotes/${ctx.quoteId}/customer-edit`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /\+ add item/i }).first().click();
    // The unified Add Line modal (Custom tab, verified against the live
    // snapshot): Title placeholder "e.g. Labour - Roof installation", then
    // Qty + Unit Cost spinbuttons (Unit Cost is the last one), "Add Line".
    await page.getByPlaceholder(/roof installation/i).first().fill(`E2E public link line ${ctx.customerName}`);
    await page.getByRole('spinbutton').last().fill('123.45');
    const addLine = page.getByRole('button', { name: /^add line$/i });
    await expect(addLine).toBeEnabled({ timeout: 10_000 });
    await addLine.click();
    const lineRow = page.getByRole('row', { name: /E2E public link line/ }).first();
    await expect(lineRow).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /save quote/i }).first().click();
    await page.waitForTimeout(2500);

    // Open the send panel. Copy-URL mode mints/reuses the acceptance token
    // via the display path (applyExpiry=false): no email, no allowance use.
    await dismissOverlays(page);
    await page.getByRole('button', { name: /^send quote$/i }).first().click();
    // One-time "Test sending" tip dialog can intercept the first open;
    // continuing it marks the tip seen and opens the real send modal.
    const tipContinue = page.getByRole('button', { name: /got it - continue/i });
    if (await tipContinue.isVisible({ timeout: 4000 }).catch(() => false)) {
      await tipContinue.click();
    }
    // The send modal opens in email-compose mode; switch to the Copy URL
    // Link mode, which triggers the idempotent token generate/fetch.
    const urlMode = page.getByRole('button', { name: /copy url link/i }).first();
    await expect(urlMode).toBeVisible({ timeout: 10_000 });
    await urlMode.click();
    await page.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('input[readonly]')) as HTMLInputElement[];
      return inputs.some((i) => i.value.includes('/accept/'));
    }, undefined, { timeout: 30_000 });
    ctx.acceptUrl = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[readonly]')) as HTMLInputElement[];
      return inputs.map((i) => i.value).find((v) => v.includes('/accept/')) ?? '';
    });
    expect(ctx.acceptUrl, 'captured public URL from send panel').toContain('/accept/');
    ctx.token = ctx.acceptUrl.split('/accept/')[1]?.split(/[?#]/)[0] ?? '';
    expect(ctx.token).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('positive control: valid token serves the quote to an anonymous visitor', async ({ freshPage }) => {
    expect(ctx.acceptUrl).toBeTruthy();
    const page = await freshPage();
    const { finalUrl, bodyText } = await loadPublic(page, ctx.acceptUrl);

    // Public page: no login redirect, seeded markers present.
    expect(finalUrl).toContain('/accept/');
    await expect
      .poll(async () => page.innerText('body'), { timeout: 20_000 })
      .toContain(ctx.customerName);

    ctx.markers = [ctx.customerName];
    if (bodyText.includes(COMPANY_A)) ctx.markers.push(COMPANY_A);
    const totalMatch = bodyText.match(/(\u00A3|\$|\u20AC)\s?\d[\d,]*(?:\.\d{2})?/);
    if (totalMatch) ctx.markers.push(totalMatch[0]);
    expect(ctx.markers.length, 'at least the customer-name marker captured').toBeGreaterThan(0);
  });

  test('tampered token denies with no leak (page + raw body)', async ({ freshPage }) => {
    const last = ctx.token.slice(-1);
    const flipped = last === 'a' ? 'b' : 'a';
    const tampered = `${ctx.acceptUrl.slice(0, -1)}${flipped}`;

    const page = await freshPage();
    const { bodyText, rawBody } = await loadPublic(page, tampered);
    expect(bodyText, 'tampered link must show denial copy').toMatch(DENIAL_COPY);
    assertNoMarkersIn(bodyText, 'tampered-token page');
    assertNoMarkersIn(rawBody, 'tampered-token raw HTTP body');
  });

  test('expired token denies with no leak (page + raw body)', async ({ freshPage }) => {
    await managementSql(`UPDATE quotes SET acceptance_token_expires_at = now() - interval '1 day' WHERE id = '${ctx.quoteId}';`);

    const page = await freshPage();
    const { bodyText, rawBody } = await loadPublic(page, ctx.acceptUrl);
    expect(bodyText, 'expired link must show denial copy').toMatch(DENIAL_COPY);
    assertNoMarkersIn(bodyText, 'expired-token page');
    assertNoMarkersIn(rawBody, 'expired-token raw HTTP body');
  });

  test('withdrawn token denies with no leak (page + raw body)', async ({ freshPage }) => {
    await managementSql(`UPDATE quotes SET withdrawn_at = now() WHERE id = '${ctx.quoteId}';`);

    const page = await freshPage();
    const { bodyText, rawBody } = await loadPublic(page, ctx.acceptUrl);
    expect(bodyText, 'withdrawn link must show denial copy').toMatch(DENIAL_COPY);
    assertNoMarkersIn(bodyText, 'withdrawn-token page');
    assertNoMarkersIn(rawBody, 'withdrawn-token raw HTTP body');
  });

  test('deleted quote: token denies and fixture removed from list (teardown)', async ({ loginAs, freshPage }) => {
    const { page, slug } = await loginAs(TENANT_A);
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('domcontentloaded');

    // Confirmed quotes live on the default tab (this fixture is confirmed).
    const row = page.locator('div.group', { hasText: ctx.customerName }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.hover();
    await row.getByRole('button', { name: 'Click to delete' }).click();
    await page.getByRole('button', { name: /^delete$/i }).last().click();
    await expect(row).toBeHidden({ timeout: 15_000 });

    // The minted token must now deny for anonymous visitors.
    const pub = await freshPage();
    const { bodyText, rawBody } = await loadPublic(pub, ctx.acceptUrl);
    expect(bodyText, 'deleted quote link must show denial copy').toMatch(DENIAL_COPY);
    assertNoMarkersIn(bodyText, 'deleted-quote page');
    assertNoMarkersIn(rawBody, 'deleted-quote raw HTTP body');
  });
});
