// Mobile takeoff M2: scene/viewport split tests (spec §2.1 trap 1, §10,
// §14.6 L03/L04 geometry invariants).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitCamera,
  pinchCamera,
  sceneDeltaFromCameraClientDelta,
  sceneDimsFromSource,
  scenePointToViewport,
  sceneToClient,
  viewportToScene,
  type Camera,
} from './sceneViewport';
import { applyAffine, MAX_CANVAS_DIM } from '../calibrationCoordinates';

const square = { width: 1000, height: 1000 };

test('sceneDimsFromSource: long edge capped at 2000, aspect preserved', () => {
  const s = sceneDimsFromSource(6000, 4000, 'rev-1');
  assert.equal(s.width, 2000);
  assert.equal(s.height, 2000 * (4000 / 6000));
  assert.equal(s.imageRevision, 'rev-1');
});

test('sceneDimsFromSource: small sources are NOT upscaled (scale min(1, ...))', () => {
  const s = sceneDimsFromSource(800, 600);
  assert.equal(s.width, 800);
  assert.equal(s.height, 600);
});

test('sceneDimsFromSource rejects invalid sources', () => {
  assert.throws(() => sceneDimsFromSource(0, 100));
  assert.throws(() => sceneDimsFromSource(NaN, 100));
});

test('R11: scene dims are INDEPENDENT of viewport size (the §2.1 trap 1 regression)', () => {
  // Same source, wildly different viewports (desktop 1920x1080 vs phone
  // 568x320 landscape vs rotated 320x568) → identical scene descriptor.
  const desktop = sceneDimsFromSource(5000, 3000);
  const phoneLandscape = sceneDimsFromSource(5000, 3000);
  const phonePortrait = sceneDimsFromSource(5000, 3000);
  assert.deepEqual(desktop, phoneLandscape);
  assert.deepEqual(desktop, phonePortrait);
  assert.equal(desktop.width, MAX_CANVAS_DIM);
});

test('R11: stored scene geometry is unchanged across camera/viewport/layout switches', () => {
  const stored = [
    { x: 100.25, y: 80.5 },
    { x: 940.75, y: 120.125 },
    { x: 500, y: 1900.5 },
  ];
  const camera1: Camera = { zoom: 2, tx: 40, ty: -60 };
  const camera2: Camera = { zoom: 0.5, tx: 0, ty: 0 };
  // Render through each camera and invert back: scene values round-trip.
  for (const camera of [camera1, camera2, fitCamera(square, { width: 568, height: 320 })]) {
    const inv = viewportToScene(camera);
    for (const p of stored) {
      const client = scenePointToViewport(camera, p);
      const back = applyAffine(inv, client);
      assert.ok(Math.abs(back.x - p.x) < 1e-6);
      assert.ok(Math.abs(back.y - p.y) < 1e-6);
    }
  }
});

test('remote-drag delta uses the linear part only, DPR-independent (§17.4 E)', () => {
  const delta = { x: 40, y: -20 };
  // zoom 2 → scene delta (20, -10); zoom 0.5 → (80, -40). Identical for any DPR.
  assert.deepEqual(sceneDeltaFromCameraClientDelta({ zoom: 2, tx: 999, ty: -999 }, delta), { x: 20, y: -10 });
  assert.deepEqual(sceneDeltaFromCameraClientDelta({ zoom: 0.5, tx: 0, ty: 0 }, delta), { x: 80, y: -40 });
  // Translation must NOT leak into the delta:
  const a = sceneDeltaFromCameraClientDelta({ zoom: 2, tx: 0, ty: 0 }, delta);
  const b = sceneDeltaFromCameraClientDelta({ zoom: 2, tx: 12345, ty: -12345 }, delta);
  assert.deepEqual(a, b);
});

test('sceneToClient composes the interaction-surface rect offset (§10.2)', () => {
  const camera: Camera = { zoom: 1, tx: 10, ty: 20 };
  const t = sceneToClient(camera, { left: 100, top: 50 });
  const client = applyAffine(t, { x: 0, y: 0 });
  assert.deepEqual(client, { x: 110, y: 70 }); // 10+100, 20+50
});

test('fitCamera: fits inside viewport with margin, centred, works at 568x320 (L03)', () => {
  const camera = fitCamera(square, { width: 568, height: 320 }, 0.05);
  const w = square.width * camera.zoom;
  const h = square.height * camera.zoom;
  assert.ok(w <= 568 && h <= 320);
  assert.ok(camera.tx >= 0 && camera.ty >= 0);
  // Centred: equal leftover space left/right and top/bottom.
  assert.ok(Math.abs(568 - w - 2 * camera.tx) < 1e-9);
  assert.ok(Math.abs(320 - h - 2 * camera.ty) < 1e-9);
});

test('fitCamera: portrait viewport still fits the same scene without changing scene dims', () => {
  const wideScene = { width: 2000, height: 1000 };
  const landscape = fitCamera(wideScene, { width: 568, height: 320 });
  const portrait = fitCamera(wideScene, { width: 320, height: 568 });
  // Different cameras for the same scene — only the camera changed, never the scene.
  assert.ok(Math.abs(landscape.zoom - 0.9 * 568 / 2000) < 1e-9);
  assert.ok(Math.abs(portrait.zoom - 0.9 * 320 / 2000) < 1e-9);
  assert.notEqual(landscape.zoom, portrait.zoom);
  assert.equal(wideScene.width, 2000);
});

test('pinchCamera: anchor point stays fixed under the gesture midpoint (§5.4)', () => {
  const camera0: Camera = { zoom: 1, tx: 50, ty: 50 };
  const startMid = { x: 300, y: 200 };
  const anchorScene = applyAffine(viewportToScene(camera0), startMid);
  // Zoom in 2x while the midpoint drifts.
  const camera1 = pinchCamera(
    camera0,
    { mid: startMid, distance: 100 },
    { mid: { x: 320, y: 210 }, distance: 200 },
    { min: 0.1, max: 10 },
  );
  assert.ok(Math.abs(camera1.zoom - 2) < 1e-9);
  const anchorAfter = applyAffine(viewportToScene(camera1), { x: 320, y: 210 });
  assert.ok(Math.abs(anchorAfter.x - anchorScene.x) < 1e-6);
  assert.ok(Math.abs(anchorAfter.y - anchorScene.y) < 1e-6);
});

test('pinchCamera: zoom clamps recompute translation so the anchor is stable', () => {
  const camera0: Camera = { zoom: 1, tx: 0, ty: 0 };
  const startMid = { x: 100, y: 100 };
  // Try to zoom 100x past a max of 4.
  const camera1 = pinchCamera(
    camera0,
    { mid: startMid, distance: 100 },
    { mid: startMid, distance: 10000 },
    { min: 0.1, max: 4 },
  );
  assert.equal(camera1.zoom, 4);
  // Anchor (scene point 100,100) remains under the same client point.
  const client = scenePointToViewport(camera1, { x: 100, y: 100 });
  assert.ok(Math.abs(client.x - 100) < 1e-6 && Math.abs(client.y - 100) < 1e-6);
});

test('pinchCamera rejects near-zero starting distance', () => {
  assert.throws(() =>
    pinchCamera({ zoom: 1, tx: 0, ty: 0 }, { mid: { x: 0, y: 0 }, distance: 0 }, { mid: { x: 5, y: 5 }, distance: 50 }, { min: 0.1, max: 10 }),
  );
});
