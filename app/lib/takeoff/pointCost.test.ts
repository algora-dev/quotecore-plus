import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiScanPointCost } from './pointCost';
import { getReasoningEffort, getScanModel } from './scan-engine';

test('scan choices route to the approved models and costs', () => {
  assert.equal(getScanModel('low'), 'gpt-6-luna');
  assert.equal(getScanModel('high'), 'gpt-6.1-sol');
  assert.equal(getReasoningEffort('low'), 'low');
  assert.equal(getReasoningEffort('high'), 'low');
  assert.equal(getAiScanPointCost('low'), 2);
  assert.equal(getAiScanPointCost('high'), 12);
});

test('unknown quality falls back to the simple-roof cost', () => {
  assert.equal(getAiScanPointCost('medium'), 2);
});
