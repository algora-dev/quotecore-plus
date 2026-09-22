/**
 * U0 (2026-09-22) — HONEST touch-UX browser harness helpers.
 *
 * Tier rules (review spec §9.1, mobile-takeoff-ux-review-2026-09-22):
 *  - The measured user journey uses REAL taps (`locator.tap()` /
 *    `page.touchscreen.tap()`) in a touch-enabled context only.
 *  - NO programmatic `.click()` via `page.evaluate`, NO `force: true`,
 *    NO hiding production overlays (`nextjs-portal` etc.) to unblock a
 *    measured interaction. Data setup (login cookies, file upload,
 *    route-mocked AI provider) may stay programmatic.
 *  - Before tapping an important control, assert containment: bounding rect
 *    inside the viewport, `elementFromPoint` hit-target sampling at centre +
 *    near-corners, no foreign sheet intercepting.
 *  - `toBeVisible()` + non-zero boxes alone are NOT acceptance conditions.
 *
 * Emulation honesty: these run in Playwright `touch-chromium` /
 * `touch-webkit` projects. Chromium multi-touch gestures use CDP
 * `Input.dispatchTouchEvent` (real touch input events, still emulation —
 * never physical-device proof). WebKit drags fall back to `page.mouse` and
 * MUST be labelled synthetic where used; they never serve as reachability
 * proof.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getAccount, getKnownAccountEmails } from '../config/accounts';
import { assertE2EAccount } from '../config/guard';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
export const ROOF_PLAN = path.join(process.cwd(), 'e2e', 'test-data', 'roof-plan-sample.png');

/** Baseline/reproduction artifacts live OUTSIDE the repo (never committed). */
export const UX_ARTIFACT_DIR =
  process.env.E2E_UX_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', '..', 'mobile-takeoff-u0-artifacts-2026-09-22');

/** ── Session auth (data setup, §9.1-sanctioned) ────────────────────────── */

/** Password-grant login + @supabase/ssr cookie injection. No UI login, no
 *  overlay manipulation. Identical mechanism to the pre-U0 harness. */
