'use client';

import { useState, useEffect } from 'react';
import {
  type PitchInputMode,
  PITCH_INPUT_MODE_LABELS,
  toDegrees,
  fromDegrees,
  pitchPlaceholder,
  pitchSuffix,
} from '@/app/lib/pitch-inputs';

/**
 * Reusable pitch input with mode toggle (degrees / ratio / gradient).
 *
 * - Value is always communicated to the parent as **degrees**.
 * - The internal text field shows whatever the user typed in the selected mode.
 * - On blur (or Enter), the value is converted to degrees and passed to `onSave`.
 * - If `degrees` prop changes externally, the display updates to match.
 */
export function PitchInput(props: {
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
  const { degrees, onSave, label, required, showMax, className, compact, autoFocus } = props;
  const [mode, setMode] = useState<PitchInputMode>('degrees');
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
    <div className={className}>
      {label && (
        <div className="flex items-center gap-2 mb-1">
          <label className={compact ? 'text-xs text-slate-500' : 'text-sm font-medium text-slate-700'}>
            {label}
            {!required && <span className="text-slate-400 font-normal ml-1">(optional)</span>}
          </label>
        </div>
      )}
      <div className="flex items-center gap-2">
        {/* Mode toggle */}
        <div className="flex rounded-full border border-slate-200 overflow-hidden shrink-0">
          {(Object.keys(PITCH_INPUT_MODE_LABELS) as PitchInputMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                mode === m
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {m === 'degrees' ? '°' : m === 'ratio' ? '1:X' : '%'}
            </button>
          ))}
        </div>
        {/* Input */}
        <input
          type="number"
          step={mode === 'degrees' ? '0.5' : mode === 'ratio' ? '1' : '0.5'}
          min="0"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          placeholder={pitchPlaceholder(mode)}
          autoFocus={autoFocus}
          className={`${compact ? 'w-16 px-1 py-0.5 text-xs' : 'w-24 px-2 py-1 text-sm'} border border-slate-300 rounded`}
        />
        <span className="text-[11px] text-slate-400">{pitchSuffix(mode)}</span>
        {showMax && <span className="text-[11px] text-slate-400">max 80°</span>}
      </div>
    </div>
  );
}
