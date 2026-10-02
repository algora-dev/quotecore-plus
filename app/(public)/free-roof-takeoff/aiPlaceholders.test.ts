import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_PLACEHOLDER_COMPONENTS } from './aiPlaceholders';
import { buildSystemComponentIds } from '../../lib/takeoff/aiComponentRegistry';

// Regression (2026-10-02): the free tool passed no is_system components, so
// the AI apply guard failed with "System components not fully seeded" and the
// AI Assist Results modal hung on "Applying...".
test('free tool AI placeholders satisfy the apply guard for every lineal semantic key', () => {
  const ids = buildSystemComponentIds(AI_PLACEHOLDER_COMPONENTS);
  for (const key of ['ridges', 'hips', 'valleys', 'broken_hips', 'barges', 'spouting'] as const) {
    assert.ok(ids[key], `missing semantic component for ${key}`);
    assert.equal(typeof ids[key], 'string');
  }
});

test('placeholders stay hidden from manual pickers (is_system)', () => {
  assert.ok(AI_PLACEHOLDER_COMPONENTS.length >= 5);
  assert.ok(AI_PLACEHOLDER_COMPONENTS.every((c) => c.is_system === true));
  assert.ok(AI_PLACEHOLDER_COMPONENTS.every((c) => c.measurement_type === 'lineal'));
});
