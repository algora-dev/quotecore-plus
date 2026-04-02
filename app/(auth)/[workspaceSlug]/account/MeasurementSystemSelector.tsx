'use client';
import { useState } from 'react';
import { updateCompanyMeasurementSystem } from './actions';

interface Props {
  currentSystem: 'metric' | 'imperial';
}

export function MeasurementSystemSelector({ currentSystem }: Props) {
  const [system, setSystem] = useState(currentSystem);
  const [saving, setSaving] = useState(false);

  async function handleChange(newSystem: 'metric' | 'imperial') {
    setSaving(true);
    try {
      await updateCompanyMeasurementSystem(newSystem);
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
      <div className="flex gap-3">
        <button
          onClick={() => handleChange('metric')}
          disabled={saving || system === 'metric'}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            system === 'metric'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          } disabled:opacity-50`}
        >
          Metric (m, m²)
        </button>
        <button
          onClick={() => handleChange('imperial')}
          disabled={saving || system === 'imperial'}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            system === 'imperial'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          } disabled:opacity-50`}
        >
          Imperial (ft, Rs)
        </button>
      </div>
      {saving && <p className="text-xs text-blue-600">Saving...</p>}
    </div>
  );
}
