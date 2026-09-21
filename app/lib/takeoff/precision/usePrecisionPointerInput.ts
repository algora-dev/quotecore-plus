'use client';
// Mobile takeoff M3: the single-owner Pointer Events adapter (spec §5.6).
//
// Attaches to ONE dedicated interaction surface (the caller's absolutely
// positioned overlay). It is the ONLY gesture owner in touch mode: it sits
// above the workstation canvas, so legacy Fabric/DOM touch paths never receive
// these contacts (T15), and DOM controls sit outside the surface and own their
// input (T09). Toolbar touches during a gesture simply never reach the
// machine.
//
// Mechanics per §5.6:
//  - pointer capture on pointerdown; explicit pointercancel / unexpected
//    lostpointercapture / window blur / surface resize → layoutInterrupt or
//    cancellation rollback (a captureLost AFTER a completed pointer-up is
//    inert — the machine's completion token guarantees it);
//  - `touch-action: none` ONLY on this surface (inline style; panels and forms
//    keep native scrolling);
//  - the surface context menu is suppressed (not text selection elsewhere);
//  - preview updates are coalesced to one per animation frame (§10.5);
//  - every listener, capture and RAF callback is cleared on unmount/deactivate
//    (T16), and only THIS adapter's own handlers are disposed.
//
// Client→scene conversion uses the linear-part-only inverse camera delta
// (§5.2, sceneViewport.sceneDeltaFromCameraClientDelta) with the camera FROZEN
// at gesture start (§10.2: freeze the mapping; a mid-gesture layout change
// cancels instead). DPR never enters the math.

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  IDLE_GESTURE_STATE,
  dispatchGesture,
  type GestureEffect,
  type GesturePhase,
  type GestureState,
  type TwoFingerSnapshot,
} from './precisionGestureMachine';
import { sceneDeltaFromCameraClientDelta, type Camera } from './sceneViewport';
import type { Point } from '../calibrationTypes';
import type { ScenePoint } from './precisionTypes';

export interface PrecisionInputHandlers {
  /** Tap resolved onto a marker (§5.3 priority 1): select + arm. */
  onTapSelect: (vertexId: string) => void;
  /** Blank-tap placement (§5.3 priority 3): scene point of the tap. */
  onTapPlace: (scenePoint: ScenePoint) => void;
  /** Uncommitted move preview (layer 3; RAF-coalesced). */
  onPreviewMove: (vertexId: string, scenePoint: ScenePoint) => void;
  /** Finger lifted: one bounded draft move (adapter runs commitMove command). */
  onCommitMove: (vertexId: string, scenePoint: ScenePoint) => void;
  /** Gesture cancelled with a move in flight: run cancelGesture command. */
  onRollbackMove: () => void;
  /** One-finger pan total delta from gesture start (view only). */
  onOneFingerPan: (totalClientDelta: Point, startCamera: Camera) => void;
  /** Two-finger pinch/pan update: returns the next camera (applied by caller). */
  onViewGestureUpdate: (start: TwoFingerSnapshot, current: TwoFingerSnapshot, startCamera: Camera) => void;
  /** Any view gesture ended (released or cancelled). */
  onViewGestureEnd: () => void;
  /** A view gesture just began (freeze hook for the caller). */
  onViewGestureStart?: () => void;
  /** Non-move gesture cancelled (pending/pan/two-finger) — informational. */
  onGestureCancelled: () => void;
}

export interface PrecisionInputEnv {
  hitMarker: (clientPoint: Point) => string | null;
  armedVertexId: () => string | null;
  canAppend: () => boolean;
  getCamera: () => Camera;
  getScenePoint: (vertexId: string) => ScenePoint | null;
}

export type { GesturePhase };

/** Frozen gesture-start snapshot for exact client→scene math + rollback. */
interface GestureFrozen {
  camera: Camera;
  originalScene: ScenePoint | null;
  panBase: Camera | null;
}