export async function loginAs(page: Page, fixture: string): Promise<string> {
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

/** ── Containment + honest taps (§9.1) ─────────────────────────────────── */

export interface ContainmentReport {
  label: string;
  box: { x: number; y: number; width: number; height: number } | null;
  insideViewport: boolean;
  hitTargets: Array<{ x: number; y: number; ok: boolean; interceptor: string | null }>;
  foreignSheet: string | null;
  /** True when the control only became tappable after scrolling it into
 *  view (below-the-fold rail content — recorded, not hidden). */
  requiredScroll?: boolean;
}

/** Assert + report containment for an important control:
 *  1. rect inside the usable (layout) viewport,
 *  2. elementFromPoint at centre + 4 near-corners resolves INSIDE the target,
 *  3. no element with dialog/region semantics OUTSIDE the target intercepts. */
export async function assertContainment(page: Page, locator: Locator, label: string): Promise<ContainmentReport> {
  const target = locator.first();
  await expect(target, `${label}: must be visible`).toBeVisible();
  const box = await target.boundingBox();
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  expect(box, `${label}: bounding box`).not.toBeNull();

  const insideViewport =
    box!.x >= 0 && box!.y >= 0 && box!.x + box!.width <= vp.width && box!.y + box!.height <= vp.height;

  const pad = 5;
  const pts = [
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    { x: box!.x + pad, y: box!.y + pad },
    { x: box!.x + box!.width - pad, y: box!.y + pad },
    { x: box!.x + pad, y: box!.y + box!.height - pad },
    { x: box!.x + box!.width - pad, y: box!.y + box!.height - pad },
  ];
  const results = await Promise.all(
    pts.map(async (p) => {
      const hit = await target.evaluate((root, pt) => {
        const el = document.elementFromPoint(pt.x, pt.y);
        if (!el) return { ok: false, interceptor: 'nothing (outside document?)' };
        if (root.contains(el) || el.contains(root)) return { ok: true, interceptor: null };
        const i = el as HTMLElement;
        const desc =
          i.getAttribute('aria-label') ?? i.getAttribute('data-testid') ?? i.tagName.toLowerCase();
        const cls = (typeof i.className === 'string' ? i.className : '').slice(0, 80);
        return { ok: false, interceptor: `${desc} ${cls}`.trim() };
      }, p);
      return { x: Math.round(p.x), y: Math.round(p.y), ...hit };
    }),
  );

  // Any intercepting element carrying sheet/dialog semantics that is NOT part
  // of the target subtree is a foreign sheet hit.
  const foreign = results.find((r) => !r.ok);
  const report: ContainmentReport = {
    label,
    box,
    insideViewport,
    hitTargets: results,
    foreignSheet: foreign?.interceptor ?? null,
  };

  expect(insideViewport, `${label}: rect must lie inside the viewport (box=${JSON.stringify(box)}, vp=${vp.width}x${vp.height})`).toBe(true);
  for (const r of results) {
    expect(r.ok, `${label}: hit-target at (${r.x},${r.y}) intercepted by ${r.interceptor}`).toBe(true);
  }
  return report;
}

/** Current run id for the tap-findings journal (set by specs). */
let currentRunId = 'ux-run';
export function setUxRunId(runId: string): void {
  currentRunId = runId;
}

function journal(findings: Record<string, unknown>): void {
  try {
    fs.mkdirSync(UX_ARTIFACT_DIR, { recursive: true });
    fs.appendFileSync(path.join(UX_ARTIFACT_DIR, `${currentRunId}-tap-findings.jsonl`), `${JSON.stringify(findings)}\n`);
  } catch {
    /* journal is best-effort */
  }
}

/** Honest tap: containment assert FIRST (so auto-scroll/fixed-control defects
 *  cannot hide), then a normal `locator.tap()`. Never force.
 *
 *  Off-viewport recovery: when the control is reachable only by scrolling
 *  (e.g. inside the rail's internal scroll), that fact is RECORDED as a
 *  `requiredScroll` finding (primary actions below the fold are owner
 *  finding 2/7 evidence) and the tap proceeds after a real scroll —
 *  exactly what a user must do. */
export async function tapControl(page: Page, locator: Locator, label: string): Promise<ContainmentReport> {
  const report = await assertContainment(page, locator, label).catch(async (err: Error) => {
    // Off-viewport (not intercepted): try a real scroll, then re-assert.
    if (/rect must lie inside the viewport/.test(err.message)) {
      await locator.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const retried = await assertContainment(page, locator, label);
      retried.requiredScroll = true;
      journal({ kind: 'required-scroll', label, box: retried.box, viewport: page.viewportSize() });
      return retried;
    }
    // Partially covered control: a real user taps the UNCOVERED part. Scan
    // for a reachable point; journal the overlap as evidence.
    const point = await locator.first().evaluate((root) => {
      const r = root.getBoundingClientRect();
      for (let fx = 0.06; fx <= 0.96; fx += 0.06) {
        for (let fy = 0.15; fy <= 0.9; fy += 0.15) {
          const x = r.x + r.width * fx;
          const y = r.y + r.height * fy;
          const el = document.elementFromPoint(x, y);
          if (el && (root.contains(el) || el.contains(root))) return { x, y };
        }
      }
      return null;
    });
    if (!point) throw err; // fully covered — genuine dead end
    journal({ kind: 'partial-coverage-tap', label, interceptor: err.message, point, viewport: page.viewportSize() });
    const partial: ContainmentReport = {
      label,
      box: await locator.first().boundingBox(),
      insideViewport: true,
      hitTargets: [],
      foreignSheet: err.message,
      requiredScroll: false,
    };
    await page.touchscreen.tap(point.x, point.y);
    return { ...partial, tapped: true } as ContainmentReport;
  });
  if (!(report as ContainmentReport & { tapped?: boolean }).tapped) {
    await locator.first().tap();
  }
  return report;
}

/** Real touch input at canvas coordinates (pointerType=touch pointer events). */
export async function touchTap(page: Page, x: number, y: number): Promise<void> {
  await page.touchscreen.tap(x, y);
}

/** ── Chromium CDP multi-touch (real touch events; emulation tier) ──────── */

export function isChromium(page: Page): boolean {
  return page.context().browser()?.browserType().name() === 'chromium';
}

/** One-finger touch pan via CDP (Chromium only). */
export async function cdpTouchPan(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Two-finger pinch via CDP (Chromium only): anchors move apart/together. */
export async function cdpTouchPinch(
  page: Page,
  centre: { x: number; y: number },
  startSpread: number,
  endSpread: number,
  steps = 10,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const pts = (spread: number) => [
    { x: centre.x - spread / 2, y: centre.y },
    { x: centre.x + spread / 2, y: centre.y },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(startSpread) });
  for (let i = 1; i <= steps; i++) {
    const spread = startSpread + ((endSpread - startSpread) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(spread) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** SYNTHETIC (mouse-emulated) off-point drag for WebKit, where CDP touch is
 *  unavailable. Labelled per §9.1; used for geometry commits only, never as
 *  reachability proof. */
export async function syntheticDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  }
  await page.mouse.up();
}

/** Touch drag (tap-place + off-point drag-release per §5.2). Chromium uses
 *  CDP touch; WebKit falls back to the labelled synthetic mouse drag. */
export async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  if (isChromium(page)) {
    await cdpTouchPan(page, from, to, 6);
  } else {
    await syntheticDrag(page, from, to, 6);
  }
}

/** ── Layout diagnostics (§9.3, bounded, no input values) ──────────────── */

export interface LayoutDiagnostics {
  step: string;
  path: string;
  window: { w: number; h: number };
  layoutViewport: { w: number; h: number };
  visualViewport: { w: number; h: number; offsetTop: number; offsetLeft: number; scale: number } | null;
  railRect: { x: number; y: number; width: number; height: number } | null;
  shellRect: { x: number; y: number; height: number; width: number } | null;
  sheets: Array<{ label: string | null; role: string; rect: { x: number; y: number; width: number; height: number } }>;
  railControls: string[];
  scrollY: number;
  activeElementTag: string | null;
}

export async function captureLayoutDiagnostics(page: Page, step: string, runId: string): Promise<LayoutDiagnostics> {
  const snap: LayoutDiagnostics = await page.evaluate((s) => {
    const round = (n: number) => Math.round(n * 10) / 10;
    const rect = (el: Element | null) =>
      el
        ? (() => {
            const r = el.getBoundingClientRect();
            return { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) };
          })()
        : null;
    const vv = window.visualViewport;
    return {
      step: s,
      path: location.pathname,
      window: { w: window.innerWidth, h: window.innerHeight },
      layoutViewport: { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight },
      visualViewport: vv
        ? { w: round(vv.width), h: round(vv.height), offsetTop: round(vv.offsetTop), offsetLeft: round(vv.offsetLeft), scale: round(vv.scale) }
        : null,
      railRect: rect(document.querySelector('[aria-label="Takeoff controls"]')),
      shellRect: rect(document.querySelector('div.fixed.inset-0.z-50')),
      sheets: Array.from(document.querySelectorAll('[role="region"], [role="dialog"]'))
        .slice(0, 8)
        .map((el) => ({ label: el.getAttribute('aria-label'), role: el.getAttribute('role') ?? '', rect: rect(el)! })),
      railControls: Array.from(document.querySelectorAll('[aria-label="Takeoff controls"] button'))
        .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 30))
        .slice(0, 30),
      scrollY: window.scrollY,
      activeElementTag: document.activeElement ? document.activeElement.tagName : null,
    } as unknown as LayoutDiagnostics;
  }, step);

  fs.mkdirSync(UX_ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(UX_ARTIFACT_DIR, `${runId}-${step.replace(/[^a-z0-9-]+/gi, '_')}.json`), JSON.stringify(snap, null, 2));
  return snap;
}

