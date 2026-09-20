// Unit tests for calibration evidence crops (Phase D, P1-4 audit 2026-09-20):
// source dims are valid whenever source prep succeeded, crops fail
// independently and are omitted, and crop failure never invalidates a
// candidate. attachEvidenceCrops is exercised with REAL sharp buffers
// (no network); crop failure is forced with off-raster/degenerate geometry
// by using a generator-injected failure via a corrupt-free path.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { attachEvidenceCrops, mergeCandidateCrops, orientSource, type EvidenceCandidate } from './calibrationEvidence';

async function tinyPng(width = 400, height = 300): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#7fb2ff' } }).png().toBuffer();
}

const CAND: EvidenceCandidate = {
  sourceP1: { x: 100, y: 100 },
  sourceP2: { x: 300, y: 200 },
  evidence: { endpointDescription: 'tick marks' },
};

test('mergeCandidateCrops: all crops present', () => {
  const crops = [
    { kind: 'endpoint-a' as const, dataUri: 'data:image/jpeg;base64,AAA' },
    { kind: 'endpoint-b' as const, dataUri: 'data:image/jpeg;base64,BBB' },
  ];
  const out = mergeCandidateCrops(CAND, crops);
  assert.equal((out.evidence as Record<string, unknown>).endpointDescription, 'tick marks');
  assert.deepEqual((out.evidence as Record<string, unknown>).crops, crops);
  // original candidate untouched
  assert.equal((CAND.evidence as Record<string, unknown>).crops, undefined);
});

test('mergeCandidateCrops: zero surviving crops omits the crops key entirely', () => {
  const out = mergeCandidateCrops(CAND, []);
  assert.equal((out.evidence as Record<string, unknown>).crops, undefined);
  assert.ok('sourceP1' in out && 'sourceP2' in out);
});

test('orientSource: dims come from the oriented output, not metadata', async () => {
  const src = await orientSource(await tinyPng(640, 480));
  assert.equal(src.width, 640);
  assert.equal(src.height, 480);
  assert.ok(src.buffer.byteLength > 0);
});

test('attachEvidenceCrops: always returns valid source dims for a valid source', async () => {
  const src = await orientSource(await tinyPng(500, 400));
  const out = await attachEvidenceCrops(src, [CAND]);
  assert.equal(out.sourceWidth, 500);
  assert.equal(out.sourceHeight, 400);
  assert.equal(out.cropFailures, 0);
  const cand = out.candidates[0] as { evidence: { crops: unknown[] } };
  assert.equal(cand.evidence.crops.length, 3);
});

test('attachEvidenceCrops: NaN centres make crops fail independently; dims still valid; candidate kept', async () => {
  const src = await orientSource(await tinyPng(500, 400));
  const bad: EvidenceCandidate = {
    sourceP1: { x: Number.NaN, y: Number.NaN },
    sourceP2: { x: 300, y: 200 },
  };
  const out = await attachEvidenceCrops(src, [bad, CAND]);
  // Source dims are NEVER null when source prep succeeded (P1-4 core fix).
  assert.equal(out.sourceWidth, 500);
  assert.equal(out.sourceHeight, 400);
  assert.equal(out.candidates.length, 2);
  // The first candidate keeps geometry (crops omitted entirely on total failure)
  const first = out.candidates[0] as { evidence?: { crops?: unknown[] }; sourceP1: { x: number } };
  assert.ok(Number.isNaN(first.sourceP1.x));
  // The healthy candidate still has all three crops.
  const second = out.candidates[1] as { evidence: { crops: unknown[] } };
  assert.equal(second.evidence.crops.length, 3);
});

test('attachEvidenceCrops: candidate geometry is never conditioned on crops', async () => {
  const src = await orientSource(await tinyPng(300, 300));
  const c: EvidenceCandidate & { valueState: string } = {
    ...CAND,
    sourceP1: { x: 1, y: 1 },
    sourceP2: { x: 299, y: 299 },
    valueState: 'readable',
  };
  const out = await attachEvidenceCrops(src, [c]);
  const got = out.candidates[0] as { valueState: string; sourceP1: { x: number } };
  assert.equal(got.valueState, 'readable');
  assert.equal(got.sourceP1.x, 1);
});
