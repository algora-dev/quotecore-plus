/**
 * Phase 0 fixture validation tests.
 * Confirms the fixtures are internally consistent and match the current engine.
 * These tests must pass BEFORE and AFTER the shared-package migration.
 *
 * Run from: quotecore-plus root
 * Command: node --import tsx --test docs/plans/phase0/fixtures.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Use pathToFileURL for Windows compatibility with (public) in path
const srcDir = resolve(process.cwd(), 'app/(public)/free-roofing-takeoff-builder');
const srcUrl = pathToFileURL(srcDir + '/').href;

test('fixture validation: actual metric with supplier pricing', async () => {
  const { calculatePublicRoofTakeoff } = await import(srcUrl + 'public-contract.ts');
  const { FIXTURE_COMPONENTS, FIXTURE_ACTUAL_METRIC, FIXTURE_SUPPLIER_SLOT_MAP } = await import('./fixtures.ts');

  const result = calculatePublicRoofTakeoff(
    FIXTURE_ACTUAL_METRIC.input,
    FIXTURE_COMPONENTS,
    FIXTURE_SUPPLIER_SLOT_MAP,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  const ra = result.results.components.roof_area;
  assert.equal(ra.rawTotal, 100);
  assert.ok(Math.abs(ra.withWaste - 110) < 1e-10);
  assert.ok(Math.abs(ra.materialCost - 3000) < 1e-10);
  assert.ok(Math.abs(ra.labourCost - 750) < 1e-10);
});

test('fixture validation: plan mode 45deg pitch factors', async () => {
  const { calculatePublicRoofTakeoff } = await import(srcUrl + 'public-contract.ts');
  const { FIXTURE_COMPONENTS, FIXTURE_PLAN_45DEG, FIXTURE_SUPPLIER_SLOT_MAP } = await import('./fixtures.ts');

  const result = calculatePublicRoofTakeoff(
    FIXTURE_PLAN_45DEG.input,
    FIXTURE_COMPONENTS,
    FIXTURE_SUPPLIER_SLOT_MAP,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.ok(Math.abs(result.results.components.roof_area.rawTotal - FIXTURE_PLAN_45DEG.expected.roof_area.rawTotal) < 1e-6);
  assert.equal(result.results.components.ridge.rawTotal, 10);
});

test('fixture validation: plan mode hip/valley pitch factors', async () => {
  const { calculatePublicRoofTakeoff } = await import(srcUrl + 'public-contract.ts');
  const { FIXTURE_COMPONENTS, FIXTURE_PLAN_HIP_VALLEY, FIXTURE_SUPPLIER_SLOT_MAP } = await import('./fixtures.ts');

  const result = calculatePublicRoofTakeoff(
    FIXTURE_PLAN_HIP_VALLEY.input,
    FIXTURE_COMPONENTS,
    FIXTURE_SUPPLIER_SLOT_MAP,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.ok(Math.abs(result.results.components.roof_area.rawTotal - FIXTURE_PLAN_HIP_VALLEY.expected.roof_area.rawTotal) < 1e-6);
  assert.ok(Math.abs(result.results.components.hip.rawTotal - FIXTURE_PLAN_HIP_VALLEY.expected.hip.rawTotal) < 1e-6);
  assert.ok(Math.abs(result.results.components.valley.rawTotal - FIXTURE_PLAN_HIP_VALLEY.expected.valley.rawTotal) < 1e-6);
});

test('fixture validation: imperial units pass through', async () => {
  const { calculatePublicRoofTakeoff } = await import(srcUrl + 'public-contract.ts');
  const { FIXTURE_COMPONENTS, FIXTURE_IMPERIAL, FIXTURE_SUPPLIER_SLOT_MAP } = await import('./fixtures.ts');

  const result = calculatePublicRoofTakeoff(
    FIXTURE_IMPERIAL.input,
    FIXTURE_COMPONENTS,
    FIXTURE_SUPPLIER_SLOT_MAP,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.results.components.roof_area.rawTotal, 1200);
  assert.equal(result.results.components.roof_area.unit, 'sq ft');
});

test('fixture validation: squares units pass through', async () => {
  const { calculatePublicRoofTakeoff } = await import(srcUrl + 'public-contract.ts');
  const { FIXTURE_COMPONENTS, FIXTURE_SQUARES, FIXTURE_SUPPLIER_SLOT_MAP } = await import('./fixtures.ts');

  const result = calculatePublicRoofTakeoff(
    FIXTURE_SQUARES.input,
    FIXTURE_COMPONENTS,
    FIXTURE_SUPPLIER_SLOT_MAP,
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.results.components.roof_area.rawTotal, 10);
  assert.equal(result.results.components.roof_area.unit, 'squares');
});

test('fixture validation: result token round-trip', async () => {
  const { toResultQuery, ROOF_TAKEOFF_CALCULATION_VERSION } = await import(srcUrl + 'public-contract.ts');
  const { createResultToken, verifyResultToken } = await import(srcUrl + 'result-token.ts');
  const { FIXTURE_RESULT_TOKEN } = await import('./fixtures.ts');

  const query = toResultQuery(FIXTURE_RESULT_TOKEN.input);
  const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  const payload = verifyResultToken(token);

  assert.ok(payload, 'Token must verify');
  assert.equal(payload!.q, query);
  assert.equal(payload!.v, ROOF_TAKEOFF_CALCULATION_VERSION);
});

test('fixture validation: result URL builds correctly', async () => {
  const { buildResultUrl } = await import(srcUrl + 'result-token.ts');

  const url = buildResultUrl('abc123.def456', 'https://quote-core.com');
  assert.equal(url, 'https://quote-core.com/free-roofing-takeoff-builder/result/abc123.def456');

  const relative = buildResultUrl('abc123.def456');
  assert.equal(relative, '/free-roofing-takeoff-builder/result/abc123.def456');
});