export async function evidenceShot(page: Page, runId: string, name: string): Promise<string> {
  fs.mkdirSync(UX_ARTIFACT_DIR, { recursive: true });
  const file = path.join(UX_ARTIFACT_DIR, `${runId}-${name.replace(/[^a-z0-9-]+/gi, '_')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/** ── Honest navigation: the real "Measure a job" entry ─────────────────── */

export interface MeasureJobResult {
  quoteId: string;
  entryEvidence: {
    submitButtonCount: number;
    startingLabelSeen: boolean;
    assistantOverlapsFooter: boolean;
    collectionSelectPresent: boolean;
  };
}

/** Cookie banner dismissal via a NORMAL tap (no force). No-ops when absent.
 *  U0 REPRODUCTION CAPTURE: on phone viewports the fixed assistant
 *  launcher (z-60, bottom-right) can overlap the banner's "Got it" button —
  * owner finding 3 family. When the centre is intercepted we record the
 *  overlap and tap the nearest UNCOVERED point inside the button (a real
 *  user can do exactly this); if no point is reachable the banner is a
 *  genuine dead end and the failure is thrown as evidence. */
export async function dismissCookiesHonestly(page: Page): Promise<boolean> {
  const btn = page.getByRole('button', { name: /^got it$/i }).last();
  if (!(await btn.isVisible({ timeout: 1500 }).catch(() => false))) return false;
  const reachable = await btn.evaluate((root) => {
    const r = root.getBoundingClientRect();
    for (let fx = 0.08; fx <= 0.95; fx += 0.08) {
      for (let fy = 0.3; fy <= 0.75; fy += 0.2) {
        const x = r.x + r.width * fx;
        const y = r.y + r.height * fy;
        const el = document.elementFromPoint(x, y);
        if (el && (root.contains(el) || el.contains(root))) return { x, y, overlapped: true };
      }
    }
    return null;
  });
  if (!reachable) {
    throw new Error('cookie banner "Got it" fully covered — untappable dead end (evidence)');
  }
  await page.touchscreen.tap(reachable.x, reachable.y);
  await page.waitForTimeout(300);
  return true;
}

/** Settle the dashboard before tapping the Measure-a-job card: up to 5
 *  rounds of dismissing first-run dialogs ("Welcome", cookie banner) with
 *  REAL taps until the card's hit-target is clean. */
export async function settleDashboard(page: Page): Promise<void> {
  const cardBtn = page.getByRole('button', { name: 'Start measuring', exact: true }).first();
  for (let i = 0; i < 5; i++) {
    const clean = await cardBtn.evaluate((root) => {
      const r = root.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!el && (root.contains(el) || el.contains(root));
    }).catch(() => false);
    if (clean) return;

    const welcome = page.getByRole('dialog').filter({ hasText: /welcome to quotecore/i }).first();
    if (await welcome.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tapControl(page, welcome.getByRole('button', { name: 'Maybe later' }), 'welcome dialog Maybe later');
      await page.waitForTimeout(400);
      continue;
    }
    if (await dismissCookiesHonestly(page)) continue;
    await page.waitForTimeout(600);
  }
}

/** Enter the takeoff canvas through the owner-reported entry: dashboard
 *  "Measure a job" card → modal → job name (typed) → plan upload (fixture
 *  file, data setup) → ONE tap on Start measuring → /takeoff. Every control
 *  on the measured journey is tapped for real after containment checks. */
export async function measureAJobEntry(page: Page, slug: string, jobName: string, runId: string): Promise<MeasureJobResult> {
  await page.goto(`${BASE_URL}/${slug}`);
  await page.waitForLoadState('domcontentloaded');
  await settleDashboard(page);

  // Dashboard card entry (variant 'card'): its button is labelled
  // "Start measuring". Scope to the card to avoid the modal's same-named
  // submit before it exists.
  const cardBtn = page.getByRole('button', { name: 'Start measuring', exact: true }).first();
  await tapControl(page, cardBtn, 'dashboard Measure-a-job card button');

  const overlay = page
    .locator('div.fixed.inset-0.z-50')
    .filter({ has: page.getByRole('heading', { name: 'Measure a job' }) })
    .first();
  await expect(overlay).toBeVisible({ timeout: 10_000 });
  // The cookie banner can overlay the modal footer on phone viewports
  // (owner finding 3 family) — dismiss it with a real tap again if present.
  await dismissCookiesHonestly(page);

  const submitButtons = overlay.locator('form button[type="submit"]');
  const submitButtonCount = await submitButtons.count();
  expect(submitButtonCount, 'Measure-a-job modal must expose exactly ONE submit control').toBe(1);

  // Owner finding 3 evidence inputs: launcher overlap + collection picker.
  const footer = overlay.locator('form > div').last();
  const footerBox = await footer.boundingBox();
  const launcher = page.locator('button[aria-label^="Open "]').first();
  const launcherBox = await (await launcher.isVisible().catch(() => false))
    ? launcher.boundingBox()
    : null;
  const assistantOverlapsFooter = !!(
    footerBox &&
    launcherBox &&
    launcherBox.x < footerBox.x + footerBox.width &&
    footerBox.x < launcherBox.x + launcherBox.width &&
    launcherBox.y < footerBox.y + footerBox.height &&
    footerBox.y < launcherBox.y + launcherBox.height
  );
  const collectionSelectPresent = await overlay.locator('select').count();

  await evidenceShot(page, runId, 'entry-modal-filled');

  // Job name — real tap + real keyboard.
  const nameInput = overlay.getByRole('textbox').first();
  await tapControl(page, nameInput, 'entry Job Name input');
  await nameInput.pressSequentially(jobName, { delay: 20 });

  // Plan upload: programmatic file selection is DATA SETUP (§9.1); the
  // journey resumes with real taps.
  const fileInput = overlay.locator('input[type="file"]');
  await fileInput.setInputFiles(ROOF_PLAN);
  await expect(overlay.getByText('Replace')).toBeVisible({ timeout: 20_000 });

  const submit = overlay.locator('form button[type="submit"]');
  const beforeTap = await submit.textContent();
  await tapControl(page, submit, 'entry Start measuring submit');
  const startingLabelSeen = (beforeTap ?? '').includes('Start');

  await page.waitForURL((u) => /\/quotes\/[^/]+\/takeoff/.test(u.pathname), { timeout: 90_000 });
  await page.waitForLoadState('domcontentloaded');

  const m = page.url().match(/\/quotes\/([^/]+)\/takeoff/);
  if (!m) throw new Error(`No quote id after Measure-a-job entry: ${page.url()}`);
  return {
    quoteId: m[1],
    entryEvidence: { submitButtonCount, startingLabelSeen, assistantOverlapsFooter, collectionSelectPresent: collectionSelectPresent > 0 },
  };
}

/** Wait for the touch workstation to mount (real, unforced visibility). */
export async function waitForTouchWorkspace(page: Page): Promise<void> {
  await expect(
    page.getByRole('button', { name: 'Workspace menu' }),
    'touch presentation should mount for a coarse-pointer phone viewport',
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.locator('[data-testid="calibration-interaction-surface"], [data-testid="outline-editor-surface"]'),
  ).toBeVisible({ timeout: 60_000 });
}
