// Point controller semantics (spec §6) + nudge math (§5.7) + offscreen
// reveal (§5.5). Controller wrap/insert/delete enablement and T11-style
// current-index usage; insertion/deletion GEOMETRY itself is proven in the M1
// precisionEditor tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canDeleteVertex,
  canInsertAfter,
  indexOfVertexId,
  minimalRevealTranslation,
  neighbourIndex,
  nudgeSceneDelta,
} from './pointNavigation';

const p = (x: number, y: number) => ({ x, y });

// ─── §6.2 previous/next in stored perimeter order ──────────────────────────

test('closed outline wraps: previous of first is last, next of last is first', () => {
  assert.equal(neighbourIndex(12, true, 0, -1), 11);
  assert.equal(neighbourIndex(12, true, 11, 1), 0);
  assert.equal(neighbourIndex(12, true, 6, 1), 7);
  assert.equal(neighbourIndex(12, true, 6, -1), 5);
});

test('open path does NOT wrap: missing neighbour is null at the ends', () => {
  assert.equal(neighbourIndex(5, false, 0, -1), null);
  assert.equal(neighbourIndex(5, false, 4, 1), null);
  assert.equal(neighbourIndex(5, false, 0, 1), 1);
  assert.equal(neighbourIndex(5, false, 4, -1), 3);
});

test('no selection: either arrow selects the FIRST vertex (deterministic)', () => {
  assert.equal(neighbourIndex(12, true, -1, 1), 0);
  assert.equal(neighbourIndex(12, true, -1, -1), 0);
  assert.equal(neighbourIndex(0, true, -1, 1), null); // empty draft: nothing to select
});

test('stored order traversal is never positional (contract: index math only)', () => {
  // neighbourIndex works purely on indices — the controller passes the draft's
  // stored array order, so concave corners/reordered inputs traverse exactly
  // as stored (R07). A 40-point concave outline needs no special casing:
  for (let i = 0; i < 40; i++) {
    assert.equal(neighbourIndex(40, true, i, 1), (i + 1) % 40);
    assert.equal(neighbourIndex(40, true, i, -1), (i - 1 + 40) % 40);
  }
});

// ─── §6.3 insert enablement ────────────────────────────────────────────────

test('insert-after is enabled for every closed vertex (last uses first as successor)', () => {
  for (let i = 0; i < 4; i++) assert.equal(canInsertAfter(4, true, i), true);
});

test('insert-after on an open path requires a real successor — last vertex disabled', () => {
  assert.equal(canInsertAfter(5, false, 3), true);
  assert.equal(canInsertAfter(5, false, 4), false);
  assert.equal(canInsertAfter(5, false, -1), false); // no selection
});

// ─── §6.4 delete enablement ────────────────────────────────────────────────

test('closed outline keeps a 3-point minimum for deletion; open path may shrink to zero', () => {
  assert.equal(canDeleteVertex(3, true, 1), false);  // would leave 2
  assert.equal(canDeleteVertex(4, true, 1), true);
  assert.equal(canDeleteVertex(2, false, 0), true);
  assert.equal(canDeleteVertex(1, false, 0), true);
  assert.equal(canDeleteVertex(4, true, -1), false); // no selection
});

// ─── §5.7 nudge math via inverse-transformed screen vectors ────────────────

test('nudge at zoom 2: 1 CSS px step = 0.5 scene px; 5 px step = 2.5 scene px', () => {
  const cam = { zoom: 2, tx: 100, ty: -50 };
  assert.deepEqual(nudgeSceneDelta(cam, 'right', 1), p(0.5, 0));
  assert.deepEqual(nudgeSceneDelta(cam, 'left', 5), p(-2.5, 0));
  assert.deepEqual(nudgeSceneDelta(cam, 'up', 1), p(0, -0.5));
  assert.deepEqual(nudgeSceneDelta(cam, 'down', 5), p(0, 2.5));
});

test('nudge zooms FINER with magnification and never applies camera translation (§5.2 linear-only)', () => {
  const t1 = { zoom: 0.5, tx: 1234, ty: -9876 };
  assert.deepEqual(nudgeSceneDelta(t1, 'right', 1), p(2, 0)); // 1/zoom = 2
  // Same camera but different translation: identical result.
  const t2 = { zoom: 0.5, tx: 0, ty: 0 };
  assert.deepEqual(nudgeSceneDelta(t2, 'right', 1), p(2, 0));
});

// ─── §5.5 minimal offscreen reveal ─────────────────────────────────────────

test('minimalRevealTranslation pans just enough; already-visible point needs none; zoom untouched', () => {
  const vp = { width: 568, height: 320 };
  assert.equal(minimalRevealTranslation(p(284, 160), vp), null);
  assert.deepEqual(minimalRevealTranslation(p(-100, 160), vp, 48), p(148, 0));
  assert.deepEqual(minimalRevealTranslation(p(600, 160), vp, 48), p(-80, 0));
  assert.deepEqual(minimalRevealTranslation(p(284, -20), vp, 48), p(0, 68));
  assert.deepEqual(minimalRevealTranslation(p(-100, -20), vp, 48), p(148, 68));
});

// ─── index helper ──────────────────────────────────────────────────────────

test('indexOfVertexId maps null/unknown to -1', () => {
  assert.equal(indexOfVertexId(['a', 'b', 'c'], 'b'), 1);
  assert.equal(indexOfVertexId(['a', 'b', 'c'], null), -1);
  assert.equal(indexOfVertexId(['a', 'b', 'c'], 'zz'), -1);
});

// ─── T11: rapid taps use CURRENT index (integration contract) ──────────────

test('rapid previous/next chains with current index resolve a full loop without skipping', () => {
  // Simulates the controller reading fresh draft state on every tap (T11):
  // after insert, the array grew; navigation continues from the new position.
  const ids = ['a', 'b', 'c'];
  let cur = indexOfVertexId(ids, null); // -1
  cur = neighbourIndex(ids.length, true, cur, 1); // → 0 (first)
  assert.equal(ids[cur], 'a');
  // Insert after 'a' → ['a','new','b','c'], selection on 'new' (M1 command).
  const afterInsert = ['a', 'new', 'b', 'c'];
  cur = afterInsert.indexOf('new'); // 1 — controller uses CURRENT ids
  cur = neighbourIndex(afterInsert.length, true, cur, 1);
  assert.equal(afterInsert[cur], 'b');
  cur = neighbourIndex(afterInsert.length, true, cur, -1);
  assert.equal(afterInsert[cur], 'new'); // no stale 'a'
});
