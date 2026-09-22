'use client';
/* eslint-disable react-hooks/refs -- bindSurface is a ref-callback PROP passed down by the
 * owning hook, not a render-time ref read; handing it to ref during render is the documented
 * pattern for callback refs and the rule cannot see across the component boundary. */
import type { ReactNode } from 'react';
import type { PrecisionEditSession } from './precisionTypes';
import { scenePointToViewport, type Camera, type SceneDescriptor } from './sceneViewport';

export function OutlineCanvas(props: {
  bindSurface: (node: HTMLDivElement | null) => void;
  camera: Camera | null; scene: SceneDescriptor | null; imageUrl: string | null;
  session: PrecisionEditSession | null; selectedIndex: number; error: string | null;
  children?: ReactNode;
}) {
  const { camera, scene, session, selectedIndex } = props;
  const points = camera ? session?.draft.vertices.map((v) => scenePointToViewport(camera,
    session.preview?.vertexId === v.id ? session.preview.point : v.point)) ?? [] : [];
  const line = session?.draft.closed && points.length ? [...points, points[0]] : points;
  const neighbours = selectedIndex < 0 ? [] : [-1, 0, 1].flatMap((delta) => {
    const raw = selectedIndex + delta;
    const index = session?.draft.closed ? (raw + points.length) % points.length : raw;
    return points[index] ? [points[index]] : [];
  });
  const path = (p: typeof points) => p.map((v) => `${v.x},${v.y}`).join(' ');
  return <div ref={props.bindSurface} data-testid="outline-editor-surface"
    className="absolute inset-0 z-10 overflow-hidden bg-slate-950" style={{ touchAction: 'none' }}>
    {camera && scene && props.imageUrl && <div className="pointer-events-none absolute left-0 top-0"
      style={{ transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.zoom})`, transformOrigin: '0 0', width: scene.width, height: scene.height }}>
      <img src={props.imageUrl} alt="Plan page" draggable={false} className="h-full w-full select-none" />
    </div>}
    {camera && session && <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {/* A polyline stays OPEN during drawing. Only a closed draft repeats its first vertex. */}
      <polyline points={path(line)} fill={session.draft.closed ? 'rgba(255,107,53,0.08)' : 'none'} stroke="#0f172a" strokeWidth={5} strokeLinejoin="round" />
      <polyline points={path(line)} fill="none" stroke="white" strokeWidth={2} strokeLinejoin="round" />
      <polyline points={path(neighbours)} fill="none" stroke="#FF6B35" strokeWidth={4} />
      {points.map((p, index) => <g key={session.draft.vertices[index].id} data-testid={`outline-point-${index}`}>
        <circle cx={p.x} cy={p.y} r={7} fill="#0f172a" />
        {index === selectedIndex && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="#FF6B35" strokeWidth={2.5}
          strokeDasharray={session.selection.moveArmed ? '5 3' : undefined} />}
        <circle cx={p.x} cy={p.y} r={3} fill={index === selectedIndex ? '#FF6B35' : 'white'} />
      </g>)}
    </svg>}
    {(!scene || props.error) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white" role={props.error ? 'alert' : 'status'}>
      {props.error ?? 'Loading your plan...'}
    </div>}
    {props.children}
  </div>;
}
