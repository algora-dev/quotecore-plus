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
 * Scan Assist for the takeoff tools), then lists the wider workspace
 * benefits.
 *
 * Design: v2 dark theme (owner 2026-11-18 round 2) - dark card with the
 * orange radial glow (matches the takeoff "Your next step" card), orange
 * gradient primary CTA with dark ink text (qc-tokens gradient), generous
 * spacing.
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
  /** Tool-specific blurb: the in-workspace equivalent of the tool just used */
  blurb: string;
  /** Shared workspace benefits, 4-5 short bullets */
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm bg-[#0b0d10]/70"
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      onClick={dismiss}
    >
      <div
        className="ws-upsell-card bg-[#0b0d10] border border-white/[.12] rounded-[20px] shadow-2xl max-w-md w-full p-7 md:p-8 animate-[wsUpsellFadeIn_0.3s_ease-out] max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold tracking-[0.17em] uppercase text-[#FF8A3D] pt-1">{eyebrow}</p>
          <button type="button" onClick={dismiss} aria-label="Close" className="p-1 -mt-1 -mr-1 text-[#a8b0bc] hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h2 className="mt-3 text-[22px] md:text-2xl font-bold tracking-tight text-[#f7f8fa]">{headline}</h2>
        <p className="mt-2.5 text-sm leading-relaxed text-[#c5cbd5]">{blurb}</p>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.17em] text-[#a8b0bc]">Plus, in your free workspace</p>
        <ul className="mt-3.5 space-y-3.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#FF8A3D] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm leading-snug text-[#c5cbd5]">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={goSignup}
          className="ws-upsell-cta mt-7 w-full text-center px-6 py-3.5 text-[15px] font-semibold rounded-xl text-[#191B20] transition-all"
        >
          Create my Free Workspace
        </button>
        <p className="mt-3 text-center text-xs text-[#a8b0bc]">Free · No card · No trial clock</p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3.5 w-full text-center px-5 py-2 text-sm font-medium text-[#a8b0bc] hover:text-[#f7f8fa] transition-colors"
        >
          No thanks, keep my results
        </button>
      </div>

      <style jsx>{`
        .ws-upsell-card {
          background-image: radial-gradient(ellipse at 95% 0%, #ff66001f, transparent 70%);
        }
        .ws-upsell-cta {
          background: linear-gradient(135deg, #FF641F 0%, #FF8A3D 55%, #FFB36B 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .ws-upsell-cta:hover {
          background: linear-gradient(135deg, #FF6B35 0%, #FF923D 55%, #FFBC7A 100%);
          box-shadow: 0 0 24px rgba(255, 138, 61, 0.35);
        }
        .ws-upsell-cta:active {
          background: linear-gradient(135deg, #F95F1D 0%, #FF8033 55%, #FFA85C 100%);
        }
        @keyframes wsUpsellFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
