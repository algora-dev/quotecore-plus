// P4 calibration codec tests: v1 envelope round trip, legacy decode,
// quarantine/diagnostics behaviour (spec 11.1/11.2 + plan suite
// calibration-persistence: old/new format round trips).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  CALIBRATION_METADATA_SCHEMA_VERSION,
  decodeCalibrationMetadata,
  encodeCalibrationMetadata,
} from './calibrationCodec';
import type { AcceptedReferenceDraft } from './calibrationTypes';

function ref(overrides: Partial<AcceptedReferenceDraft> = {}): AcceptedReferenceDraft {
  return {
    id: 'ref-1',
    source: 'manual',
    candidateId: null,
    referenceId: null,
    candidateRevision: null,
    sceneP1: { x: 10, y: 10 },
    sceneP2: { x: 110, y: 10 },
    confirmedDistance: 20,
    confirmedUnit: 'ft',
    originalLabelText: null,
    valueCorrected: false,
    ...overrides,
  };
}

test('v1 round trip preserves accepted references', () => {
  const accepted = [
    ref(),
    ref({ id: 'ref-2', sceneP1: { x: 0, y: 0 }, sceneP2: { x: 0, y: 50 }, confirmedDistance: 10.5, confirmedUnit: 'ft' }),
  ];
  const env = encodeCalibrationMetadata({ accepted, workingUnit: 'feet', imageRevision: 'sha256-abc-on1' });
  assert.equal(env.schemaVersion, CALIBRATION_METADATA_SCHEMA_VERSION);
  assert.equal(env.references.length, 2);

  const json = JSON.parse(JSON.stringify(env)); // serialisation round trip
  const decoded = decodeCalibrationMetadata(json);
  if (decoded.kind !== 'v1') assert.fail(`expected v1, got ${decoded.kind}`);
  assert.equal(decoded.status, 'valid');
  assert.deepEqual(decoded.diagnostics, []);
  assert.equal(decoded.metadata.imageRevision, 'sha256-abc-on1');
  assert.equal(decoded.metadata.workingUnit, 'feet');
  const r1 = decoded.metadata.references[0];
  assert.equal(r1.id, 'ref-1');
  assert.equal(r1.confirmedDistance, 20);
  assert.equal(r1.confirmedUnit, 'ft');
  assert.equal(r1.sceneP2.x, 110);
  // Effective scale: mean of 20/100 and 10.5/50 = mean(0.2, 0.21)
  assert.ok(Math.abs(decoded.effective.scale - 0.205) < 1e-12);
  assert.deepEqual(decoded.effective.contributingCalibrationIds.sort(), ['ref-1', 'ref-2']);
});

test('v1 decode ignores tampered scale caches and recomputes', () => {
  const env = encodeCalibrationMetadata({ accepted: [ref()], workingUnit: 'feet', imageRevision: 'rev-x' });
  const tampered = JSON.parse(JSON.stringify(env));
  tampered.references[0].scaleCache = 999;
  tampered.references[0].pixelDistanceCache = 1;
  tampered.effective.scale = 42;
  const decoded = decodeCalibrationMetadata(tampered);
  if (decoded.kind !== 'v1') assert.fail(`expected v1, got ${decoded.kind}`);
  assert.equal(decoded.status, 'needs_review');
  assert.ok(decoded.diagnostics.some((d) => d.includes('cached scale')));
  assert.ok(decoded.diagnostics.some((d) => d.includes('recomputed')));
  // Recomputed, authoritative value survives tampering.
  assert.ok(Math.abs(decoded.effective.scale - 0.2) < 1e-12);
});

test('v1 decode quarantines corrupt references with diagnostics', () => {
  const env = encodeCalibrationMetadata({ accepted: [ref(), ref({ id: 'ref-2' })], workingUnit: 'feet', imageRevision: 'rev' });
  const corrupted = JSON.parse(JSON.stringify(env));
  corrupted.references[1].sceneP1 = { x: 'oops', y: null };
  const decoded = decodeCalibrationMetadata(corrupted);
  if (decoded.kind !== 'v1') assert.fail(`expected v1, got ${decoded.kind}`);
  assert.equal(decoded.status, 'needs_review');
  assert.equal(decoded.metadata.references.length, 1);
  assert.equal(decoded.metadata.references[0].id, 'ref-1');
  assert.ok(decoded.diagnostics.some((d) => d.includes('ref-2') && d.includes('quarantined')));
});

test('v1 decode with all references corrupt is invalid, never silent', () => {
  const env = encodeCalibrationMetadata({ accepted: [ref()], workingUnit: 'feet', imageRevision: 'rev' });
  const corrupted = JSON.parse(JSON.stringify(env));
  corrupted.references[0].confirmedDistance = -5;
  const decoded = decodeCalibrationMetadata(corrupted);
  assert.equal(decoded.kind, 'invalid');
  assert.ok(decoded.diagnostics.length > 0);
});

