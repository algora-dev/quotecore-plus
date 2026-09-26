'use client';

import { useState, useEffect, useId } from 'react';
import './ui/v2/qc.css';
import {
  type PitchInputMode,
  PITCH_INPUT_MODE_LABELS,
  toDegrees,
  fromDegrees,
  pitchPlaceholder,
  pitchSuffix,
} from '@/app/lib/pitch-inputs';

/** Owner 2026-09-26: word labels on the mode pills (was ° / 1:X / %) plus a
 *  hover tooltip explaining each mode - the symbols "said nothing". */
const MODE_BUTTON_LABELS: Record<PitchInputMode, string> = {
  degrees: 'Degrees',
  ratio: 'Ratio',
  gradient: 'Slope',
};
const MODE_BUTTON_TITLES: Record<PitchInputMode, string> = {
  degrees: 'Degrees - angle from horizontal. 0 = flat, 45 = very steep.',
  ratio: 'Ratio 1:X - X units of run per 1 unit of rise. Type 12 for 1:12.',
  gradient: 'Slope % - rise per 100 units of horizontal run. 58 = 58%.',
};

/**
 * Reusable pitch input with mode toggle (degrees / ratio / gradient).
 *
 * - Value is always communicated to the parent as **degrees**.
 * - The internal text field shows whatever the user typed in the selected mode.
 * - On blur (or Enter), the value is converted to degrees and passed to `onSave`.
 * - If `degrees` prop changes externally, the display updates to match.
 */
/** Persisted so the takeoff report can show pitch in the mode the user
 *  chose (degrees / ratio / gradient) instead of always degrees. */
const PITCH_MODE_STORAGE_KEY = 'qc-pitch-input-mode';

/** Read the last pitch input mode the user selected (client-side only). */
export function getStoredPitchMode(): PitchInputMode {
  if (typeof window === 'undefined') return 'degrees';
  const v = window.localStorage.getItem(PITCH_MODE_STORAGE_KEY);
  return v === 'ratio' || v === 'gradient' || v === 'degrees' ? v : 'degrees';
}

function storePitchMode(mode: PitchInputMode) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(PITCH_MODE_STORAGE_KEY, mode); } catch {}
}

export function PitchInput(props: {
  /** Phase 1-only presentation; does not alter pitch conversion or write timing. */
  appearance?: 'v2';
  /** Current pitch in degrees (controlled from parent / DB). */
  degrees: number | null | undefined;
  /** Called with degrees when the user commits a value. */
  onSave: (degrees: number | null) => void;
  /** Label for the field. */
  label?: string;
  /** Whether pitch is required (affects placeholder styling). */
  required?: boolean;
  /** Whether to show the max-80° hint. */
  showMax?: boolean;
  /** Optional className for the wrapper. */
  className?: string;
  /** Compact mode (smaller, for inline use). */
  compact?: boolean;
  /** autoFocus the input. */
  autoFocus?: boolean;
}) {
  const { degrees, onSave, label, required, showMax, className, compact, autoFocus, appearance } = props;
  const inputId = useId();
  const [mode, setMode] = useState<PitchInputMode>('degrees');
  // Restore the user's last-selected mode (report also reads this).
  useEffect(() => {
    setMode(getStoredPitchMode());
  }, []);
  const [text, setText] = useState('');

  // Sync display text when external degrees change or mode changes
  useEffect(() => {
    setText(fromDegrees(mode, degrees));
  }, [mode, degrees]);

  function commit() {
    const raw = text.trim();
    if (!raw) {
      onSave(null);
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
      onSave(null);
      return;
    }
    const deg = toDegrees(mode, num);
    onSave(deg);
  }

  return (
    <div data-qc-ui={appearance === 'v2' ? 'v2' : undefined} className={appearance === 'v2' ? `qc-pitch ${className ?? ''}` : className}>
      {label && (
        <div className="flex items-center gap-2 mb-1">
          <label htmlFor={inputId} className={compact ? 'text-xs text-slate-500' : 'text-sm font-medium text-slate-700'}>
            {label}
            {!required && <span className="text-slate-400 font-normal ml-1">(optional)</span>}
          </label>
        </div>
      )}
      <div className={appearance === 'v2' ? 'qc-pitch-row' : 'flex items-center gap-2'}>
        {/* Mode toggle */}
        <div className={appearance === 'v2' ? 'qc-choice-group' : 'flex rounded-full border border-slate-200 overflow-hidden shrink-0'} role="group" aria-label="Pitch input units">
          {(Object.keys(PITCH_INPUT_MODE_LABELS) as PitchInputMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              aria-label={PITCH_INPUT_MODE_LABELS[m]}
              title={MODE_BUTTON_TITLES[m]}
              onClick={() => { setMode(m); storePitchMode(m); }}
              className={appearance === 'v2' ? 'qc-choice' : `px-2 py-1 text-[11px] font-medium transition-colors ${
                mode === m
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {MODE_BUTTON_LABELS[m]}
            </button>
          ))}
        </div>
        {/* Input */}
        <input
          id={inputId}
          aria-label={label || `Pitch in ${PITCH_INPUT_MODE_LABELS[mode]}`}
          inputMode="decimal"
          type="number"
          step={mode === 'degrees' ? '0.5' : mode === 'ratio' ? '1' : '0.5'}
          min="0"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          placeholder={pitchPlaceholder(mode)}
          autoFocus={autoFocus}
          className={appearance === 'v2' ? 'qc-input qc-pitch-value' : `${compact ? 'w-16 px-1 py-0.5 text-xs' : 'w-24 px-2 py-1 text-sm'} border border-slate-300 rounded focus:outline-none focus:border-slate-500`}
        />
        <span className="text-[11px] text-slate-400">{pitchSuffix(mode)}</span>
        {showMax && <span className="text-[11px] text-slate-400">max 80°</span>}
      </div>
      {(() => {
        // Live equivalents (owner 2026-09-26): show what the current value
        // means in the other two units so the modes teach themselves.
        const raw = text.trim();
        const num = Number(raw);
        if (!raw || !Number.isFinite(num) || num <= 0) return null;
        const deg = toDegrees(mode, num);
        if (deg == null || deg <= 0) return null;
        const parts: string[] = [];
        if (mode !== 'degrees') parts.push(`${fromDegrees('degrees', deg)}°`);
        if (mode !== 'ratio') parts.push(`1:${fromDegrees('ratio', deg)}`);
        if (mode !== 'gradient') parts.push(`${fromDegrees('gradient', deg)}%`);
        return <div className="text-[11px] text-slate-400 mt-1">= {parts.join(' · ')}</div>;
      })()}
    </div>
  );
}
