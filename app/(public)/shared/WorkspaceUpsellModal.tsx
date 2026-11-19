'use client';

import { useCallback, useEffect, useState } from 'react';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { toFreeTrialHref } from '@/lib/freeTrialCta';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';

/**
 * Free-workspace upsell modal shown on free tool OUTPUT screens.
 *
 * Strategy (owner 2026-11-18): when a user creates any output in a free
 * tool, show ONE call to action - create a Free Workspace. No draft
 * handoff, no save-to-app complexity. The blurb ties the in-workspace
 * equivalent of the tool they just used to a headline feature, then lists
 * the wider workspace benefits.
 *
 * Design (owner 2026-11-18 rounds 2+3): v2 dark card (orange radial glow),
 * and the CTA is the standard marketing primary button (MarketingButton,
 * same as the header CTA). Owner reroute 2026-11-19: the CTA is now
 * "See how it works" and lands on the /free-trial pre-qualify page (new
 * tab, ?ref preserved) instead of straight into /signup.
 *
 * UX pattern (matches PostGenerationModal):
 * - ~2s delay after the output renders so the user reads their result first
 * - once per browser session per tool (sessionStorage dismissal)
 * - result-first eyebrow, minimal words, single primary CTA
 * - `trigger` prop gates mounting tools that only produce an output later
 *   (e.g. document generators fire it on generation).
 */

/** Standard free-workspace benefit bullets (owner-approved 2026-11-18). */
export const WORKSPACE_FEATURES = [
  'Save your pricing to reuse on all your jobs',
  'Turn measurements into quotes in a few clicks',
  'Create quotes, invoices and material orders',
  'See when customers open, accept or decline your quote, so you follow up on time',
  'Upload photos or files and AI extracts the measurements, quantities and pricing',
];

/** One shared blurb covers all three free document generators (owner 2026-11-18). */
export const DOC_GENERATORS_BLURB = 'In your Free Workspace you get access to more features, like quotes, invoices and material orders you can save, edit and send from one place - and see when customers open, accept or decline them.';
export const DOC_UPSELL_CONFIG: Record<'quote' | 'invoice' | 'order', { slug: string; eyebrow: string; signupHref: string }> = {
  quote: { slug: 'free-quote-generator', eyebrow: 'Your quote is ready', signupHref: '/signup?ref=free-quote-generator' },
  invoice: { slug: 'free-invoice-generator', eyebrow: 'Your invoice is ready', signupHref: '/signup?ref=free-invoice-generator' },
  order: { slug: 'free-purchase-order-generator', eyebrow: 'Your purchase order is ready', signupHref: '/signup?ref=free-purchase-order-generator' },
};

/** Calculator family (2026-11-19): one blurb covers all trade + roofing calculators. */
export const CALCULATOR_BLURB = 'In your Free Workspace, calculations like this are part of your quoting. Save your pricing once and every measurement turns into a priced, professional quote you can send and track.';

/** Supplier pricing tool (2026-11-19). */
export const SUPPLIER_TOOL_BLURB = 'In your Free Workspace, takeoffs like this become full quotes with your own pricing and branding - saved, editable and ready to send, with material orders a click away.';

interface WorkspaceUpsellModalProps {
  /** Dismissal key suffix + analytics tag, e.g. "free-roof-takeoff" */
  slug: string;
  /** Result-first eyebrow, e.g. "Your roofing takeoff is ready" */
  eyebrow: string;
  /** Pitch headline */
  headline: string;
  /** Tool-specific blurb: the in-workspace equivalent of the tool just used */
  blurb: string;
  /** Shared workspace benefits, 4-5 short bullets (defaults to WORKSPACE_FEATURES) */
  features?: string[];
  /** Signup URL with ref tag */
  signupHref: string;
  /** Show only when true (default true; doc generators pass a generated flag) */
  trigger?: boolean;
  /** Optional tool-code override for usage analytics */
  toolCode?: string;
  /** Calculator family (2026-11-19): the result value, shown prominently under the eyebrow */
  resultLabel?: string;
  /** Optional breakdown line under the result */
  resultDetails?: string;
  /** Optional primary ACTION instead of the signup link (tier-aware smart-component save) */
  onPrimaryAction?: () => void | Promise<void>;
  /** Label for the action button */
  primaryActionText?: string;
  /** Optional secondary text link (e.g. the quote-generator funnel) */
  secondaryLinkHref?: string;
  secondaryLinkText?: string;
}

export function WorkspaceUpsellModal({
  slug,
  eyebrow,
  headline,
  blurb,
  features = WORKSPACE_FEATURES,
  signupHref,
  trigger = true,
  toolCode,
  resultLabel,
  resultDetails,
  onPrimaryAction,
  primaryActionText,
  secondaryLinkHref,
  secondaryLinkText,
}: WorkspaceUpsellModalProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const storageKey = `qcp:ws-upsell:${slug}`;

  const dismiss = useCallback(() => {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, '1'); } catch {}
    trackFreeToolEvent('ws_upsell_dismissed', { slug }, toolCode);
  }, [storageKey, slug, toolCode]);

  useEffect(() => {
    if (!trigger) return;
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {}
    const timer = setTimeout(() => {
      setVisible(true);
      trackFreeToolEvent('ws_upsell_shown', { slug }, toolCode);
    }, 2000);
    return () => clearTimeout(timer);
  }, [trigger, storageKey, slug, toolCode]);

  if (!visible) return null;

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

        {resultLabel && (
          <div className="mt-4 rounded-[12px] border border-white/10 bg-white/[.04] px-4 py-3.5 text-center">
            <p className="text-[22px] md:text-2xl font-bold tracking-tight text-[#f7f8fa] break-words">{resultLabel}</p>
            {resultDetails && <p className="mt-1.5 text-xs leading-relaxed text-[#a8b0bc]">{resultDetails}</p>}
          </div>
        )}

        <h2 className={resultLabel ? 'mt-4 text-lg md:text-xl font-bold tracking-tight text-[#f7f8fa]' : 'mt-3 text-[22px] md:text-2xl font-bold tracking-tight text-[#f7f8fa]'}>{headline}</h2>
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

        <div className="mt-7">
          {onPrimaryAction ? (
            <QcButton
              variant="primary"
              className="w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                trackFreeToolEvent('ws_upsell_click', { slug }, toolCode);
                try {
                  await onPrimaryAction();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Working...' : (primaryActionText ?? 'Continue')}
            </QcButton>
          ) : (
            <MarketingButton
              href={toFreeTrialHref(signupHref)}
              variant="primary"
              size="large"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
              onClick={() => trackFreeToolEvent('ws_upsell_click', { slug }, toolCode)}
            >
              See how it works
            </MarketingButton>
          )}
          {secondaryLinkHref && secondaryLinkText && (
            <a
              href={secondaryLinkHref}
              className="mt-3 block text-center text-sm text-[#a8b0bc] hover:text-[#FF8A3D] underline underline-offset-4 transition-colors"
              onClick={() => trackFreeToolEvent('ws_upsell_secondary_click', { slug }, toolCode)}
            >
              {secondaryLinkText}
            </a>
          )}
        </div>
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
        @keyframes wsUpsellFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
