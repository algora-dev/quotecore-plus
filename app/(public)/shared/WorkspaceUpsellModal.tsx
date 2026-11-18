'use client';

import { useCallback, useEffect, useState } from 'react';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';

/**
 * Free-workspace upsell modal shown on free tool OUTPUT screens.
 *
 * Strategy (owner 2026-11-18): when a user creates any output in a free
 * tool, show ONE call to action - create a Free Workspace. No draft
 * handoff, no save-to-app complexity. The blurb ties the in-app
 * equivalent of the tool they just used to a headline feature (e.g. AI
 * Scan Assist for the takeoff tools), then lists the wider app benefits.
 *
 * UX pattern (matches PostGenerationModal / CalcResultPopup):
 * - ~2s delay after the output renders so the user reads their result first
 * - once per browser session per tool (sessionStorage dismissal)
 * - result-first eyebrow, minimal words, single primary CTA
 */

interface WorkspaceUpsellModalProps {
  /** Dismissal key suffix + analytics tag, e.g. "free-roof-takeoff" */
  slug: string;
  /** Result-first eyebrow, e.g. "Your roofing takeoff is ready" */
  eyebrow: string;
  /** Pitch headline */
  headline: string;
  /** Tool-specific blurb: the in-app equivalent of the tool just used */
  blurb: string;
  /** Shared app benefits, 4-5 short bullets */
  features: string[];
  /** Signup URL with ref tag */
  signupHref: string;
  /** Optional tool-code override for usage analytics */
  toolCode?: string;
}

export function WorkspaceUpsellModal({
  slug,
  eyebrow,
  headline,
  blurb,
  features,
  signupHref,
  toolCode,
}: WorkspaceUpsellModalProps) {
  const [visible, setVisible] = useState(false);
  const storageKey = `qcp:ws-upsell:${slug}`;

  const dismiss = useCallback(() => {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
    trackFreeToolEvent('ws_upsell_dismissed', { slug }, toolCode);
  }, [storageKey, slug, toolCode]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {}
    const timer = setTimeout(() => {
      setVisible(true);
      trackFreeToolEvent('ws_upsell_shown', { slug }, toolCode);
    }, 2000);
    return () => clearTimeout(timer);
  }, [storageKey, slug, toolCode]);

  if (!visible) return null;

  const goSignup = () => {
    trackFreeToolEvent('ws_upsell_click', { slug }, toolCode);
    window.location.href = signupHref;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 md:p-7 animate-[wsUpsellFadeIn_0.3s_ease-out] max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1">
            <svg className="w-3.5 h-3.5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span className="text-xs font-medium text-[#BD4A1A]">{eyebrow}</span>
          </div>
          <button type="button" onClick={dismiss} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h2 className="mt-4 text-xl font-bold text-slate-900 tracking-tight">{headline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{blurb}</p>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">And your free workspace also includes</p>
        <ul className="mt-3 space-y-2.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-700">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={goSignup}
          className="mt-6 w-full text-center px-5 py-3 text-sm font-semibold rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition-all"
        >
          Create my Free Workspace
        </button>
        <p className="mt-2.5 text-center text-xs text-slate-400">Free · No card · No trial clock</p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full text-center px-5 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          No thanks, keep my results
        </button>
      </div>

      <style jsx>{`
        @keyframes wsUpsellFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
