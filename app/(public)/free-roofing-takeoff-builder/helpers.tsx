'use client';

import { useState } from 'react';
import type { ComponentKind } from './types';

// ─── Unit conversion helpers ─────────────────────────

const M_TO_FT = 3.28084;
const M2_TO_SQFT = 10.7639;

export function unitLabel(unit: 'metric' | 'imperial' | 'squares'): string {
  if (unit === 'metric') return 'm';
  // Both imperial and squares use linear feet for non-area components
  return 'ft';
}

export function areaUnitLabel(unit: 'metric' | 'imperial' | 'squares'): string {
  if (unit === 'metric') return 'm\u00B2';
  if (unit === 'imperial') return 'sq ft';
  return 'squares';
}

export function ratioToDegrees(ratio: string): number {
  const parts = ratio.split(':');
  if (parts.length !== 2) return 0;
  const rise = parseFloat(parts[0]);
  const run = parseFloat(parts[1]);
  if (!rise || !run || run <= 0) return 0;
  return Math.atan(rise / run) * (180 / Math.PI);
}

export function degreesToRatio(deg: number, unit: 'metric' | 'imperial' | 'squares'): string {
  if (unit === 'metric') {
    const riseM = Math.tan(deg * Math.PI / 180) * 10;
    return `${riseM.toFixed(1)}:10`;
  }
  const rise = Math.tan(deg * Math.PI / 180) * 12;
  return `${rise.toFixed(1)}:12`;
}

// ─── Component symbols (SVG) ─────────────────────────

export function ComponentSymbol({ kind, className = 'w-4 h-4' }: { kind: ComponentKind; className?: string }) {
  const stroke = 'currentColor';
  const sw = 1.8;
  switch (kind) {
    case 'roof_area':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
        </svg>
      );
    case 'ridge':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20L12 6l8 14" />
        </svg>
      );
    case 'hip':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20L12 6l8 14" />
        </svg>
      );
    case 'valley':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l8 14 8-14" />
        </svg>
      );
    case 'barge':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 4v16h14" />
        </svg>
      );
    case 'spouting':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18M5 8v4a2 2 0 002 2h10a2 2 0 002-2V8" />
        </svg>
      );
  }
}

// ─── Info Icon (hover/click tooltip) ─────────────────

export function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        className="text-slate-300 hover:text-slate-500 transition rounded-full p-0.5"
        aria-label="More info"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-64 rounded-lg bg-slate-900 text-white text-xs p-3 shadow-lg pointer-events-none">
          {text}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ─── Component display labels ────────────────────────

export function componentLabel(kind: ComponentKind): string {
  const labels: Record<ComponentKind, string> = {
    roof_area: 'Roof Area',
    ridge: 'Ridge',
    hip: 'Hip',
    valley: 'Valley',
    barge: 'Barge (Rake)',
    spouting: 'Spouting',
  };
  return labels[kind];
}

// ─── NumField helper ─────────────────────────────────

export function NumField({ label, value, onChange, step = 0.1, min = 0, max, suffix }: { label: string; value: number | undefined; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <input type="number" value={value ?? ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min} max={max} step={step} inputMode="decimal"
          className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}
