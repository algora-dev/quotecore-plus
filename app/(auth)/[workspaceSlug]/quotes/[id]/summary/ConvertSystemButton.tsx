'use client';
import { useState } from 'react';
import { convertQuoteMeasurementSystem } from '../../actions';
import { useRouter } from 'next/navigation';

interface Props {
  quoteId: string;
  currentSystem: 'metric' | 'imperial';
  workspaceSlug: string;
}

export function ConvertSystemButton({ quoteId, currentSystem, workspaceSlug }: Props) {
  const [converting, setConverting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  
  const targetSystem = currentSystem === 'metric' ? 'imperial' : 'metric';
  const targetLabel = targetSystem === 'imperial' ? 'Imperial (ft, Rs)' : 'Metric (m, m²)';

  async function handleConvert() {
    setConverting(true);
    try {
      await convertQuoteMeasurementSystem(quoteId, targetSystem);
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to convert:', err);
      alert('Failed to convert quote. Please try again.');
    } finally {
      setConverting(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
          <h3 className="text-lg font-semibold">Convert to {targetLabel}?</h3>
          <p className="text-sm text-slate-600">
            This will change how measurements are displayed. All underlying data remains the same
            (stored in metric), but the UI will show values in {targetLabel}.
          </p>
          <p className="text-sm text-slate-600">
            This action only works on draft quotes. Once confirmed, quotes cannot be converted.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
              disabled={converting}
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={converting}
            >
              {converting ? 'Converting...' : `Convert to ${targetLabel}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
    >
      Convert to {targetLabel}
    </button>
  );
}
