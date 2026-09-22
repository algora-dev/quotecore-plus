/**
 * U0 (2026-09-22) — HONEST UX-tier reproduction + baseline suite.
 *
 * Implements review spec §9.1/§9.2/§9.3 for phase U0 of
 * mobile-takeoff-ux-review-2026-09-22:
 *  - real "Measure a job" entry, real taps (locator.tap / touchscreen.tap),
 *    containment + elementFromPoint hit-target checks before every measured
 *    action, no evaluate-clicks, no force, no hidden overlays;
 *  - reproduction attempts for the 7 owner findings (2026-09-21 handoff);
 *  - desktop + flag-off baselines so later phases can prove nothing changed;
 *  - bounded layout diagnostics (§9.3) written OUTSIDE the repo.
 *
 * Emulation tiers only (touch-chromium / touch-webkit); multi-touch gestures
 * use Chromium CDP touch events. NOT physical-device evidence.
 *
 * Runs ONLY via `npx playwright test -c playwright.touch.config.ts`.
 *
 * @touch @ux
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  BASE_URL,
  cdpTouchPan,
  cdpTouchPinch,
  captureLayoutDiagnostics,
  evidenceShot,
  isChromium,
  loginAs,
  measureAJobEntry,
  settleDashboard,
  tapControl,
  touchTap,
  waitForTouchWorkspace,
} from '../helpers/touch-ux';

const RUN = `u0ux-${Date.now().toString(36)}`;

/** ── Shared honest calibration journey (measured, tapped for real) ─────── */

interface CalibrationFindings {
  doubleManualStart: boolean;
  dragHandlePresent: boolean;
  sheetCoversPlanFraction: number | null;
  railControlCount: number;
}

/** Owner finding 4 evidence + honest dismissal: the DESKTOP workstation's
 *  first-time "Calibrate Your Plan" help modal renders over the touch
 *  workspace on every uncalibrated entry (and re-appears after reload). */
