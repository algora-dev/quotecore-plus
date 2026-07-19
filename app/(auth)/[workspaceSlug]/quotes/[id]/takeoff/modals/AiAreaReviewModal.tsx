'use client';

import { useState } from 'react';
import type { AiResultsArea } from './AiResultsModal';

interface Props {
  areas: AiResultsArea[];
  notes: string[];
  previewImage: string;
  outlines: Array<{ points: Array<{ x: number; y: number }> }>;
  /** Canvas dimensions — SVG viewBox matches these so overlay coords align perfectly. */
  canvasWidth: number;
  canvasHeight: number;
  onConfirm: (overrides: Record<number, { name: string; pitch: number }>) => void;
  onDiscard: () => void;
}

export function AiAreaReviewModal({ areas, notes, previewImage, outlines, canvasWidth, canvasHeight, onConfirm, onDiscard }: Props) {
  const [edits, setEdits] = useState<Record<number, { name: string; pitch: string }>>(() => (
    Object.fromEntries(areas.map(area => [area.index, {
      name: area.name,
      pitch: area.pitch == null ? '' : String(area.pitch),
    }]))
  ));

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

  // Compute aspect ratio from canvas dimensions for the preview container
  const aspectRatio = `${canvasWidth} / ${canvasHeight}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Confirm roof areas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Check each parent area name and pitch before AI finds the roof components.
        </p>
        <div
          className="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-800 bg-contain bg-left-top bg-no-repeat"
          style={{
            backgroundImage: `url(${previewImage})`,
            aspectRatio,
            maxHeight: '40vh',
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            preserveAspectRatio="none"
            aria-label="Detected roof area preview"
          >
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
          </svg>
        </div>
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
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onDiscard} className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Discard</button>
          <button type="button" onClick={confirm} disabled={!valid} className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:cursor-not-allowed disabled:opacity-40">Confirm & Find Components</button>
        </div>
      </div>
    </div>
  );
}
