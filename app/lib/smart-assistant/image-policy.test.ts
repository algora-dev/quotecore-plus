import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PHOTO_MARKER,
  formatPhotoMeasurementsMessage,
  isSaImageType,
  parseExtractedMeasurements,
} from './image-policy';

test('isSaImageType accepts vision-readable photos only', () => {
  assert.equal(isSaImageType('image/jpeg'), true);
  assert.equal(isSaImageType('image/png'), true);
  assert.equal(isSaImageType('image/webp'), true);
  assert.equal(isSaImageType('image/gif'), false);
  assert.equal(isSaImageType('application/pdf'), false);
  assert.equal(isSaImageType('text/plain'), false);
  assert.equal(isSaImageType(''), false);
});

test('parseExtractedMeasurements keeps good rows and drops malformed ones', () => {
  const parsed = parseExtractedMeasurements({
    items: [
      { label: 'ridge', quantity: '8.2', unit: 'lm' },
      { label: '', quantity: '5', unit: 'm' },
      { label: 'hip', quantity: '', unit: 'lm' },
      { label: 'roof area', quantity: '120', unit: 'm2' },
      'garbage',
    ],
    pitch: '25 deg',
    basis: 'PLAN',
    clientName: 'John Smith',
    jobName: 'Reroof',
    address: '123 Main St',
    notes: 'Two-storey',
  });
  assert.ok(parsed);
  assert.deepEqual(parsed.items, [
    { label: 'ridge', quantity: '8.2', unit: 'lm' },
    { label: 'roof area', quantity: '120', unit: 'm2' },
  ]);
  assert.equal(parsed.pitch, '25 deg');
  assert.equal(parsed.basis, 'plan');
  assert.equal(parsed.clientName, 'John Smith');
});

test('parseExtractedMeasurements rejects unknown basis and clamps long strings', () => {
  const parsed = parseExtractedMeasurements({
    items: [{ label: 'x'.repeat(200), quantity: '1' }],
    basis: 'sideways',
    notes: 'n'.repeat(500),
  });
  assert.ok(parsed);
  assert.equal(parsed.basis, '');
  assert.equal(parsed.items[0].label.length, 80);
  assert.equal(parsed.notes.length, 160);
});

test('parseExtractedMeasurements returns null for non-object payloads', () => {
  assert.equal(parseExtractedMeasurements(null), null);
  assert.equal(parseExtractedMeasurements('text'), null);
  assert.equal(parseExtractedMeasurements(42), null);
});

test('formatPhotoMeasurementsMessage renders the full shape with the marker', () => {
  const text = formatPhotoMeasurementsMessage({
    items: [
      { label: 'ridge', quantity: '8.2', unit: 'lm' },
      { label: 'hip', quantity: '6.1', unit: 'lm' },
    ],
    pitch: '25 deg',
    basis: 'plan',
    clientName: 'John Smith',
    jobName: 'Reroof',
    address: '123 Main St',
    notes: '',
  });
  assert.ok(text.startsWith(PHOTO_MARKER));
  assert.match(text, /- ridge: 8\.2 lm/);
  assert.match(text, /- hip: 6\.1 lm/);
  assert.match(text, /- Pitch: 25 deg/);
  assert.match(text, /- Basis: plan/);
  assert.match(text, /- Client: John Smith · 123 Main St/);
  assert.match(text, /- Job: Reroof/);
  // Notes omitted entirely when empty.
  assert.doesNotMatch(text, /Note:/);
});

test('formatPhotoMeasurementsMessage degrades honestly for unreadable photos', () => {
  const text = formatPhotoMeasurementsMessage({
    items: [], pitch: '', basis: '', clientName: '', jobName: '', address: '', notes: '',
  });
  assert.ok(text.startsWith(PHOTO_MARKER));
  assert.match(text, /Nothing readable was found/);
});
