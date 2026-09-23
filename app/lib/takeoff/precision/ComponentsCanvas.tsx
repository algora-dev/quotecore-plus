'use client';
// M10 F1/F2 + M11: the ONE canvas for the whole touch components step - the
// plan raster, the saved roof outline and every component entry stay visible
// at all times (scan, review, detail, draw): the plan is the source of
// truth and NEVER goes blank. Also hosts the + New entry drawing with the
// outline-editor interaction model: tap places the point, pressing anywhere
// else and dragging moves it at an offset (remote move - the thumb never
// covers the point), release holds, Confirm locks. Calibration-style
// crosshair markers. M11: entries render by kind (line, polygon area, point
// marker) and the draw gesture follows the draw mode - lineal = two
// confirm-locked endpoints, area = tap-appended corners (last one is
// remote-movable), count/item = one remote-movable marker.
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { scenePointToViewport, type Camera, type SceneDescriptor } from './sceneViewport';
import type { TouchDrawMode } from './touchComponents';

export interface EntryDraftPoint { x: number; y: number }

const HIT_RADIUS_PX = 44;
const TAP_SLOP_PX = 8;

interface GestureState {
  pointers: Map<number, { x: number; y: number; startX: number; startY: number }>;
  mode: 'undecided' | 'point' | 'remote' | 'pan' | 'pinch';
  slot: 0 | 1;
  offset: { x: number; y: number };
  pinchDist: number;
  left: number;
  top: number;
}

export interface CanvasEntry {
  id: string;
  key: string;
  colour: string;
  hidden: boolean;
  points: { x: number; y: number }[];
  kind?: 'line' | 'area' | 'point';
  /** Area entries attached to a saved roof area render without vertex dots. */
  fromRoofAreaId?: string;
}

