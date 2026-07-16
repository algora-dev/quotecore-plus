'use client';
import { useState, useRef } from 'react';
import { getTradeLabels } from '@/app/lib/trades/labels';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { formatArea, formatLinear } from '@/app/lib/measurements/displayHelpers';
import type { QuoteRow, QuoteRoofAreaRow, QuoteRoofAreaEntryRow } from '@/app/lib/types';
import type { MeasurementSystem } from '@/app/lib/types';
import { updateQuoteRoofArea, toggleAreaLock, addRoofAreaEntry, removeRoofAreaEntry } from '../../actions';
import { PitchInput } from '@/app/components/PitchInput';

export function RoofAreaCard({
  area,
  entries,
  quote,
  onUpdate,
  onToggleLock,
  onAddEntry,
  onRemoveEntry,
  onRemove
}: {
  area: QuoteRoofAreaRow;
  entries: QuoteRoofAreaEntryRow[];
  quote: QuoteRow;
  onUpdate: (id: string, updates: Parameters<typeof updateQuoteRoofArea>[1]) => Promise<void>;
  onToggleLock: (id: string, locked: boolean) => Promise<void>;
  onAddEntry: (areaId: string, widthM: number, lengthM: number) => Promise<void>;
  onRemoveEntry: (entryId: string, areaId: string) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [widthInput, setWidthInput] = useState('');
  const [lengthInput, setLengthInput] = useState('');
  // Track in-flight submission so two near-simultaneous onBlur events
  // (e.g. width blur firing while length is autofilled) don't double-fire.
  const submittingRef = useRef(false);
  // Show the pitch field for trades that require pitch (roofing) or support it optionally
  // (landscaping, concrete, insulation, electrical). Label changes per trade.
  const _areaTradeLabels = getTradeLabels((quote as { trade?: string }).trade);
  const areaPitchVisible = _areaTradeLabels.pitchRequired || !!_areaTradeLabels.pitchOptional;
  const areaPitchLabel = _areaTradeLabels.areaPitchLabel ?? 'Pitch (°)';
  const widthRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (submittingRef.current) return;
    const w = Number(widthInput);
    const l = Number(lengthInput);
    if (!w || w <= 0 || !l || l <= 0) return;
    submittingRef.current = true;
    try {
      await onAddEntry(area.id, w, l);
      setWidthInput('');
      setLengthInput('');
      widthRef.current?.focus();
    } finally {
      submittingRef.current = false;
    }
  }

  /**
   * Auto-submit the entry as soon as both fields hold a positive number.
   * Wired to onBlur on width / length so the user no longer needs to click
   * the explicit "Add" button - entering W × L × pitch "just works" and the
   * area's computed_sqm updates immediately. Reported by Shaun 2026-05-17.
   */
  function tryAutoSubmit() {
    const w = Number(widthInput);
    const l = Number(lengthInput);
    if (w > 0 && l > 0) {
      // Defer one tick so React state from the blurring input is committed
      // (otherwise the trailing edit on the just-blurred field may be lost).
      setTimeout(() => { void handleSubmit(); }, 0);
    }
  }

  function startAdding() {
    setAdding(true);
    setTimeout(() => widthRef.current?.focus(), 50);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4 space-y-3">
      {area.is_locked ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">{area.label}</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-medium text-orange-600">
                {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
                {area.calc_pitch_degrees ? ` @ ${area.calc_pitch_degrees}°` : ''}
              </span>
              <button
                onClick={() => onToggleLock(area.id, false)}
                className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50 min-h-[44px] flex items-center"
              >
                Edit
              </button>
              <button onClick={() => onRemove(area.id)} className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">{area.label}</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-medium text-orange-600">
                {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
              </span>
              <button onClick={() => onRemove(area.id)} className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>
          <div>
              {areaPitchVisible && <div className="mb-2" data-copilot="quote-pitch">
                <PitchInput
                  degrees={area.calc_pitch_degrees}
                  onSave={(deg) => {
                    onUpdate(area.id, {
                      input_mode: 'calculated',
                      calc_width_m: area.calc_width_m,
                      calc_length_m: area.calc_length_m,
                      calc_plan_sqm: area.calc_plan_sqm,
                      calc_pitch_degrees: deg,
                    });
                  }}
                  label={areaPitchLabel}
                  showMax
                  compact
                  className="block"
                />
                {(area.calc_pitch_degrees ?? 0) >= 60 && (
                  <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    High angle ({area.calc_pitch_degrees}°): calculated quantities get very large near vertical. Double-check the value is correct.
                  </p>
                )}
              </div>}
              {entries.map((entry, idx) => (
                <div key={entry.id} className="flex items-center gap-2 text-xs mb-1">
                  <span className="text-slate-400 w-6 flex-shrink-0">#{idx + 1}</span>
                  <span className="text-slate-700 min-w-0">
                    {formatLinear(entry.width_m, quote.measurement_system)} × {formatLinear(entry.length_m, quote.measurement_system)} = {formatArea(entry.sqm, quote.measurement_system)}
                    {entry.pitch_degrees != null && entry.pitch_degrees > 0 && (
                      <span className="text-slate-400 ml-1">@ {entry.pitch_degrees}°</span>
                    )}
                  </span>
                  <button
                    onClick={() => onRemoveEntry(entry.id, area.id)}
                    className="ml-auto w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
              ))}
              {adding ? (
                <div className="flex flex-wrap items-center gap-2 mt-2" data-copilot="quote-measurement-inputs">
                  <input
                    ref={widthRef}
                    type="number"
                    step="0.01"
                    value={widthInput}
                    onChange={e => setWidthInput(e.target.value)}
                    onBlur={tryAutoSubmit}
                    placeholder={normalizeMeasurementSystem(quote.measurement_system) === 'metric' ? "Width (m)" : "Width (ft)"}
                    inputMode="decimal"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') {
                        setAdding(false);
                        setWidthInput('');
                        setLengthInput('');
                      }
                    }}
                    className="w-24 px-2 py-1.5 text-base md:text-xs border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="number"
                    step="0.01"
                    value={lengthInput}
                    onChange={e => setLengthInput(e.target.value)}
                    onBlur={tryAutoSubmit}
                    placeholder={normalizeMeasurementSystem(quote.measurement_system) === 'metric' ? "Length (m)" : "Length (ft)"}
                    inputMode="decimal"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') {
                        setAdding(false);
                        setWidthInput('');
                        setLengthInput('');
                      }
                    }}
                    className="w-24 px-2 py-1.5 text-base md:text-xs border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSubmit}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.5)] min-h-[44px]"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setAdding(false);
                      setWidthInput('');
                      setLengthInput('');
                    }}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 min-h-[44px] flex items-center"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  onClick={startAdding}
                  data-copilot="quote-add-measurement"
                  className="text-xs text-orange-600 hover:text-blue-800 font-medium mt-1"
                >
                  + Add area measurement
                </button>
              )}
            </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onToggleLock(area.id, true)}
              data-copilot="quote-confirm-area"
              className="px-4 py-2 text-sm font-medium rounded-full bg-emerald-600 text-white hover:bg-emerald-700 min-h-[44px]"
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}
