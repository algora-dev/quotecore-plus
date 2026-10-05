// P0-1 / P0-5 regression suite (calibration hardening audit 2026-09-20).
// Covers the pure per-page calibration resolver used by page switching, area
// switching and hydration:
// - page A calibrated + page B uncalibrated -> B stays uncalibrated
// - both calibrated differently -> each restores its own, exactly
// - calibration-only page (zero measurements) hydrates its calibration
// Run: node --import tsx --test app/lib/takeoff/calibrationPageState.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePageCalibration, shouldTrustCalibrationMetadata, type PageCalibrationLike } from './calibrationPageState';

function cal(id: string, scale: number, x: number): PageCalibrationLike {
  return {
    id,
    point1: { x, y: 100 },
    point2: { x: x + 1000, y: 100 },
    pixelDistance: 1000,
    actualDistance: 1000 * scale,
    unit: 'feet',
    scale,
  };
}

describe('P0-1 cross-page inheritance removal', () => {
  test('page A calibrated + page B uncalibrated -> B resolves uncalibrated, store untouched', () => {
    const store = new Map<string, PageCalibrationLike[]>([['A', [cal('a1', 0.05, 0)]]]);
    const before = JSON.stringify(store.get('A'));

    const r = resolvePageCalibration(store, 'B');
    assert.equal(r.source, 'none');
    assert.deepEqual(r.calibrations, []);
    assert.equal(r.calibrationConfirmed, false);
    assert.equal(r.showCalibrationHelp, true);

    // The resolver is pure: A's calibration is unchanged and nothing was
    // written for B (the caller-side guarantee that page B can never inherit
    // page A's scale via this path).
    assert.equal(JSON.stringify(store.get('A')), before);
    assert.equal(store.has('B'), false);
  });

  test('pages A and B calibrated differently -> each restores its own, exactly', () => {
    const aCal = cal('a1', 0.05, 0);
    const bCal = cal('b1', 0.1, 500);
    const store = new Map<string, PageCalibrationLike[]>([
      ['A', [aCal]],
      ['B', [bCal]],
    ]);

    const ra = resolvePageCalibration(store, 'A');
    const rb = resolvePageCalibration(store, 'B');
    assert.equal(ra.source, 'page');
    assert.equal(rb.source, 'page');
    assert.equal(ra.calibrations[0].scale, 0.05);
    assert.equal(rb.calibrations[0].scale, 0.1);
    assert.deepEqual(ra.calibrations[0], aCal);
    assert.deepEqual(rb.calibrations[0], bCal);
    assert.equal(ra.calibrationConfirmed, true);
    assert.equal(rb.calibrationConfirmed, true);
    assert.equal(ra.showCalibrationHelp, false);
    assert.equal(rb.showCalibrationHelp, false);

    // Round-trip stability: switching back to A after B still restores A
    // exactly (no mutation from the B resolution).
    const ra2 = resolvePageCalibration(store, 'A');
    assert.deepEqual(ra2.calibrations[0], aCal);
  });

  test('resolution returns defensive copies, never store references', () => {
    const aCal = cal('a1', 0.05, 0);
    const store = new Map<string, PageCalibrationLike[]>([['A', [aCal]]]);
    const r = resolvePageCalibration(store, 'A');
    assert.notEqual(r.calibrations[0], aCal);
    r.calibrations[0].scale = 999;
    assert.equal(store.get('A')![0].scale, 0.05);
  });

  test('null/undefined pageId and empty stored arrays resolve uncalibrated', () => {
    const store = new Map<string, PageCalibrationLike[]>([['A', []]]);
    for (const pid of [null, undefined, 'missing', 'A']) {
      const r = resolvePageCalibration(store, pid as string | null | undefined);
      assert.equal(r.source, 'none', `pageId=${String(pid)}`);
      assert.equal(r.calibrationConfirmed, false);
    }
  });
});

describe('P0-5 calibration-only hydration', () => {
  test('a page with a stored calibration but ZERO measurements still resolves calibrated', () => {
    // Hydration of a calibration-only page: the store is built purely from
    // takeoff_pages.scale_calibration; no measurements exist anywhere.
    const store = new Map<string, PageCalibrationLike[]>([
      ['A', [cal('a1', 0.05, 0)]],
      ['B', [cal('b1', 0.1, 0)]],
    ]);
    const r = resolvePageCalibration(store, 'B');
    assert.equal(r.source, 'page');
    assert.equal(r.calibrationConfirmed, true);
    assert.equal(r.showCalibrationHelp, false);
    assert.equal(r.calibrations.length, 1);
    assert.equal(r.calibrations[0].scale, 0.1);
  });
});

describe('P0-6 metadata hydration trust gate', () => {
  test('matching revision is trusted', () => {
    assert.equal(shouldTrustCalibrationMetadata('sha256-abc-on1', 'sha256-abc-on1'), true);
  });

  test('mismatched revision is NOT trusted (envelope from a different source image)', () => {
    assert.equal(shouldTrustCalibrationMetadata('sha256-old-on1', 'sha256-new-on1'), false);
  });

  test('unknown page revision (pre-migration row) cannot contradict the envelope', () => {
    assert.equal(shouldTrustCalibrationMetadata('sha256-abc-on1', null), true);
  });
});

