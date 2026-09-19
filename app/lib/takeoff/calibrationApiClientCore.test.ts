// Pure unit tests for the P6 calibration API client core: failure
// classification, response validation and the server->client frame mapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCalibrationHttpFailure,
  evidenceCropsForDisplay,
  mapCandidatesToClientFrame,
  parseCalibrationSearchResponse,
  type ServerCalibrationCandidate,
} from './calibrationApiClientCore';
import type { CalibrationImageDescriptor } from './calibrationTypes';
import { makeCandidate } from './calibrationSession';

function clientImage(overrides: Partial<CalibrationImageDescriptor> = {}): CalibrationImageDescriptor {
  return {
    pageId: 'page-1',
    imageRevision: 'client-rev',
    sourceWidth: 1000,
    sourceHeight: 500,
    sceneWidth: 1000,
    sceneHeight: 500,
    sourceToScene: [1, 0, 0, 1, 0, 0],
    coordinateFrame: 'takeoff-scene-v1',
    geometryVersion: 1,
    ...overrides,
  };
}

// ── classifyCalibrationHttpFailure ────────────────────────────────────────

test('network failure (null status) is recoverable', () => {
  const c = classifyCalibrationHttpFailure(null);
  assert.equal(c.recoverable, true);
  assert.equal(c.terminalPolicy, false);
});

test('401 and 429 are recoverable despite being 4xx', () => {
  assert.equal(classifyCalibrationHttpFailure(401).recoverable, true);
  assert.equal(classifyCalibrationHttpFailure(429).recoverable, true);
});

test('other 4xx are terminal policy failures with specific copy', () => {
  const forbidden = classifyCalibrationHttpFailure(403, 'FORBIDDEN');
  assert.equal(forbidden.recoverable, false);
  assert.equal(forbidden.terminalPolicy, true);

  const quota = classifyCalibrationHttpFailure(402, 'INSUFFICIENT_POINTS');
  assert.equal(quota.recoverable, false);
  assert.match(quota.message, /points limit|manually/i);

  const conflict = classifyCalibrationHttpFailure(409, 'REQUEST_CONFLICT');
  assert.match(conflict.message, /No more searches/);
});

test('5xx is recoverable and flagged terminal-technical for linked retry', () => {
  const c = classifyCalibrationHttpFailure(502);
  assert.equal(c.recoverable, true);
  assert.equal(c.terminalTechnical, true);
  assert.match(c.message, /No points were charged/);
});

// ── parseCalibrationSearchResponse ────────────────────────────────────────

function okBody(): Record<string, unknown> {
  return {
    success: true,
    action: 'search',
    status: 'candidates',
    round: 0,
    pageId: 'page-1',
    imageRevision: 'sha256-abc-on1',
    sourceWidth: 2000,
    sourceHeight: 1000,
    candidates: [],
    notes: [],
    completedSearchRounds: 1,
    rescanAvailable: true,
    roundToken: 'tok',
    pointsCharged: 1,
    pointsRemaining: 9,
    detectorVersion: 'calibration-p5',
  };
}

test('valid response parses with full typing', () => {
  const parsed = parseCalibrationSearchResponse(okBody());
  assert.ok(parsed);
  assert.equal(parsed.status, 'candidates');
  assert.equal(parsed.sourceWidth, 2000);
  assert.equal(parsed.roundToken, 'tok');
});

test('malformed payloads are rejected', () => {
  assert.equal(parseCalibrationSearchResponse(null), null);
  assert.equal(parseCalibrationSearchResponse({ ...okBody(), success: false }), null);
  assert.equal(parseCalibrationSearchResponse({ ...okBody(), status: 'weird' }), null);
  assert.equal(parseCalibrationSearchResponse({ ...okBody(), round: 2 }), null);
  // > 3 candidates violates the slot contract.
  const many = { ...okBody(), candidates: [1, 2, 3, 4] };
  assert.equal(parseCalibrationSearchResponse(many), null);
});

