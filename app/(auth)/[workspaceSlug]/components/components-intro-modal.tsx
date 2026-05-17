'use client';

/**
 * First-visit welcome modal for the components page.
 *
 * Renders only when the server has determined the user has never dismissed
 * this modal before (see `hasSeenComponentsIntro` in actions.ts). When the
 * user clicks "Got it", we:
 *   1. Persist the dismissal server-side via `markComponentsIntroSeen`.
 *   2. Remove the body-level copilot-suppress marker, then dispatch
 *      `copilot-redetect` so the existing CopilotProvider auto-start logic
 *      runs and (if copilot is enabled) immediately kicks off the
 *      `components` guide.
 *
 * While the modal is mounted we set `data-copilot-suppress="1"` on
 * `<body>`. CopilotProvider's auto-detect bails when that marker is
 * present, so the copilot tour never overlaps with this modal even if it
 * would otherwise auto-start on `/components`.
 */
import { useState, useEffect } from 'react';
import { markComponentsIntroSeen } from './actions';

export function ComponentsIntroModal() {
  const [open, setOpen] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!open) return;
    document.body.dataset.copilotSuppress = '1';
    return () => {
      // Always clear on unmount so suppressing never leaks across navigations.
      delete document.body.dataset.copilotSuppress;
    };
  }, [open]);

  async function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    try {
      await markComponentsIntroSeen();
    } catch (err) {
      console.error('[ComponentsIntroModal] markSeen failed:', err);
      // We still close — re-showing the modal forever on a persistence
      // failure is worse than the user not seeing it again next visit.
    } finally {
      setOpen(false);
      // Let the copilot provider re-evaluate now that the suppression
      // marker is gone (cleared by the cleanup in the useEffect above).
      if (typeof window !== 'undefined') {
        // Cleanup runs synchronously on the next render; queue the event
        // a tick later so the dataset attribute is definitely gone.
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('copilot-redetect'));
        }, 0);
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Welcome to your component library</h3>
            <p className="text-sm text-slate-600 mt-2">
              We&apos;ve added 8 starter components covering the main measurement types so you can
              see how the system works. Feel free to edit them to match your business, or delete
              the ones you don&apos;t need. Take a look around.
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={dismissing}
            className="px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition-all disabled:opacity-50"
          >
            {dismissing ? 'Loading...' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
