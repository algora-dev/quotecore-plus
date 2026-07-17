'use client';

import { useState } from 'react';

export interface AiResultsData {
  summary: {
    areas: number;
    components: number;
    ridges: number;
    hips: number;
    valleys: number;
    barges: number;
    spouting: number;
    notes: string[];
    unreadable: boolean;
  };
  scaleCheck: {
    hasDimensionLine: boolean;
    discrepancyPct: number | null;
    warning: string | null;
  } | null;
  droppedCount: number;
}

interface Props {
  data: AiResultsData;
  onApply: (pitchOverrides: Record<string, number>) => void;
  onDiscard: () => void;
}

export function AiResultsModal({ data, onApply, onDiscard }: Props) {
  const { summary, scaleCheck, droppedCount } = data;
  const [acknowledged, setAcknowledged] = useState(false);
  const [pitchOverrides, setPitchOverrides] = useState<Record<string, number>>({});

  if (summary.unreadable) {
    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-[60]">
        <div className="bg-white rounded-2xl p-4 md:p-6 max-w-md border border-gray-200 shadow-xl">
          <h2 className="text-lg font-semibold mb-2">⚠️ Image unreadable</h2>
          <p className="text-sm text-slate-500 mb-4">
            The AI couldn&apos;t analyse this plan image. This usually means the image is too low quality,
            rotated at an unusual angle, or doesn&apos;t contain a recognisable roof plan.
          </p>
          {summary.notes.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              {summary.notes.map((n, i) => <p key={i}>• {n}</p>)}
            </div>
          )}
          <button
            onClick={onDiscard}
            className="w-full py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl p-4 md:p-6 max-w-lg border border-gray-200 shadow-xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-1">AI Scan Results</h2>
        <p className="text-xs text-slate-500 mb-4">
          Review the detected components below. You can adjust pitch per area before applying.
          After applying, you can attach real components and edit measurements manually.
        </p>

        {/* Detection summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <SummaryCard label="Roof Areas" value={summary.areas} colour="text-blue-600" />
          <SummaryCard label="Total Lines" value={summary.components} colour="text-slate-900" />
          <SummaryCard label="Dropped" value={droppedCount} colour={droppedCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          <MiniStat label="Ridges" value={summary.ridges} colour="bg-green-100 text-green-700" />
          <MiniStat label="Hips" value={summary.hips} colour="bg-red-100 text-red-700" />
          <MiniStat label="Valleys" value={summary.valleys} colour="bg-yellow-100 text-yellow-700" />
          <MiniStat label="Barges" value={summary.barges} colour="bg-purple-100 text-purple-700" />
          <MiniStat label="Spouting" value={summary.spouting} colour="bg-slate-100 text-slate-700" />
        </div>

        {/* Scale cross-check */}
        {scaleCheck?.warning && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ {scaleCheck.warning}
          </div>
        )}

        {/* Pitch */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-700 mb-1.5 block">
            Roof Pitch (degrees)
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={0}
              max={89}
              step={0.5}
              placeholder="25"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 89) {
                  setPitchOverrides({ default: val });
                }
              }}
              className="w-20 px-2 py-1.5 text-sm rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none inputMode='decimal'"
            />
            <span className="text-xs text-slate-500">
              Applied to all detected areas. Adjust per-area later in the takeoff.
            </span>
          </div>
        </div>

        {/* Notes */}
        {summary.notes.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            {summary.notes.map((n, i) => <p key={i}>• {n}</p>)}
          </div>
        )}

        {/* Acknowledgment */}
        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-xs text-slate-600">
            I understand these are AI-generated measurements placed as placeholder components.
            I&apos;ll verify accuracy and attach real components before quoting.
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onDiscard}
            className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={() => onApply(pitchOverrides)}
            disabled={!acknowledged}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply to Canvas
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-2.5 text-center">
      <div className={`text-xl font-bold ${colour}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className={`rounded-lg p-2 text-center ${colour}`}>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[9px] uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}
