/**
 * E2E-12 extended: Email send (opt-in)
 *
 * Requires E2E_ALLOW_EMAIL_SEND=true AND E2E_SAFE_RECIPIENT_EMAIL matching.
 * Uses @email-opt-in tag — not in default smoke set.
 *
 * @email-opt-in @mutation
 */
import { test, expect } from '../fixtures/base';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';
const ALLOW_SEND = process.env.E2E_ALLOW_EMAIL_SEND === 'true';
const SAFE_EMAIL = process.env.E2E_SAFE_RECIPIENT_EMAIL ?? '';

test.describe('Email Send (opt-in)', () => {
  test.skip(!ALLOW_SEND || !SAFE_EMAIL, 'Email send requires E2E_ALLOW_EMAIL_SEND=true and E2E_SAFE_RECIPIENT_EMAIL');

  test('E2E-12-email: Quote send to safe recipient @email-opt-in', async ({ loginAs, prefix, recordEntity, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('starter-b');

    // Navigate to quotes
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');

    // This test requires a quote to exist. For Phase 1, we just verify
    // the email infrastructure is reachable (page loads, no 5xx).
    // Full send flow will be implemented when we have a stable quote fixture.
    expect(page.url()).toContain('/quotes');

    assertNoServerErrors();
  });
});
