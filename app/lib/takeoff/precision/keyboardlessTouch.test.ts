import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editNumberText, parseRailNumber, stepPitch, DEFAULT_ROOF_NAME, DEFAULT_ROOF_PITCH, type NumberKey } from './touchNumberEntry';
import { canPlaceCalibrationPoint, canEditCalibrationPoints, pointIsOnPlan, type TouchCalibrationStep } from './touchCalibrationFlow';
import { resizePrecisionCamera } from './touchCamera';
import { fitCamera, scenePointToViewport } from './sceneViewport';
import { createSingleFlight } from './touchSaveFlight';

const type = (keys: NumberKey[], initial = '') => keys.reduce(editNumberText, initial);
test('mobile defaults need neither text entry nor AI metadata', () => {
  assert.equal(DEFAULT_ROOF_NAME, 'Main Roof'); assert.equal(DEFAULT_ROOF_PITCH, 25);
});
test('keypad preserves fractional strings until confirmation', () => {
  assert.equal(type(['9', '.', '1', '5']), '9.15');
  assert.equal(type(['.', '0', '5']), '0.05');
  assert.equal(type(['0', '0', '9']), '9');
  assert.equal(type(['1', '.', '.', '2']), '1.2');
});
test('backspace, clear and digit limit are deterministic', () => {
  assert.equal(type(['backspace'], '9.15'), '9.1');
  assert.equal(type(['clear', '2'], '9.15'), '2');
  assert.equal(type(['backspace'], ''), '');
  assert.equal(type(['3'], '123456789012'), '123456789012');
});
for (const value of ['', '.', '-1', '+1', '1e3', 'NaN', 'Infinity', '1,25', '4m', ' 4', '4.5.6']) {
  test(`reject non-keypad number ${JSON.stringify(value)}`, () => {
    assert.equal(parseRailNumber(value, 'distance').ok, false);
    assert.equal(parseRailNumber(value, 'pitch').ok, false);
  });
}
for (const value of ['0', '0.0', '00']) test(`distance ${value} cannot establish a scale`, () => {
  assert.equal(parseRailNumber(value, 'distance').ok, false);
});
for (const value of ['0', '25', '25.5', '89.9']) test(`valid exact pitch ${value}`, () => {
  assert.deepEqual(parseRailNumber(value, 'pitch'), { ok: true, value: Number(value) });
});
for (const value of ['90', '90.1', '999']) test(`reject pitch ${value}`, () => {
  assert.equal(parseRailNumber(value, 'pitch').ok, false);
});
test('one-degree arrows preserve typed fractions and legal bounds', () => {
  assert.equal(stepPitch(25, 1), 26); assert.equal(stepPitch(25, -1), 24);
  assert.equal(stepPitch(25.5, 1), 26.5); assert.equal(stepPitch(0, -1), 0);
  assert.equal(stepPitch(89, 1), 89); assert.equal(stepPitch(89.9, 1), 89.9);
});
for (const step of ['find', 'distance', 'references', 'ai'] as TouchCalibrationStep[]) {
  test(`${step} is view-only, never tap-to-place or remote-point-drag`, () => {
    for (let count = 0; count <= 3; count++) assert.equal(canPlaceCalibrationPoint(step, count), false);
    assert.equal(canEditCalibrationPoints(step), false);
  });
}
test('A and B cannot be accidentally added before their explicit step', () => {
  assert.equal(canPlaceCalibrationPoint('start', 0), true);
  assert.equal(canPlaceCalibrationPoint('start', 1), false);
  assert.equal(canPlaceCalibrationPoint('end', 0), false);
  assert.equal(canPlaceCalibrationPoint('end', 1), true);
  assert.equal(canPlaceCalibrationPoint('end', 2), false);
});
test('off-plan or non-finite taps are rejected', () => {
  const scene = { width: 1200, height: 800 };
  assert.equal(pointIsOnPlan({ x: 0, y: 800 }, scene), true);
  for (const p of [{ x: -1, y: 0 }, { x: 1201, y: 0 }, { x: 0, y: 801 }, { x: NaN, y: 1 }, { x: 1, y: Infinity }]) {
    assert.equal(pointIsOnPlan(p, scene), false);
  }
});
for (const viewport of [{ width: 636, height: 390 }, { width: 572, height: 390 }, { width: 296, height: 320 }]) {
  test(`initial fit contains whole plan in ${viewport.width}x${viewport.height}`, () => {
    const scene = { width: 2000, height: 1300 };
    const c = fitCamera(scene, viewport);
    const a = scenePointToViewport(c, { x: 0, y: 0 });
    const b = scenePointToViewport(c, { x: scene.width, y: scene.height });
    assert.ok(a.x >= 0 && a.y >= 0 && b.x <= viewport.width && b.y <= viewport.height);
  });
}
test('opening keypad refits an untouched fit but never rewrites geometry', () => {
  const scene = { width: 1200, height: 800 }, old = { width: 636, height: 390 }, next = { width: 572, height: 390 };
  assert.deepEqual(resizePrecisionCamera(fitCamera(scene, old), old, next, scene), fitCamera(scene, next));
});
test('keypad resize preserves user camera centre and zoom after exploration', () => {
  const c = { zoom: 2.5, tx: -100, ty: -230 }, old = { width: 636, height: 390 }, next = { width: 572, height: 320 };
  const n = resizePrecisionCamera(c, old, next, { width: 1200, height: 800 });
  assert.equal(n.zoom, c.zoom);
  assert.equal((old.width / 2 - c.tx) / c.zoom, (next.width / 2 - n.tx) / n.zoom);
  assert.equal((old.height / 2 - c.ty) / c.zoom, (next.height / 2 - n.ty) / n.zoom);
  assert.strictEqual(resizePrecisionCamera(c, old, old, { width: 1200, height: 800 }), c);
});
test('double save shares the same real acknowledgement', async () => {
  const flight = createSingleFlight<string>(); let calls = 0;
  let finish!: (value: string) => void;
  const operation = () => { calls++; return new Promise<string>(resolve => { finish = resolve; }); };
  const first = flight.run(operation), second = flight.run(operation);
  assert.strictEqual(first, second); assert.equal(flight.isPending(), true);
  await Promise.resolve(); assert.equal(calls, 1);
  finish('actual acknowledgement'); assert.equal(await second, 'actual acknowledgement');
  assert.equal(flight.isPending(), false);
});
test('settled failure releases save latch without inventing success', async () => {
  const flight = createSingleFlight<boolean>();
  await assert.rejects(flight.run(async () => { throw new Error('DB unavailable'); }), /DB unavailable/);
  assert.equal(flight.isPending(), false);
  assert.equal(await flight.run(async () => true), true);
});
