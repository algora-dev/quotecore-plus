'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { stepPitch } from './touchNumberEntry';

export function RailAction({ children, label, onClick, disabled, primary = false, className = '' }: {
  children: ReactNode; label?: string; onClick?: () => void; disabled?: boolean;
  primary?: boolean; className?: string;
}) {
  return <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
    // M11 r3 (owner 2026-09-23): disabled buttons stay READABLE - muted fill
    // plus visible border/text instead of the old 40% opacity wash-out that
    // made "Close shape & save" nearly invisible on the draw screen.
    className={`select-none touch-manipulation min-h-12 min-w-12 w-full shrink-0 rounded-xl px-2 py-2 text-sm font-semibold leading-tight transition-all duration-100 active:scale-[1.04] disabled:active:scale-100 ${primary
      ? 'bg-[#FF6B35] text-white active:scale-[1.06] active:brightness-110 disabled:bg-[#FF6B35]/50 disabled:text-white'
      : 'border border-white/20 bg-white/10 text-white active:border-[#FF6B35] active:bg-[#FF6B35]/25 disabled:border-white/25 disabled:bg-white/5 disabled:text-slate-300'} ${className}`}>{children}</button>;
}

/** M11 r3 (owner 2026-09-23): ONE PANEL - the footer mechanism is gone.
 * Every control (including primary actions) lives inside the single
 * scrollable panel so the user scrolls and sees everything that matters;
 * nothing is ever pinned over or above the rail content. */
export function RailTask({ children, label }: { children: ReactNode; label: string }) {
  return <section aria-label={label} className="flex h-full min-h-0 flex-col">
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-2 pb-3 pr-0.5">{children}</div>
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

/** M10: scan progress - orange bar with animated label while a scan stage
 * runs. The API gives no streaming progress, so the bar creeps smoothly
 * toward 90% by elapsed time and never claims completion early; the stage
 * label carries the moving dots. Unmounts when the scan ends. */
export function ScanProgress({ label }: { label: string }) {
  const [pct, setPct] = useState(6);
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setPct(6 + 84 * (1 - Math.exp(-elapsed / 11000)));
      setDots((d) => (d % 3) + 1);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div role="status" aria-live="polite" className="space-y-2 rounded-xl bg-white/5 px-2 py-2">
      <div className="text-xs font-semibold text-white">{label}{'.'.repeat(dots)}</div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[#FF6B35] transition-[width] duration-300 ease-linear"
          style={{ width: `${Math.min(pct, 90).toFixed(1)}%` }} />
      </div>
    </div>
  );
}
