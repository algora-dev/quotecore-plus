// Mobile takeoff M3: pure precision gesture state machine (spec 2026-09-21
// §5.3 — the ENTIRE transition table, tap priority, slop).
//
// PURE module: no React, no DOM, no IO. The DOM Pointer Events adapter
// (usePrecisionPointerInput.ts) dispatches events here and executes the
// returned effects; this machine only arbitrates.
//
// Design per §5.3:
//  - a single active pointer map (surface contacts only; toolbar/sheet
//    controls own their input and never reach this machine);
//  - one gesture owner with EXPLICIT phases (no scattered booleans):
//      idle      — no surface contact
//      pending   — one contact recorded, below slop, no commitment yet
//      moving    — armed vertex remote-drag in progress (uncommitted preview)
//      panning   — one-finger view pan (only when nothing is armed, §5.4)
//      twoPointer— two-finger pinch/pan (view only)
//      cancelled — a cancelled/suppressed gesture; ALL remaining contacts are
//                  ignored until every pointer has lifted (§5.3 two rows)
//  - a base snapshot per gesture (press start position, marker hit, two-finger
//    start pair) so rollbacks and full-delta-from-start math are exact.
//
// Placement NEVER happens on pointerdown (the contact may become a pinch);
// exactly one placement per resolved tap sequence. Ghost synthetic clicks are
// structurally inert (syntheticClick produces no effect ever) — suppression by
// sequence state, not a timeout (§5.3/§5.6).
//
// A lostpointercapture arriving AFTER a completed pointer-up finds the pointer
// already removed from the map and the phase back at idle, so it can never
// roll back the committed move (T08). `completedSequences` additionally counts
// finished gestures as an explicit completion token for adapters.

import type { Point } from '../calibrationTypes';

/** Initial touch slop in visible CSS px (spec §5.2). */
export const TOUCH_SLOP_PX = 6;

/** Screen-space marker hit radius in visible CSS px, zoom-independent (§5.5). */
export const HIT_RADIUS_PX = 24;

export type GesturePhase = 'idle' | 'pending' | 'moving' | 'panning' | 'twoPointer' | 'cancelled';

/** A two-finger snapshot: both pointer positions in surface CSS px. */
export type TwoFingerSnapshot = Readonly<{ a: Point; b: Point }>;

export type GestureEvent =
  | { type: 'pointerDown'; pointerId: number; position: Point }
  | { type: 'pointerMove'; pointerId: number; position: Point }
  | { type: 'pointerUp'; pointerId: number }
  | { type: 'pointerCancel'; pointerId: number }
  | { type: 'captureLost'; pointerId: number }
  | { type: 'layoutInterrupt' }
  | { type: 'syntheticClick' };

/** Environment read at EVENT DISPATCH time so decisions always use the
 *  caller's CURRENT state (spec: rapid taps must not use stale closures). */
export type GestureEnvironment = Readonly<{
  /** Nearest active-geometry marker within hit radius at a surface point, or null. */
  hitMarker: (position: Point) => string | null;
  /** Currently armed vertex id, or null (§5.1). */
  armedVertexId: () => string | null;
  /** True only in an explicit placement state on an open path (§5.3 priority 3). */
  canAppend: () => boolean;
}>;

export type GestureEffect =
  | { type: 'tapSelect'; vertexId: string }
  | { type: 'tapPlace'; position: Point }
  | { type: 'tapIgnored' }
  | { type: 'beginMove'; vertexId: string }
  | { type: 'movePreview'; vertexId: string; totalClientDelta: Point }
  | { type: 'commitMove'; vertexId: string; totalClientDelta: Point }
  | { type: 'rollbackMove' }
  | { type: 'oneFingerPan'; totalClientDelta: Point }
  | { type: 'viewGestureStart' }
  | { type: 'viewGestureUpdate'; start: TwoFingerSnapshot; current: TwoFingerSnapshot }
  | { type: 'viewGestureEnd'; reason: 'released' | 'cancelled' }
  | { type: 'gestureCancelled' };

