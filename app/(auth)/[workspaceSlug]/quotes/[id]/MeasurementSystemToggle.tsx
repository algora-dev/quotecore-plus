'use client';
import { useState } from 'react';
import { convertQuoteMeasurementSystem } from '../actions';
import { useRouter } from 'next/navigation';

type System = 'metric' | 'imperial_ft' | 'imperial_rs' | 'imperial';

interface Props {
  quoteId: string;
  currentSystem: System;
  isDraft: boolean;
}

export function MeasurementSystemToggle({ quoteId, currentSystem, isDraft }: Props) {
  const [switching, setSwitching] = useState(false);
  const router = useRouter();

  // Treat the deprecated 'imperial' value as 'imperial_rs' for selected-state.
  const normalized: 'metric' | 'imperial_ft' | 'imperial_rs' =
    currentSystem === 'metric' ? 'metric' :
    currentSystem === 'imperial_ft' ? 'imperial_ft' : 'imperial_rs';

  async function handleSwitch(newSystem: 'metric' | 'imperial_ft' | 'imperial_rs') {
    if (newSystem === normalized || !isDraft || switching) return;
    
    setSwitching(true);
    try {
      await convertQuoteMeasurementSystem(quoteId, newSystem);
      // Force hard refresh to update all displays
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch system:', err);
      alert('Failed to switch measurement system. Please try again.');
      setSwitching(false);
    }
  }

  const baseButtonClass = "px-3 py-1 text-xs font-medium transition-colors";
  const activeClass = "bg-emerald-500 text-white";
  const inactiveClass = "bg-white text-slate-600 hover:bg-slate-50";
  const disabledClass = "bg-slate-100 text-slate-400 cursor-not-allowed";

  return (
    <div className="flex rounded-lg border border-slate-300 overflow-hidden" title={!isDraft ? "Confirmed quotes cannot be converted" : ""}>
      <button
        onClick={() => handleSwitch('metric')}
        disabled={!isDraft || switching}
        className={`${baseButtonClass} ${
          !isDraft ? disabledClass :
          normalized === 'metric' ? activeClass : inactiveClass
        }`}
        title="Metric (m, m²)"
      >
        Metric
      </button>
      <button
        onClick={() => handleSwitch('imperial_ft')}
        disabled={!isDraft || switching}
        className={`${baseButtonClass} border-l border-slate-300 ${
          !isDraft ? disabledClass :
          normalized === 'imperial_ft' ? activeClass : inactiveClass
        }`}
        title="Imperial (ft, ft²)"
      >
        Imperial ft²
      </button>
      <button
        onClick={() => handleSwitch('imperial_rs')}
        disabled={!isDraft || switching}
        className={`${baseButtonClass} border-l border-slate-300 ${
          !isDraft ? disabledClass :
          normalized === 'imperial_rs' ? activeClass : inactiveClass
        }`}
        title="Imperial (ft, Roofing Squares)"
      >
        Imperial RS
      </button>
    </div>
  );
}
