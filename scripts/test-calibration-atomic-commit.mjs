#!/usr/bin/env node
/**
 * Calibration hardening Phase B: DB failure-injection for save_takeoff_atomic_v2.
 *
 * Proves (against a real Supabase with patch_048 applied):
 *   1. Successful atomic path: measurements + page calibration commit together.
 *   2. Injected page-calibration failure (page belongs to another quote)
 *      rolls back the recalibrated measurements.
 *   3. Stale session version rolls back everything.
 *
 * ENV-GATED. Not runnable automatically in this workspace: the local Supabase
 * CLI stack requires Docker Desktop, which is not available here. Run manually:
 *
 *   supabase start
 *   supabase db reset            # applies all migrations incl. patch_048
 *   node --env-file=.env.local scripts/test-calibration-atomic-commit.mjs
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service
 * role so the RPC's auth.uid() ownership check is skipped, matching how
 * integration rows are seeded). The script creates its own throwaway
 * company/quote/page rows and cleans up on exit. Exit 0 = all proofs pass.
 */

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'NOT RUN: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. ' +
      'See the header comment for how to run this against a local Supabase (supabase start + db reset).',
  );
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const failures = [];
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    failures.push(name);
    console.error(`  FAIL ${name} ${detail}`);
  }
}

async function fetchMeasurements(quoteId, pageId) {
  const { data, error } = await admin
    .from('quote_takeoff_measurements')
    .select('id, measurement_value, source_geometry_id')
    .eq('quote_id', quoteId)
    .eq('page_id', pageId);
  if (error) throw new Error(`fetch measurements: ${error.message}`);
  return data;
}

