/**
 * M7 Touch Verification — browser-level pass (spec §13-M7 / §14)
 *
 * Evidence tier (§14.1 — honest): these are TOUCH-EMULATION browser runs
 * (Chromium `touch-chromium`, WebKit `touch-webkit` projects) against a LOCAL
 * dev server and the REAL dev Supabase database. The AI provider endpoint is
 * ROUTE-MOCKED — no live provider, no credits spent. Emulation is emulation:
 * nothing here is physical-device evidence.
 *
 * Runs ONLY via `npx playwright test -c playwright.touch.config.ts`
 * (loopback-guarded config; the deployed-host main config is untouched).
 *
 * @touch
 */
import { test, expect, type Page } from '@playwright/test';
import { getAccount, getKnownAccountEmails } from '../config/accounts';
import { assertE2EAccount } from '../config/guard';
import * as path from 'path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ROOF_PLAN = path.join(process.cwd(), 'e2e', 'test-data', 'roof-plan-sample.png');

const RUN = `m7touch-${Date.now().toString(36)}`;

/** Local-harness login (loopback only). The shared fixtures assert the
 *  DEPLOYED-host origin, and Supabase rate-limits repeated UI logins, so
 *  this harness authenticates via the password grant API and injects the
 *  @supabase/ssr session cookies (`sb-qcp-auth`, base64- chunked) directly. */
async function loginAs(page: Page, fixture: string): Promise<string> {
  const account = getAccount(fixture);
  assertE2EAccount(account.email, getKnownAccountEmails());

  const tokenRes = await fetch(
    'https://aaavvfttkesdzblttmby.supabase.co/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: account.email, password: account.password }),
    },
  );
  if (!tokenRes.ok) throw new Error(`password grant failed for ${fixture}: HTTP ${tokenRes.status}`);
  const session = (await tokenRes.json()) as Record<string, unknown>;

  // @supabase/ssr cookie format (v0.9): "base64-" + base64url(JSON session),
  // chunked at 3180 chars as sb-qcp-auth.0/.1/… on the app host.
  const raw = `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')}`;
  const CHUNK = 3180;
  const chunks: string[] = [];
  for (let i = 0; i < raw.length; i += CHUNK) chunks.push(raw.slice(i, i + CHUNK));
  const cookies = (chunks.length === 1
    ? [{ name: 'sb-qcp-auth', value: chunks[0] }]
    : chunks.map((c, i) => ({ name: `sb-qcp-auth.${i}`, value: c }))
  ).map((c) => ({ ...c, domain: 'localhost', path: '/' }));
  await page.context().addCookies(cookies);

  await page.goto(`${BASE_URL}/${account.workspaceSlug}`);
  if (page.url().includes('/login')) throw new Error(`session injection failed for ${fixture}`);
  return account.workspaceSlug;
}

/** Deterministic DOM click by aria-label (phone-width overlays/dev portal
 *  can cover chips in the scrollable bottom strip without hiding them). */
async function domClickByLabel(page: Page, ariaLabel: string) {
  await page.evaluate((label) => {
    const btn = Array.from(document.querySelectorAll(`button[aria-label="${label}"]`)).find(
      (b) => b.offsetParent !== null,
    );
    if (!(btn instanceof HTMLButtonElement)) throw new Error(`button ${label} not found`);
    btn.click();
  }, ariaLabel);
}

async function dismissCookies(page: Page) {
  const cookieBtn = page.getByRole('button', { name: /^got it$/i }).last();
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(300);
  }
}

async function dismissModals(page: Page) {
  // Workstation help/instruction modals (and cookie/assistant overlays) can
  // intercept clicks; dismiss up to three in a loop.
  for (let i = 0; i < 3; i++) {
    const skipBtn = page.getByRole('button', { name: /not now|skip|close|dismiss|got it/i }).last();
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    break;
  }
}

