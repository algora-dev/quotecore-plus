'use client';
import { QcHostedDialog, QcHostedButton } from '@/app/components/ui/v2/QcHostedDialog';
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
  const valid = !!distance && parseFloat(distance) > 0;

  return (
    // Modeless (desktop): a floating card, not a modal. The plan/canvas behind
    // stays fully interactive so the user can pan/zoom to reveal the point-to-
    // point they are typing in. Draggable by the header strip. Owner spec
    // 2026-09-25. The touch scope keeps its original overlay presentation.
    <QcHostedDialog label="Set the calibration distance" modeless
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xl">
      <h2 className="text-base font-semibold mb-0.5 text-slate-900">
        Calibration {calibrationNumber} of 3
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        {calibrationNumber === 1
          ? 'One correct calibration is all you need to start measuring.'
          : `Add up to ${3 - calibrationNumber + 1} more for best accuracy, or use this one as your only calibration.`}
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Distance</label>
          <input aria-label="Known distance"
            type="number"
            step="0.01"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
            placeholder="e.g. 10.5"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Unit</label>
          <select aria-label="Distance unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'feet' | 'meters')}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          >
            <option value="feet">Feet</option>
            <option value="meters">Meters</option>
          </select>
        </div>
        <p className="text-[11px] text-slate-400">
          Drag this card aside or pan the plan behind it if the measurement is hidden.
        </p>
        <div className="flex gap-2 justify-end">
          <QcHostedButton variant="ghost"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            Cancel
          </QcHostedButton>
          {canAddAnother && (
            <QcHostedButton variant="ghost"
              type="button"
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-full hover:bg-slate-50"
              disabled={!valid}
            >
              Save &amp; add another
            </QcHostedButton>
          )}
          <QcHostedButton variant="secondary"
            type="button"
            onClick={() => handleSubmit(false)}
            className="px-4 py-2 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors disabled:opacity-40"
            disabled={!valid}
          >
            Use this calibration
          </QcHostedButton>
        </div>
      </div>
      </div>
    </QcHostedDialog>
  );
}