test('candidate structural violations are rejected', () => {
  const badPoint = {
    ...okBody(),
    candidates: [{ ...makeCandidate({ id: 'c1' }), sourceP1: { x: 'no', y: 0 } as unknown as { x: number; y: number } }],
  };
  assert.equal(parseCalibrationSearchResponse(badPoint), null);
  const badCrop = {
    ...okBody(),
    candidates: [{ ...makeCandidate({ id: 'c1' }), evidence: { crops: [{ kind: 'mystery', dataUri: 'data:image/jpeg;base64,x' }] } }],
  };
  assert.equal(parseCalibrationSearchResponse(badCrop), null);
});

// ── mapCandidatesToClientFrame ────────────────────────────────────────────

function serverCandidate(): ServerCalibrationCandidate {
  return {
    ...makeCandidate({
      id: 'sc1',
      imageRevision: 'sha256-abc-on1',
      sceneP1: { x: 0, y: 0 }, // server frame placeholder; mapping uses sourceP
      sceneP2: { x: 0, y: 0 },
    }),
    sourceP1: { x: 100, y: 50 },
    sourceP2: { x: 1100, y: 50 },
    evidence: {
      ...makeCandidate({ id: 'sc1' }).evidence,
      crops: [
        { kind: 'endpoint-a', dataUri: 'data:image/jpeg;base64,AAA' },
        { kind: 'endpoint-b', dataUri: 'data:image/jpeg;base64,BBB' },
        { kind: 'label', dataUri: 'data:image/jpeg;base64,CCC' },
      ],
    },
  };
}

test('uniform scale maps server source pixels into the client scene frame', () => {
  // Server source 2000x1000 -> client scene 1000x500 (scale 0.5).
  const image = clientImage();
  const result = mapCandidatesToClientFrame([serverCandidate()], { width: 2000, height: 1000 }, image);
  assert.ok(result.ok);
  const c = result.candidates[0];
  assert.deepEqual(c.sceneP1, { x: 50, y: 25 });
  assert.deepEqual(c.sceneP2, { x: 550, y: 25 });
  assert.equal(c.scenePixelLength, 500);
  // Client session revision stamp (reducer frame guard) applied.
  assert.equal(c.imageRevision, 'client-rev');
  // Server identity + evidence preserved verbatim.
  assert.equal(c.referenceId, serverCandidate().referenceId);
  assert.equal(c.evidence.crops?.length, 3);
});

test('aspect mismatch (anisotropic client frame) fails honestly', () => {
  const image = clientImage({ sceneWidth: 1000, sceneHeight: 400 }); // 2:1 vs 2:2
  const result = mapCandidatesToClientFrame([serverCandidate()], { width: 2000, height: 1000 }, image);
  assert.ok(!result.ok);
  assert.equal(result.reason, 'anisotropic_frame_mismatch');
});

test('missing source crops survive mapping as-is', () => {
  const bare = { ...serverCandidate(), evidence: { ...serverCandidate().evidence, crops: undefined } };
  const result = mapCandidatesToClientFrame([bare], { width: 1000, height: 500 }, clientImage());
  assert.ok(result.ok);
  assert.equal(result.candidates[0].evidence.crops, undefined);
});

// ── evidenceCropsForDisplay ───────────────────────────────────────────────

test('display crops are labelled and ordered', () => {
  const c = serverCandidate();
  // Strip server-only shape; the display helper only needs evidence.crops.
  const crops = evidenceCropsForDisplay(c);
  assert.deepEqual(crops.map((x) => x.label), ['Start point', 'End point', 'Label']);
  assert.ok(crops.every((x) => x.url.startsWith('data:image/jpeg;base64,')));
});

test('no candidate or no crops yield an empty display list', () => {
  assert.deepEqual(evidenceCropsForDisplay(null), []);
  const bare = serverCandidate();
  assert.deepEqual(evidenceCropsForDisplay({ ...bare, evidence: { ...bare.evidence, crops: undefined } }), []);
});
