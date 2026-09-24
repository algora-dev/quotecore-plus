'use client';
import { QcHostedDialog, QcHostedButton } from '@/app/components/ui/v2/QcHostedDialog';
import React from 'react';

export function LineMeasurementModal({
  length,
  unit,
  onConfirm,
  onCancel,
}: {
  length: number;
  unit: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <QcHostedDialog label="Line measurement" size="sm" 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-lg p-6 w-96 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Line Measurement</h2>
        <div className="mb-6">
          <div className="text-3xl font-bold text-green-400">
            {length.toFixed(2)} {unit}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Press Enter to add, or Esc to cancel
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <QcHostedButton variant="ghost"
            onClick={onCancel}
            className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"
          >
            Cancel (Esc)
          </QcHostedButton>
          <QcHostedButton variant="secondary"
            onClick={onConfirm}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            autoFocus
          >
            Add Line (Enter)
          </QcHostedButton>
        </div>
      </div>
    </QcHostedDialog>
  );
}

// Calibration Modal Component
