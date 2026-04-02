'use client';
import { useState, useTransition } from 'react';
import { updateCompanyMeasurementSystem } from './actions';
import type { MeasurementSystem } from '@/app/lib/types';

export function MeasurementSystemSelector({ current }: { current: MeasurementSystem }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleChange(system: MeasurementSystem) {
    startTransition(async () => {
      try {
        await updateCompanyMeasurementSystem(system);
        setMessage('Measurement system updated. New quotes will use this system.');
        setTimeout(() => setMessage(null), 3000);
      } catch (err) {
        setMessage('Failed to update system');
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-900">
        Default Measurement System
      </label>
      <p className="text-xs text-slate-500">
        New quotes will use this system. Existing quotes keep their original system.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => handleChange('metric')}
          disabled={pending}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
            current === 'metric'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
          } disabled:opacity-50`}
        >
          Metric (m, m²)
        </button>
        <button
          onClick={() => handleChange('imperial')}
          disabled={pending}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
            current === 'imperial'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
          } disabled:opacity-50`}
        >
          Imperial (ft, roofing squares)
        </button>
      </div>
      {message && (
        <p className="text-xs text-emerald-600" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
