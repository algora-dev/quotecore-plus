'use client';

import { useEffect } from 'react';

interface Props {
  /** What's being sent, for copy: 'quote' | 'order' | 'invoice'. */
  docType: 'quote' | 'order' | 'invoice';
  /** Whether the company can send via QCP email (drives the guidance). */
  canEmail: boolean;
  /** Continue to the real send flow (also marks the tip seen). */
  onContinue: () => void;
  /** Dismiss without continuing (X / Esc) - still marks seen. */
  onClose: () => void;
}

/**
 * One-time "test it on yourself first" tip, shown before a user's very first
 * send of any quote / order / invoice. Informational, NOT blocking - the user
 * can continue straight away. Esc + X close it; no overlay-click close (app
 * modal rule). Both close paths mark the tip as seen so it never nags again.
 */
export function SendTestTipModal({ docType, canEmail, onContinue, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recipient = docType === 'order' ? 'supplier' : 'customer';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-test-tip-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start gap-3 px-6 pt-6">
          <div className="flex-shrink-0 rounded-full bg-orange-50 p-3">
            <svg className="h-6 w-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="send-test-tip-title" className="text-lg font-semibold text-slate-900">
              Quick tip: test it on yourself first
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              A 30-second check before it reaches a {recipient}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm leading-relaxed text-slate-700">
          <p>
            Before sending to a real {recipient}, send it to <span className="font-semibold">your own email</span> first to
            check the layout and wording read exactly how you want.
          </p>
          {canEmail ? (
            <ul className="list-disc space-y-1 pl-5">
              <li>Put your own email in as the recipient and send it.</li>
              <li>Try it both <span className="font-semibold">with and without</span> a template message so you know how each looks.</li>
              <li>Happy with it? Then send the real one to your {recipient}.</li>
            </ul>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              <li>Use <span className="font-semibold">Copy URL Link</span> and open it yourself to check how it looks to the {recipient}.</li>
              <li>
                When you&apos;re happy, you can <span className="font-semibold">reset the {docType}</span> to void that test link and
                send a fresh URL to the real {recipient}.
              </li>
            </ul>
          )}
          <p className="text-xs text-slate-500">You&apos;ll only see this tip once.</p>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.45)]"
          >
            Got it - continue
          </button>
        </div>
      </div>
    </div>
  );
}
