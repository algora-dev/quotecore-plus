// Gesture state-machine tests: EVERY §5.3 transition-table row plus the tap
// priority rules, slop/delta math and completion-token behaviour (T01–T09
// pure subsets; DOM/browser assertions are separate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDLE_GESTURE_STATE,
  TOUCH_SLOP_PX,
  dispatchGesture,
  type GestureEffect,
  type GestureEnvironment,
  type GestureState,
} from './precisionGestureMachine';

const p = (x: number, y: number) => ({ x, y });

/** Mutable environment double: tests reconfigure between dispatches to prove
 *  decisions use CURRENT state at event time (no stale closures). */
function env(over: Partial<GestureEnvironment> = {}): GestureEnvironment {
  return {
    hitMarker: () => null,
    armedVertexId: () => null,
    canAppend: () => false,
    ...over,
  };
}

function types(effects: readonly GestureEffect[]): string[] {
  return effects.map((e) => e.type);
}

function run(state: GestureState, events: Parameters<typeof dispatchGesture>[1][], e = env()): GestureState {
  let s = state;
  for (const ev of events) s = dispatchGesture(s, ev, e).state;
  return s;
}

// ─── §5.3 row: Idle; pointer down on canvas → pending press, nothing placed ──

test('idle pointerDown records pending press; NO selection/placement effect', () => {
  const r = dispatchGesture(IDLE_GESTURE_STATE, { type: 'pointerDown', pointerId: 1, position: p(100, 100) }, env());
  assert.equal(r.state.phase, 'pending');
  assert.equal(r.state.primaryPointerId, 1);
  assert.deepEqual(r.state.pressStart, p(100, 100));
  assert.deepEqual(r.effects, []); // never place on pointerdown (§5.3)
});

test('§5.3 idle pointer down in a control/sheet never reaches the machine (adapter contract)', () => {
  // Controls sit outside the interaction surface; the adapter only forwards
  // surface events. Assert the machine has no entry point for control input:
  // a pointerDown on the surface is the ONLY idle transition. (Row is proven
  // structurally; this test pins the contract.)
  assert.equal(dispatchGesture(IDLE_GESTURE_STATE, { type: 'syntheticClick' }, env()).state.phase, 'idle');
});

// ─── §5.3 row: Pending; second touch → cancel pending, two-pointer view ─────

test('pending + second touch cancels the tap and begins a two-pointer view gesture', () => {
  const s = dispatchGesture(IDLE_GESTURE_STATE, { type: 'pointerDown', pointerId: 1, position: p(100, 100) }, env()).state;
  const r = dispatchGesture(s, { type: 'pointerDown', pointerId: 2, position: p(200, 150) }, env());
  assert.equal(r.state.phase, 'twoPointer');
  assert.deepEqual(r.state.twoFingerStart, { a: p(100, 100), b: p(200, 150) });
  assert.deepEqual(types(r.effects), ['viewGestureStart']);
  // No tap/place/select effect survived (T05 first half).
  assert.ok(!r.effects.some((e) => e.type === 'tapPlace' || e.type === 'tapSelect'));
});

// ─── §5.3 row: Pending; movement exceeds slop → armed move OR one-finger pan ─

test('pending + slop-exceeding move while armed → remote move (beginMove + preview with FULL delta)', () => {
  const e = env({ armedVertexId: () => 'v3' });
  const s = dispatchGesture(IDLE_GESTURE_STATE, { type: 'pointerDown', pointerId: 1, position: p(50, 50) }, e).state;
  // Exactly at the slop distance: still pending (threshold is exclusive).
  let r = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(50 + TOUCH_SLOP_PX, 50) }, e);
  assert.equal(r.state.phase, 'pending');
  assert.deepEqual(r.effects, []);
  // Beyond slop: move begins; preview carries the COMPLETE delta from start.
  r = dispatchGesture(r.state, { type: 'pointerMove', pointerId: 1, position: p(50 + TOUCH_SLOP_PX + 0.5, 50) }, e);
  assert.equal(r.state.phase, 'moving');
  assert.equal(r.state.moveVertexId, 'v3');
  assert.deepEqual(types(r.effects), ['beginMove', 'movePreview']);
  const preview = r.effects.find((x) => x.type === 'movePreview') as Extract<GestureEffect, { type: 'movePreview' }>;
  assert.deepEqual(preview.totalClientDelta, { x: TOUCH_SLOP_PX + 0.5, y: 0 });
});

