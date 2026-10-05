'use client';
import { useState, useRef, useId } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput } from '@/app/components/ui/v2/QcField';
import { QcStatusBadge } from '@/app/components/ui/v2/QcSurface';
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
  const fieldId = useId();
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
    <div className="qc-surface qb-area-card qb-stack">
      {area.is_locked ? (
        <>
          <div className="qb-area-heading">
            <h3 className="qb-group-title">{area.label}</h3>
            <div className="qb-area-tools">
              <span className="qb-area-quantity">
                {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
                {area.calc_pitch_degrees ? ` @ ${area.calc_pitch_degrees}°` : ''}
              </span>
              <QcStatusBadge tone="success">Confirmed</QcStatusBadge>
              <QcButton
                aria-label={`Edit ${area.label}`}
                onClick={() => onToggleLock(area.id, false)}
                size="sm"
              >
                Edit
              </QcButton>
              <QcButton aria-label={`Remove ${area.label}`} title={`Remove ${area.label}`} onClick={() => onRemove(area.id)} size="sm" className="qc-icon-button qc-icon-danger">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </QcButton>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="qb-area-heading">
            <h3 className="qb-group-title">{area.label}</h3>
            <div className="qb-area-tools">
              <span className="qb-area-quantity">
                {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
              </span>
              <QcButton aria-label={`Remove ${area.label}`} title={`Remove ${area.label}`} onClick={() => onRemove(area.id)} size="sm" className="qc-icon-button qc-icon-danger">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </QcButton>
            </div>
          </div>
          <div>
              {areaPitchVisible && <p className="qce-basis-help" style={{ marginTop: 8 }}>
                Width × length is plan area; the pitch below adjusts it to the surface.
                Already have a surface total? Enter it on a component as an Actual measurement instead.
              </p>}
              {areaPitchVisible && <div className="mb-2" data-copilot="quote-pitch">
                <PitchInput
                  appearance="v2"
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
                  <p className="qb-angle-warning">
                    High angle ({area.calc_pitch_degrees}°): calculated quantities get very large near vertical. Double-check the value is correct.
                  </p>
                )}
              </div>}
              {entries.map((entry, idx) => (
                <div key={entry.id} className="qb-entry-row">
                  <span className="qb-entry-number">#{idx + 1}</span>
                  <span className="qb-entry-value">
                    {formatLinear(entry.width_m, quote.measurement_system)} × {formatLinear(entry.length_m, quote.measurement_system)} = {formatArea(entry.sqm, quote.measurement_system)}
                    {entry.pitch_degrees != null && entry.pitch_degrees > 0 && (
                      <span className="qb-entry-detail">@ {entry.pitch_degrees}°</span>
                    )}
                  </span>
                  <QcButton
                    aria-label={`Remove measurement ${idx + 1} from ${area.label}`}
                    title="Remove measurement"
                    onClick={() => onRemoveEntry(entry.id, area.id)}
                    size="sm" className="qc-icon-button qc-icon-danger qb-entry-remove"
                  >
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </QcButton>
                </div>
              ))}
              {adding ? (
                <div className="qb-measurement-row" data-copilot="quote-measurement-inputs">
                  <div className="qb-dimension-field">
                    <label htmlFor={`${fieldId}-width`} className="qc-label">Width ({normalizeMeasurementSystem(quote.measurement_system) === 'metric' ? 'm' : 'ft'})</label>
                  <QcInput
                    ref={widthRef}
                    id={`${fieldId}-width`}
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
                    className="qb-full-width"
                  />
                  </div>
                  <span className="qb-multiply" aria-hidden="true">×</span>
                  <div className="qb-dimension-field">
                    <label htmlFor={`${fieldId}-length`} className="qc-label">Length ({normalizeMeasurementSystem(quote.measurement_system) === 'metric' ? 'm' : 'ft'})</label>
                  <QcInput
                    id={`${fieldId}-length`}
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
                    className="qb-full-width"
                  />
                  </div>
                  <QcButton
                    onClick={handleSubmit}
                    variant="primary"
                  >
                    Add
                  </QcButton>
                  <QcButton
                    onClick={() => {
                      setAdding(false);
                      setWidthInput('');
                      setLengthInput('');
                    }}
                    variant="ghost"
                  >
                    Done
                  </QcButton>
                </div>
              ) : (
                <QcButton
                  onClick={startAdding}
                  data-copilot="quote-add-measurement"
                  variant="ghost"
                >
                  + Add area measurement
                </QcButton>
              )}
            </div>
          <div className="qb-area-footer">
            <QcButton
              onClick={() => onToggleLock(area.id, true)}
              data-copilot="quote-confirm-area"
              className="qc-success-action"
            >
              Confirm area
            </QcButton>
          </div>
        </>
      )}
    </div>
  );
}
