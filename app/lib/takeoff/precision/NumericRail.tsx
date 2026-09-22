'use client';

import { useState, type KeyboardEvent, type ReactNode, type CSSProperties } from 'react';
import { editNumberText, parseRailNumber, type NumberKey } from './touchNumberEntry';

interface NumericRailProps {
  kind: 'distance' | 'pitch';
  value: string;
  onChange: (value: string) => void;
  onConfirm: (value: number) => void;
  onBack: () => void;
  unit: string;
  onChangeUnit?: () => void;
  busy?: boolean;
}

/** Buttons + output, never a text input. Focusing a key cannot open the OS
 * keyboard. A hardware keyboard still works while focus is in this group.
 * The fourth column holds editing/Enter so there is no fifth keypad row. */
export function NumericRail(props: NumericRailProps) {
  const [replaceOnType, setReplaceOnType] = useState(props.kind === 'pitch');
  const [error, setError] = useState<string | null>(null);
  const apply = (key: NumberKey) => {
    if (props.busy) return;
    setError(null);
    const replace = replaceOnType && (/^\d$/.test(key) || key === '.');
    setReplaceOnType(false);
    props.onChange(editNumberText(replace ? '' : props.value, key));
  };
  const submit = () => {
    if (props.busy) return;
    const result = parseRailNumber(props.value, props.kind);
    if (!result.ok) { setError(result.message); return; }
    setError(null);
    props.onConfirm(result.value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey || props.busy) return;
    if (/^\d$/.test(event.key) || event.key === '.') {
      event.preventDefault(); apply(event.key as NumberKey);
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault(); apply(event.key === 'Backspace' ? 'backspace' : 'clear');
    } else if (event.key === 'Escape') { event.preventDefault(); props.onBack(); }
    // Enter activates the focused button natively. It is not a global submit
    // shortcut: Enter on a focused digit must not accidentally save a value.
  };
  const keyButton = (label: string, content: ReactNode, action: () => void, style?: CSSProperties) => (
    <button key={label} type="button" aria-label={label} onClick={action} disabled={props.busy} style={style}
      className="touch-number-key min-w-0 rounded-lg border border-white/20 bg-white/10 text-lg font-semibold text-white disabled:opacity-40">{content}</button>
  );
  return <div aria-label={props.kind === 'distance' ? 'Known distance keypad' : 'Roof pitch keypad'}
    role="group" className="select-none touch-manipulation flex h-full min-h-0 flex-col gap-1" onKeyDown={onKeyDown}>
    <div className="flex min-h-12 shrink-0 items-center gap-1">
      <button type="button" aria-label="Back without confirming number" onClick={props.onBack} disabled={props.busy}
        className="h-12 w-12 shrink-0 rounded-xl border border-white/20 text-white disabled:opacity-40">‹</button>
      <div className="min-w-0 flex-1 text-right">
        <div className="text-[11px] text-slate-300">{props.kind === 'distance' ? 'Known distance' : 'Roof pitch'}</div>
        <output aria-label={props.kind === 'distance' ? 'Entered distance' : 'Entered pitch'} aria-live="polite"
          className="block overflow-x-auto whitespace-nowrap text-xl font-semibold tabular-nums">{props.value || '0'}</output>
      </div>
      {props.onChangeUnit ? <button type="button" aria-label={`Change calibration unit, currently ${props.unit}`} disabled={props.busy} onClick={props.onChangeUnit}
        className="h-12 min-w-12 rounded-xl border border-white/20 px-1 text-sm text-white">{props.unit} ▾</button>
        : <span className="px-2 text-sm text-slate-300">{props.unit}</span>}
    </div>
    {error && <div role="alert" className="shrink-0 text-xs text-red-200">{error}</div>}
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="grid grid-cols-4 gap-1" style={{ gridTemplateRows: 'repeat(4, var(--touch-number-key-height, 48px))' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((key, index) => keyButton(
          key === '.' ? 'Decimal point' : `Digit ${key}`, key, () => apply(key as NumberKey),
          { gridRow: Math.floor(index / 3) + 1, gridColumn: index % 3 + 1 },
        ))}
        {keyButton('Backspace', '⌫', () => apply('backspace'), { gridRow: 1, gridColumn: 4 })}
        {keyButton('Clear number', 'C', () => apply('clear'), { gridRow: 2, gridColumn: 4 })}
        <button type="button" aria-label={props.kind === 'distance' ? 'Confirm distance' : 'Confirm pitch'}
          disabled={props.busy} onClick={submit} style={{ gridRow: '3 / span 2', gridColumn: 4 }}
          className="min-w-0 rounded-lg bg-[#FF6B35] px-1 text-sm font-semibold text-white disabled:opacity-40">
          {props.busy ? 'Wait' : 'Enter'}
        </button>
      </div>
    </div>
  </div>;
}