/** Create a Digital Measure quote with a plan image; returns quote id. */
async function createDigitalQuote(page: Page, slug: string, label: string): Promise<string> {
  await page.goto(`${BASE_URL}/${slug}/quotes`);
  await page.waitForLoadState('domcontentloaded');
  await dismissCookies(page);
  // DOM click: on WebKit/phone viewports the floating assistant can cover
  // the New Quote button.
  await page.evaluate(() => {
    const a = document.querySelector('a[data-copilot="new-quote"]');
    if (!(a instanceof HTMLAnchorElement)) throw new Error('new-quote link not found');
    a.click();
  });
  await page.waitForURL((url) => url.pathname.includes('/quotes/new'), { timeout: 20_000 });
  await page.waitForLoadState('domcontentloaded');

  const customerField = page.getByText('Customer Name').locator('..').locator('input').first();
  await customerField.fill(`${RUN} ${label}`);

  const digitalBtn = page.getByText('Digital Measure').first();
  if (await digitalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await digitalBtn.click();
    await page.waitForTimeout(500);
    await page.locator('input[type="file"]').first().setInputFiles(ROOF_PLAN);
    await page.waitForTimeout(4000);
  } else {
    throw new Error('Digital Measure mode not visible at quote creation');
  }

  // Phone-viewport hygiene: hide the floating assistant + cookie banner so
  // they cannot overlay the form, then submit via a DOM click on the form's
  // submit button (pointer-events overlays on phone-sized viewports make a
  // coordinate click unreliable; the DOM click is the same user intent).
  const hideAssistant = page.getByRole('button', { name: 'Hide assistant' });
  if (await hideAssistant.isVisible({ timeout: 1500 }).catch(() => false)) {
    await hideAssistant.click();
  }
  await dismissCookies(page);
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-copilot="quote-create"]');
    if (!(btn instanceof HTMLButtonElement)) throw new Error('quote-create button not found');
    btn.click();
  });

  await page.waitForURL((url) => !url.pathname.includes('/quotes/new'), { timeout: 60_000 });
  await dismissModals(page);
  await page.waitForLoadState('domcontentloaded');
  const m = page.url().match(/\/quotes\/([^/]+)/);
  if (!m) throw new Error(`No quote id in URL: ${page.url()}`);
  return m[1];
}

async function openTakeoffTouch(page: Page, slug: string, quoteId: string) {
  await page.goto(`${BASE_URL}/${slug}/quotes/${quoteId}/takeoff`);
  await page.waitForLoadState('domcontentloaded');
  // Touch presentation (Auto on an emulated phone): shell top strip appears
  // once the workstation registers its adapter (M5).
  await expect(
    page.getByRole('button', { name: 'Back to quote' }),
    'Auto should resolve the touch presentation for a coarse-pointer phone viewport',
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-testid="outline-editor-surface"]')).toBeVisible({ timeout: 60_000 });
  await dismissCookies(page);
  await dismissModals(page);
}

