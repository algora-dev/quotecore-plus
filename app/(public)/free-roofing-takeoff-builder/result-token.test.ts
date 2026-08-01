import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery } from './public-contract';
import { createResultToken, verifyResultToken, buildResultUrl } from './result-token';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from './public-contract';

// Test 1: Canonical result URLs open successfully (token round-trip)
test('canonical result URLs: token round-trip produces same calculation', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    spouting: [18],
  };
  const result = calculatePublicRoofTakeoff(input);
  assert.equal(result.success, true);
  if (!result.success) return;

  const query = toResultQuery({ ...input, mode: result.mode, units: result.units });
  const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  const payload = verifyResultToken(token);

  assert.ok(payload, 'Token must verify successfully');
  assert.equal(payload!.q, query);
  assert.equal(payload!.v, ROOF_TAKEOFF_CALCULATION_VERSION);

  // Re-calculate from the verified payload
  const restoredInput = parseQueryInput(new URLSearchParams(payload!.q));
  const restoredResult = calculatePublicRoofTakeoff(restoredInput);
  assert.equal(restoredResult.success, true);
  if (!restoredResult.success) return;
  assert.equal(restoredResult.results.components.roof_area.rawTotal, result.results.components.roof_area.rawTotal);
  assert.equal(restoredResult.results.components.hip.rawTotal, result.results.components.hip.rawTotal);
  assert.equal(restoredResult.results.components.ridge.rawTotal, result.results.components.ridge.rawTotal);
});

// Test 2: Query separators are not double-encoded in canonical query strings
test('query separators are not double-encoded in toResultQuery output', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    spouting: [18],
  };
  const query = toResultQuery(input);

  // The query must contain raw separators
  assert.ok(query.includes('&'), 'Query must contain raw & separators');
  assert.ok(query.includes('='), 'Query must contain raw = separators');
  assert.ok(!query.includes('%26'), 'Query must NOT contain encoded & (%26)');
  assert.ok(!query.includes('%3D'), 'Query must NOT contain encoded = (%3D)');
});

// Test 3: Commas and other value characters are encoded correctly
test('comma-separated values work correctly in URL construction', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 35,
    area: 150,
    hips: [4, 4, 4, 4],
    valleys: [3, 3],
    barges: [2.5, 2.5],
    ridges: [5],
  };
  const query = toResultQuery(input);

  // Parse it back
  const restored = parseQueryInput(new URLSearchParams(query));
  assert.deepEqual(restored.hips, [4, 4, 4, 4]);
  assert.deepEqual(restored.valleys, [3, 3]);
  assert.deepEqual(restored.barges, [2.5, 2.5]);
  assert.deepEqual(restored.ridges, [5]);
  assert.equal(restored.area, 150);
  assert.equal(restored.pitchDegrees, 35);
});

// Test 4: Copying resultUrl exactly returns the same calculation
test('copying resultUrl token exactly reproduces the same calculation', () => {
  const inputs = [
    { mode: 'plan' as const, units: 'metric' as const, pitchDegrees: 25, area: 126, hips: [5, 5, 5, 5], ridges: [8], valleys: [4, 4], spouting: [18] },
    { mode: 'actual' as const, units: 'metric' as const, pitchDegrees: 30, area: 200, hips: [22], ridges: [10], valleys: [12], spouting: [30] },
    { mode: 'plan' as const, units: 'imperial' as const, pitchDegrees: 35, area: 1600, hips: [16, 14, 12, 10], ridges: [28], spouting: [60] },
  ];

  for (const input of inputs) {
    const result = calculatePublicRoofTakeoff(input);
    assert.equal(result.success, true);
    if (!result.success) continue;

    const query = toResultQuery({ ...input, mode: result.mode, units: result.units });
    const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
    const url = buildResultUrl(token);

    // Extract token from URL and verify
    const extractedToken = url.split('/result/')[1];
    const payload = verifyResultToken(extractedToken);
    assert.ok(payload, `Token must verify for input: ${JSON.stringify(input)}`);

    // Re-calculate
    const restoredInput = parseQueryInput(new URLSearchParams(payload!.q));
    const restoredResult = calculatePublicRoofTakeoff(restoredInput);
    assert.equal(restoredResult.success, true);
    if (!restoredResult.success) continue;
    assert.equal(restoredResult.results.components.roof_area.rawTotal, result.results.components.roof_area.rawTotal);
  }
});

// Test 5: No analytics or tracking parameter breaks the calculation
test('tracking parameters do not break calculation', () => {
  const params = new URLSearchParams('mode=actual&units=metric&area=126&pitch=25&hips=5,5,5,5&ridge=8&valleys=4,4&gutter=18&utm_source=ai&utm_medium=test&fbclid=abc123');
  const input = parseQueryInput(params);
  const result = calculatePublicRoofTakeoff(input);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.results.components.roof_area.rawTotal, 126);
  assert.equal(result.results.components.hip.rawTotal, 20);
  assert.equal(result.results.components.ridge.rawTotal, 8);
  assert.equal(result.results.components.spouting.rawTotal, 18);
});

// Test 6: Deterministic - same inputs always produce the same token
test('same inputs always produce the same token (deterministic)', () => {
  const input = {
    mode: 'plan' as const,
    units: 'metric' as const,
    pitchDegrees: 25,
    area: 126,
    hips: [5, 5, 5, 5],
    ridges: [8],
    valleys: [4, 4],
    spouting: [18],
  };
  const result = calculatePublicRoofTakeoff(input);
  assert.equal(result.success, true);
  if (!result.success) return;

  const query = toResultQuery({ ...input, mode: result.mode, units: result.units });
  const token1 = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  const token2 = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);
  assert.equal(token1, token2, 'Same inputs must produce identical tokens');
});

// Test 7: Tampered token is rejected
test('tampered token is rejected by verifyResultToken', () => {
  const query = 'mode=plan&units=metric&area=126&pitch=25&hips=5,5,5,5&ridge=8&valleys=4,4&gutter=18';
  const token = createResultToken(query, ROOF_TAKEOFF_CALCULATION_VERSION);

  // Tamper with the payload part
  const [payloadB64, sigB64] = token.split('.');
  const tampered = `${payloadB64}TAMPERED.${sigB64}`;
  assert.equal(verifyResultToken(tampered), null);

  // Tamper with the signature part
  const tamperedSig = `${payloadB64}.${sigB64}X`;
  assert.equal(verifyResultToken(tamperedSig), null);

  // Completely garbage token
  assert.equal(verifyResultToken('garbage'), null);
  assert.equal(verifyResultToken('a.b.c'), null);
});

// Test 8: buildResultUrl produces correct paths
test('buildResultUrl produces correct paths with and without origin', () => {
  const token = createResultToken('mode=actual&units=metric&area=100', ROOF_TAKEOFF_CALCULATION_VERSION);

  const relativeUrl = buildResultUrl(token);
  assert.equal(relativeUrl, `/free-roofing-takeoff-builder/result/${token}`);

  const absoluteUrl = buildResultUrl(token, 'https://example.com');
  assert.equal(absoluteUrl, `https://example.com/free-roofing-takeoff-builder/result/${token}`);
});