export type GestureState = Readonly<{
  phase: GesturePhase;
  /** Active surface contacts by pointerId (last known surface CSS position). */
  pointers: Readonly<Record<number, Point>>;
  /** The single contact that owns pending/moving/panning. */
  primaryPointerId: number | null;
  /** Press-start position (base snapshot) for slop + full-delta-from-start math. */
  pressStart: Point | null;
  /** Marker hit captured at pointerdown — tap resolution uses it on release. */
  pendingMarkerHit: string | null;
  /** Vertex being remote-dragged (uncommitted). */
  moveVertexId: string | null;
  /** Base pair captured when the two-finger gesture began. */
  twoFingerStart: TwoFingerSnapshot | null;
  /** Completion token: incremented once per fully finished gesture (§5.6). */
  completedSequences: number;
}>;

export const IDLE_GESTURE_STATE: GestureState = {
  phase: 'idle',
  pointers: {},
  primaryPointerId: null,
  pressStart: null,
  pendingMarkerHit: null,
  moveVertexId: null,
  twoFingerStart: null,
  completedSequences: 0,
};

export type DispatchResult = Readonly<{ state: GestureState; effects: readonly GestureEffect[] }>;

function withPointers(state: GestureState, pointers: Record<number, Point>): GestureState {
  return { ...state, pointers };
}

function pointerCount(state: GestureState): number {
  return Object.keys(state.pointers).length;
}

function finish(state: GestureState): GestureState {
  // Gesture fully resolved and every contact lifted → back to idle.
  return {
    ...IDLE_GESTURE_STATE,
    completedSequences: state.completedSequences + 1,
  };
}

function suppressed(state: GestureState): GestureState {
  // Gesture cancelled while contacts remain: suppress everything until lift.
  return {
    ...state,
    phase: 'cancelled',
    primaryPointerId: null,
    pressStart: null,
    pendingMarkerHit: null,
    moveVertexId: null,
    twoFingerStart: null,
  };
}

function beginTwoPointer(state: GestureState): { state: GestureState; effect: GestureEffect } {
  const ids = Object.keys(state.pointers).map(Number);
  const a = state.pointers[ids[0]];
  const b = state.pointers[ids[1]];
  const start: TwoFingerSnapshot = { a, b };
  return {
    state: {
      ...state,
      phase: 'twoPointer',
      primaryPointerId: null,
      pressStart: null,
      pendingMarkerHit: null,
      moveVertexId: null,
      twoFingerStart: start,
    },
    effect: { type: 'viewGestureStart' },
  };
}

function currentPair(state: GestureState): TwoFingerSnapshot {
  const ids = Object.keys(state.pointers).map(Number);
  return { a: state.pointers[ids[0]], b: state.pointers[ids[1]] };
}

