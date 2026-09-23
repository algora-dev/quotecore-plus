'use client';
// M10 P3b: entry-draw canvas - the tap/drag/confirm point-to-point surface
// for drawing a new lineal component entry. Mirrors the OutlineCanvas
// pattern (camera-transformed raster + SVG overlay in viewport space) with
// its own simplified pointer handling: a tap places the active point,
// dragging near a draft point moves it, dragging empty space pans, two
// fingers pinch. Confirmation is explicit (rail button), so gestures never
// need rollback - releasing simply stops moving.
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { scenePointToViewport, type Camera, type SceneDescriptor } from './sceneViewport';

export interface EntryDraftPoint { x: number; y: number }

const HIT_RADIUS_PX = 44;
const TAP_SLOP_PX = 8;

interface GestureState {
  pointers: Map<number, { x: number; y: number; startX: number; startY: number }>;
  mode: 'undecided' | 'point' | 'pan' | 'pinch';
  slot: 0 | 1;
  pinchDist: number;
  left: number;
  top: number;
}

export function EntryDrawCanvas(props: {
  bindSurface: (node: HTMLDivElement | null) => void;
  camera: Camera | null;
  scene: SceneDescriptor | null;
  imageUrl: string | null;
  groupColour: string;
  contextLines: { x: number; y: number }[][];
  draft: { p1: EntryDraftPoint | null; p2: EntryDraftPoint | null };
  activeSlot: 0 | 1;
  onTapPlace: (scenePoint: EntryDraftPoint) => void;
  onDraftMove: (slot: 0 | 1, scenePoint: EntryDraftPoint) => void;
  onPanBy: (dx: number, dy: number) => void;
  onZoomAt: (factor: number, vx: number, vy: number) => void;
  error: string | null;
  children?: ReactNode;
}) {
  const camera = props.camera;
  const gesture = useRef<GestureState | null>(null);

  const toScene = (vx: number, vy: number): EntryDraftPoint => camera
    ? { x: (vx - camera.tx) / camera.zoom, y: (vy - camera.ty) / camera.zoom }
    : { x: vx, y: vy };
  const draftSlotAt = (vx: number, vy: number): 0 | 1 | null => {
    if (!camera) return null;
    for (const slot of [0, 1] as const) {
      const p = slot === 0 ? props.draft.p1 : props.draft.p2;
      if (!p) continue;
      const v = scenePointToViewport(camera, p);
      if (Math.hypot(v.x - vx, v.y - vy) <= HIT_RADIUS_PX) return slot;
    }
    return null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!gesture.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      gesture.current = { pointers: new Map(), mode: 'undecided', slot: 0, pinchDist: 0, left: rect.left, top: rect.top };
    }
    const g = gesture.current;
    const local = { x: e.clientX - g.left, y: e.clientY - g.top };
    g.pointers.set(e.pointerId, { x: local.x, y: local.y, startX: local.x, startY: local.y });
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      g.mode = 'pinch';
    } else if (g.pointers.size > 2) {
      g.mode = 'pinch';
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const prev = g.pointers.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX - g.left, y: e.clientY - g.top };
    g.pointers.set(e.pointerId, { ...prev, x: now.x, y: now.y });
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    if (g.mode === 'pinch') {
      if (g.pointers.size >= 2) {
        const [a, b] = [...g.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (g.pinchDist > 0 && dist > 0) {
          props.onZoomAt(dist / g.pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
          g.pinchDist = dist;
        }
      }
      return;
    }
    if (g.mode === 'undecided' && Math.hypot(now.x - prev.startX, now.y - prev.startY) > TAP_SLOP_PX) {
      const slot = draftSlotAt(now.x, now.y);
      if (slot != null) { g.mode = 'point'; g.slot = slot; } else { g.mode = 'pan'; }
    }
    if (g.mode === 'point') props.onDraftMove(g.slot, toScene(now.x, now.y));
    else if (g.mode === 'pan') props.onPanBy(dx, dy);
  };
  const endPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g) return;
    const start = g.pointers.get(e.pointerId);
    g.pointers.delete(e.pointerId);
    if (g.mode === 'pinch') {
      if (g.pointers.size < 2) {
        g.mode = 'undecided';
        g.pinchDist = 0;
        for (const [id, p] of g.pointers) g.pointers.set(id, { ...p, startX: p.x, startY: p.y });
      }
    } else if (!cancelled && g.mode === 'undecided' && g.pointers.size === 0 && start) {
      // A clean tap (under the slop) places the active draft point at the
      // START position, so a micro-jitter at lift-off never offsets it.
      props.onTapPlace(toScene(start.startX, start.startY));
    }
    if (g.pointers.size === 0) gesture.current = null;
  };

  const vp = (p: { x: number; y: number }) => (camera ? scenePointToViewport(camera, p) : p);
  const d1 = props.draft.p1 ? vp(props.draft.p1) : null;
  const d2 = props.draft.p2 ? vp(props.draft.p2) : null;
  return <div ref={props.bindSurface} data-testid="entry-draw-surface"
    className="absolute inset-0 z-10 overflow-hidden bg-slate-950" style={{ touchAction: 'none' }}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove}
    onPointerUp={(e) => endPointer(e, false)} onPointerCancel={(e) => endPointer(e, true)}>
    {camera && props.scene && props.imageUrl && <div className="pointer-events-none absolute left-0 top-0"
      style={{ transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.zoom})`, transformOrigin: '0 0', width: props.scene.width, height: props.scene.height }}>
      <img src={props.imageUrl} alt="Plan page" draggable={false} className="h-full w-full select-none" />
    </div>}
    {camera && <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {props.contextLines.map((line, index) => line.length === 2
        && <line key={`ctx-${index}`} x1={vp(line[0]).x} y1={vp(line[0]).y} x2={vp(line[1]).x} y2={vp(line[1]).y}
          stroke={props.groupColour} strokeWidth={2} opacity={0.35} />)}
      {d1 && d2 && <line x1={d1.x} y1={d1.y} x2={d2.x} y2={d2.y} stroke="#FF6B35" strokeWidth={2.5} strokeDasharray="6 4" />}
      {d1 && <g data-testid="entry-draft-1">
        <circle cx={d1.x} cy={d1.y} r={7} fill="#0f172a" />
        {props.activeSlot === 0 && <circle cx={d1.x} cy={d1.y} r={14} fill="none" stroke="#FF6B35" strokeWidth={2.5} strokeDasharray="5 3" />}
        <circle cx={d1.x} cy={d1.y} r={3} fill="#FF6B35" />
      </g>}
      {d2 && <g data-testid="entry-draft-2">
        <circle cx={d2.x} cy={d2.y} r={7} fill="#0f172a" />
        {props.activeSlot === 1 && <circle cx={d2.x} cy={d2.y} r={14} fill="none" stroke="#FF6B35" strokeWidth={2.5} strokeDasharray="5 3" />}
        <circle cx={d2.x} cy={d2.y} r={3} fill="#FF6B35" />
      </g>}
    </svg>}
    {(!props.scene || props.error) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white" role={props.error ? 'alert' : 'status'}>
      {props.error ?? 'Loading your plan...'}
    </div>}
    {props.children}
  </div>;
}
