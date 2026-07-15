'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Conversion popup that shows the calculation result + a CTA to the next funnel stage.
 *
 * Design principles:
 * - Result-first (the useful number is the headline, not the CTA)
 * - One popup per session per stage (sessionStorage dismissal)
 * - 1.5s delay after calculation so user reads result first
 * - Mobile-first full-width modal
 */

export type PopupStage = 'calc-to-quote' | 'smart-to-signup';

interface CalcResultPopupProps {
  /** The calculation result to display (the useful part) */
  resultLabel: string;
  /** Optional breakdown line */
  resultDetails?: string;
  /** Primary CTA text */
  ctaText: string;
  /** Primary CTA URL (used when no onCta action is provided) */
  ctaHref: string;
  /** Optional CTA action — when set, the CTA runs this instead of
   *  navigating to ctaHref (e.g. tier-aware smart-component save). */
  onCta?: () => void | Promise<void>;
  /** Secondary description text */
  secondaryText?: string;
  /** Funnel stage - controls dismissal key prefix */
  stage: PopupStage;
  /** Slug for dismissal uniqueness, e.g. "free-roofing-calculator" */
  slug: string;
  /** Trigger - when true, starts the delay timer to show the popup */
  trigger: boolean;
}

export function CalcResultPopup({
  resultLabel,
  resultDetails,
  ctaText,
  ctaHref,
  onCta,
  secondaryText,
  stage,
  slug,
  trigger,
}: CalcResultPopupProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const storageKey = `qcp:popup:${stage}:${slug}`;

  const dismiss = useCallback(() => {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!trigger) return;
    // Check dismissal
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {}
    // Delay 1.5s so user reads the result first
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [trigger, storageKey]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm bg-black/40"
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-[fadeInUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Result - the headline */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 mb-3">
            <svg className="w-3.5 h-3.5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span className="text-xs font-medium text-[#FF6B35]">Your result</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{resultLabel}</p>
          {resultDetails && (
            <p className="mt-1.5 text-sm text-slate-500">{resultDetails}</p>
          )}
        </div>

        {/* CTA */}
        {onCta ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onCta();
              } finally {
                setBusy(false);
              }
            }}
            className="block w-full text-center px-5 py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] transition-all disabled:opacity-60"
          >
            {busy ? 'Saving...' : ctaText}
          </button>
        ) : (
          <a
            href={ctaHref}
            className="block w-full text-center px-5 py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] transition-all"
          >
            {ctaText}
          </a>
        )}

        {/* Secondary text */}
        {secondaryText && (
          <p className="mt-3 text-center text-xs text-slate-400">{secondaryText}</p>
        )}

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Maybe later
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
