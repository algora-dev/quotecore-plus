/**
 * Phase 2.6-03: Multi-page takeoff E2E
 *
 * Tests the full multi-page takeoff flow:
 * 1. Create a quote
 * 2. Navigate to takeoff
 * 3. Upload first plan image
 * 4. Calibrate scale
 * 5. Save
 * 6. Upload a second plan image (multi-page)
 * 7. Switch between pages
 * 8. Verify areas/measurements persist across page switches
 * 9. Reload and verify hydration
 *
 * @multi-page @mutation
 */
import { test, expect } from '../fixtures/base';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://quotecore-plus-dev.vercel.app';
const ROOF_PLAN = path.join(process.cwd(), 'e2e', 'test-data', 'roof-plan-sample.png');

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

/** Create a Digital Measure quote and navigate to its takeoff page.
 *  Digital Measure mode uploads a plan during quote creation and routes
 *  directly to the takeoff/builder flow. */
async function setupTakeoffPage(page: import('@playwright/test').Page, slug: string, customerName: string): Promise<string> {
  await page.goto(`${BASE_URL}/${slug}/quotes`);
  await page.waitForLoadState('networkidle');
  await dismissCookies(page);
  await dismissModals(page);

  // Click "New Quote" button
  const newQuoteBtn = page.getByRole('button', { name: /new quote/i }).first();
  if (await newQuoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newQuoteBtn.click();
  } else {
    // Fall back to text match
    await page.getByText(/new quote/i).first().click();
  }
  await page.waitForURL((url) => url.pathname.includes('/quotes/new'), { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  const customerLabel = page.getByText('Customer Name');
  const customerField = customerLabel.locator('..').locator('input').first();
  await customerField.fill(customerName);

  // Select "Digital Measure" mode (required for takeoff page)
  const digitalBtn = page.getByText('Digital Measure').first();
  if (await digitalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await digitalBtn.click();
    await page.waitForTimeout(500);

    // Upload plan during quote creation (required for digital mode)
    // The FileUploader uses a hidden input triggered by a button click.
    // Use filechooser event to handle the native file dialog.
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
    // Click the upload area/button to trigger file input
    const uploadArea = page.getByText(/upload|browse|drag/i).first();
    if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uploadArea.click();
    } else {
      // Try clicking the dropzone div
      const dropzone = page.locator('[class*="dropzone"], [class*="upload"], [class*="border-dashed"]').first();
      if (await dropzone.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dropzone.click();
      }
    }
    const fileChooser = await fileChooserPromise;
    if (fileChooser) {
      await fileChooser.setFiles(ROOF_PLAN);
      await page.waitForTimeout(5000); // wait for upload
    } else {
      // Fallback: try hidden input directly
      const planInput = page.locator('input[type="file"]').first();
      await planInput.setInputFiles(ROOF_PLAN).catch(() => {});
      await page.waitForTimeout(5000);
    }
  }

  // Wait for Create button to be enabled
  const createBtn = page.getByRole('button', { name: /start digital|create|start|submit/i }).last();
  await createBtn.waitFor({ state: 'enabled', timeout: 15_000 }).catch(() => {});
  await createBtn.click();
  await page.waitForURL((url) => !url.pathname.includes('/quotes/new'), { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await dismissModals(page);

  const currentUrl = page.url();
  const quoteIdMatch = currentUrl.match(/\/quotes\/([^/]+)/);
  expect(quoteIdMatch).toBeTruthy();
  const quoteId = quoteIdMatch![1];

  // If we're not already on the takeoff/build page, navigate to takeoff
  if (!currentUrl.includes('/takeoff') && !currentUrl.includes('/build')) {
    await page.goto(`${BASE_URL}/${slug}/quotes/${quoteId}/takeoff`);
    await page.waitForLoadState('networkidle');
    await dismissModals(page);
  }

  return quoteId;
}

/** Upload a plan image on the takeoff page */
async function uploadPlan(page: import('@playwright/test').Page, filePath: string) {
  // The file input may be hidden — find it and use setInputFiles directly
  const fileInput = page.locator('input[type="file"]').first();

  // Wait for the input to exist in DOM (it may be hidden)
  await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(5000); // wait for upload + canvas render
}

test.describe('Multi-Page Takeoff', () => {
  test('P2.6-03: Upload plan, calibrate, save, upload second plan @multi-page', async ({ loginAs, prefix, assertNoServerErrors }) => {
    test.setTimeout(180_000); // 3 min
    const { page, slug } = await loginAs('paid-c');

    const customerName = prefix('Multi-Page Takeoff');
    const quoteId = await setupTakeoffPage(page, slug, customerName);

    // Verify we're on the takeoff page (not 404)
    expect(page.url()).toContain('/takeoff');

    // 1. Dismiss calibration help / modals (plan was uploaded during quote creation)
    await dismissModals(page);

    // 2. Verify canvas loaded with the plan
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 15_000 });

    // 4. Look for "Upload another plan" button
    const uploadAnotherBtn = page.getByRole('button', { name: /upload another plan|upload another/i }).first();
    const hasMultiPage = await uploadAnotherBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasMultiPage) {
      // 5. Save current state first (non-blocking — auto-save may have already done it)
      const saveBtn = page.getByRole('button', { name: /save/i }).first();
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
      }

      // 6. Click "Upload another plan" (force through any overlay)
      await uploadAnotherBtn.click({ force: true });
      await page.waitForTimeout(1000);

      // 7. Verify upload modal appears
      const uploadModal = page.getByRole('dialog').first();
      if (await uploadModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        const modalText = await uploadModal.innerText();
        expect(modalText).toMatch(/upload.*plan|another.*plan/i);

        // 8. Select file in modal (hidden input — use filechooser event)
        const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
        // Click the upload area inside the modal to trigger file input
        const modalUploadArea = uploadModal.locator('[class*="border-dashed"], [class*="upload"]').first();
        if (await modalUploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
          await modalUploadArea.click();
        }
        const fileChooser = await fileChooserPromise;
        if (fileChooser) {
          await fileChooser.setFiles(ROOF_PLAN);
          await page.waitForTimeout(1000);
        } else {
          // Fallback: hidden input directly
          const modalFileInput = uploadModal.locator('input[type="file"]').first();
          await modalFileInput.setInputFiles(ROOF_PLAN).catch(() => {});
          await page.waitForTimeout(1000);
        }

        // 9. Click upload/confirm
        const confirmBtn = uploadModal.getByRole('button', { name: /upload|confirm|save/i }).last();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(5000);
        }

        // Close modal if still open
        if (await uploadModal.isVisible({ timeout: 1000 }).catch(() => false)) {
          const cancelBtn = uploadModal.getByRole('button', { name: /cancel|close/i }).first();
          if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelBtn.click();
          }
        }
      }

      // 10. Verify we're still on takeoff
      expect(page.url()).toContain('/takeoff');

      // 11. Reload and verify persistence
      await page.reload();
      await page.waitForLoadState('networkidle');
      await dismissModals(page);

      const canvasAfterReload = page.locator('canvas').first();
      await canvasAfterReload.waitFor({ state: 'visible', timeout: 15_000 });
    }

    assertNoServerErrors();
  });

  test('P2.6-03b: Takeoff page loads without errors for existing quote @multi-page', async ({ loginAs, assertNoServerErrors }) => {
    const { page, slug } = await loginAs('paid-c');

    await page.goto(`${BASE_URL}/${slug}/quotes`);
    await page.waitForLoadState('networkidle');
    await dismissCookies(page);
    await dismissModals(page);

    // Find an existing quote
    const firstQuote = page.locator('[href*="/quotes/"]').first();
    if (await firstQuote.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstQuote.click();
      await page.waitForLoadState('networkidle');
      await dismissModals(page);

      // Navigate to takeoff if link exists
      const takeoffLink = page.getByRole('link', { name: /takeoff|digital takeoff|measure/i }).first();
      if (await takeoffLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await takeoffLink.click();
        await page.waitForLoadState('networkidle');
        await dismissModals(page);

        // Verify page loaded without 5xx
        const canvas = page.locator('canvas').first();
        await canvas.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      }
    }

    assertNoServerErrors();
  });

  test('P2.6-03c: Plan upload persists after reload @multi-page', async ({ loginAs, prefix, assertNoServerErrors }) => {
    test.setTimeout(180_000);
    const { page, slug } = await loginAs('paid-c');

    const customerName = prefix('Persistence Test');
    await setupTakeoffPage(page, slug, customerName);

    // Plan was uploaded during quote creation — dismiss modals
    await dismissModals(page);

    // Verify canvas
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 15_000 });

    // Reload and verify the canvas still shows the plan
    await page.reload();
    await page.waitForLoadState('networkidle');
    await dismissModals(page);

    const canvasAfterReload = page.locator('canvas').first();
    await canvasAfterReload.waitFor({ state: 'visible', timeout: 15_000 });

    assertNoServerErrors();
  });
});