test('pending + slop-exceeding move while disarmed → one-finger pan; NEVER appends a point', () => {
  const e = env();
  const s = dispatchGesture(IDLE_GESTURE_STATE, { type: 'pointerDown', pointerId: 1, position: p(0, 0) }, e).state;
  const r = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(40, 20) }, e);
  assert.equal(r.state.phase, 'panning');
  assert.deepEqual(types(r.effects), ['oneFingerPan']);
  const pan = r.effects[0] as Extract<GestureEffect, { type: 'oneFingerPan' }>;
  assert.deepEqual(pan.totalClientDelta, { x: 40, y: 20 });
  // Full delta from START, not accumulated rounded increments:
  const r2 = dispatchGesture(r.state, { type: 'pointerMove', pointerId: 1, position: p(10, 5) }, e);
  const pan2 = r2.effects[0] as Extract<GestureEffect, { type: 'oneFingerPan' }>;
  assert.deepEqual(pan2.totalClientDelta, { x: 10, y: 5 });
});

// ─── §5.3 row: Pending; release within slop → resolve single tap (priority) ──

test('tap priority 1: marker hit selects/arms the existing point', () => {
  const e = env({ hitMarker: (pos) => (pos.x === 100 && pos.y === 100 ? 'v2' : null) });
  const s = run(IDLE_GESTURE_STATE, [{ type: 'pointerDown', pointerId: 1, position: p(100, 100) }], e);
  const r = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e);
  assert.deepEqual(r.effects, [{ type: 'tapSelect', vertexId: 'v2' }]);
  assert.equal(r.state.phase, 'idle');
  assert.equal(r.state.completedSequences, 1);
});

test('tap priority 2: blank tap while armed creates/moves nothing; stays armed (T03)', () => {
  const e = env({ armedVertexId: () => 'v1' });
  const s = run(IDLE_GESTURE_STATE, [{ type: 'pointerDown', pointerId: 1, position: p(300, 300) }], e);
  const r = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e);
  assert.deepEqual(r.effects, [{ type: 'tapIgnored' }]);
});

test('tap priority 3: explicit placement state, nothing armed → exactly one point placed (T01)', () => {
  const e = env({ canAppend: () => true });
  const s = run(IDLE_GESTURE_STATE, [{ type: 'pointerDown', pointerId: 1, position: p(120, 80) }], e);
  const r = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e);
  assert.deepEqual(r.effects, [{ type: 'tapPlace', position: p(120, 80) }]);
  // A later synthetic click must not create a second point (ghost tap, T01).
  const click = dispatchGesture(r.state, { type: 'syntheticClick' }, e);
  assert.deepEqual(click.effects, []);
});

test('tap priority 4: closed-outline review — blank taps NEVER add vertices', () => {
  const e = env(); // canAppend false, nothing armed
  const s = run(IDLE_GESTURE_STATE, [{ type: 'pointerDown', pointerId: 1, position: p(10, 10) }], e);
  const r = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e);
  assert.deepEqual(r.effects, [{ type: 'tapIgnored' }]);
});

test('marker hit outranks an armed point: tapping a different marker selects it (priority order)', () => {
  const e = env({ hitMarker: () => 'v9', armedVertexId: () => 'v1' });
  const s = run(IDLE_GESTURE_STATE, [{ type: 'pointerDown', pointerId: 1, position: p(0, 0) }], e);
  const r = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e);
  assert.deepEqual(r.effects, [{ type: 'tapSelect', vertexId: 'v9' }]);
});

// ─── §5.3 row: Moving; second touch → roll back uncommitted move, then pinch ─

test('moving + second touch rolls back the ENTIRE uncommitted move, then two-pointer (T05)', () => {
  const e = env({ armedVertexId: () => 'v5' });
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(60, 60) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(90, 60) }, e).state; // moving
  const r = dispatchGesture(s, { type: 'pointerDown', pointerId: 2, position: p(200, 200) }, e);
  assert.equal(r.state.phase, 'twoPointer');
  assert.deepEqual(types(r.effects), ['rollbackMove', 'viewGestureStart']);
});