test('v1 envelope with >3 references reports, does not drop', () => {
  // Build the oversized envelope manually: encode() enforces the 3-cap at
  // commit time, but the DECODER must still report (never silently truncate)
  // an oversized persisted envelope.
  const mk = (id: string) => ({
    id, source: 'manual', candidateId: null, referenceId: null, candidateRevision: null,
    sceneP1: { x: 0, y: 0 }, sceneP2: { x: 100, y: 0 },
    confirmedDistance: 20, confirmedUnit: 'ft',
    originalLabelText: null, valueCorrected: false,
    pixelDistanceCache: 100, scaleCache: 0.2,
  });
  const oversized = {
    schemaVersion: 1,
    workingUnit: 'feet',
    aggregationPolicy: 'mean-distance-per-scene-pixel-v1',
    imageRevision: 'rev',
    references: [mk('r1'), mk('r2'), mk('r3'), mk('r4')],
    effective: { scale: 0.2, unit: 'feet', aggregationPolicy: 'mean-distance-per-scene-pixel-v1', contributingCalibrationIds: ['r1'], validCalibrationCount: 1, scaleRangePct: 0, disagreementWarning: null },
    savedAt: null,
  };
  const decoded = decodeCalibrationMetadata(oversized);
  if (decoded.kind !== 'v1') assert.fail(`expected v1, got ${decoded.kind}`);
  assert.equal(decoded.metadata.references.length, 4);
  assert.ok(decoded.diagnostics.some((d) => d.includes('4 references (max 3)')));
});

test('legacy array decodes to accepted drafts with recomputed pixel distance', () => {
  const legacy = [
    { id: 'cal-1', point1: { x: 0, y: 0 }, point2: { x: 200, y: 0 }, pixelDistance: 200, actualDistance: 40, unit: 'feet', scale: 0.2 },
  ];
  const decoded = decodeCalibrationMetadata(legacy);
  if (decoded.kind !== 'legacy') assert.fail(`expected legacy, got ${decoded.kind}`);
  assert.equal(decoded.status, 'valid');
  assert.equal(decoded.references.length, 1);
  assert.equal(decoded.workingUnit, 'feet');
  const r = decoded.references[0];
  assert.equal(r.source, 'manual');
  assert.equal(r.confirmedUnit, 'ft');
  assert.equal(r.confirmedDistance, 40);
  assert.ok(Math.abs((decoded.effective?.scale ?? 0) - 0.2) < 1e-12);
});

test('legacy corrupt entries are quarantined and reported', () => {
  const legacy = [
    { id: 'ok', point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, actualDistance: 20, unit: 'feet' },
    { id: 'bad-pts', point1: null, point2: { x: 1, y: 1 }, actualDistance: 5, unit: 'feet' },
    { id: 'bad-dist', point1: { x: 0, y: 0 }, point2: { x: 50, y: 0 }, actualDistance: 'NaN', unit: 'feet' },
    'not-even-an-object',
  ];
  const decoded = decodeCalibrationMetadata(legacy);
  if (decoded.kind !== 'legacy') assert.fail(`expected legacy, got ${decoded.kind}`);
  assert.equal(decoded.status, 'needs_review');
  assert.equal(decoded.quarantined, 3);
  assert.equal(decoded.references.length, 1);
  assert.equal(decoded.references[0].id, 'ok');
  assert.equal(decoded.diagnostics.filter((d) => d.includes('quarantined')).length, 3);
});

test('legacy stale pixelDistance cache is diagnosed and recomputed', () => {
  const legacy = [
    { point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, pixelDistance: 50, actualDistance: 20, unit: 'feet', scale: 0.4 },
  ];
  const decoded = decodeCalibrationMetadata(legacy);
  if (decoded.kind !== 'legacy') assert.fail(`expected legacy, got ${decoded.kind}`);
  assert.ok(decoded.diagnostics.some((d) => d.includes('recomputed')));
  assert.ok(Math.abs((decoded.effective?.scale ?? 0) - 0.2) < 1e-12);
});

test('legacy all-corrupt array is invalid', () => {
  const decoded = decodeCalibrationMetadata([{ garbage: true }]);
  assert.equal(decoded.kind, 'invalid');
  assert.ok(decoded.diagnostics.some((d) => d.includes('none survived')));
});

test('unknown payload shapes are invalid with diagnostics', () => {
  for (const bad of [null, 'string', 42, { schemaVersion: 99 }]) {
    const decoded = decodeCalibrationMetadata(bad);
    assert.equal(decoded.kind, 'invalid', `payload ${JSON.stringify(bad)}`);
    assert.ok(decoded.diagnostics.length > 0);
  }
});

test('encode throws on empty accepted set', () => {
  assert.throws(() => encodeCalibrationMetadata({ accepted: [], workingUnit: 'feet', imageRevision: 'r' }));
});

test('mixed-unit v1 envelope decodes via shared unit-normalised mean', () => {
  // 20 ft over 100 px and 3.048 m (= 10 ft) over 50 px are equivalent 0.2 ft/px.
  const accepted = [
    ref(),
    ref({ id: 'ref-m', sceneP1: { x: 0, y: 0 }, sceneP2: { x: 0, y: 50 }, confirmedDistance: 3.048, confirmedUnit: 'm' }),
  ];
  const env = encodeCalibrationMetadata({ accepted, workingUnit: 'feet', imageRevision: 'rev' });
  const decoded = decodeCalibrationMetadata(JSON.parse(JSON.stringify(env)));
  if (decoded.kind !== 'v1') assert.fail(`expected v1, got ${decoded.kind}`);
  assert.equal(decoded.status, 'valid');
  assert.ok(Math.abs(decoded.effective.scale - 0.2) < 1e-9);
});
