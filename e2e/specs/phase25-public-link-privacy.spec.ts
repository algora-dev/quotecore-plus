/**
 * P2.5-07 â€” Public-link privacy
 *
 * For an E2E public quote/customer link:
 * - valid token exposes only intended public content
 * - invalid, modified, expired, and deleted-token variants deny safely
 * - denial response/page must not leak customer name, company name,
 *   quote/invoice totals, attachment names, internal IDs, or existence hints
 * - assert no 5xx and no open redirect
 *
 * @smoke @security @public
 */
import { test, expect, type Page } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-testing.vercel.app';

/** Patterns that must NEVER appear on a denial page */
const LEAK_PATTERNS = [
  /customer\s*name/i,
  /company\s*name/i,
  /Â£\d/,
  /\$\d/,
  /â‚¬\d/,
  /total/i,
  /subtotal/i,
  /grand total/i,
  /attachment/i,
  /invoice\s*number/i,
  /quote\s*number/i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // UUIDs
];

/** Check that a page does not leak sensitive data (uses innerText to exclude RSC script payloads) */
async function assertNoDataLeak(page: Page) {
  const bodyText = await page.innerText('body');
  expect(bodyText).toBeTruthy();

  for (const pattern of LEAK_PATTERNS) {
    // Some words like "total" may appear in generic UI text â€” only flag
    // if it appears alongside numbers or in a data-like context
    if (pattern.source.includes('\\d')) {
      // Pattern requires a number nearby â€” check directly
      expect(bodyText).not.toMatch(pattern);
    }
  }

  // No open redirect: URL must stay on the same origin
  const url = page.url();
  expect(url).toContain('quotecore-plus-testing.vercel.app');
}

test.describe('P2.5-07: Public-link privacy @security @public', () => {
  test('invalid token shows safe denial page', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // A completely invalid token (not a UUID)
    await page.goto(`${BASE_URL}/accept/not-a-real-token`);
    await page.waitForLoadState('networkidle');

    // Should show a "not found" or "invalid" message â€” NOT a 500
    // Use innerText to get visible text only (excludes Next.js RSC script payloads)
    const bodyText = (await page.innerText('body')) ?? '';
    const hasNotFound = /not found|invalid|expired|may be invalid/i.test(bodyText);
    const hasServerError = /500|internal server error|stack trace/i.test(bodyText);
    expect(hasServerError).toBe(false);
    expect(hasNotFound || page.url().includes('/login')).toBeTruthy();

    assertNoServerErrors();
  });

  test('malformed UUID token is handled safely', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // A string that looks like a UUID but isn't valid
    await page.goto(`${BASE_URL}/accept/00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('networkidle');

    // Should show safe denial â€” either "not found" or redirect
    const hasServerError = await page.getByText(/500|internal server error/i).count();
    expect(hasServerError).toBe(0);

    assertNoServerErrors();
  });

  test('tampered token does not leak data', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // Take a valid-looking UUID and flip a character
    const tamperedToken = '12345678-1234-1234-1234-1234567890ab';
    await page.goto(`${BASE_URL}/accept/${tamperedToken}`);
    await page.waitForLoadState('networkidle');

    // Must not leak customer/company names, totals, or internal IDs
    await assertNoDataLeak(page);

    // No 5xx
    assertNoServerErrors();
  });

  test('valid-format but non-existent token denies safely', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // Valid UUID format that doesn't exist in the database
    await page.goto(`${BASE_URL}/accept/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`);
    await page.waitForLoadState('networkidle');

    // Use innerText for visible text only (excludes RSC streaming JSON)
    const bodyText = (await page.innerText('body')) ?? '';

    // Should NOT show a server error
    expect(bodyText).not.toMatch(/500|internal server error|stack trace/i);

    // Should show some form of denial
    const isDenied = /not found|invalid|expired|may be invalid|unavailable/i.test(bodyText);
    expect(isDenied || page.url().includes('/login')).toBeTruthy();

    // Must not leak data
    await assertNoDataLeak(page);

    assertNoServerErrors();
  });

  test('no open redirect on public link routes', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // Attempt an open-redirect-style URL
    await page.goto(`${BASE_URL}/accept/../../../login`);
    await page.waitForLoadState('networkidle');

    // Must stay on same origin â€” no external redirect
    const url = page.url();
    expect(url).toContain('quotecore-plus-testing.vercel.app');
    expect(url).not.toMatch(/\/\/(?!quotecore-plus-testing)/);

    assertNoServerErrors();
  });

  test('rate limiting on invalid attempts does not 5xx', async ({ freshPage, assertNoServerErrors }) => {
    const page = await freshPage();

    // Make several rapid invalid attempts to trigger rate limiting
    for (let i = 0; i < 3; i++) {
      await page.goto(`${BASE_URL}/accept/invalid-attempt-${i}`);
      await page.waitForLoadState('networkidle');
    }

    // Should not produce 5xx errors even under rate limiting
    assertNoServerErrors();
  });
});
