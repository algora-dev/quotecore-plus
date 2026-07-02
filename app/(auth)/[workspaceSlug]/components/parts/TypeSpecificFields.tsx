'use client';
import type { MeasurementType, PricingStrategy, WasteType, PitchType, WasteUnit } from '@/app/lib/types';

export function TypeSpecificFields(props: {
  measurementType: MeasurementType;
  heightMm: string;
  setHeightMm: (v: string) => void;
  depthMm: string;
  setDepthMm: (v: string) => void;
  hoursUnit: 'hr' | 'day';
  setHoursUnit: (v: 'hr' | 'day') => void;
}) {
  const { measurementType, heightMm, setHeightMm, depthMm, setDepthMm, hoursUnit, setHoursUnit } = props;
  if (!['length_x_height', 'multi_lineal_lxh', 'volume', 'volume_3d', 'hours_days'].includes(measurementType)) return null;
  return (
    <div className="space-y-3 mt-1">
      {(measurementType === 'length_x_height' || measurementType === 'multi_lineal_lxh') && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Component height (mm)</label>
          <input type="number" step="1" placeholder="e.g. 2400" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
          <p className="text-xs text-slate-400 mt-1">Area = measured length x height.</p>
        </div>
      )}
      {/* volume_3d has NO preset depth - depth is entered per measurement in the quote builder / takeoff */}
      {measurementType === 'volume' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Component depth (mm)</label>
          <input type="number" step="1" placeholder="e.g. 100" value={depthMm} onChange={(e) => setDepthMm(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
          <p className="text-xs text-slate-400 mt-1">Volume = measured area x depth.</p>
        </div>
      )}
      {measurementType === 'hours_days' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Time unit</label>
          <select value={hoursUnit} onChange={(e) => setHoursUnit(e.target.value as 'hr' | 'day')} className="w-full px-2 py-1 text-sm border border-slate-300 rounded">
            <option value="hr">Hours</option>
            <option value="day">Days</option>
          </select>
        </div>
      )}
    </div>
  );
}
