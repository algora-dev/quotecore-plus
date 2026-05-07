'use client';
import { useState } from 'react';
import { updateDefaultMeasurementSystem } from './actions';
import type { MeasurementSystem } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';

interface Props {
  currentSystem: MeasurementSystem;
}

const OPTIONS: Array<{ value: 'metric' | 'imperial_ft' | 'imperial_rs'; title: string; subtitle: string }> = [
  { value: 'metric', title: 'Metric', subtitle: 'm, m²' },
  { value: 'imperial_ft', title: 'Imperial — ft²', subtitle: 'feet, square feet' },
  { value: 'imperial_rs', title: 'Imperial — RS', subtitle: 'feet, Roofing Squares (1 RS = 100 ft²)' },
];

export function MeasurementSystemSelector({ currentSystem }: Props) {
  // Normalise legacy 'imperial' to 'imperial_rs' so the picker doesn't render unselected.
  const initial = normalizeMeasurementSystem(currentSystem);
  const [system, setSystem] = useState<'metric' | 'imperial_ft' | 'imperial_rs'>(initial);
  const [saving, setSaving] = useState(false);

  async function handleChange(newSystem: 'metric' | 'imperial_ft' | 'imperial_rs') {
    if (newSystem === system) return;
    setSaving(true);
    try {
      await updateDefaultMeasurementSystem(newSystem);
      setSystem(newSystem);
      // Force page reload to sync server state
      window.location.reload();
    } catch (err) {
      console.error('Failed to update measurement system:', err);
      alert('Failed to update system. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        Default Measurement System
      </label>
      <p className="text-xs text-slate-500">
        New quotes will use this system. Existing quotes are locked to their original system.
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const isActive = system === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              disabled={saving || isActive}
              title={opt.subtitle}
              className={`px-4 py-2 text-sm font-medium rounded-full transition disabled:opacity-50 ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.title}
            </button>
          );
        })}
      </div>
      {saving && <p className="text-xs text-orange-600">Saving...</p>}
    </div>
  );
}
