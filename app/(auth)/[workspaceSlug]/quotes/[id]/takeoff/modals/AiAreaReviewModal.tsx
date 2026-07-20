'use client';

import { useState, useMemo } from 'react';
import type { AiResultsArea } from './AiResultsModal';

interface SkeletonNode {
  id: string;
  kind: 'junction' | 'perimeter_point';
  x: number;
  y: number;
}

interface SkeletonSegment {
  id: string;
  start_node_id: string;
  end_node_id: string;
}

interface Props {
  areas: AiResultsArea[];
  notes: string[];
  previewImage: string;
  outlines: Array<{ points: Array<{ x: number; y: number }> }>;
  /** Canvas dimensions - SVG viewBox matches these so overlay coords align perfectly. */
  canvasWidth: number;
  canvasHeight: number;
  /** V2 skeleton nodes (orange dots) */
  skeletonNodes?: SkeletonNode[];
  /** V2 skeleton segments (orange lines) */
  skeletonSegments?: SkeletonSegment[];
  onConfirm: (overrides: Record<number, { name: string; pitch: number }>) => void;
  onDiscard: () => void;
  onManualComponents: (overrides: Record<number, { name: string; pitch: number }>) => void;
}

export function AiAreaReviewModal({
  areas, notes, previewImage, outlines, canvasWidth, canvasHeight,
  skeletonNodes, skeletonSegments,
  onConfirm, onDiscard, onManualComponents,
}: Props) {
  const [edits, setEdits] = useState<Record<number, { name: string; pitch: string }>>(() => (
    Object.fromEntries(areas.map(area => [area.index, {
      name: area.name,
      pitch: area.pitch == null ? '' : String(area.pitch),
    }]))
  ));
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [viewMode, setViewMode] = useState<'original' | 'clean'>('original');

  const valid = areas.length > 0 && areas.every(area => {
    const edit = edits[area.index];
    const pitch = Number(edit?.pitch);
    return Boolean(edit?.name.trim()) && edit?.pitch !== ''
      && Number.isFinite(pitch) && pitch >= 0 && pitch <= 89;
  });

  const confirm = () => {
    if (!valid) return;
    onConfirm(Object.fromEntries(areas.map(area => [area.index, {
      name: edits[area.index].name.trim(),
      pitch: Number(edits[area.index].pitch),
    }])));
  };

  const buildOverrides = (): Record<number, { name: string; pitch: number }> => {
    return Object.fromEntries(areas.map(area => [area.index, {
      name: edits[area.index]?.name?.trim() || area.name || `Area ${area.index + 1}`,
      pitch: Number(edits[area.index]?.pitch) || area.pitch || 0,
    }]));
  };

  // Build node lookup for skeleton rendering
  const nodeLookup = useMemo(() => {
    const map = new Map<string, SkeletonNode>();
    if (skeletonNodes) for (const n of skeletonNodes) map.set(n.id, n);
    return map;
  }, [skeletonNodes]);

  const hasSkeleton = (skeletonNodes?.length ?? 0) > 0 || (skeletonSegments?.length ?? 0) > 0;
  const junctionCount = skeletonNodes?.filter(n => n.kind === 'junction').length ?? 0;
  const segmentCount = skeletonSegments?.length ?? 0;

  const aspectRatio = `${canvasWidth} / ${canvasHeight}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Confirm roof areas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Check the outline and skeleton before AI finds the roof components.
        </p>

        {/* Skeleton stats */}
        {hasSkeleton && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
              {areas[0]?.vertexCount ?? 0} outline points
            </span>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 font-medium text-orange-700">
              {junctionCount} junctions
            </span>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 font-medium text-orange-700">
              {segmentCount} segments
            </span>
          </div>
        )}

        {/* Preview with toggle */}
        <div
          className="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-800 bg-contain bg-left-top bg-no-repeat"
          style={{
            backgroundImage: viewMode === 'original' ? `url(${previewImage})` : 'none',
            backgroundColor: viewMode === 'clean' ? '#1e293b' : undefined,
            aspectRatio,
            maxHeight: '40vh',
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            preserveAspectRatio="none"
            aria-label="Detected roof area preview with skeleton"
          >
            {/* Outline polygons (blue, dashed) */}
            {outlines.map((outline, index) => (
              <polygon
                key={index}
                points={outline.points.map(point => `${point.x},${point.y}`).join(' ')}
                fill="rgba(59,130,246,0.16)"
                stroke="#2563eb"
                strokeWidth="2"
                strokeDasharray="7 5"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Skeleton segments (orange) */}
            {showSkeleton && skeletonSegments?.map(seg => {
              const start = nodeLookup.get(seg.start_node_id);
              const end = nodeLookup.get(seg.end_node_id);
              if (!start || !end) return null;
              return (
                <line
                  key={seg.id}
                  x1={start.x} y1={start.y}
                  x2={end.x} y2={end.y}
                  stroke="#FF6B35"
                  strokeWidth="3"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Skeleton nodes (orange dots for junctions, blue dots for perimeter points) */}
            {showSkeleton && skeletonNodes?.map(node => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={node.kind === 'junction' ? 5 : 4}
                fill={node.kind === 'junction' ? '#FF6B35' : '#2563eb'}
                stroke="white"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Segment IDs */}
            {showSkeleton && skeletonSegments?.map(seg => {
              const start = nodeLookup.get(seg.start_node_id);
              const end = nodeLookup.get(seg.end_node_id);
              if (!start || !end) return null;
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              return (
                <text
                  key={`label-${seg.id}`}
                  x={midX + 6}
                  y={midY - 6}
                  fontFamily="monospace"
                  fontSize="14"
                  fontWeight="bold"
                  fill="#dc2626"
                >
                  {seg.id}
                </text>
              );
            })}
          </svg>
        </div>

        {/* View toggle */}
        {hasSkeleton && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('original')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${viewMode === 'original' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'}`}
            >
              Original + Skeleton
            </button>
            <button
              type="button"
              onClick={() => setViewMode('clean')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${viewMode === 'clean' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'}`}
            >
              Clean Skeleton
            </button>
            <button
              type="button"
              onClick={() => setShowSkeleton(s => !s)}
              className="ml-auto rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {showSkeleton ? 'Hide skeleton' : 'Show skeleton'}
            </button>
          </div>
        )}

        {/* Area name + pitch inputs */}
        <div className="mt-4 space-y-2">
          {areas.map(area => {
            const edit = edits[area.index] ?? { name: area.name, pitch: '' };
            return (
              <div key={area.index} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Area {area.index + 1}</span>
                  <span className="text-xs text-slate-400">{area.vertexCount} outline points</span>
                </div>
                <div className="grid grid-cols-[1fr_92px] gap-2">
                  <input type="text" value={edit.name} onChange={event => setEdits(previous => ({ ...previous, [area.index]: { ...edit, name: event.target.value } }))} aria-label={`Area ${area.index + 1} name`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                  <div className="relative">
                    <input type="number" min={0} max={89} step={0.5} value={edit.pitch} placeholder="Pitch" onChange={event => setEdits(previous => ({ ...previous, [area.index]: { ...edit, pitch: event.target.value } }))} aria-label={`Area ${area.index + 1} pitch`} className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm focus:border-orange-500 focus:outline-none" />
                    <span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-400">deg</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {notes.length > 0 && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            {notes.map((note, index) => <p key={`${note}-${index}`}>• {note}</p>)}
          </div>
        )}

        {/* 3-button layout */}
        <div className="mt-5 flex flex-col gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={onDiscard} className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Discard</button>
            <button
              type="button"
              onClick={confirm}
              disabled={!valid}
              className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Run AI component classification on the outline"
            >
              Scan for Components (AI Assist)
            </button>
          </div>
          <button type="button" onClick={() => valid && onManualComponents(buildOverrides())} disabled={!valid} className="w-full rounded-full border border-[#FF6B35] px-4 py-2 text-sm font-medium text-[#FF6B35] transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40">Add Components (Manual)</button>
        </div>
      </div>
    </div>
  );
}
