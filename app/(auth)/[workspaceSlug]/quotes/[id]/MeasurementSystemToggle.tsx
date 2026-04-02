'use client';
import { useState } from 'react';
import { convertQuoteMeasurementSystem } from '../actions';
import { useRouter } from 'next/navigation';

interface Props {
  quoteId: string;
  currentSystem: 'metric' | 'imperial';
  isDraft: boolean;
}

export function MeasurementSystemToggle({ quoteId, currentSystem, isDraft }: Props) {
  const [switching, setSwitching] = useState(false);
  const router = useRouter();

  async function handleSwitch(newSystem: 'metric' | 'imperial') {
    if (newSystem === currentSystem || !isDraft || switching) return;
    
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
          currentSystem === 'metric' ? activeClass : inactiveClass
        }`}
      >
        Metric
      </button>
      <button
        onClick={() => handleSwitch('imperial')}
        disabled={!isDraft || switching}
        className={`${baseButtonClass} border-l border-slate-300 ${
          !isDraft ? disabledClass :
          currentSystem === 'imperial' ? activeClass : inactiveClass
        }`}
      >
        Imperial
      </button>
    </div>
  );
}
