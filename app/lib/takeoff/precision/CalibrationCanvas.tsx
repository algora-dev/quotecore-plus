'use client';

import type { RefCallback } from 'react';
import type { Point } from '../calibrationTypes';
import { scenePointToViewport, type Camera, type SceneDescriptor } from './sceneViewport';

export interface CalibrationSpan { id: string; points: readonly Point[]; muted?: boolean; label?: string }
export function CalibrationCanvas({ bindSurface, camera, scene, planUrl, spans, selected, armed, loading, error }: {
  bindSurface: RefCallback<HTMLDivElement>; camera: Camera | null; scene: SceneDescriptor | null;
  planUrl: string; spans: CalibrationSpan[]; selected: number | null; armed: boolean; loading: boolean; error: string | null;
}) {
  return <div ref={bindSurface} data-testid="calibration-interaction-surface" className="absolute inset-0 z-10 overflow-hidden bg-slate-950"
    style={{ touchAction: 'none' }}>
    {scene && camera && <div className="pointer-events-none absolute left-0 top-0"
      style={{ transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.zoom})`, transformOrigin: '0 0', width: scene.width, height: scene.height }}>
      <img src={planUrl} alt="Plan page" draggable={false} className="h-full w-full select-none" />
    </div>}
    {camera && <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {spans.map((span) => {
        const points = span.points.map((p) => scenePointToViewport(camera, p));
        const stroke = span.muted ? '#94a3b8' : '#FF6B35';
        return <g key={span.id} opacity={span.muted ? 0.6 : 1}>
          {points.length === 2 && <>
            {/* Polish 2026-09-22 (owner): thinner dashed span, smaller dashes
                with wider gaps and slight transparency so printed dimensions
                (e.g. 9.15) stay readable underneath the overlay line. */}
            <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#0f172a" strokeWidth={3} />
            <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke={stroke} strokeWidth={1.5}
              strokeDasharray={span.muted ? '2 7' : '4 8'} opacity={0.8} />
          </>}
          {points.map((p, index) => <g key={index} data-testid={span.muted ? undefined : `calibration-point-${index}`}>
            {/* Polish 2026-09-22 (owner): no filled disc - thin ring plus a
                segmented crosshair with a clear centre gap, so the exact plan
                junction under the point stays visible for accurate placement. */}
            <circle cx={p.x} cy={p.y} r={6.5} fill="none" stroke={span.muted ? '#fff' : stroke} strokeWidth={2} />
            {!span.muted && selected === index && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={stroke} strokeWidth={2.5} strokeDasharray={armed ? '5 3' : undefined} />}
            <path d={`M${p.x - 11} ${p.y}h5 M${p.x + 6} ${p.y}h5 M${p.x} ${p.y - 11}v5 M${p.x} ${p.y + 6}v5`}
              stroke={span.muted ? '#fff' : stroke} strokeWidth={2} />
            <text x={p.x + 16} y={p.y - 10} fill={stroke} stroke="#0f172a" strokeWidth={3} paintOrder="stroke" fontSize={12} fontWeight={700}>
              {span.label ?? (index === 0 ? 'Start' : 'End')}
            </text>
          </g>)}
        </g>;
      })}
    </svg>}
    {(loading || error) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-200" role={error ? 'alert' : 'status'}>
      {error ?? 'Loading your plan...'}
    </div>}
  </div>;
}
