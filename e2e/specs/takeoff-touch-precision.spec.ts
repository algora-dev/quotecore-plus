/** Keyboardless production-app journeys. Real local Next server + dev DB,
 * mocked AI only. These are browser emulation, not physical iOS evidence.
 * Run with playwright.touch.config.ts; zero forced/programmatic clicks. @touch */
import { test, expect } from '@playwright/test';
import { enterKeyboardlessTakeoff, addCalibrationReference, confirmCalibration, manualRectangle,
  mockRoofScan, tapNamed, enterRailNumber, expectNoCanvasTextInputs } from '../helpers/keyboardless-takeoff';
import { waitForTouchWorkspace } from '../helpers/touch-ux';
const RUN = `keyboardless-${Date.now().toString(36)}`;
test.describe.configure({ mode: 'serial' });
test.describe('Keyboardless precision @touch', () => {
  test('manual calibration, exact pitch, manual outline, save to builder and reload', async ({ page }) => {
    test.setTimeout(360_000);
    const { slug, quoteId, takeoffUrl } = await enterKeyboardlessTakeoff(page, `${RUN}-manual`);
    await tapNamed(page, 'Type roof pitch, currently 25 degrees', true);
    await enterRailNumber(page, '32.5'); await tapNamed(page, 'Confirm pitch');
    await tapNamed(page, 'Increase pitch by one degree', true);
    await addCalibrationReference(page); await confirmCalibration(page);
    await manualRectangle(page); await tapNamed(page, 'Done');
    await expect(page.getByRole('button', { name: 'Type roof pitch, currently 33.5 degrees' })).toBeVisible();
    await expectNoCanvasTextInputs(page);
    await tapNamed(page, 'Save & finish');
    await page.waitForURL(`**/${slug}/quotes/${quoteId}/build?step=roof-areas`, { timeout: 60_000 });
    await expect(page.getByText('Main Roof', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText('Main Roof', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    // Reopen acknowledged geometry and edit in place, not create another roof.
    await page.goto(takeoffUrl); await waitForTouchWorkspace(page);
    await expect(page.getByRole('button', { name: 'Manual Outline', exact: true })).toBeEnabled({ timeout: 30_000 });
    const existing = page.getByText('Existing roof outlines', { exact: true });
    await existing.scrollIntoViewIfNeeded(); await existing.tap();
    await tapNamed(page, 'Main Roof', true);
    await tapNamed(page, 'Insert vertex after selected', true);
    await tapNamed(page, 'Done'); await tapNamed(page, 'Save & finish');
    await page.waitForURL('**/build?step=roof-areas', { timeout: 60_000 });
    await expect(page.getByText('Main Roof', { exact: true }).first()).toBeVisible();
  });
  test('unchanged AI outline can be accepted with Main Roof and default pitch', async ({ page }) => {
    test.setTimeout(300_000);
    await enterKeyboardlessTakeoff(page, `${RUN}-ai`);
    await addCalibrationReference(page); await confirmCalibration(page); await mockRoofScan(page);
    await tapNamed(page, 'AI Scan Assist');
    await expect(page.getByTestId('outline-point-0')).toBeVisible({ timeout: 45_000 });
    await tapNamed(page, 'Done');
    await expect(page.getByRole('button', { name: 'Type roof pitch, currently 25 degrees' })).toBeVisible();
    await expect(page.getByText('AI name must not override Main Roof', { exact: true })).toHaveCount(0);
    await expectNoCanvasTextInputs(page); await tapNamed(page, 'Save & finish');
    await page.waitForURL('**/build?step=roof-areas', { timeout: 60_000 });
  });
  test('three references are optional and the fourth is unavailable', async ({ page }) => {
    test.setTimeout(300_000);
    await enterKeyboardlessTakeoff(page, `${RUN}-three`);
    for (let i = 0; i < 3; i++) {
      await addCalibrationReference(page, '10', 0.3 + i * 0.2);
      if (i < 2) await tapNamed(page, 'Calibrate another length', true);
    }
    await expect(page.getByRole('button', { name: 'Calibrate another length', exact: true })).toHaveCount(0);
    await confirmCalibration(page);
    // Persisted calibration-only page must survive without roof geometry.
    await page.reload(); await waitForTouchWorkspace(page);
    await expect(page.getByRole('button', { name: 'Manual Outline', exact: true })).toBeEnabled({ timeout: 30_000 });
  });
  test('measurement-persist failure retains draft; retry resumes existing parent', async ({ page }) => {
    test.setTimeout(300_000);
    const { quoteId } = await enterKeyboardlessTakeoff(page, `${RUN}-retry`);
    await addCalibrationReference(page); await confirmCalibration(page); await manualRectangle(page); await tapNamed(page, 'Done');
    let failed = false;
    let parentCreates = 0;
    page.on('request', request => {
      const text = request.postData() ?? '';
      if (request.method() === 'POST' && request.headers()['next-action'] && text.includes(quoteId)
        && text.includes('Main Roof') && !text.includes('componentId')) parentCreates++;
    });
    await page.route('**/takeoff*', async route => {
      const request = route.request(), body = request.postData() ?? '';
      // Fail BEFORE delivery, not after committing a real DB transaction.
      if (!failed && request.method() === 'POST' && request.headers()['next-action'] && body.includes(quoteId) && body.includes('componentId')) {
        failed = true; await route.abort('failed'); return;
      }
      await route.continue();
    });
    await tapNamed(page, 'Save & finish');
    await expect(page.getByRole('alert').filter({ hasText: /outline is kept/i })).toBeVisible({ timeout: 60_000 });
    expect(failed).toBe(true); expect(page.url()).toContain('/takeoff');
    await expect(page.getByTestId('outline-point-0')).toBeVisible();
    await tapNamed(page, 'Save & finish'); await page.waitForURL('**/build?step=roof-areas', { timeout: 60_000 });
    expect(parentCreates, 'retry must reuse the already-created parent').toBe(1);
  });
});
