'use client';
import { useEffect } from 'react';

type AlertVariant = 'info' | 'success' | 'error';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  /** Primary button label. Defaults to 'OK'. */
  confirmLabel?: string;
  /** Visual variant; drives button + icon colour. Defaults to 'info'. */
  variant?: AlertVariant;
  onClose: () => void;
}

/**
 * Single-button modal alert used to replace native `alert(...)` calls.
 * Matches the look & feel of `ConfirmModal` so the whole app feels consistent
 * regardless of whether the message is a confirmation, an error, or a
 * success notification.
 *
 * For yes/no prompts use `ConfirmModal`; for plain "got it" messages use this.
 */
export function AlertModal({
  open,
  title,
  description,
  confirmLabel = 'OK',
  variant = 'info',
  onClose,
}: Props) {
  // Close on Escape so keyboard users aren't trapped.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Variant-driven styling. Errors get red; success gets green; info uses
  // the same neutral black we use for primary CTAs elsewhere.
  const buttonClass =
    variant === 'error'
      ? 'bg-red-600 text-white hover:bg-red-700'
      : variant === 'success'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
      : 'bg-black text-white hover:bg-slate-800';

  const iconBgClass =
    variant === 'error'
      ? 'bg-red-100 text-red-600'
      : variant === 'success'
      ? 'bg-emerald-100 text-emerald-600'
      : 'bg-slate-100 text-slate-600';

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
            {variant === 'error' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            ) : variant === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="alert-modal-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
            {description && <p className="text-sm text-slate-500 mt-2 whitespace-pre-line break-words">{description}</p>}
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`px-4 py-2 text-sm font-medium rounded-full ${buttonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
