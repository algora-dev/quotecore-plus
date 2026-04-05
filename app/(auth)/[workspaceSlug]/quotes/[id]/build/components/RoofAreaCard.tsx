'use client';
import { useState, useRef } from 'react';
import type { QuoteRoofAreaRow, QuoteRoofAreaEntryRow, QuoteRow } from '@/app/lib/types';
import { formatArea, formatLinear } from '@/app/lib/measurements/displayHelpers';

interface Props {
  area: QuoteRoofAreaRow;
  entries: QuoteRoofAreaEntryRow[];
  quote: QuoteRow;
  locked?: boolean; // NEW: For digital takeoff data
  onUpdate: (id: string, updates: any) => Promise<void>;
  onToggleLock: (id: string, locked: boolean) => Promise<void>;
  onAddEntry: (areaId: string, widthM: number, lengthM: number) => Promise<void>;
  onRemoveEntry: (entryId: string, areaId: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function RoofAreaCard({
  area,
  entries,
  quote,
  locked = false,
  onUpdate,
  onToggleLock,
  onAddEntry,
  onRemoveEntry,
  onRemove
}: Props) {
  const [adding, setAdding] = useState(false);
  const [widthInput, setWidthInput] = useState('');
  const [lengthInput, setLengthInput] = useState('');
  const widthRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const w = Number(widthInput);
    const l = Number(lengthInput);
    if (!w || w <= 0 || !l || l <= 0) return;
    await onAddEntry(area.id, w, l);
    setWidthInput('');
    setLengthInput('');
    widthRef.current?.focus();
  }

  function startAdding() {
    setAdding(true);
    setTimeout(() => widthRef.current?.focus(), 50);
  }

  const isLocked = locked || area.is_locked;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {isLocked ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">{area.label}</h3>
              {locked && (
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">
                  🤖 From Takeoff
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-600">
                {formatArea(area.final_value_sqm ?? area.computed_sqm ?? 0, quote.measurement_system)}
                {area.calc_pitch_degrees ? ` @ ${area.calc_pitch_degrees}°` : ''}
              </span>
              {!locked && (
                <>
                  <button
                    onClick={() => onToggleLock(area.id, false)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button onClick={() => onRemove(area.id)} className="text-xs text-red-500">
                    ×
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{area.label}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-600">
                {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
              </span>
              <button onClick={() => onRemove(area.id)} className="text-xs text-red-500">
                ×
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-slate-500">Pitch (°)</label>
              <input
                type="number"
                step="0.5"
                defaultValue={area.calc_pitch_degrees ?? ''}
                onBlur={e =>
                  onUpdate(area.id, {
                    input_mode: 'calculated',
                    calc_width_m: area.calc_width_m,
                    calc_length_m: area.calc_length_m,
                    calc_plan_sqm: area.calc_plan_sqm,
                    calc_pitch_degrees: Number(e.target.value) || null
                  })
                }
                className="w-20 px-2 py-1 text-xs border border-slate-300 rounded"
              />
            </div>
            {entries.map((entry, idx) => (
              <div key={entry.id} className="flex items-center gap-2 text-xs mb-1">
                <span className="text-slate-400 w-6">#{idx + 1}</span>
                <span className="text-slate-700">
                  {formatLinear(entry.width_m, quote.measurement_system)} × {formatLinear(entry.length_m, quote.measurement_system)} = {formatArea(entry.sqm, quote.measurement_system)}
                </span>
                <button
                  onClick={() => onRemoveEntry(entry.id, area.id)}
                  className="ml-auto text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            {adding ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  ref={widthRef}
                  type="number"
                  step="0.01"
                  value={widthInput}
                  onChange={e => setWidthInput(e.target.value)}
                  placeholder={quote.measurement_system === "imperial" ? "Width (ft)" : "Width (m)"}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSubmit();
                    if (e.key === 'Escape') {
                      setAdding(false);
                      setWidthInput('');
                      setLengthInput('');
                    }
                  }}
                  className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                />
                <span className="text-xs text-slate-400">×</span>
                <input
                  type="number"
                  step="0.01"
                  value={lengthInput}
                  onChange={e => setLengthInput(e.target.value)}
                  placeholder={quote.measurement_system === "imperial" ? "Length (ft)" : "Length (m)"}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSubmit();
                    if (e.key === 'Escape') {
                      setAdding(false);
                      setWidthInput('');
                      setLengthInput('');
                    }
                  }}
                  className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                />
                <button
                  onClick={handleSubmit}
                  className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setWidthInput('');
                    setLengthInput('');
                  }}
                  className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                onClick={startAdding}
                className="text-xs text-orange-600 hover:text-blue-800 font-medium mt-1"
              >
                + Add area measurement
              </button>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onToggleLock(area.id, true)}
              className="px-3 py-1 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}
