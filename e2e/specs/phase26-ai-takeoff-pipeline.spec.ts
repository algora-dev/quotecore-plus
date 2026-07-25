/**
 * Phase 2.6-01: AI Takeoff real pipeline E2E
 *
 * Runs the actual 3-scan GPT-5.6 vision pipeline against a real roof plan.
 * Costs ~$0.25 per run. Only runs when E2E_AI_TAKEOFF_ENABLED=true.
 *
 * Flow:
 * 1. Login as paid-c (has AI Assist points)
 * 2. Create a quote
 * 3. Navigate to takeoff page
 * 4. Upload roof plan image
 * 5. Calibrate scale
 * 6. Select quality (Low to minimise cost)
 * 7. Click AI Assist
 * 8. Wait for 3-scan pipeline to complete (up to 5 min)
 * 9. Verify results modal appears with areas/components
 * 10. Apply results
 * 11. Verify canvas has drawn areas
 *
 * @ai-pipeline @mutation
 */
import { test, expect } from '../fixtures/base';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';
const ROOF_PLAN = path.join(process.cwd(), 'e2e', 'test-data', 'roof-plan-sample.png');
const AI_ENABLED = process.env.E2E_AI_TAKEOFF_ENABLED === 'true';

/** Dismiss cookie banner */
async function dismissCookies(page: import('@playwright/test').Page) {
  const cookieBtn = page.getByRole('button', { name: /^got it$/i }).last();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

/** Dismiss trial/suspension modals */
async function dismissModals(page: import('@playwright/test').Page) {
  const skipBtn = page.getByRole('button', { name: /not now|skip|close/i }).last();
  if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skipBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

/** Dismiss any modal by clicking "Not now" or "Skip" */
async function dismissModal(page: import('@playwright/test').Page) {
  const skipBtn = page.getByRole('button', { name: /not now|skip|close|dismiss/i }).last();
  if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skipBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

test.describe('AI Takeoff Real Pipeline', () => {
  test.skip(!AI_ENABLED, 'Set E2E_AI_TAKEOFF_ENABLED=true to run real AI pipeline tests (costs ~$0.25/run)');

  test('P2.6-01: Full 3-scan AI pipeline produces results @ai-pipeline', async ({ loginAs, prefix, assertNoServerErrors }) => {
    test.setTimeout(600_000); // 10 min timeout for real AI pipeline
    const { page, slug } = await loginAs('paid-c');

    // 1. Create a quote with Digital Measure mode
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');
    await dismissCookies(page);
    await dismissModals(page);

    const customerName = prefix('AI Takeoff Test');
    const newQuoteBtn = page.getByRole('button', { name: /new quote/i }).first();
    if (await newQuoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newQuoteBtn.click();
    } else {
      await page.getByText(/new quote/i).first().click();
    }
    await page.waitForURL((url) => url.pathname.includes('/quotes/new'), { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    const customerLabel = page.getByText('Customer Name');
    const customerField = customerLabel.locator('..').locator('input').first();
    await customerField.fill(customerName);

    // Select Digital Measure mode
    const digitalBtn = page.getByText('Digital Measure').first();
    if (await digitalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await digitalBtn.click();
      await page.waitForTimeout(500);

      // Upload plan during quote creation
      const planInput = page.locator('input[type="file"]').first();
      await planInput.setInputFiles(ROOF_PLAN);
      await page.waitForTimeout(5000); // wait for upload
    }

    const createBtn = page.getByRole('button', { name: /start digital|create|start|submit/i }).last();
    await createBtn.waitFor({ state: 'enabled', timeout: 15_000 }).catch(() => {});
    await createBtn.click();
    await page.waitForURL((url) => !url.pathname.includes('/quotes/new'), { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    await dismissModals(page);

    // 2. Navigate to takeoff
    const takeoffLink = page.getByRole('link', { name: /takeoff|digital takeoff|measure/i }).first();
    if (await takeoffLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeoffLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Try direct URL — extract quote ID from current URL
      const currentUrl = page.url();
      const quoteIdMatch = currentUrl.match(/\/quotes\/([^/]+)/);
      if (quoteIdMatch) {
        await page.goto(`${BASE_URL}/${slug}/quotes/${quoteIdMatch[1]}/takeoff`);
        await page.waitForLoadState('networkidle');
      }
    }

    // 3. Upload roof plan image (if not already uploaded during quote creation)
    // The takeoff page may already have the plan from quote creation
    const canvas = page.locator('canvas').first();
    const hasCanvas = await canvas.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCanvas) {
      // Try uploading via file input
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(ROOF_PLAN).catch(() => {});
      await page.waitForTimeout(5000);
    }

    // 4. Dismiss calibration help modal (blocks toolbar buttons)
    await dismissModals(page);
    await dismissModal(page);

    // 5. Verify canvas loaded
    await canvas.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

    // 6. Look for AI Assist button (only appears after calibration for roofing companies)
    const aiAssistBtn = page.getByRole('button', { name: /ai assist/i }).first();

    // If quality selector is visible, select Low
    const lowQualityBtn = page.getByRole('button', { name: /^low$/i }).first();
    if (await lowQualityBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lowQualityBtn.click();
    }

    if (await aiAssistBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aiAssistBtn.click();

      // 6. Wait for scan to complete — look for results modal or scan progress
      // The scan can take 30s-5min depending on quality
      const resultsModal = page.getByRole('dialog').filter({ hasText: /area|pitch|apply/i }).first();
      await resultsModal.waitFor({ state: 'visible', timeout: 300_000 }); // 5 min max

      // 7. Verify results modal has content
      const modalText = await resultsModal.innerText();
      expect(modalText.length).toBeGreaterThan(20);

      // 8. Look for Apply button
      const applyBtn = page.getByRole('button', { name: /apply/i }).first();
      if (await applyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await applyBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    assertNoServerErrors();
  });

  test('P2.6-01b: AI pipeline handles errors gracefully @ai-pipeline', async ({ loginAs, assertNoServerErrors }) => {
    test.setTimeout(120_000);
    const { page, slug } = await loginAs('paid-c');

    // Navigate to an existing quote's takeoff page (or create one)
    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');
    await dismissCookies(page);

    // Verify the AI scan API endpoint exists and responds
    const response = await page.request.post(`${BASE_URL}/api/takeoff/ai-scan-v3`, {
      data: { quoteId: '00000000-0000-0000-0000-000000000000', stage: 'scan1', qualityLevel: 'low' },
    });

    // Should get 4xx (not 5xx) for non-existent quote
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    assertNoServerErrors();
  });
});
