/** Real-app helpers. No click injection, forced taps, automatic reload/retry,
 * overlay hiding, or native input filling inside the takeoff canvas. */
import { expect, type Page } from '@playwright/test';
import { loginAs, measureAJobEntry, assertContainment, touchTap, waitForTouchWorkspace } from './touch-ux';

export async function enterKeyboardlessTakeoff(page: Page, run: string) {
  // Entry job-name form may still use the OS keyboard. Keyboardless scope is
  // the digital takeoff workspace, not the dashboard or quote builder.
  await page.setViewportSize({ width: 844, height: 390 });
  const slug = await loginAs(page, 'paid-c');
  const result = await measureAJobEntry(page, slug, run, run);
  await waitForTouchWorkspace(page);
  await expect(page.getByRole('button', { name: 'Ready to place calibration points', exact: true })).toBeEnabled({ timeout: 30_000 });
  return { ...result, slug, takeoffUrl: page.url() };
}
export async function tapNamed(page: Page, name: string, secondary = false) {
  const button = page.getByRole('button', { name, exact: true });
  // Secondary settings can scroll within the rail. Primary actions must pass
  // containment WITHOUT first scrolling, so a hidden primary fails the test.
  if (secondary) await button.scrollIntoViewIfNeeded();
  await assertContainment(page, button, name);
  await button.tap();
}
export async function enterRailNumber(page: Page, text: string) {
  for (const char of text) await tapNamed(page, char === '.' ? 'Decimal point' : `Digit ${char}`);
}
export async function imagePoint(page: Page, fx: number, fy: number) {
  const image = page.getByAltText('Plan page', { exact: true });
  await expect(image).toBeVisible();
  const rect = await image.boundingBox();
  expect(rect).not.toBeNull();
  return { x: rect!.x + rect!.width * fx, y: rect!.y + rect!.height * fy };
}
export async function addCalibrationReference(page: Page, value = '10', y = 0.55) {
  await tapNamed(page, 'Ready to place calibration points');
  const a = await imagePoint(page, 0.25, y), b = await imagePoint(page, 0.75, y);
  await touchTap(page, a.x, a.y);
  await tapNamed(page, 'Confirm first point');
  await touchTap(page, b.x, b.y);
  await tapNamed(page, 'Confirm second point');
  await expect(page.getByRole('group', { name: 'Known distance keypad' })).toBeVisible();
  await enterRailNumber(page, value);
  await tapNamed(page, 'Confirm distance');
}
export async function confirmCalibration(page: Page) {
  await tapNamed(page, 'Confirm calibration and continue');
  await expect(page.getByRole('button', { name: 'Manual Outline', exact: true })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId('outline-editor-surface')).toBeVisible();
}
export async function manualRectangle(page: Page) {
  await tapNamed(page, 'Manual Outline');
  for (const [x, y] of [[0.3, 0.3], [0.7, 0.3], [0.7, 0.65], [0.3, 0.65]]) {
    const p = await imagePoint(page, x, y);
    await touchTap(page, p.x, p.y);
    await tapNamed(page, 'Confirm point');
  }
  await tapNamed(page, 'Close outline');
}
export async function mockRoofScan(page: Page, delayMs = 0) {
  const dims = await page.getByAltText('Plan page', { exact: true }).evaluate((element) => {
    const img = element as HTMLImageElement;
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    return { w: img.naturalWidth * scale, h: img.naturalHeight * scale };
  });
  await page.route('**/api/takeoff/ai-scan-v3*', async route => {
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, data: { roof_areas: [{ name: 'AI name must not override Main Roof', pitch_degrees: 40,
        points: [[0.3, 0.3], [0.7, 0.3], [0.7, 0.65], [0.3, 0.65]].map(([x, y]) => ({ x: dims.w * x, y: dims.h * y })) }] }, summary: { notes: [] },
    }) });
  });
}
export async function expectNoCanvasTextInputs(page: Page) {
  const rail = page.locator('[aria-label="Takeoff controls"]');
  await expect(rail.locator('input, textarea, [contenteditable="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? ''))).toBe(false);
  // This establishes no native editable control was focused, not physical
  // iOS keyboard behaviour. That remains in the owner-device checklist.
}