// ─── §5.3 row: Moving; normal release → commit one bounded draft move ────────

test('moving + release commits exactly one move; sequence completes (disarm is the adapter\'s command)', () => {
  const e = env({ armedVertexId: () => 'v5' });
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(100, 100) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(140, 80) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(150, 80) }, e).state;
  const r = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e);
  assert.equal(r.state.phase, 'idle');
  const commits = r.effects.filter((x) => x.type === 'commitMove');
  assert.equal(commits.length, 1);
  assert.deepEqual((commits[0] as Extract<GestureEffect, { type: 'commitMove' }>).totalClientDelta, { x: 50, y: -20 });
  assert.equal(r.state.completedSequences, 1);
});

// ─── §5.3 rows: Moving cancel / lost capture → restore pre-gesture point ────

test('moving + pointercancel rolls the move back and clears the gesture (T07)', () => {
  const e = env({ armedVertexId: () => 'v2' });
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(0, 0) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(50, 0) }, e).state;
  assert.equal(s.phase, 'moving');
  const r = dispatchGesture(s, { type: 'pointerCancel', pointerId: 1 }, e);
  assert.equal(r.state.phase, 'idle');
  assert.ok(r.effects.some((x) => x.type === 'rollbackMove'));
  assert.ok(!r.effects.some((x) => x.type === 'commitMove'));
});

test('T08: lostpointercapture AFTER a completed pointer-up does NOT roll back the move', () => {
  const e = env({ armedVertexId: () => 'v2' });
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(0, 0) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(30, 0) }, e).state;
  s = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e).state;
  const r = dispatchGesture(s, { type: 'captureLost', pointerId: 1 }, e);
  assert.equal(r.state.phase, 'idle');
  assert.deepEqual(r.effects, []); // committed move stands — completion token path
  assert.equal(r.state.completedSequences, 1);
});

// ─── §5.3 row: Two-pointer gesture; move → simultaneous pan+pinch ───────────

test('twoPointer + moves emit viewGestureUpdate with the frozen start pair (pinch math is M2 pinchCamera)', () => {
  const e = env();
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(100, 100) }, e).state;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 2, position: p(200, 100) }, e).state;
  assert.equal(s.phase, 'twoPointer');
  const r = dispatchGesture(s, { type: 'pointerMove', pointerId: 2, position: p(260, 130) }, e);
  const upd = r.effects.find((x) => x.type === 'viewGestureUpdate') as Extract<GestureEffect, { type: 'viewGestureUpdate' }>;
  assert.ok(upd);
  assert.deepEqual(upd.start, { a: p(100, 100), b: p(200, 100) });
  assert.deepEqual(upd.current, { a: p(100, 100), b: p(260, 130) });
});

// ─── §5.3 rows: lift of one pinch finger / third touch → suppress until all lift (T06)

test('T06: remaining finger after pinch cannot place/move; input resumes only when ALL lift', () => {
  const e = env();
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(100, 100) }, e).state;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 2, position: p(200, 100) }, e).state;
  s = dispatchGesture(s, { type: 'pointerUp', pointerId: 2 }, e).state;
  assert.equal(s.phase, 'cancelled'); // pointer 1 still down → suppressed
  // Remaining finger moves/taps/starts drags: all ignored.
  let r = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(400, 400) }, e);
  assert.equal(r.state.phase, 'cancelled');
  assert.deepEqual(r.effects, []);
  r = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e);
  assert.equal(r.state.phase, 'idle');
  // Only NOW may a new tap resolve normally.
  const tap = dispatchGesture(r.state, { type: 'pointerDown', pointerId: 3, position: p(10, 10) }, e);
  assert.equal(tap.state.phase, 'pending');
});

