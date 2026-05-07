'use client';
import { useState } from 'react';
import { convertQuoteMeasurementSystem } from '../../actions';
import { useRouter } from 'next/navigation';
import type { MeasurementSystem } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { describeMeasurementSystem } from '@/app/lib/measurements/displayHelpers';

interface Props {
  quoteId: string;
  currentSystem: MeasurementSystem;
  workspaceSlug: string;
}

const TARGETS: Array<'metric' | 'imperial_ft' | 'imperial_rs'> = ['metric', 'imperial_ft', 'imperial_rs'];

export function ConvertSystemButton({ quoteId, currentSystem }: Props) {
  const [converting, setConverting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<'metric' | 'imperial_ft' | 'imperial_rs' | null>(null);
  const router = useRouter();

  const normalized = normalizeMeasurementSystem(currentSystem);

  async function handleConvert(target: 'metric' | 'imperial_ft' | 'imperial_rs') {
    setConverting(true);
    try {
      await convertQuoteMeasurementSystem(quoteId, target);
      setShowConfirm(false);
      setPendingTarget(null);
      router.refresh();
    } catch (err) {
      console.error('Failed to convert:', err);
      alert(err instanceof Error ? err.message : 'Failed to convert quote.');
    } finally {
      setConverting(false);
    }
  }

  function requestConvert(target: 'metric' | 'imperial_ft' | 'imperial_rs') {
    setPendingTarget(target);
    setShowConfirm(true);
  }

  if (showConfirm && pendingTarget) {
    const targetLabel = describeMeasurementSystem(pendingTarget);
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
          <h3 className="text-lg font-semibold">Convert to {targetLabel}?</h3>
          <p className="text-sm text-slate-600">
            This changes how measurements are displayed. All underlying data is stored in metric,
            so converting only switches the unit labels and conversion of values shown to the user.
          </p>
          <p className="text-sm text-slate-600">
            This action only works on draft quotes.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setShowConfirm(false); setPendingTarget(null); }}
              className="px-4 py-2 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
              disabled={converting}
            >
              Cancel
            </button>
            <button
              onClick={() => handleConvert(pendingTarget)}
              className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50"
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
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-amber-300 bg-amber-50 p-0.5">
      {TARGETS.filter((t) => t !== normalized).map((t) => (
        <button
          key={t}
          onClick={() => requestConvert(t)}
          className="px-3 py-1.5 text-xs font-medium rounded-full text-amber-700 hover:bg-amber-100"
          title={`Convert to ${describeMeasurementSystem(t)}`}
        >
          → {t === 'metric' ? 'Metric' : t === 'imperial_ft' ? 'Imperial ft²' : 'Imperial RS'}
        </button>
      ))}
    </div>
  );
}
