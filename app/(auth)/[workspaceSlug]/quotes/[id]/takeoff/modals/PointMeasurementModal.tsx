'use client';
import { QcHostedDialog, QcHostedButton } from '@/app/components/ui/v2/QcHostedDialog';
import React from 'react';

export function PointMeasurementModal({
  componentName,
  onConfirm,
  onCancel,
}: {
  componentName: string;
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
    // Modeless (desktop, owner 2026-09-26): a floating draggable card - the
    // plan/canvas behind stays fully interactive. The touch scope keeps the
    // original overlay presentation.
    <QcHostedDialog label="Point measurement" modeless
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        tabIndex={-1}
        autoFocus
        onKeyDown={handleKeyDown}
        className="bg-white rounded-2xl p-4 w-full border border-slate-200 shadow-xl outline-none"
      >
        <h2 className="text-base font-semibold text-slate-900 mb-3">Add Point</h2>
        <div className="mb-4">
          <div className="text-lg">
            Add 1 item to <strong className="text-purple-400">{componentName}</strong>?
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
            Add Point (Enter)
          </QcHostedButton>
        </div>
      </div>
    </QcHostedDialog>
  );
}

// Line Measurement Modal
