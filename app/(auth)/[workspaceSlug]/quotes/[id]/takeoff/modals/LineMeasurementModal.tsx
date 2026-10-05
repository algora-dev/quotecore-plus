'use client';
import { QcHostedDialog, QcHostedButton } from '@/app/components/ui/v2/QcHostedDialog';
import React, { useEffect } from 'react';

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
  // Owner 2026-10-01: the modeless card keeps the canvas interactive, so focus
  // usually sits on the canvas and the div-level keydown below never fires.
  // A capture-phase window listener makes Enter/Esc work regardless of focus,
  // and stops the canvas's own Escape handling from double-firing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onConfirm(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onConfirm, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    // Modeless (desktop, owner 2026-09-26): a floating draggable card - the
    // plan/canvas behind stays fully interactive (pan/zoom) so the user can
    // check the line while the card is open. The touch scope keeps the
    // original overlay presentation.
    <QcHostedDialog label="Line measurement" modeless
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        tabIndex={-1}
        autoFocus
        onKeyDown={handleKeyDown}
        className="bg-white rounded-2xl p-4 w-full border border-slate-200 shadow-xl outline-none"
      >
        <h2 className="text-base font-semibold text-slate-900 mb-3">Line Measurement</h2>
        <div className="mb-4">
          <div className="text-3xl font-bold text-[#FF6B35]">
            {length.toFixed(2)} {unit}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Press Enter to add, or Esc to cancel
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Drag this card aside or pan the plan behind it if needed.
        </p>
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
          >
            Add Line (Enter)
          </QcHostedButton>
        </div>
      </div>
    </QcHostedDialog>
  );
}

// Calibration Modal Component
