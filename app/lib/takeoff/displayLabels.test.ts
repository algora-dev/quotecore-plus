import test from 'node:test';
import assert from 'node:assert/strict';
import { takeoffDisplayName } from './displayLabels';

test('expands roofing component names for visible UI', () => {
  assert.equal(takeoffDisplayName('Barge'), 'Barge (Rake)');
  assert.equal(takeoffDisplayName('Spouting'), 'Spouting (Gutter)');
});

test('does not duplicate expanded terminology or alter unrelated names', () => {
  assert.equal(takeoffDisplayName('Barge (Rake)'), 'Barge (Rake)');
  assert.equal(takeoffDisplayName('Spouting (Gutter)'), 'Spouting (Gutter)');
  assert.equal(takeoffDisplayName('Roof Area'), 'Roof Area');
});
