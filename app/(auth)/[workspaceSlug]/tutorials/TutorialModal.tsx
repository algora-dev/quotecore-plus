'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startGuide } from '@/app/components/assistant/startGuide';
import type { Tutorial } from './tutorials.data';

interface Props {
  tutorial: Tutorial | null;
  /** Workspace base path, e.g. "/acme". */
  base: string;
  /** Whether the Q assistant is enabled for this workspace (gates the Q CTA). */
  assistantEnabled: boolean;
  onClose: () => void;
}

/**
 * Tutorial modal - pages through a tutorial's content and offers two CTAs:
 *   - "Go to <feature>"        (accent) → router.push(ctaHref)
 *   - "Walk me through with Q" (black)  → navigate to start URL + launch guide
 *
 * The Q button is hidden when there's no workflowId or the assistant is off.
 * Matches the app modal shell: backdrop-blur overlay, rounded-2xl panel,
 * rounded-full buttons (accent #FF6B35 / black).
 */
export function TutorialModal({ tutorial, base, assistantEnabled, onClose }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(0);

  // Reset to first page whenever a different tutorial opens.
  useEffect(() => {
    setPage(0);
  }, [tutorial?.id]);

  // Esc to close.
  useEffect(() => {
    if (!tutorial) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tutorial, onClose]);

  const goToFeature = useCallback(() => {
    if (!tutorial) return;
    onClose();
    router.push(tutorial.ctaHref(base));
  }, [tutorial, base, router, onClose]);

  // "Walk me through with Q": start the guide from right here, WITHOUT
  // pre-navigating. The guide engine's own nav-hop logic highlights the correct
  // top-nav button and walks the user to the start page - identical to the
  // normal "ask Q" Guide-Me flow (which works with a single click). Previously
  // we router.push()'d to the page first, but applying the nav highlight mid-
  // navigation swallowed the user's first nav click (the "nav 100% blocked"
  // bug). Letting the engine drive the navigation is the reliable path.
  const walkThrough = useCallback(() => {
    if (!tutorial || !tutorial.workflowId) return;
    const workflowId = tutorial.workflowId;
    onClose();
    // Small defer so the modal has unmounted (and its overlay/focus trap is
    // gone) before the assistant opens and the first highlight paints.
    setTimeout(() => startGuide(workflowId), 80);
  }, [tutorial, onClose]);

  if (!tutorial) return null;

  const pages = tutorial.pages;
  const multiPage = pages.length > 1;
  const current = pages[page];
  const isLast = page === pages.length - 1;
  const showQ = assistantEnabled && !!tutorial.workflowId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 pt-6 pb-4">
          <div className="flex-shrink-0 rounded-full bg-orange-50 p-3">{tutorial.icon}</div>
          <div className="min-w-0 flex-1">
            <h3 id="tutorial-modal-title" className="text-lg font-semibold text-slate-900">
              {tutorial.title}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">{tutorial.tagline}</p>
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

        {/* Body */}
        <div className="px-6 py-5">
          {multiPage && current.heading ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">
              {current.heading}
            </p>
          ) : null}
          <div className="space-y-2">
            {current.body.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-slate-700">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Pager (multi-page only) */}
        {multiPage ? (
          <div className="flex items-center justify-between gap-3 px-6 pb-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-1.5">
              {pages.map((_, i) => (
                <span
                  key={i}
                  className={[
                    'h-1.5 rounded-full transition-all',
                    i === page ? 'w-4 bg-[#FF6B35]' : 'w-1.5 bg-slate-300',
                  ].join(' ')}
                />
              ))}
            </div>

            {!isLast ? (
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Next
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <span className="w-[68px]" aria-hidden />
            )}
          </div>
        ) : null}

        {/* CTAs - always visible so the user can bail to the feature any time. */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={goToFeature}
            className="rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_12px_rgba(255,107,53,0.45)]"
          >
            {tutorial.ctaLabel}
          </button>
          {showQ ? (
            <button
              type="button"
              onClick={walkThrough}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(0,0,0,0.25)]"
            >
              Walk me through with Q
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
