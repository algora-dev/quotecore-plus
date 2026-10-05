'use client';
import { useEffect, useRef } from 'react';
import { QcDialog } from './ui/v2/QcDialog';
import { QcButton } from './ui/v2/QcButton';

interface Props {
  /** Opt in only on reviewed Phase 1 surfaces; other callers retain the existing UI. */
  appearance?: 'v2';
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses red styling. Default true (destructive). */
  destructive?: boolean;
  /** When true, both buttons are disabled and the confirm label is replaced with `pendingLabel`. */
  pending?: boolean;
  pendingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shared confirm dialog. Matches the QuotesList delete modal pattern so all
 * destructive prompts in the app feel consistent.
 */
export function ConfirmModal({
  open,
  appearance,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  pending = false,
  pendingLabel = 'Working...',
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Close on Escape
  useEffect(() => {
    if (!open || appearance === 'v2') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending, onCancel, appearance]);

  if (!open) return null;

  if (appearance === 'v2') {
    return (
      <QcDialog open={open} title={title} description={description} pending={pending}
        onRequestClose={onCancel} initialFocusRef={cancelRef}
        footer={<>
          <QcButton ref={cancelRef} onClick={onCancel} disabled={pending}>{cancelLabel}</QcButton>
          <QcButton onClick={onConfirm} pending={pending} variant={destructive ? 'danger' : 'primary'}>
            {pending ? pendingLabel : confirmLabel}
          </QcButton>
        </>} />
    );
  }

  const confirmClass = destructive
    ? 'bg-red-600 text-white hover:bg-red-700'
    : 'bg-black text-white hover:bg-slate-800';

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"

    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 id="confirm-modal-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h3>
        {description && <p className="text-sm text-slate-500 mt-2">{description}</p>}
        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-full disabled:opacity-50 ${confirmClass}`}
            disabled={pending}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