export function ComponentsCanvas(props: {
  bindSurface: (node: HTMLDivElement | null) => void;
  camera: Camera | null;
  scene: SceneDescriptor | null;
  imageUrl: string | null;
  /** Saved roof outline polygon (scene space) - always rendered. */
  outlinePoints: { x: number; y: number }[];
  entries: CanvasEntry[];
  isolatedKey: string | null;
  highlightedId: string | null;
  /** M11: active draw interaction (null = not drawing). */
  drawMode: TouchDrawMode | null;
  drawSlot: 0 | 1 | null;
  draft: { p1: EntryDraftPoint | null; p2: EntryDraftPoint | null };
  polygonDraft: { x: number; y: number }[];
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
    if (props.drawMode === 'polygon') {
      const last = props.polygonDraft[props.polygonDraft.length - 1];
      if (!last) return null;
      const v = scenePointToViewport(camera, last);
      return Math.hypot(v.x - vx, v.y - vy) <= HIT_RADIUS_PX ? 0 : null;
    }
    for (const slot of [0, 1] as const) {
      if (props.drawMode === 'point' && slot === 1) continue;
      const p = slot === 0 ? props.draft.p1 : props.draft.p2;
      if (!p) continue;
      const v = scenePointToViewport(camera, p);
      if (Math.hypot(v.x - vx, v.y - vy) <= HIT_RADIUS_PX) return slot;
    }
    return null;
  };
  const activeSlot = props.drawSlot ?? 0;
  const draftPointFor = (slot: 0 | 1): EntryDraftPoint | null => {
    if (props.drawMode === 'polygon') return props.polygonDraft[props.polygonDraft.length - 1] ?? null;
    return slot === 0 ? props.draft.p1 : props.draft.p2;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!gesture.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      gesture.current = { pointers: new Map(), mode: 'undecided', slot: 0, offset: { x: 0, y: 0 }, pinchDist: 0, left: rect.left, top: rect.top };
    }
    const g = gesture.current;
    const local = { x: e.clientX - g.left, y: e.clientY - g.top };
    g.pointers.set(e.pointerId, { x: local.x, y: local.y, startX: local.x, startY: local.y });
    if (g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
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
      const nearSlot = draftSlotAt(now.x, now.y);
      if (props.drawMode != null && nearSlot != null) {
        // Direct drag on a draft point (polygon: the last corner).
        g.mode = 'point';
        g.slot = nearSlot;
      } else if (props.drawMode != null) {
        // Remote move (outline-editor model): press AWAY from the point and
        // drag - the point keeps the press offset so the thumb never covers
        // it. Polygon mode always has a live last corner once one exists.
        g.mode = 'remote';
        g.slot = activeSlot;
        const p = draftPointFor(props.drawMode === 'polygon' ? 0 : activeSlot);
        if (p && camera) {
          const v = scenePointToViewport(camera, p);
          g.offset = { x: v.x - now.x, y: v.y - now.y };
        } else {
          g.mode = 'pan';
        }
      } else {
        g.mode = 'pan';
      }
    }
    if (g.mode === 'point') props.onDraftMove(g.slot, toScene(now.x, now.y));
    else if (g.mode === 'remote') props.onDraftMove(g.slot, toScene(now.x + g.offset.x, now.y + g.offset.y));
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
      props.onTapPlace(toScene(start.startX, start.startY));
    }
    if (g.pointers.size === 0) gesture.current = null;
  };

  const vp = (p: { x: number; y: number }) => (camera ? scenePointToViewport(camera, p) : p);
  const d1 = props.draft.p1 ? vp(props.draft.p1) : null;
  const d2 = props.draft.p2 ? vp(props.draft.p2) : null;
  const polygonDraftPath = props.polygonDraft.map(p => vp(p));
  const outlinePath = props.outlinePoints.map(p => vp(p));
  const visibleEntries = props.entries.filter(e => props.isolatedKey == null || e.key === props.isolatedKey);
  return <div ref={props.bindSurface} data-testid="components-canvas"
    className="absolute inset-0 z-10 overflow-hidden bg-slate-950" style={{ touchAction: 'none' }}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove}
    onPointerUp={(e) => endPointer(e, false)} onPointerCancel={(e) => endPointer(e, true)}>
    {camera && props.scene && props.imageUrl && <div className="pointer-events-none absolute left-0 top-0"
      style={{ transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.zoom})`, transformOrigin: '0 0', width: props.scene.width, height: props.scene.height }}>
      <img src={props.imageUrl} alt="Plan page" draggable={false} decoding="async" fetchPriority="high"
        className="h-full w-full select-none" />
    </div>}
    {camera && <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {/* Source-of-truth roof outline - always visible. */}
      {outlinePath.length >= 3 && <>
        <polygon points={outlinePath.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(59, 130, 246, 0.08)" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
        {outlinePath.map((p, i) => <circle key={`o-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#3b82f6" />)}
      </>}
      {/* Component entries by kind (registry colours; hidden = grey; highlight = thick). */}
      {visibleEntries.map(e => {
        const highlighted = props.highlightedId === e.id;
        const stroke = e.hidden ? '#94A3B8' : e.colour;
        const path = e.points.map(p => vp(p));
        if (e.kind === 'area' && path.length >= 3) {
          return <g key={e.id} opacity={e.hidden ? 0.5 : 1}>
            <polygon points={path.map(p => `${p.x},${p.y}`).join(' ')} fill={stroke} fillOpacity={highlighted ? 0.22 : 0.12} stroke={stroke} strokeWidth={highlighted ? 4 : 2.2} strokeLinejoin="round" />
            {!e.fromRoofAreaId && path.map((p, i) => <circle key={`a-${i}`} cx={p.x} cy={p.y} r={highlighted ? 4.5 : 2.8} fill={stroke} />)}
          </g>;
        }
        if (e.kind === 'point' && path.length >= 1) {
          const p = path[0];
          return <g key={e.id} opacity={e.hidden ? 0.5 : 1}>
            <circle cx={p.x} cy={p.y} r={highlighted ? 11 : 8} fill={stroke} fillOpacity={0.25} stroke={stroke} strokeWidth={highlighted ? 4 : 2.6} />
            <circle cx={p.x} cy={p.y} r={highlighted ? 4.5 : 3} fill={stroke} />
          </g>;
        }
        if (path.length === 2) {
          const a = path[0];
          const b = path[1];
          return <g key={e.id} opacity={e.hidden ? 0.5 : 1}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={highlighted ? 4.5 : 2.6} strokeLinecap="round" />
            <circle cx={a.x} cy={a.y} r={highlighted ? 5 : 3} fill={stroke} />
            <circle cx={b.x} cy={b.y} r={highlighted ? 5 : 3} fill={stroke} />
          </g>;
        }
        return null;
      })}
      {/* Line draft: dashed link + calibration-style crosshairs. */}
      {props.drawMode === 'line' && d1 && d2 && <line x1={d1.x} y1={d1.y} x2={d2.x} y2={d2.y} stroke="#FF6B35" strokeWidth={2.5} strokeDasharray="6 4" />}
      {props.drawMode === 'line' && [d1, d2].map((d, idx) => d && <g key={`draft-${idx}`} data-testid={`entry-draft-${idx + 1}`}>
        <line x1={d.x - 18} y1={d.y} x2={d.x + 18} y2={d.y} stroke="#FF6B35" strokeWidth={1.5} opacity={0.9} />
        <line x1={d.x} y1={d.y - 18} x2={d.x} y2={d.y + 18} stroke="#FF6B35" strokeWidth={1.5} opacity={0.9} />
        <circle cx={d.x} cy={d.y} r={8} fill="none" stroke="#FF6B35" strokeWidth={2} strokeDasharray={props.drawSlot === idx ? '5 3' : undefined} />
        <circle cx={d.x} cy={d.y} r={2.5} fill="#FF6B35" />
      </g>)}
      {/* Polygon draft: dashed open polyline + closing segment + crosshair on the last corner. */}
      {props.drawMode === 'polygon' && polygonDraftPath.length > 0 && <>
        {polygonDraftPath.length > 1 && <polyline points={polygonDraftPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#FF6B35" strokeWidth={2.5} strokeDasharray="6 4" strokeLinejoin="round" />}
        {polygonDraftPath.length >= 3 && <line x1={polygonDraftPath[polygonDraftPath.length - 1].x} y1={polygonDraftPath[polygonDraftPath.length - 1].y} x2={polygonDraftPath[0].x} y2={polygonDraftPath[0].y} stroke="#FF6B35" strokeWidth={1.5} strokeDasharray="3 4" opacity={0.7} />}
        {polygonDraftPath.slice(0, -1).map((p, i) => <circle key={`pd-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#FF6B35" />)}
        {(() => { const last = polygonDraftPath[polygonDraftPath.length - 1]; return <g data-testid="entry-draft-last">
          <line x1={last.x - 18} y1={last.y} x2={last.x + 18} y2={last.y} stroke="#FF6B35" strokeWidth={1.5} opacity={0.9} />
          <line x1={last.x} y1={last.y - 18} x2={last.x} y2={last.y + 18} stroke="#FF6B35" strokeWidth={1.5} opacity={0.9} />
          <circle cx={last.x} cy={last.y} r={8} fill="none" stroke="#FF6B35" strokeWidth={2} strokeDasharray="5 3" />
          <circle cx={last.x} cy={last.y} r={2.5} fill="#FF6B35" />
        </g>; })()}
      </>}
      {/* Point draft: single crosshair marker. */}
      {props.drawMode === 'point' && d1 && <g data-testid="entry-draft-point">
        <line x1={d1.x - 18} y1={d1.y} x2={d1.x + 18} y2={d1.y} stroke="#FF6B35" strokeWidth={1.5} opacity={0.9} />
        <line x1={d1.x} y1={d1.y - 18} x2={d1.x} y2={d1.y + 18} stroke="#FF6B35" strokeWidth={1.5} opacity={0.9} />
        <circle cx={d1.x} cy={d1.y} r={8} fill="none" stroke="#FF6B35" strokeWidth={2} strokeDasharray="5 3" />
        <circle cx={d1.x} cy={d1.y} r={2.5} fill="#FF6B35" />
      </g>}
    </svg>}
    {(!props.scene || props.error) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white" role={props.error ? 'alert' : 'status'}>
      {props.error ?? 'Loading your plan...'}
    </div>}
    {props.children}
  </div>;
}