async function dismissDesktopHelpModal(page: import('@playwright/test').Page, runId: string, tag: string): Promise<void> {
  const desktopHelpModal = page.getByRole('heading', { name: 'Calibrate Your Plan' });
  if (await desktopHelpModal.isVisible({ timeout: 2500 }).catch(() => false)) {
    await evidenceShot(page, runId, `desktop-help-modal-bleedthrough-${tag}`);
    test.info().annotations.push({ type: 'finding-4-desktop-help-modal-over-touch', description: `reproduced (${tag})` });
    await tapControl(page, page.getByRole('button', { name: /got it, let's calibrate/i }), 'desktop help modal Got it');
    await page.waitForTimeout(500);
  }
}

async function calibrateHonestly(page: import('@playwright/test').Page, runId: string): Promise<CalibrationFindings> {
  // ── U0 REPRODUCTION CAPTURE: first-ever entry state ──────────────────
  // The desktop workstation mounts UNDER the touch shell; its first-time
  // "Calibrate Your Plan" help modal can bleed through (owner finding 4),
  // and the touch flow can land in the OUTLINE phase because the page-1
  // takeoff_pages row only exists after the workstation's mount effect —
  // the server render that decides the initial phase races it.
  await dismissDesktopHelpModal(page, runId, 'entry');

  const calibSurface = page.locator('[data-testid="calibration-interaction-surface"]');
  if (!(await calibSurface.isVisible({ timeout: 3000 }).catch(() => false))) {
    // Entry-phase race: touch landed in the uncalibrated OUTLINE phase.
    await evidenceShot(page, runId, 'entry-phase-race-outline-uncalibrated');
    test.info().annotations.push({ type: 'u0-new-entry-phase-race', description: 'Measure-a-job first entry: touch flow starts in OUTLINE phase (page-1 row not yet in hydration)' });
    await tapControl(page, page.getByRole('button', { name: 'Calibrate this page' }), 'Calibrate this page (recovery)');
  }

  await expect(calibSurface).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Calibration' })).toBeVisible();

  // Owner finding 5: is a SECOND manual-start step required on entry?
  const beginManual = page.getByRole('button', { name: 'Set the scale manually with two points' });
  const doubleManualStart = await beginManual.isVisible({ timeout: 3000 }).catch(() => false);
  if (doubleManualStart) {
    await tapControl(page, beginManual, 'Set the scale manually with two points');
  }

  const surface = page.locator('[data-testid="calibration-interaction-surface"]');
  const box = (await surface.boundingBox())!;
  expect(box, 'calibration surface box').not.toBeNull();

  // Place A / B with REAL touch taps; accept via honest rail taps.
  await touchTap(page, box.x + box.width * 0.3, box.y + box.height * 0.35);
  await tapControl(page, page.getByRole('button', { name: 'The point is correct - continue' }), 'accept point A');
  await touchTap(page, box.x + box.width * 0.7, box.y + box.height * 0.6);
  await tapControl(page, page.getByRole('button', { name: 'The point is correct - continue' }), 'accept point B');

  const sheet = page.getByRole('region', { name: 'Calibration' });

  // Owner finding 1: how much of the readable plan does the fixed sheet
  // cover, and does it have ANY drag affordance?
  const coversPlanFraction = await page.evaluate(() => {
    const sheet = document.querySelector('[aria-label="Calibration"]');
    const surface = document.querySelector('[data-testid="calibration-interaction-surface"]');
    if (!sheet || !surface) return null;
    const s = sheet.getBoundingClientRect();
    const c = surface.getBoundingClientRect();
    const ix = Math.max(0, Math.min(s.right, c.right) - Math.max(s.left, c.left));
    const iy = Math.max(0, Math.min(s.bottom, c.bottom) - Math.max(s.top, c.top));
    return Math.round((ix * iy) / (c.width * c.height) * 100);
  });
  const dragHandlePresent = await page.evaluate(() => {
    const sheet = document.querySelector('[aria-label="Calibration"]');
    if (!sheet) return false;
    return Boolean(
      sheet.querySelector('[aria-label*="drag" i], [data-testid*="handle"], [class*="handle" i], [class*="drag" i]'),
    );
  });
  await evidenceShot(page, runId, 'calibration-sheet-review');
  await captureLayoutDiagnostics(page, 'calibration-review', runId);

  // Distance entry: real tap + real keyboard; unit via control API after a
  // containment check (selectOption is data entry, not reachability proof).
  const distanceInput = sheet.locator('input[inputmode="decimal"]');
  await tapControl(page, distanceInput, 'calibration distance input');
  await distanceInput.pressSequentially('10', { delay: 20 });
  const unitSelect = sheet.locator('select');
  await tapControl(page, unitSelect, 'calibration unit select');
  await unitSelect.selectOption('m');

  const finish = page.getByRole('button', { name: 'Use this calibration and finish' });
  await tapControl(page, finish, 'Use this calibration and finish');

  // U0 REPRODUCTION: with the entry-phase race (calibrationPage null for the
  // whole session), the commit dead-ends: "No takeoff page exists for this
  // plan yet." — every subsequent attempt resets the wizard. A page reload
  // is the only recovery. Capture, then reload and redo.
  const saved = await page.getByText('Scale saved.', { exact: false }).isVisible({ timeout: 8000 }).catch(() => false);
  if (!saved) {
    await evidenceShot(page, runId, 'calibration-commit-deadend');
    const errText = await page.evaluate(() => {
      const el = document.querySelector('[aria-label="Calibration"]');
      return el ? (el.textContent ?? '').slice(0, 400) : null;
    });
    test.info().annotations.push({ type: 'u0-new-calibration-commit-deadend', description: errText ?? 'no error text found' });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await waitForTouchWorkspace(page);
    await dismissDesktopHelpModal(page, runId, 'after-reload');
    // After reload the page-1 row exists: the flow starts correctly in the
    // calibration phase. Redo the manual reference + commit.
    await expect(page.locator('[data-testid="calibration-interaction-surface"]')).toBeVisible({ timeout: 30_000 });
    await tapControl(page, page.getByRole('button', { name: 'Set the scale manually with two points' }), 'Set the scale manually with two points (retry)');
    const box2 = (await surface.boundingBox())!;
    await touchTap(page, box2.x + box2.width * 0.3, box2.y + box2.height * 0.35);
    await tapControl(page, page.getByRole('button', { name: 'The point is correct - continue' }), 'accept point A (retry)');
    await touchTap(page, box2.x + box2.width * 0.7, box2.y + box2.height * 0.6);
    await tapControl(page, page.getByRole('button', { name: 'The point is correct - continue' }), 'accept point B (retry)');
    const sheet2 = page.getByRole('region', { name: 'Calibration' });
    const input2 = sheet2.locator('input[inputmode="decimal"]');
    await tapControl(page, input2, 'calibration distance input (retry)');
    await input2.pressSequentially('10', { delay: 20 });
    await sheet2.locator('select').selectOption('m');
    await tapControl(page, page.getByRole('button', { name: 'Use this calibration and finish' }), 'Use this calibration and finish (retry)');
    await expect(page.getByText('Scale saved.', { exact: false })).toBeVisible({ timeout: 30_000 });
  }
  await page.waitForTimeout(2500); // router.refresh lands the new scale

  const railControlCount = await page.evaluate(() =>
    document.querySelectorAll('[aria-label="Takeoff controls"] button').length,
  );

  await tapControl(page, page.getByRole('button', { name: 'Close calibration' }), 'Close calibration');
  await expect(page.locator('[data-testid="outline-editor-surface"]')).toBeVisible({ timeout: 30_000 });

  return {
    doubleManualStart,
    dragHandlePresent,
    sheetCoversPlanFraction: coversPlanFraction,
    railControlCount,
  };
}

/** ── Tests ─────────────────────────────────────────────────────────────── */

test.describe.configure({ mode: 'serial' });

test.describe('U0 honest touch UX @touch @ux', () => {
  test('U0-A: Measure-a-job entry, Starting-state, calibration findings 1/5/7', async ({ page }) => {
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 915, height: 412 }); // owner: landscape phone
    const slug = await loginAs(page, 'paid-c');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const entry = await measureAJobEntry(page, slug, `${RUN} A Entry`, `${RUN}-A`);
    await waitForTouchWorkspace(page);
    await captureLayoutDiagnostics(page, 'entry-touch-workspace', `${RUN}-A`);
    await evidenceShot(page, `${RUN}-A`, 'touch-workspace-calibration-entry');

    expect(entry.entryEvidence.submitButtonCount, 'one submit control in the entry modal').toBe(1);

    const findings = await calibrateHonestly(page, `${RUN}-A`);
    test.info().annotations.push(
      { type: 'finding-5-double-manual-start', description: String(findings.doubleManualStart) },
      { type: 'finding-1-drag-handle-present', description: String(findings.dragHandlePresent) },
      { type: 'finding-1-sheet-covers-plan-percent', description: String(findings.sheetCoversPlanFraction) },
      { type: 'finding-7-rail-control-count-at-calibration', description: String(findings.railControlCount) },
    );

    const appErrors = errors.filter((e) => !/clarity\.ms/.test(e));
    expect(appErrors, `page errors: ${appErrors.join(' | ')}`).toEqual([]);
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

  test('U0-C: pan/pinch rail containment + desktop bleed-through (findings 2/4, CDP touch)', async ({ page }) => {
    test.setTimeout(360_000);
    test.skip(!isChromium(page), 'CDP multi-touch is Chromium-only; WebKit pan is covered by the M7 suite (labelled synthetic)');
    await page.setViewportSize({ width: 915, height: 412 });
    const slug = await loginAs(page, 'paid-c');
    await measureAJobEntry(page, slug, `${RUN} C Pan`, `${RUN}-C`);
    await waitForTouchWorkspace(page);
    await calibrateHonestly(page, `${RUN}-C`);

    const rail = page.locator('[aria-label="Takeoff controls"]');

    const railFullyContained = async () => {
      const b = await rail.boundingBox();
      const vp = page.viewportSize()!;
      return b != null && b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width && b.y + b.height <= vp.height;
    };
    expect(await railFullyContained(), 'rail inside viewport before gestures').toBe(true);

    const extremes: Array<[string, () => Promise<void>]> = [
      ['pan-far-left', () => cdpTouchPan(page, { x: 300, y: 200 }, { x: -600, y: 200 })],
      ['pan-far-right', () => cdpTouchPan(page, { x: 300, y: 200 }, { x: 900, y: 200 })],
      ['pan-far-up', () => cdpTouchPan(page, { x: 300, y: 200 }, { x: 300, y: -400 })],
      ['pan-far-down', () => cdpTouchPan(page, { x: 300, y: 200 }, { x: 300, y: 600 })],
      ['pinch-out', () => cdpTouchPinch(page, { x: 300, y: 200 }, 80, 500)],
      ['pinch-in', () => cdpTouchPinch(page, { x: 300, y: 200 }, 400, 40)],
    ];
    for (const [name, gesture] of extremes) {
      await gesture();
      await page.waitForTimeout(250);
      const contained = await railFullyContained();
      test.info().annotations.push({ type: `finding-2-${name}-rail-contained`, description: String(contained) });
      await evidenceShot(page, `${RUN}-C`, name);
      await captureLayoutDiagnostics(page, name, `${RUN}-C`);
      // Owner finding 2 reproduction = rail NOT fully contained/visible after
      // a gesture. U0 records the truth; U1 must make this assertion pass.
      // (No expect() here: this is the reproduction attempt, not the fixed gate.)
    }

    // Owner finding 4: desktop UI bleed-through. Sample hit targets across
    // the canvas area: every hit must belong to the touch shell, never a
    // desktop panel/control ("+ New Area", Fabric canvas, desktop panels).
    const bleed = await page.evaluate(() => {
      const shell = document.querySelector('div.fixed.inset-0.z-50');
      const hits: string[] = [];
      for (let fx = 0.1; fx <= 0.95; fx += 0.15) {
        for (let fy = 0.1; fy <= 0.95; fy += 0.2) {
          const el = document.elementFromPoint(innerWidth * fx, innerHeight * fy);
          if (!el) continue;
          if (shell && shell.contains(el)) continue;
          const t = el as HTMLElement;
          hits.push(`${t.tagName.toLowerCase()} ${t.getAttribute('aria-label') ?? ''} ${(typeof t.className === 'string' ? t.className : '').slice(0, 60)}`.trim());
        }
      }
      const newAreaVisible = Array.from(document.querySelectorAll('button')).some(
        (b) => /new area/i.test(b.textContent ?? '') && (b as HTMLElement).getClientRects().length > 0,
      );
      return { foreignHits: [...new Set(hits)].slice(0, 12), newAreaVisible };
    });
    test.info().annotations.push({ type: 'finding-4-foreign-hits', description: JSON.stringify(bleed.foreignHits) });
    test.info().annotations.push({ type: 'finding-4-new-area-visible', description: String(bleed.newAreaVisible) });
    await evidenceShot(page, `${RUN}-C`, 'bleed-check-final');
  });

  test('U0-D: AI outline review affordances + marker visibility (finding 6)', async ({ page }) => {
    test.setTimeout(360_000);
    await page.setViewportSize({ width: 915, height: 412 });
    const slug = await loginAs(page, 'paid-c');
    await measureAJobEntry(page, slug, `${RUN} D AI`, `${RUN}-D`);
    await waitForTouchWorkspace(page);
    await calibrateHonestly(page, `${RUN}-D`);

    // Route-mocked provider (no credits): same mock shape as the M7 suite.
    await page.route('**/api/takeoff/ai-scan-v3*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            roof_areas: [
              {
                name: 'AI Detected Roof',
                pitch_degrees: 20,
                points: [
                  { x: 500, y: 600 },
                  { x: 1400, y: 620 },
                  { x: 1420, y: 1350 },
                  { x: 520, y: 1380 },
                ],
              },
            ],
          },
          summary: { notes: [] },
        }),
      }),
    );

    await tapControl(page, page.getByRole('button', { name: 'Scan outline with AI' }), 'Scan outline with AI');
    await expect(page.getByRole('dialog', { name: 'AI outline found' })).toBeVisible({ timeout: 45_000 });
    await evidenceShot(page, `${RUN}-D`, 'ai-offer');
    await captureLayoutDiagnostics(page, 'ai-offer', `${RUN}-D`);

    await tapControl(page, page.getByRole('button', { name: 'Edit points', exact: true }), 'AI offer Edit points');
    await expect(page.getByText(/4 points|Point \d of 4/)).toBeVisible({ timeout: 15_000 });

    // Marker visibility evidence (owner finding 6): unselected points are
    // white 3px-radius circles — record the actual rendered markers.
    const markers = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="outline-editor-surface"] svg');
      if (!svg) return null;
      return Array.from(svg.querySelectorAll('circle'))
        .slice(0, 12)
        .map((c) => ({ r: c.getAttribute('r'), fill: c.getAttribute('fill'), stroke: c.getAttribute('stroke') }));
    });
    test.info().annotations.push({ type: 'finding-6-marker-styles', description: JSON.stringify(markers) });
    await evidenceShot(page, `${RUN}-D`, 'ai-points-edit');

    // Acceptance affordances: Continue/Edit points exist by design; the
    // owner complaint is visibility/clarity — screenshots are the evidence.
    const affordances = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-label="Takeoff controls"] button'))
        .map((b) => b.getAttribute('aria-label') ?? '')
        .filter(Boolean),
    );
    test.info().annotations.push({ type: 'finding-6-rail-affordances', description: JSON.stringify(affordances) });
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