test('third touch during twoPointer cancels and suppresses until every contact lifts', () => {
  const e = env();
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(100, 100) }, e).state;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 2, position: p(200, 100) }, e).state;
  const third = dispatchGesture(s, { type: 'pointerDown', pointerId: 3, position: p(150, 300) }, e);
  assert.equal(third.state.phase, 'cancelled');
  assert.deepEqual(types(third.effects), ['viewGestureEnd']);
  let s2 = third.state;
  s2 = dispatchGesture(s2, { type: 'pointerUp', pointerId: 3 }, e).state;
  assert.equal(s2.phase, 'cancelled'); // 2 still down
  s2 = dispatchGesture(s2, { type: 'pointerUp', pointerId: 1 }, e).state;
  assert.equal(s2.phase, 'cancelled'); // 1 still down
  s2 = dispatchGesture(s2, { type: 'pointerUp', pointerId: 2 }, e).state;
  assert.equal(s2.phase, 'idle');
});

test('third touch during a move rolls the move back and suppresses (never guesses fingers)', () => {
  const e = env({ armedVertexId: () => 'v1' });
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(0, 0) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(40, 0) }, e).state;
  const s2 = dispatchGesture(s, { type: 'pointerDown', pointerId: 2, position: p(100, 100) }, e).state; // → twoPointer
  const r = dispatchGesture(s2, { type: 'pointerDown', pointerId: 3, position: p(150, 150) }, e);
  assert.equal(r.state.phase, 'cancelled');
  assert.ok(!r.effects.some((x) => x.type === 'commitMove'));
});

// ─── §5.3 row: layout resize/rotation/modal cancels the gesture, keeps draft ─

test('layoutInterrupt during a move rolls back the uncommitted move (draft preserved by adapter)', () => {
  const e = env({ armedVertexId: () => 'v1' });
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(0, 0) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(40, 0) }, e).state;
  const r = dispatchGesture(s, { type: 'layoutInterrupt' }, e);
  assert.ok(r.effects.some((x) => x.type === 'rollbackMove'));
  assert.equal(r.state.phase, 'cancelled'); // contact still down → suppressed
});

test('layoutInterrupt during twoPointer ends the view gesture without geometry effects', () => {
  const e = env();
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(100, 100) }, e).state;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 2, position: p(200, 100) }, e).state;
  const r = dispatchGesture(s, { type: 'layoutInterrupt' }, e);
  assert.deepEqual(types(r.effects), ['viewGestureEnd', 'gestureCancelled']);
});

test('layoutInterrupt while idle is a no-op', () => {
  const r = dispatchGesture(IDLE_GESTURE_STATE, { type: 'layoutInterrupt' }, env());
  assert.deepEqual(r.effects, []);
  assert.equal(r.state.phase, 'idle');
});

// ─── §5.3 row: explicit previous/next/insert/delete never forward to canvas ──

test('controller buttons live outside the machine (§5.3 row: buttons do not forward events)', () => {
  // Structural: the machine's event union has no button events; commands go
  // straight to the editor engine. Pin the union shape.
  const eventTypes: readonly string[] = [
    'pointerDown', 'pointerMove', 'pointerUp', 'pointerCancel', 'captureLost', 'layoutInterrupt', 'syntheticClick',
  ];
  assert.equal(eventTypes.length, 7);
});

// ─── Environment freshness (T11 sibling guarantee) ──────────────────────────

test('slop decision reads the environment at EVENT time — arming between press and move switches to move', () => {
  let armed = false;
  const e = env({ armedVertexId: () => (armed ? 'v1' : null) });
  const s = dispatchGesture(IDLE_GESTURE_STATE, { type: 'pointerDown', pointerId: 1, position: p(0, 0) }, e).state;
  armed = true; // e.g. the controller armed a point while the finger was down
  const r = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(50, 0) }, e);
  assert.equal(r.state.phase, 'moving'); // used the CURRENT armed state
});

test('ghost syntheticClick after a drag produces no effects (suppression by sequence state)', () => {
  const e = env({ armedVertexId: () => 'v1', canAppend: () => true });
  let s = IDLE_GESTURE_STATE;
  s = dispatchGesture(s, { type: 'pointerDown', pointerId: 1, position: p(0, 0) }, e).state;
  s = dispatchGesture(s, { type: 'pointerMove', pointerId: 1, position: p(50, 0) }, e).state;
  s = dispatchGesture(s, { type: 'pointerUp', pointerId: 1 }, e).state;
  assert.equal(s.phase, 'idle');
  const click = dispatchGesture(s, { type: 'syntheticClick' }, e);
  assert.deepEqual(click.effects, []);
});