export function usePrecisionPointerInput(
  active: boolean,
  surfaceRef: RefObject<HTMLElement | null>,
  handlers: PrecisionInputHandlers,
  env: PrecisionInputEnv,
): GesturePhase {
  const [phase, setPhase] = useState<GesturePhase>('idle');
  const stateRef = useRef<GestureState>(IDLE_GESTURE_STATE);
  const frozenRef = useRef<GestureFrozen | null>(null);
  // Latest handler/env references — decisions always use CURRENT closures
  // (§5.3/T11: rapid interactions must not read stale state).
  const handlersRef = useRef(handlers);
  const envRef = useRef(env);
  // Latest handler/env references — decisions always use CURRENT closures
  // (§5.3/T11). Synced in an effect (react-hooks/refs): effects run after
  // render but strictly before any pointer event can be dispatched.
  useEffect(() => {
    handlersRef.current = handlers;
    envRef.current = env;
  });

  useEffect(() => {
    if (!active) return;
    const surface = surfaceRef.current;
    if (!surface) return;

    surface.style.touchAction = 'none'; // ONLY this surface (§5.6)

    const toSurfacePoint = (ev: PointerEvent): Point => {
      const rect = surface.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    let rafId: number | null = null;
    let pendingPreview: { vertexId: string; scenePoint: ScenePoint } | null = null;
    const flushPreview = () => {
      rafId = null;
      const p = pendingPreview;
      pendingPreview = null;
      if (p) handlersRef.current.onPreviewMove(p.vertexId, p.scenePoint);
    };
    const schedulePreview = (vertexId: string, scenePoint: ScenePoint) => {
      pendingPreview = { vertexId, scenePoint };
      if (rafId == null) rafId = requestAnimationFrame(flushPreview);
    };

    const sceneFor = (vertexId: string, totalClientDelta: Point, fallback: ScenePoint | null): ScenePoint | null => {
      const frozen = frozenRef.current;
      const base = frozen?.originalScene ?? fallback;
      if (!frozen || !base) return null;
      const d = sceneDeltaFromCameraClientDelta(frozen.camera, totalClientDelta);
      return { x: base.x + d.x, y: base.y + d.y };
    };

    const execute = (effects: readonly GestureEffect[]) => {
      for (const effect of effects) {
        const h = handlersRef.current;
        switch (effect.type) {
          case 'tapSelect':
            h.onTapSelect(effect.vertexId);
            break;
          case 'tapPlace': {
            const camera = envRef.current.getCamera();
            // Scene point of the tap = inverse-camera map of the client point
            // (absolute mapping is correct for placement; only DRAG deltas use
            // the linear-only rule, §5.2).
            const inv = 1 / camera.zoom;
            h.onTapPlace({
              x: (effect.position.x - camera.tx) * inv,
              y: (effect.position.y - camera.ty) * inv,
            });
            break;
          }
          case 'beginMove': {
            const camera = envRef.current.getCamera();
            frozenRef.current = { camera, originalScene: envRef.current.getScenePoint(effect.vertexId), panBase: null };
            break;
          }
          case 'movePreview': {
            const sp = sceneFor(effect.vertexId, effect.totalClientDelta, null);
            if (sp) schedulePreview(effect.vertexId, sp);
            break;
          }
          case 'commitMove': {
            const fallback = envRef.current.getScenePoint(effect.vertexId);
            const sp = sceneFor(effect.vertexId, effect.totalClientDelta, fallback);
            frozenRef.current = null;
            if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; pendingPreview = null; }
            if (sp) h.onCommitMove(effect.vertexId, sp);
            break;
          }
          case 'rollbackMove':
            frozenRef.current = null;
            if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; pendingPreview = null; }
            h.onRollbackMove();
            break;
          case 'oneFingerPan': {
            let frozen = frozenRef.current;
            if (!frozen || frozen.panBase == null) {
              const camera = envRef.current.getCamera();
              frozen = { camera, originalScene: null, panBase: camera };
              frozenRef.current = frozen;
            }
            const panBase = frozen.panBase as Camera; // non-null by construction above
            h.onOneFingerPan(effect.totalClientDelta, panBase);
            break;
          }
          case 'viewGestureStart': {
            frozenRef.current = { camera: envRef.current.getCamera(), originalScene: null, panBase: null };
            h.onViewGestureStart?.();
            break;
          }
          case 'viewGestureUpdate': {
            const frozen = frozenRef.current ?? { camera: envRef.current.getCamera(), originalScene: null, panBase: null };
            frozenRef.current = frozen;
            h.onViewGestureUpdate(effect.start, effect.current, frozen.camera);
            break;
          }
          case 'viewGestureEnd':
            frozenRef.current = null;
            h.onViewGestureEnd();
            break;
          case 'gestureCancelled':
            frozenRef.current = null;
            h.onGestureCancelled();
            break;
          case 'tapIgnored':
            break;
        }
      }
    };

    const dispatch = (event: Parameters<typeof dispatchGesture>[1]) => {
      const result = dispatchGesture(stateRef.current, event, {
        hitMarker: envRef.current.hitMarker,
        armedVertexId: envRef.current.armedVertexId,
        canAppend: envRef.current.canAppend,
      });
      stateRef.current = result.state;
      setPhase(result.state.phase);
      execute(result.effects);
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return; // explicit mouse-left rule (§5.6)
      try {
        surface.setPointerCapture(ev.pointerId);
      } catch {
        // Capture is best-effort; cancellation handling covers the rest.
      }
      dispatch({ type: 'pointerDown', pointerId: ev.pointerId, position: toSurfacePoint(ev) });
    };
    const onPointerMove = (ev: PointerEvent) => {
      dispatch({ type: 'pointerMove', pointerId: ev.pointerId, position: toSurfacePoint(ev) });
    };
    const onPointerUp = (ev: PointerEvent) => {
      dispatch({ type: 'pointerUp', pointerId: ev.pointerId });
    };
    const onPointerCancel = (ev: PointerEvent) => {
      dispatch({ type: 'pointerCancel', pointerId: ev.pointerId });
    };
    // Unexpected capture loss mid-gesture rolls back; AFTER a completed
    // pointer-up the machine no longer knows the pointer → inert (T08).
    const onLostPointerCapture = (ev: PointerEvent) => {
      dispatch({ type: 'captureLost', pointerId: ev.pointerId });
    };
    const onContextMenu = (ev: MouseEvent) => ev.preventDefault(); // surface only (§5.2)
    const onBlur = () => dispatch({ type: 'layoutInterrupt' }); // page lifecycle (§5.6)

    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', onPointerUp);
    surface.addEventListener('pointercancel', onPointerCancel);
    surface.addEventListener('lostpointercapture', onLostPointerCapture);
    surface.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);

    // Layout resize/rotation/modal: cancel the ACTIVE gesture before view
    // geometry changes (§5.3); the draft is preserved by the commands.
    const ro = new ResizeObserver(() => dispatch({ type: 'layoutInterrupt' }));
    ro.observe(surface);

    return () => {
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', onPointerUp);
      surface.removeEventListener('pointercancel', onPointerCancel);
      surface.removeEventListener('lostpointercapture', onLostPointerCapture);
      surface.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
      stateRef.current = IDLE_GESTURE_STATE;
      frozenRef.current = null;
      setPhase('idle');
    };
  }, [active, surfaceRef]);

  return phase;
}