function delta(from: Point, to: Point): Point {
  return { x: to.x - from.x, y: to.y - from.y };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** §5.3 tap priority (resolved on release within slop, never on pointerdown). */
function resolveTap(state: GestureState, env: GestureEnvironment, releasePosition: Point): GestureEffect {
  if (state.pendingMarkerHit != null) {
    // 1. A canvas marker hit selects/arms that existing point.
    return { type: 'tapSelect', vertexId: state.pendingMarkerHit };
  }
  if (env.armedVertexId() != null) {
    // 2. Blank tap while armed: stays armed, creates nothing.
    return { type: 'tapIgnored' };
  }
  if (env.canAppend()) {
    // 3. Explicit placement state: exactly one point per resolved sequence.
    return { type: 'tapPlace', position: releasePosition };
  }
  // 4. Closed-outline review/browse (or closed draft): blank taps never add.
  return { type: 'tapIgnored' };
}

/**
 * The single entry point. Dispatch one event against the current state with
 * the caller's CURRENT environment; returns the next state plus the effects
 * the adapter must execute (in order). Pure: no mutation of inputs.
 */
export function dispatchGesture(
  state: GestureState,
  event: GestureEvent,
  env: GestureEnvironment,
  slopPx: number = TOUCH_SLOP_PX,
): DispatchResult {
  switch (event.type) {
    case 'syntheticClick': {
      // Ghost-tap suppression by sequence state (§5.3): a later click after a
      // resolved pointer sequence NEVER places geometry. No timeout involved.
      return { state, effects: [] };
    }

    case 'pointerDown': {
      const pointers = { ...state.pointers, [event.pointerId]: event.position };
      const base = { ...state, pointers };

      switch (state.phase) {
        case 'idle': {
          // Record a pending press. Do NOT place/select anything yet.
          return {
            state: {
              ...base,
              phase: 'pending',
              primaryPointerId: event.pointerId,
              pressStart: event.position,
              pendingMarkerHit: env.hitMarker(event.position),
            },
            effects: [],
          };
        }
        case 'pending': {
          // Second touch cancels the pending tap/move → two-pointer view gesture.
          const { state: s, effect } = beginTwoPointer(base);
          return { state: s, effects: [effect] };
        }
        case 'moving': {
          // Second touch during a move: roll back the ENTIRE uncommitted move,
          // then begin pinch/pan from the current contacts. No geometry or
          // history event survives (§5.3 / R09).
          const { state: s, effect } = beginTwoPointer(base);
          return { state: s, effects: [{ type: 'rollbackMove' }, effect] };
        }
        case 'panning': {
          // Pan promotes to a two-finger pinch/pan (view-only either way).
          const { state: s, effect } = beginTwoPointer(base);
          return { state: s, effects: [effect] };
        }
        case 'twoPointer': {
          // Third touch: cancel the gesture, preserve state, suppress until
          // every contact lifts. Do not guess which two fingers were intended.
          return { state: suppressed(base), effects: [{ type: 'viewGestureEnd', reason: 'cancelled' }] };
        }
        case 'cancelled':
        default: {
          // Suppressed: new contacts are ignored entirely.
          return { state: base, effects: [] };
        }
      }
    }

    case 'pointerMove': {
      if (!(event.pointerId in state.pointers)) return { state, effects: [] };
      const pointers = { ...state.pointers, [event.pointerId]: event.position };
      const next = withPointers(state, pointers);
      const start = state.pressStart;

      switch (state.phase) {
        case 'pending': {
          if (start == null || state.primaryPointerId !== event.pointerId) {
            return { state: next, effects: [] };
          }
          if (distance(start, event.position) <= slopPx) {
            return { state: next, effects: [] }; // still within slop: no commitment
          }
          const armed = env.armedVertexId();
          if (armed != null) {
            // Armed → remote move. Full delta from press start (§5.2).
            return {
              state: {
                ...next,
                phase: 'moving',
                moveVertexId: armed,
                pendingMarkerHit: null,
              },
              effects: [
                { type: 'beginMove', vertexId: armed },
                { type: 'movePreview', vertexId: armed, totalClientDelta: delta(start, event.position) },
              ],
            };
          }
          // Disarmed → one-finger pan. Never append a point after a pan.
          return {
            state: { ...next, phase: 'panning' },
            effects: [{ type: 'oneFingerPan', totalClientDelta: delta(start, event.position) }],
          };
        }
        case 'moving': {
          if (start == null || state.moveVertexId == null) return { state: next, effects: [] };
          return {
            state: next,
            effects: [
              { type: 'movePreview', vertexId: state.moveVertexId, totalClientDelta: delta(start, event.position) },
            ],
          };
        }
        case 'panning': {
          if (start == null) return { state: next, effects: [] };
          return {
            state: next,
            effects: [{ type: 'oneFingerPan', totalClientDelta: delta(start, event.position) }],
          };
        }
        case 'twoPointer': {
          if (pointerCount(state) !== 2 || state.twoFingerStart == null) {
            return { state: next, effects: [] };
          }
          return {
            state: next,
            effects: [
              { type: 'viewGestureUpdate', start: state.twoFingerStart, current: currentPair(next) },
            ],
          };
        }
        case 'cancelled':
        case 'idle':
        default: {
          return { state: next, effects: [] };
        }
      }
    }

    case 'pointerUp': {
      if (!(event.pointerId in state.pointers)) return { state, effects: [] };
      const pointers = { ...state.pointers };
      delete pointers[event.pointerId];
      const next = withPointers(state, pointers);
      const empty = Object.keys(pointers).length === 0;

      if (state.phase === 'pending' && state.primaryPointerId === event.pointerId) {
        if (!empty) return { state: next, effects: [] }; // defensive; pending is single-contact
        const tap = resolveTap(state, env, state.pointers[event.pointerId]);
        return { state: finish(next), effects: [tap] };
      }

      if (state.phase === 'moving' && state.primaryPointerId === event.pointerId) {
        // Normal release: commit ONE finite, bounded draft move. The adapter
        // commits through the command engine (which disarms, §5.1/R10).
        if (state.pressStart == null || state.moveVertexId == null) {
          return { state: finish(next), effects: [{ type: 'rollbackMove' }] };
        }
        const total = delta(state.pressStart, state.pointers[event.pointerId]);
        if (empty) {
          return {
            state: finish(next),
            effects: [{ type: 'commitMove', vertexId: state.moveVertexId, totalClientDelta: total }],
          };
        }
        // Defensive: another contact remains — commit, then suppress.
        return {
          state: suppressed(next),
          effects: [{ type: 'commitMove', vertexId: state.moveVertexId, totalClientDelta: total }],
        };
      }

      if (state.phase === 'panning' && state.primaryPointerId === event.pointerId) {
        return empty
          ? { state: finish(next), effects: [] }
          : { state: suppressed(next), effects: [] };
      }

      if (state.phase === 'twoPointer') {
        // One finger lifts: the remaining finger must NOT become a drag or a
        // tap — suppress all contacts until every pointer has lifted.
        return {
          state: empty ? finish(next) : suppressed(next),
          effects: [{ type: 'viewGestureEnd', reason: 'released' }],
        };
      }

      if (state.phase === 'cancelled') {
        // Suppression lifts only when the pointer map is empty.
        return { state: empty ? finish(next) : next, effects: [] };
      }

      return { state: empty ? finish(next) : next, effects: [] };
    }

    case 'pointerCancel':
    case 'captureLost': {
      // A captureLost AFTER a completed pointer-up: the pointer is already
      // gone from the map → no effect, the committed move stands (T08).
      if (!(event.pointerId in state.pointers)) return { state, effects: [] };
      const pointers = { ...state.pointers };
      delete pointers[event.pointerId];
      const next = withPointers(state, pointers);
      const empty = Object.keys(pointers).length === 0;

      const effects: GestureEffect[] = [];
      switch (state.phase) {
        case 'moving':
          // Restore the pre-gesture point, disarm, clear the gesture (§5.3).
          effects.push({ type: 'rollbackMove' }, { type: 'gestureCancelled' });
          break;
        case 'pending':
          effects.push({ type: 'gestureCancelled' });
          break;
        case 'panning':
          effects.push({ type: 'gestureCancelled' });
          break;
        case 'twoPointer':
          effects.push({ type: 'viewGestureEnd', reason: 'cancelled' }, { type: 'gestureCancelled' });
          break;
        case 'cancelled':
        case 'idle':
        default:
          break;
      }
      return {
        state: empty
          ? { ...next, phase: 'idle', primaryPointerId: null, pressStart: null, pendingMarkerHit: null, moveVertexId: null, twoFingerStart: null, completedSequences: state.completedSequences + 1 }
          : suppressed(next),
        effects,
      };
    }

    case 'layoutInterrupt': {
      // Resize / rotation / modal opening: cancel the ACTIVE gesture before
      // view geometry changes; preserve the edit draft (§5.3 last row).
      switch (state.phase) {
        case 'idle':
          return { state, effects: [] };
        case 'pending':
          return {
            state: pointerCount(state) > 0 ? suppressed(state) : finish(state),
            effects: [{ type: 'gestureCancelled' }],
          };
        case 'moving':
          return {
            state: pointerCount(state) > 0 ? suppressed(state) : finish(state),
            effects: [{ type: 'rollbackMove' }, { type: 'gestureCancelled' }],
          };
        case 'panning':
        case 'twoPointer':
          return {
            state: pointerCount(state) > 0 ? suppressed(state) : finish(state),
            effects: [{ type: 'viewGestureEnd', reason: 'cancelled' }, { type: 'gestureCancelled' }],
          };
        case 'cancelled':
        default:
          return { state, effects: [] };
      }
    }
  }
}
