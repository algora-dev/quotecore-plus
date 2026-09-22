'use client';

import type { ReactNode } from 'react';
import { stepPitch } from './touchNumberEntry';

export function RailAction({ children, label, onClick, disabled, primary = false, className = '' }: {
  children: ReactNode; label?: string; onClick?: () => void; disabled?: boolean;
  primary?: boolean; className?: string;
}) {
  return <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
    className={`select-none touch-manipulation min-h-12 min-w-12 w-full shrink-0 rounded-xl px-2 py-2 text-sm font-semibold leading-tight disabled:opacity-40 ${primary
      ? 'bg-[#FF6B35] text-white' : 'border border-white/20 bg-white/10 text-white'} ${className}`}>{children}</button>;
}

/** Primary actions stay outside the scrolling explanatory/options area. */
export function RailTask({ children, footer, label }: { children: ReactNode; footer?: ReactNode; label: string }) {
  return <section aria-label={label} className="flex h-full min-h-0 flex-col gap-2">
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-2 pr-0.5">{children}</div>
    {footer && <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 bg-slate-900 pt-2">{footer}</div>}
  </section>;
}

export function RailNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-xl px-2 py-2 text-xs leading-snug ${error
    ? 'border border-red-400/40 bg-red-500/10 text-red-100' : 'bg-white/5 text-slate-200'}`}>{children}</div>;
}

export function RailViewControls({ onFit, onZoomIn, onZoomOut, disabled = false }: {
  onFit: () => void; onZoomIn: () => void; onZoomOut: () => void; disabled?: boolean;
}) {
  return <div className="grid grid-cols-3 gap-1" role="group" aria-label="View controls">
    <RailAction label="Fit plan to view" onClick={onFit} disabled={disabled}>Fit</RailAction>
    <RailAction label="Zoom out" onClick={onZoomOut} disabled={disabled}>−</RailAction>
    <RailAction label="Zoom in" onClick={onZoomIn} disabled={disabled}>+</RailAction>
  </div>;
}

export function PitchControl({ pitch, onChange, onType, disabled = false }: {
  pitch: number; onChange: (pitch: number) => void; onType: () => void; disabled?: boolean;
}) {
  return <div role="group" aria-label="Roof pitch" className="space-y-1">
    <div className="text-xs text-slate-300">Roof pitch</div>
    <div className="grid grid-cols-[48px_1fr_48px] gap-1">
      <RailAction label="Decrease pitch by one degree" onClick={() => onChange(stepPitch(pitch, -1))} disabled={disabled || pitch <= 0}>‹</RailAction>
      <RailAction label={`Type roof pitch, currently ${pitch} degrees`} onClick={onType} disabled={disabled}>{pitch}°</RailAction>
      <RailAction label="Increase pitch by one degree" onClick={() => onChange(stepPitch(pitch, 1))} disabled={disabled || pitch + 1 >= 90}>›</RailAction>
    </div>
    <div className="text-[11px] text-slate-400">Tap the number to type. Arrows change 1°.</div>
  </div>;
}