/** Manual one-reference calibration (C01 journey, browser tier). */
async function calibrateManually(page: Page) {
  // The workstation's first-time calibration help modal can cover the strip.
  const helpBtn = page.getByRole('button', { name: /got it, let's calibrate/i });
  if (await helpBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await helpBtn.click();
  }
  await page.getByRole('button', { name: 'Calibrate this plan' }).click();
  await expect(page.locator('[data-testid="calibration-interaction-surface"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Calibration' })).toBeVisible();
  await page.getByRole('button', { name: 'Set the scale manually with two points' }).click();

  const surface = page.locator('[data-testid="calibration-interaction-surface"]');
  const box = await surface.boundingBox();
  expect(box, 'calibration surface box').not.toBeNull();

  // Place A (tap), accept without a drag, place B, accept (§7.2 "Point is correct").
  await page.mouse.click(box!.x + box!.width * 0.3, box!.y + box!.height * 0.35);
  await page.getByRole('button', { name: 'The point is correct - continue' }).click();
  await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.6);
  await page.getByRole('button', { name: 'The point is correct - continue' }).click();

  // Distance review: known distance + unit, one reference is enough (R03).
  const sheet = page.getByRole('region', { name: 'Calibration' });
  await sheet.locator('input[inputmode="decimal"]').fill('10');
  await sheet.locator('select').selectOption('m');
  await page.getByRole('button', { name: 'Use this calibration and finish' }).click();

  // Commit runs through persistPageCalibration (real dev DB) and triggers a
  // router.refresh so the workstation (scale owner) picks the new scale up in
  // THIS session — give the refresh a moment to land before continuing.
  await expect(page.getByText('Scale saved.', { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Close calibration' }).click();
  await expect(page.locator('[data-testid="outline-editor-surface"]')).toBeVisible({ timeout: 30_000 });
}

/** Tap-place + off-point drag-release per point, then explicit Close. */
async function drawOutline(page: Page, points: Array<{ fx: number; fy: number }>) {
  const surface = page.locator('[data-testid="outline-editor-surface"]');
  const box = await surface.boundingBox();
  expect(box, 'outline surface box').not.toBeNull();
  for (const p of points) {
    const x = box!.x + box!.width * p.fx;
    const y = box!.y + box!.height * p.fy;
    await page.mouse.click(x, y); // place + arm
    // Off-point relative drag: press far from the marker, move, release to
    // commit + disarm (§5.2) so the next tap creates the next point.
    await page.mouse.move(x - 60, y - 40);
    await page.mouse.down();
    await page.mouse.move(x - 45, y - 30, { steps: 6 });
    await page.mouse.up();
  }
}

async function assert48pxGrid(page: Page) {
  // L06: 2×2 perimeter grid targets are ≥48×48 CSS px and do not overlap.
  const labels = ['Previous point', 'Next point', 'Insert point after selected point', 'Delete selected point'];
  const boxes = [];
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label, exact: true });
    await expect(btn).toBeVisible();
    const b = await btn.boundingBox();
    expect(b, `${label} box`).not.toBeNull();
    expect(b!.width, `${label} width ≥ 48`).toBeGreaterThanOrEqual(48);
    expect(b!.height, `${label} height ≥ 48`).toBeGreaterThanOrEqual(48);
    boxes.push(b!);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps, `${labels[i]} overlaps ${labels[j]}`).toBe(false);
    }
  }
  // Zoom controls are separately labelled, distinguishable from point +/− (§3.5).
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.describe('M7 touch presentation @touch', () => {
  test('M7-T1: manual calibration → outline draw/save → reopen → edit in place', async ({ page }) => {
    test.setTimeout(360_000);
    const slug = await loginAs(page, 'paid-c');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const quoteId = await createDigitalQuote(page, slug, 'Journey');
    await openTakeoffTouch(page, slug, quoteId);

    // ── L06/L07 (assertable in emulation) ─────────────────────────────────
    await assert48pxGrid(page);
    // L07: armed vs set states are text-distinguishable, not colour-only.
    await expect(page.getByText('Pick an outline below')).toBeVisible();

    // ── Calibration (C01 browser tier) ────────────────────────────────────
    await calibrateManually(page);

    // ── Outline: manual draw → close → save (O01/O03) ─────────────────────
    await page.getByRole('button', { name: 'New manual outline' }).click();
    await drawOutline(page, [
      { fx: 0.3, fy: 0.3 },
      { fx: 0.7, fy: 0.35 },
      { fx: 0.65, fy: 0.7 },
      { fx: 0.3, fy: 0.65 },
    ]);
    await expect(page.getByText('Point 4 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Close outline' }).click();
    await expect(page.getByText('Point 4 of 4')).toBeVisible(); // closed review

    // L07: selection + armed cue text after Adjust.
    await page.getByRole('button', { name: 'Adjust point (re-arm for dragging)' }).click();
    await expect(page.getByText('Drag anywhere to move · release to set')).toBeVisible();

    await page.getByRole('button', { name: 'Save outline changes' }).click();
    const useOutline = page.getByRole('button', { name: 'Use outline', exact: true });
    await expect(useOutline).toBeVisible({ timeout: 15_000 });
    await useOutline.click();
    // Create goes through the EXISTING handleSaveArea flow → area chip appears.
    await expect(page.getByRole('button', { name: /Area \d{4}/ }).first()).toBeVisible({ timeout: 30_000 });

    // ── Reload → reopen → edit in place (O05, patch_052 RPC, REAL dev DB) ─
    await page.goto(`${BASE_URL}/${slug}/quotes/${quoteId}/takeoff`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: 'Back to quote' })).toBeVisible({ timeout: 60_000 });
    await dismissCookies(page);
    await dismissModals(page);
    const chip = page.getByRole('button', { name: /Area \d{4}/ }).first();
    await expect(chip).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-testid="outline-editor-surface"]')).toBeVisible({ timeout: 30_000 });
    await chip.click();

    // Select via next (§6.2 no precision tap needed). With no prior selection
    // the first ‹/› tap selects the FIRST vertex (§6.2), so expect Point 1.
    await page.getByRole('button', { name: 'Next point', exact: true }).click();
    await expect(page.getByText('Point 1 of 4')).toBeVisible();
    const surface = page.locator('[data-testid="outline-editor-surface"]');
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    // Drag remotely: press far from the marker (R06) and release.
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.52, box!.y + box!.height * 0.52, { steps: 8 });
    await page.mouse.up();
    // Point set → disarmed cue (T02 disarmed final state).
    await expect(page.getByText('Point set', { exact: true })).toBeVisible();

    // Update-in-place save through the real RPC: same target, no duplicate row.
    await page.getByRole('button', { name: 'Save outline changes' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Save failed')).toHaveCount(0);

    // WebKit surfaces third-party telemetry (MS Clarity) XHR CORS checks as
    // page errors — analytics noise, not application defects.
    const appErrors = errors.filter((e) => !/clarity\.ms/.test(e));
    expect(appErrors, `page errors: ${appErrors.join(' | ')}`).toEqual([]);
  });

  test('M7-T2: view switch round-trip, viewport floor, dirty-draft guards, mocked AI scan', async ({ page }) => {
    test.setTimeout(360_000);
    const slug = await loginAs(page, 'paid-c');
    const quoteId = await createDigitalQuote(page, slug, 'Guards');
    await openTakeoffTouch(page, slug, quoteId);
    await calibrateManually(page);

    // ── L01/L02-ish: explicit Desktop round-trip; preference stored locally ─
    await page.getByRole('button', { name: 'Workspace menu' }).click();
    await page.getByRole('radio', { name: 'Desktop' }).click();
    await expect(page.getByRole('button', { name: 'Back to quote' })).toBeHidden();
    const stored = await page.evaluate(() => window.localStorage.getItem('quotecore.takeoff.view-mode.v1'));
    expect(stored).toContain('desktop');
    // M7 escape hatch: desktop presentation keeps a way back to touch.
    // (force: the oversized Fabric upper-canvas sits under the button visually
    //  but Playwright's hit-target check reports it as intercepting.)
    await page.getByRole('button', { name: 'Switch to touch workspace' }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Back to quote' })).toBeVisible({ timeout: 15_000 });

    // ── L03: 568×320 landscape floor stays operable, data unchanged ───────
    await page.getByRole('button', { name: 'New manual outline' }).click();
    await drawOutline(page, [
      { fx: 0.3, fy: 0.3 },
      { fx: 0.7, fy: 0.35 },
      { fx: 0.65, fy: 0.7 },
    ]);
    await expect(page.getByText(/3 points|Point \d of 3/)).toBeVisible();
    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.getByText(/3 points|Point \d of 3/)).toBeVisible(); // draft survives resize (R11)
    await page.getByRole('button', { name: 'Close outline' }).click();
    await page.setViewportSize({ width: 412, height: 915 });

    // ── O16: dirty-draft exit guards ──────────────────────────────────────
    // Dirty via an off-point drag on point 1.
    await page.getByRole('button', { name: 'Previous point', exact: true }).click();
    const surface = page.locator('[data-testid="outline-editor-surface"]');
    const box = await surface.boundingBox();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.54, box!.y + box!.height * 0.5, { steps: 6 });
    await page.mouse.up();

    // Back guard (shell sheet).
    await page.getByRole('button', { name: 'Back to quote' }).click();
    await expect(page.getByRole('dialog', { name: 'Unsaved outline edits' })).toBeVisible();
    await page.getByRole('button', { name: 'Stay', exact: true }).click();
    await expect(page.getByText(/3 points|Point \d of 3/)).toBeVisible(); // draft kept

    // Switch guard (area/new switching).
    await domClickByLabel(page, 'New manual outline');
    await expect(page.getByText('Save them before switching', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Stay', exact: true }).click();

    // ── M7: pre-scan dirty guard + mocked AI outline import (O04/O10) ─────
    const scanChip = page.getByRole('button', { name: 'Scan outline with AI' });
    await expect(scanChip).toBeVisible(); // entitled chip (local env + roofing trade)
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

    // Dirty draft at scan start → replace/cancel guard (NEW in M7).
    await domClickByLabel(page, 'Scan outline with AI');
    await expect(page.getByRole('dialog', { name: 'Replace unsaved outline edits' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText(/3 points|Point \d of 3/)).toBeVisible(); // draft intact

    // Cancel the draft, then scan for real (mocked provider; no credits).
    await page.getByRole('button', { name: 'Cancel outline edit and restore the saved outline' }).click();
    await domClickByLabel(page, 'Scan outline with AI');
    await expect(page.getByRole('dialog', { name: 'AI outline found' })).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: 'Edit points', exact: true }).click();
    // Imported draft opens with 4 editable AI-origin points (R02).
    await expect(page.getByText(/4 points|Point \d of 4/)).toBeVisible({ timeout: 15_000 });
  });
});
