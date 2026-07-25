'use client';

import { useState } from 'react';
import type { ComponentKind, CustomComponentDef } from './types';
import { COMPONENT_DEFS } from './calc';

// ─── Unit conversion helpers ─────────────────────────

export function unitLabel(unit: 'metric' | 'imperial' | 'squares'): string {
  if (unit === 'metric') return 'm';
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

export function ComponentSymbol({ kind, customDef, className = 'w-4 h-4' }: { kind: string; customDef?: CustomComponentDef; className?: string }) {
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
      // ┌ shape: up then right - flashing rising up the barge edge then over the roof
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 20V4h14" />
        </svg>
      );
    case 'spouting':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18M5 8v4a2 2 0 002 2h10a2 2 0 002-2V8" />
        </svg>
      );
    default:
      // Custom component - use a generic tool icon
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={sw}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.5 19.5h3m-3 0v-3" />
        </svg>
      );
  }
}

// ─── Info Icon (hover + click tooltip) ───────────────

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
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-64 rounded-lg bg-slate-900 text-white text-xs p-3 shadow-lg">
          {text}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ─── Component display labels ────────────────────────

export function componentLabel(kind: string, customDef?: CustomComponentDef): string {
  if (kind.startsWith('custom-') && customDef) return `${customDef.name} (Custom)`;
  const def = COMPONENT_DEFS[kind];
  return def ? def.label : 'Custom';
}

export function componentDescription(kind: string, customDef?: CustomComponentDef): string {
  if (kind.startsWith('custom-') && customDef) {
    const mt = customDef.measurementType === 'area' ? 'Area-based' : 'Linear';
    const pt = customDef.pitchType === 'rafter' ? 'rafter pitch' : customDef.pitchType === 'hip_valley' ? 'hip/valley pitch' : 'no pitch';
    return `${mt} component, ${pt}.`;
  }
  const def = COMPONENT_DEFS[kind];
  return def ? def.description : '';
}
