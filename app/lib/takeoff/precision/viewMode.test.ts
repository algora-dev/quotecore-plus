// Mobile takeoff M2: view-mode resolution tests (spec §3.1, §14.6 L01/L02/L04).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_TOUCH_MAX_SHORT_EDGE,
  VIEW_PREFERENCE_STORAGE_KEY,
  createPreferencePersistence,
  parseStoredPreference,
  readLayoutViewportCapabilities,
  recommendViewMode,
  resetSessionPreferenceMemoryForTests,
  resolveViewMode,
  type PreferenceStore,
} from './viewMode';

const phonePortrait = { primaryPointerCoarse: true, layoutViewport: { width: 390, height: 844 } };
const phoneLandscape = { primaryPointerCoarse: true, layoutViewport: { width: 844, height: 390 } };
const tablet = { primaryPointerCoarse: true, layoutViewport: { width: 1024, height: 768 } };
const desktop = { primaryPointerCoarse: false, layoutViewport: { width: 1920, height: 1080 } };
const hybridLaptop = { primaryPointerCoarse: false, layoutViewport: { width: 1440, height: 900 } };

test('L01: Auto recommends touch for coarse-pointer phones in both orientations', () => {
  assert.equal(recommendViewMode(phonePortrait), 'mobile-touch');
  assert.equal(recommendViewMode(phoneLandscape), 'mobile-touch');
});

test('L01: Auto recommends desktop for fine pointers regardless of size', () => {
  assert.equal(recommendViewMode(desktop), 'desktop');
  assert.equal(recommendViewMode(hybridLaptop), 'desktop');
});

test('L01: Auto recommends desktop for coarse pointers above the short-edge threshold', () => {
  // Large tablet 1366x1024: shorter edge 1024 > 820 → desktop.
  assert.equal(
    recommendViewMode({ primaryPointerCoarse: true, layoutViewport: { width: 1366, height: 1024 } }),
    'desktop',
  );
  // Mid tablet 1024x768: shorter edge 768 ≤ 820 → touch (spec threshold).
  assert.equal(recommendViewMode(tablet), 'mobile-touch');
  // Boundary: exactly at the threshold is touch; one above is desktop.
  assert.equal(
    recommendViewMode({ primaryPointerCoarse: true, layoutViewport: { width: AUTO_TOUCH_MAX_SHORT_EDGE, height: 1600 } }),
    'mobile-touch',
  );
  assert.equal(
    recommendViewMode({ primaryPointerCoarse: true, layoutViewport: { width: AUTO_TOUCH_MAX_SHORT_EDGE + 1, height: 1600 } }),
    'desktop',
  );
});

test('L01: boundary uses the SHORTER layout edge (landscape phone passes)', () => {
  // 844x390 landscape phone: shorter edge 390 ≤ 820 → touch even though the
  // long edge is large.
  assert.equal(recommendViewMode(phoneLandscape), 'mobile-touch');
});

test('L01: explicit preference always wins over the Auto recommendation', () => {
  assert.equal(resolveViewMode('desktop', phonePortrait), 'desktop');
  assert.equal(resolveViewMode('mobile-touch', desktop), 'mobile-touch');
  assert.equal(resolveViewMode('auto', phonePortrait), 'mobile-touch');
  assert.equal(resolveViewMode(null, desktop), 'desktop');
  assert.equal(resolveViewMode(undefined, desktop), 'desktop');
});

test('L01: malformed stored values fall back to Auto', () => {
  assert.equal(parseStoredPreference('mobile'), null);
  assert.equal(parseStoredPreference('{"mode":"touch"}'), null);
  assert.equal(parseStoredPreference(null), null);
  assert.equal(parseStoredPreference('desktop'), 'desktop');
  assert.equal(parseStoredPreference('auto'), 'auto');
});

test('L02: PWA display mode alone never flips the recommendation', () => {
  // Desktop PWA (standalone, fine pointer) stays desktop.
  assert.equal(recommendViewMode({ ...desktop, displayMode: 'standalone' }), 'desktop');
  // Mobile browser (no standalone) still gets touch.
  assert.equal(recommendViewMode({ ...phonePortrait, displayMode: 'browser' }), 'mobile-touch');
});

test('L04: heuristic consumes only the layout viewport — a keyboard-shrunk visual viewport is invisible', () => {
  // The capabilities type physically has no visual-viewport input; simulate the
  // keyboard case by showing layout viewport stays the authoritative source:
  // phone with keyboard open still reports full-height layout viewport.
  const caps = readLayoutViewportCapabilities({
    innerWidth: 390,
    innerHeight: 844, // layout viewport unaffected by keyboard
    matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }),
  });
  assert.equal(recommendViewMode(caps), 'mobile-touch');
});

test('readLayoutViewportCapabilities: pointer media failure degrades to fine pointer', () => {
  const caps = readLayoutViewportCapabilities({
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: () => {
      throw new Error('matchMedia unavailable');
    },
  });
  assert.equal(caps.primaryPointerCoarse, false);
  assert.equal(recommendViewMode(caps), 'desktop');
});

test('L01: preference persistence round-trips through a working store', () => {
  const backing = new Map<string, string>();
  const store: PreferenceStore = {
    getItem: (k) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k, v) => void backing.set(k, v),
  };
  const persistence = createPreferencePersistence(store);
  assert.equal(persistence.read(), null); // absent = Auto
  persistence.write('mobile-touch');
  assert.equal(persistence.read(), 'mobile-touch');
  assert.equal(backing.get(VIEW_PREFERENCE_STORAGE_KEY), 'mobile-touch');

  // A second instance (fresh hook) sees the persisted value.
  assert.equal(createPreferencePersistence(store).read(), 'mobile-touch');
});

test('storage failure falls back to session memory without throwing', () => {
  resetSessionPreferenceMemoryForTests();
  const throwingStore: PreferenceStore = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceeded');
    },
  };
  const persistence = createPreferencePersistence(throwingStore);
  assert.equal(persistence.read(), null);
  assert.doesNotThrow(() => persistence.write('desktop'));
  // Session fallback returns the value for this session (same module map).
  const again = createPreferencePersistence(throwingStore);
  assert.equal(again.read(), 'desktop');
});

test('null store (no window) still supports session-memory persistence', () => {
  resetSessionPreferenceMemoryForTests();
  const persistence = createPreferencePersistence(null);
  assert.equal(persistence.read(), null);
  persistence.write('auto');
  assert.equal(createPreferencePersistence(null).read(), 'auto');
});

test('no oscillation: hybrid device with fine primary pointer stays desktop even at phone width', () => {
  // Hybrid laptop with the on-screen keyboard: fine primary pointer → desktop.
  const hybrid = { primaryPointerCoarse: false, layoutViewport: { width: 500, height: 800 } };
  assert.equal(recommendViewMode(hybrid), 'desktop');
  // And the same resolution is stable across repeated calls.
  for (let i = 0; i < 3; i++) {
    assert.equal(resolveViewMode('auto', hybrid), 'desktop');
  }
});