async function main() {
  // ---- Seed throwaway company / quote / takeoff page / takeoff session ----
  const companyId = randomUUID();
  const { error: coErr } = await admin.from('companies').insert({ id: companyId, name: `cal-atomic-test-${Date.now()}` });
  if (coErr) throw new Error(`seed company: ${coErr.message}`);
  const quoteId = randomUUID();
  const { error: qErr } = await admin.from('quotes').insert({
    id: quoteId,
    company_id: companyId,
    quote_number: `CAL-TEST-${Date.now()}`,
    status: 'draft',
  });
  if (qErr) throw new Error(`seed quote: ${qErr.message}`);
  const pageId = randomUUID();
  const { error: pErr } = await admin.from('takeoff_pages').insert({
    id: pageId,
    quote_id: quoteId,
    page_order: 0,
  });
  if (pErr) throw new Error(`seed page: ${pErr.message}`);
  const { error: sErr } = await admin.from('takeoff_sessions').insert({ quote_id: quoteId, version: 1 });
  if (sErr && !/duplicate/i.test(sErr.message)) throw new Error(`seed session: ${sErr.message}`);

  const baseMeasurement = (value) => ({
    company_id: companyId,
    measurement_type: 'line',
    measurement_value: value,
    measurement_unit: 'meters',
    canvas_points: null,
    is_visible: true,
    page_id: pageId,
    entry_inputs: null,
  });
  const calibrationBlock = {
    page_id: pageId,
    scale_calibration: [{ id: 'cal-1', scale: 0.1, unit: 'meters' }],
    calibration_metadata: { schemaVersion: 1, references: [], workingUnit: 'meters', savedAt: new Date().toISOString() },
    image_revision: 'sha256-deadbeefdeadbeef-on1',
  };
  const payloadFor = (measurements, calibration, extra = {}) => ({
    canvas_image_path: null,
    lines_image_path: null,
    current_page_id: pageId,
    measurements,
    roof_areas: [],
    components: [],
    ...(calibration ? { calibration } : {}),
    ...extra,
  });

  try {
    // ---- Proof 1: successful atomic path ----
    console.log('Proof 1: successful atomic commit (measurements + calibration together)');
    const cal1 = structuredClone(calibrationBlock);
    const { error: okErr } = await admin.rpc('save_takeoff_atomic_v2', {
      p_quote_id: quoteId,
      p_payload: payloadFor([baseMeasurement(12.5)], cal1),
    });
    check('v2 rpc succeeds', !okErr, okErr?.message ?? '');
    let rows = await fetchMeasurements(quoteId, pageId);
    check('measurement committed', rows.length === 1 && Number(rows[0].measurement_value) === 12.5);
    const { data: page1 } = await admin
      .from('takeoff_pages')
      .select('scale_calibration, calibration_metadata, image_revision')
      .eq('id', pageId)
      .single();
    check('scale_calibration persisted', Array.isArray(page1?.scale_calibration) && page1.scale_calibration.length === 1);
    check('calibration_metadata persisted', page1?.calibration_metadata?.schemaVersion === 1);
    check('image_revision persisted', page1?.image_revision === 'sha256-deadbeefdeadbeef-on1');

    // ---- Proof 2: page-calibration failure rolls back measurements ----
    console.log('Proof 2: injected page-calibration failure rolls back measurements');
    const badCal = structuredClone(calibrationBlock);
    badCal.page_id = randomUUID(); // page that does not belong to this quote
    const { error: calFailErr } = await admin.rpc('save_takeoff_atomic_v2', {
      p_quote_id: quoteId,
      p_payload: payloadFor([baseMeasurement(99.9)], badCal),
    });
    check('v2 rpc fails on foreign page_id', !!calFailErr, calFailErr ? '' : 'expected an error');
    rows = await fetchMeasurements(quoteId, pageId);
    check(
      'recalibrated measurements NOT left behind (still 12.5)',
      rows.length === 1 && Number(rows[0].measurement_value) === 12.5,
    );
    const { data: page2 } = await admin
      .from('takeoff_pages')
      .select('scale_calibration')
      .eq('id', pageId)
      .single();
    check('page calibration unchanged', Array.isArray(page2?.scale_calibration) && page2.scale_calibration.length === 1);

    // ---- Proof 3: stale session version rolls back everything ----
    console.log('Proof 3: stale session version rolls back everything');
    const { error: staleErr } = await admin.rpc('save_takeoff_atomic_v2', {
      p_quote_id: quoteId,
      p_payload: payloadFor([baseMeasurement(77.7)], structuredClone(calibrationBlock), {
        session_version: 999, // DB version is 2 after proof 1 (seeded 1, bumped once)
      }),
    });
    check('v2 rpc fails on stale version', !!staleErr, staleErr ? '' : 'expected STALE_TAKEOFF_VERSION');
    check('stale version message surfaced', /STALE_TAKEOFF_VERSION/i.test(staleErr?.message ?? ''), staleErr?.message ?? '');
    rows = await fetchMeasurements(quoteId, pageId);
    check('measurements untouched by stale attempt', rows.length === 1 && Number(rows[0].measurement_value) === 12.5);
    const { data: page3 } = await admin
      .from('takeoff_pages')
      .select('image_revision')
      .eq('id', pageId)
      .single();
    check('calibration untouched by stale attempt', page3?.image_revision === 'sha256-deadbeefdeadbeef-on1');

    // ---- Bonus: 6.4 source_geometry_id stamped from entry_inputs ----
    console.log('Bonus: source_geometry_id stamped natively from entry_inputs');
    const withProv = baseMeasurement(5);
    withProv.entry_inputs = { source_geometry_id: 'poly-42' };
    const { error: provErr } = await admin.rpc('save_takeoff_atomic_v2', {
      p_quote_id: quoteId,
      p_payload: payloadFor([withProv], structuredClone(calibrationBlock)),
    });
    check('v2 rpc succeeds with provenance row', !provErr, provErr?.message ?? '');
    rows = await fetchMeasurements(quoteId, pageId);
    check('native source_geometry_id stamped', rows.length === 1 && rows[0].source_geometry_id === 'poly-42');
  } finally {
    // Cleanup (cascade removes page/session/measurements).
    await admin.from('quotes').delete().eq('id', quoteId);
    await admin.from('companies').delete().eq('id', companyId);
  }

  if (failures.length > 0) {
    console.error(`\nFAILED: ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nAll DB failure-injection proofs passed.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
