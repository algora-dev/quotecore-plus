'use client';

import { useState } from 'react';
import { AI_COMPONENT_REGISTRY, ALL_SEMANTIC_KEYS } from '@/app/lib/takeoff/aiComponentRegistry';

export interface AiResultsArea {
  /** Index in the roof_areas array (0-based). */
  index: number;
  /** AI-suggested name. */
  name: string;
  /** AI-suggested pitch (degrees). */
  pitch: number | null;
  /** Number of polygon points. */
  vertexCount: number;
}

export interface AiResultsData {
  summary: {
    areas: number;
    components: number;
    ridges: number;
    hips: number;
    valleys: number;
    broken_hips: number;
    barges: number;
    spouting: number;
    uncertain: number;
    notes: string[];
    unreadable: boolean;
  };
  scaleCheck: {
    hasDimensionLine: boolean;
    discrepancyPct: number | null;
    warning: string | null;
  } | null;
  droppedCount: number;
  /** Per-area details for the editable Parent Areas section. */
  areas: AiResultsArea[];
}

interface Props {
  data: AiResultsData;
  onApply: (areaOverrides: Record<number, { name: string; pitch: number }>) => void;
  onDiscard: () => void;
}

export function AiResultsModal({ data, onApply, onDiscard }: Props) {
  const { summary, scaleCheck, droppedCount, areas } = data;
  const [acknowledged, setAcknowlednowledged] = useState(false);
  const [areaEdits, setAreaEdits] = useState<Record<number, { name: string; pitch: string }>>(() => (
    Object.fromEntries(areas.map(area => [area.index, {
      name: area.name,
      pitch: area.pitch != null ? String(area.pitch) : '',
    }]))
  ));
  const [applyPitchToAll, setApplyPitchToAll] = useState<string>('');

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

  // Build the final overrides for onApply
  const buildOverrides = (): Record<number, { name: string; pitch: number }> => {
    const overrides: Record<number, { name: string; pitch: number }> = {};
    for (const area of areas) {
      const edit = areaEdits[area.index];
      const name = edit?.name?.trim() || area.name || `Area ${area.index + 1}`;
      let pitch: number;
      if (applyPitchToAll) {
        pitch = parseFloat(applyPitchToAll);
        if (isNaN(pitch) || pitch < 0 || pitch > 89) pitch = area.pitch ?? 0;
      } else {
        pitch = parseFloat(edit?.pitch || '');
        if (isNaN(pitch) || pitch < 0 || pitch > 89) pitch = area.pitch ?? 0;
      }
      overrides[area.index] = { name, pitch };
    }
    return overrides;
  };

  // Validate all areas have valid values before enabling Apply
  const allValid = areas.length > 0 && areas.every(area => {
    const edit = areaEdits[area.index];
    if (!edit?.name?.trim()) return false;
    if (applyPitchToAll) {
      const p = parseFloat(applyPitchToAll);
      return !isNaN(p) && p >= 0 && p <= 89;
    }
    if (edit?.pitch === undefined || edit.pitch.trim() === '') return false;
    const pitch = parseFloat(edit.pitch);
    return !isNaN(pitch) && pitch >= 0 && pitch <= 89;
  });

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl p-4 md:p-6 max-w-lg border border-gray-200 shadow-xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-1">AI Scan Results</h2>
        <p className="text-xs text-slate-500 mb-4">
          Review the detected areas and components below. You can adjust names and pitches before applying.
          After applying, you can attach real components and edit measurements manually.
        </p>

        {/* Detection summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <SummaryCard label="Roof Areas" value={summary.areas} colour="text-blue-600" />
          <SummaryCard label="Total Lines" value={summary.components} colour="text-slate-900" />
          <SummaryCard label="Dropped" value={droppedCount} colour={droppedCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {ALL_SEMANTIC_KEYS.map(key => {
            const def = AI_COMPONENT_REGISTRY[key];
            const count = summary[def.key];
            return (
              <MiniStat key={key} label={def.displayName} value={count} colour={def.badgeClasses} />
            );
          })}
        </div>

        {/* Scale cross-check */}
        {scaleCheck?.warning && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ {scaleCheck.warning}
          </div>
        )}

        {/* Roof areas — editable rows */}
        {areas.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700">
                Name Roof Areas and Apply Pitch
              </label>
              <span className="text-[10px] text-slate-400">{areas.length} area{areas.length !== 1 ? 's' : ''}</span>
            </div>

            <p className="mb-2 text-xs text-slate-500">
              Check each detected outline, then enter its name and pitch before applying the results.
            </p>

            {/* Apply pitch to all */}
            <div className="flex gap-2 items-center mb-2 p-2 bg-orange-50/50 border border-orange-100 rounded-lg">
              <input
                type="number"
                min={0}
                max={89}
                step={0.5}
                placeholder="25"
                value={applyPitchToAll}
                onChange={(e) => setApplyPitchToAll(e.target.value)}
                className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none"
                inputMode="decimal"
              />
              <span className="text-xs text-slate-600">
                Apply this pitch to all areas (overrides per-area values)
              </span>
              {applyPitchToAll && (
                <button
                  onClick={() => setApplyPitchToAll('')}
                  className="text-xs text-slate-400 hover:text-slate-600 ml-auto"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Per-area editable rows */}
            <div className="space-y-2">
              {areas.map((area) => {
                const edit = areaEdits[area.index];
                return (
                  <div key={area.index} className="flex gap-2 items-center p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 w-5">{area.index + 1}</span>
                    <input
                      type="text"
                      value={edit?.name ?? ''}
                      placeholder={area.name || `Area ${area.index + 1}`}
                      onChange={(e) => {
                        setAreaEdits(prev => ({
                          ...prev,
                          [area.index]: { ...prev[area.index], name: e.target.value },
                        }));
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={89}
                        step={0.5}
                        placeholder={area.pitch != null ? String(area.pitch) : '0'}
                        value={applyPitchToAll ? '' : (edit?.pitch ?? '')}
                        disabled={!!applyPitchToAll}
                        onChange={(e) => {
                          setAreaEdits(prev => ({
                            ...prev,
                            [area.index]: { ...prev[area.index], pitch: e.target.value },
                          }));
                        }}
                        className="w-14 px-2 py-1 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                        inputMode="decimal"
                      />
                      <span className="text-[10px] text-slate-400">°</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{area.vertexCount}pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            onChange={(e) => setAcknowlednowledged(e.target.checked)}
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
            onClick={() => onApply(buildOverrides())}
            disabled={!acknowledged || !allValid}
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
