'use client';
import { useState } from 'react';

export function CalibrationModal({
  calibrationNumber,
  defaultUnit,
  onSave,
  onCancel,
}: {
  calibrationNumber: number;
  defaultUnit: 'feet' | 'meters';
  onSave: (distance: number, unit: 'feet' | 'meters', addAnother: boolean) => void;
  onCancel: () => void;
}) {
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'feet' | 'meters'>(defaultUnit);

  const handleSubmit = (addAnother: boolean) => {
    const num = parseFloat(distance);
    if (!isNaN(num) && num > 0) {
      onSave(num, unit, addAnother);
    }
  };

  const canAddAnother = calibrationNumber < 3;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-96 border border-slate-200 shadow-xl">
        <h2 className="text-xl font-semibold mb-2 text-slate-900">
          Calibration {calibrationNumber} of 3
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {calibrationNumber === 1
            ? 'One correct calibration is all you need to start measuring.'
            : `Add up to ${3 - calibrationNumber + 1} more for best accuracy, or use this one as your only calibration.`}
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">Distance</label>
            <input
              type="number"
              step="0.01"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
              placeholder="e.g. 10.5"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-2">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'feet' | 'meters')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
            >
              <option value="feet">Feet</option>
              <option value="meters">Meters</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full"
            >
              Cancel
            </button>
            {canAddAnother && (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full"
                disabled={!distance || parseFloat(distance) <= 0}
              >
                Save &amp; add another
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              disabled={!distance || parseFloat(distance) <= 0}
            >
              Use this calibration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
