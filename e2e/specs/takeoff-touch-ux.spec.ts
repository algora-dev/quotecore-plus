/** Keyboardless touch UX regression suite. Browser emulation only.
 * Authenticated Measure-a-job entry, real hit-tested taps, no automatic
 * retries/reloads to mask a failed journey. Original entry-failure and
 * desktop/flag-off baseline cases are retained below. @touch @ux */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { BASE_URL, cdpTouchPan, cdpTouchPinch, captureLayoutDiagnostics, evidenceShot, isChromium,
  loginAs, measureAJobEntry, settleDashboard, tapControl, touchTap, assertContainment, touchDrag } from '../helpers/touch-ux';
import { enterKeyboardlessTakeoff, addCalibrationReference, confirmCalibration, imagePoint,
  enterRailNumber, tapNamed, expectNoCanvasTextInputs, mockRoofScan } from '../helpers/keyboardless-takeoff';
const RUN = `rail-ux-${Date.now().toString(36)}`;
test.describe.configure({ mode: 'serial' });
test.describe('Keyboardless UX @touch @ux', () => {
  test('landing fits the page and cannot accidentally create calibration A', async ({ page }) => {
    test.setTimeout(300_000);
    await enterKeyboardlessTakeoff(page, `${RUN}-landing`);
    const surface = page.getByTestId('calibration-interaction-surface');
    const frame = (await surface.boundingBox())!, image = (await page.getByAltText('Plan page', { exact: true }).boundingBox())!;
    expect(image.x).toBeGreaterThanOrEqual(frame.x); expect(image.y).toBeGreaterThanOrEqual(frame.y);
    expect(image.x + image.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(image.y + image.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    const p = await imagePoint(page, 0.5, 0.5); await touchTap(page, p.x, p.y);
    await expect(page.getByTestId('calibration-point-0')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Calibrate Your Plan' })).toBeHidden();
    if (isChromium(page)) {
      await cdpTouchPan(page, p, { x: p.x + 20, y: p.y + 15 });
      await cdpTouchPinch(page, p, 70, 110);
      await expect(page.getByTestId('calibration-point-0')).toHaveCount(0);
    }
    await assertContainment(page, page.getByRole('button', { name: 'Ready to place calibration points' }), 'Ready remains reachable after pan/pinch');
    await tapNamed(page, 'Fit plan to view', true); await expectNoCanvasTextInputs(page);
    await captureLayoutDiagnostics(page, 'landing', RUN); await evidenceShot(page, RUN, 'landing');
  });
  test('568x320: keypad targets, unit override, error and orientation recovery', async ({ page }) => {
    test.setTimeout(300_000);
    await enterKeyboardlessTakeoff(page, `${RUN}-keypad`);
    await page.setViewportSize({ width: 568, height: 320 });
    await tapNamed(page, 'Ready to place calibration points');
    const a = await imagePoint(page, 0.2, 0.5), b = await imagePoint(page, 0.8, 0.5);
    await touchTap(page, a.x, a.y); await tapNamed(page, 'Confirm first point');
    await touchTap(page, b.x, b.y); await tapNamed(page, 'Confirm second point');
    await tapNamed(page, 'Confirm distance'); await expect(page.getByRole('alert').first()).toBeVisible();
    await tapNamed(page, 'Change calibration unit, currently m'); await tapNamed(page, 'Use mm for calibration');
    await enterRailNumber(page, '9150');
    const labels = ['Digit 1', 'Digit 0', 'Decimal point', 'Backspace', 'Clear number', 'Confirm distance'];
    for (const label of labels) {
      const target = page.getByRole('button', { name: label, exact: true });
      await assertContainment(page, target, label);
      const box = (await target.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(48); expect(box.height).toBeGreaterThanOrEqual(48);
    }
    await expectNoCanvasTextInputs(page); await evidenceShot(page, RUN, 'small-keypad');
    await page.setViewportSize({ width: 390, height: 844 });
    const hint = page.getByRole('button', { name: 'Dismiss turn-phone hint' });
    if (await hint.isVisible()) await tapControl(page, hint, 'Dismiss portrait hint');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByLabel('Entered distance', { exact: true })).toHaveText('9150');
    await tapNamed(page, 'Confirm distance'); await confirmCalibration(page);
  });
  test('AI edit: remote movement, four controls, dirty exit and cancellation', async ({ page }) => {
    test.setTimeout(300_000);
    await enterKeyboardlessTakeoff(page, `${RUN}-editing`);
    await addCalibrationReference(page); await confirmCalibration(page); await mockRoofScan(page);
    await tapNamed(page, 'AI Scan Assist'); await expect(page.getByTestId('outline-point-0')).toBeVisible({ timeout: 45_000 });
    // M10 P2 (D1): the AI scan notice opens with the imported outline -
    // dismiss it the way a user would before editing.
    await tapControl(page, page.getByRole('button', { name: 'Got it', exact: true }), 'Dismiss AI scan notice');
    await tapNamed(page, 'Edit points');
    for (const name of ['Previous vertex', 'Next vertex', 'Insert vertex after selected', 'Delete selected vertex']) {
      await assertContainment(page, page.getByRole('button', { name, exact: true }), name);
    }
    await tapNamed(page, 'Next vertex'); await tapNamed(page, 'Insert vertex after selected');
    await expect(page.getByRole('button', { name: 'Rearm selected outline point' })).toContainText('of 5');
    await tapNamed(page, 'Delete selected vertex');
    const p = await imagePoint(page, 0.5, 0.5);
    await touchDrag(page, p, { x: p.x + 12, y: p.y + 8 });
    if (!isChromium(page)) test.info().annotations.push({ type: 'synthetic-drag', description: 'WebKit mouse fallback; not physical touch proof.' });
    await tapNamed(page, 'Workspace menu'); await tapNamed(page, 'Back to quote', true);
    await expect(page.getByRole('dialog', { name: 'Unsaved takeoff edits' })).toBeVisible();
    await tapControl(page, page.getByRole('button', { name: 'Stay', exact: true }), 'Stay with draft');
    await tapNamed(page, 'Workspace menu');
    await expect(page.getByTestId('outline-point-0')).toBeVisible();
    const selectedBeforeSwitch = await page.getByRole('button', { name: 'Rearm selected outline point' }).textContent();
    await tapNamed(page, 'Workspace menu');
    const desktopChoice = page.getByRole('radio', { name: 'Desktop', exact: true });
    await assertContainment(page, desktopChoice, 'Desktop view choice'); await desktopChoice.tap();
    await expect(page.getByTestId('outline-editor-surface')).toHaveCount(0);
    // Desktop's oversized layout viewport must not hide this return control.
    await tapNamed(page, 'Switch to touch workspace');
    await expect(page.getByTestId('outline-point-0')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rearm selected outline point' })).toHaveText(selectedBeforeSwitch!);
    await tapNamed(page, 'Cancel outline', true);
    await expect(page.getByRole('dialog', { name: 'Unsaved outline', exact: true })).toBeVisible();
    await tapControl(page, page.getByRole('button', { name: 'Discard and continue', exact: true }), 'Discard draft');
    await expect(page.getByRole('button', { name: 'Manual Outline', exact: true })).toBeEnabled();
    await mockRoofScan(page, 2500); await tapNamed(page, 'AI Scan Assist'); await tapNamed(page, 'Cancel scan');
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('outline-point-0')).toHaveCount(0);
  });
  test('U0-B: entry failure path — no stuck/stacked Starting (verifies a03ce9cd)', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 915, height: 412 });
    const slug = await loginAs(page, 'paid-c');
    await page.goto(`${BASE_URL}/${slug}`);
    await page.waitForLoadState('domcontentloaded');
    await settleDashboard(page);

    // Fail ONLY the create server action: the route is installed AFTER the
    // plan upload completes, so the upload's own server action passes.
    const failCreateAction = () =>
      page.route(
        (url) => url.pathname === `/${slug}`,
        async (route) => {
          const req = route.request();
          if (req.method() === 'POST' && req.headers()['next-action']) {
            await page.waitForTimeout(2500);
            await route.abort('failed');
            return;
          }
          await route.continue();
        },
      );

    const cardBtn = page.getByRole('button', { name: 'Start measuring', exact: true }).first();
    await tapControl(page, cardBtn, 'dashboard Measure-a-job card button');
    const overlay = page
      .locator('div.fixed.inset-0.z-50')
      .filter({ has: page.getByRole('heading', { name: 'Measure a job' }) })
      .first();
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const nameInput = overlay.getByRole('textbox').first();
    await tapControl(page, nameInput, 'entry Job Name input');
    await nameInput.pressSequentially(`${RUN} B failpath`, { delay: 20 });
    await overlay.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), 'e2e', 'test-data', 'roof-plan-sample.png'));
    await expect(overlay.getByText('Replace')).toBeVisible({ timeout: 20_000 });
    await failCreateAction();

    const submit = overlay.locator('form button[type="submit"]');
    await tapControl(page, submit, 'entry Start measuring submit (doomed)');

    // During 'creating': exactly ONE submit control, labelled Starting...
    await page.waitForTimeout(600);
    const submitCount = await overlay.locator('form button[type="submit"]').count();
    const allButtons = await overlay.locator('button').allTextContents();
    const startingTexts = allButtons.filter((t) => /starting/i.test(t));
    expect(submitCount, 'still exactly one submit control while creating').toBe(1);
    expect(startingTexts.length, 'Starting label appears on exactly one button').toBeLessThanOrEqual(1);
    await evidenceShot(page, RUN, 'entry-creating-state');

    // After failure: spinner clears, error visible, entered data remains.
    await expect(overlay.getByText(/failed|could not|error/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(submit).toHaveText(/start measuring/i, { timeout: 15_000 });
    await expect(nameInput).toHaveValue(`${RUN} B failpath`);
    await evidenceShot(page, RUN, 'entry-failure-recovered');
  });

  test('U0-E: desktop baseline (flag ON, desktop viewport — unchanged evidence)', async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(!isChromium(page), 'baseline captured once (chromium)');
    await page.setViewportSize({ width: 1440, height: 900 });
    const slug = await loginAs(page, 'paid-c');
    await measureAJobEntry(page, slug, `${RUN} E Desktop`, `${RUN}-E`);

    // Desktop resolution: no touch shell, workstation canvas present.
    await expect(page.getByRole('button', { name: 'Workspace menu' })).toHaveCount(0);
    await page.waitForTimeout(4000); // Fabric workstation mount
    const semantics = await page.evaluate(() => ({
      hasCanvasContainer: Boolean(document.querySelector('.canvas-container, .canvas-wrapper')),
      hasFabricUpper: Boolean(document.querySelector('canvas.upper-canvas')),
      calibrationPanel: Boolean(document.querySelector('[class*="fixed"][class*="w-80"]')),
      touchSurfaceCount: document.querySelectorAll('[data-testid="calibration-interaction-surface"], [data-testid="outline-editor-surface"]').length,
      immersiveAttr: document.documentElement.getAttribute('data-takeoff-immersive'),
    }));
    test.info().annotations.push({ type: 'desktop-baseline-semantics', description: JSON.stringify(semantics) });
    expect(semantics.touchSurfaceCount, 'no touch surfaces in desktop presentation').toBe(0);
    await evidenceShot(page, `${RUN}-E`, 'desktop-takeoff-baseline');
    await captureLayoutDiagnostics(page, 'desktop-baseline', `${RUN}-E`);
  });

  test('U0-F: flag-off mobile baseline (touch flag disabled — desktop bit-for-bit)', async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(!isChromium(page), 'baseline captured once (chromium)');
    // Test-data setup (documented, reversible): temporarily disable the
    // touch flag for Paid Company C (the pro-plan fixture — starter-b lacks
    // the digital-takeoff entitlement and paywalls the entry), capture the
    // flag-off baseline, re-enable in the finally block below.
    const env = fs.readFileSync('.env.local', 'utf8');
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)![1].trim().replace(/^["']|["']$/g, '');
    const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)![1].trim().replace(/^["']|["']$/g, '');
    const accounts = await import('../config/accounts');
    const paidC = accounts.getAccount('paid-c');
    const companyIdRes = await fetch(`${url}/rest/v1/companies?slug=eq.${paidC.workspaceSlug}&select=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const companyId = (await companyIdRes.json())[0]?.id as string;
    const setFlag = async (enabled: boolean) => {
      const res = await fetch(`${url}/rest/v1/rpc/set_takeoff_touch_flag`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_company_id: companyId, p_enabled: enabled }),
      });
      if (!res.ok) throw new Error(`set_takeoff_touch_flag(${enabled}) -> HTTP ${res.status}`);
    };
    await setFlag(false);
    try {
      await page.setViewportSize({ width: 412, height: 915 }); // phone, flag off
      const slug = await loginAs(page, 'paid-c');
      await measureAJobEntry(page, slug, `${RUN} F FlagOff`, `${RUN}-F`);

      await expect(page.getByRole('button', { name: 'Workspace menu' })).toHaveCount(0);
      await page.waitForTimeout(4000);
      const semantics = await page.evaluate(() => ({
        hasFabricUpper: Boolean(document.querySelector('canvas.upper-canvas')),
        touchSurfaceCount: document.querySelectorAll('[data-testid="calibration-interaction-surface"], [data-testid="outline-editor-surface"]').length,
        immersiveAttr: document.documentElement.getAttribute('data-takeoff-immersive'),
        railCount: document.querySelectorAll('[aria-label="Takeoff controls"]').length,
      }));
      test.info().annotations.push({ type: 'flag-off-semantics', description: JSON.stringify(semantics) });
      expect(semantics.touchSurfaceCount, 'flag off = no touch surfaces even on a phone').toBe(0);
      expect(semantics.railCount, 'flag off = no touch rail').toBe(0);
      await evidenceShot(page, `${RUN}-F`, 'flagoff-mobile-baseline');
      await captureLayoutDiagnostics(page, 'flagoff-mobile-baseline', `${RUN}-F`);
    } finally {
      await setFlag(true); // restore the pre-U0 dev-DB state
    }
  });
});
