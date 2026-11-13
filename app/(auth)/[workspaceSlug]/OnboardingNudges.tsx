'use client';

import { useEffect, useRef, useState } from 'react';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { GetInTouchDialog } from '@/app/components/onboarding/GetInTouchDialog';
import {
  PRICING_NUDGE_AFTER_VISIT_MS,
  PRICING_NUDGE_AFTER_SIGNUP_MS,
  QUOTE_NUDGE_AFTER_VISIT_MS,
} from '@/app/lib/onboarding/constants';
import { recordNudgeShown } from '@/app/lib/onboarding/actions';
import { trackEvent } from '@/lib/analytics';

type NudgeKind = 'pricing' | 'quote';

/**
 * One-time activation nudges inside the personal workspace (owner
 * 2026-11-13), for accounts that came through the demo-first welcome flow.
 * Pop-up modals, not banners:
 *
 *  - Pricing: no component created/edited ~12 min after the first workspace
 *    visit (or ~30 min after signup) → "need a hand adding your pricing?"
 *    with Add my pricing / Get help.
 *  - First quote: pricing exists but no job space created ~45 min after the
 *    first visit → "ready for your first quote?" with Start my first quote /
 *    Get help.
 *
 * Both are dismissible with the X (never re-shown: company-level first-wins
 * stamp at show time). Get help opens the three-option get-in-touch dialog.
 */
export function OnboardingNudges({
  workspaceSlug,
  firstVisitAt,
  companyCreatedAt,
  componentCount,
  quoteCount,
  pricingShown,
  quoteShown,
}: {
  workspaceSlug: string;
  firstVisitAt: string | null;
  companyCreatedAt: string | null;
  componentCount: number;
  quoteCount: number;
  pricingShown: boolean;
  quoteShown: boolean;
}) {
  const [nudge, setNudge] = useState<NudgeKind | null>(null);
  const [helpFor, setHelpFor] = useState<NudgeKind | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (pricingShown && quoteShown) return; // nothing left to nudge
    let cancelled = false;
    const check = () => {
      if (cancelled || fired.current) return;
      const now = Date.now();
      const visitMs = firstVisitAt ? now - Date.parse(firstVisitAt) : null;
      const ageMs = companyCreatedAt ? now - Date.parse(companyCreatedAt) : null;
      let next: NudgeKind | null = null;
      if (
        !pricingShown &&
        componentCount === 0 &&
        ((visitMs !== null && visitMs >= PRICING_NUDGE_AFTER_VISIT_MS) ||
          (ageMs !== null && ageMs >= PRICING_NUDGE_AFTER_SIGNUP_MS))
      ) {
        next = 'pricing';
      } else if (
        !quoteShown &&
        componentCount > 0 &&
        quoteCount === 0 &&
        visitMs !== null &&
        visitMs >= QUOTE_NUDGE_AFTER_VISIT_MS
      ) {
        next = 'quote';
      }
      if (next) {
        fired.current = true;
        setNudge(next);
        void recordNudgeShown(next);
        trackEvent(next === 'pricing' ? 'onboarding_pricing_nudge_shown' : 'onboarding_quote_nudge_shown');
      }
    };
    // Short delay before the first check so an already-due nudge doesn't slam
    // into a page that's still settling; then re-check every 30s.
    const first = setTimeout(check, 8_000);
    const interval = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [pricingShown, quoteShown, componentCount, quoteCount, firstVisitAt, companyCreatedAt]);

  const closeNudge = () => setNudge(null);
  const openHelp = () => {
    setHelpFor(nudge);
    setNudge(null);
  };
  const go = (path: string) => {
    window.location.assign(`/${workspaceSlug}${path}`);
  };

  return (
    <>
      <QcDialog
        open={nudge === 'pricing'}
        size="md"
        title="Need a hand with your pricing?"
        description="We noticed you haven't added a pricing component yet — it's the most important first step in QuoteCore+."
        onRequestClose={closeNudge}
        footer={
          <>
            <QcButton onClick={openHelp}>Get help</QcButton>
            <QcButton variant="primary" onClick={() => go('/components')}>Add my pricing</QcButton>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Your prices are what turn measurements into quotes — without them you&apos;ll only ever
          see quantities. Add your first component now, or if you&apos;d rather we handle it,
          we&apos;ll set it all up for you.
        </p>
      </QcDialog>

      <QcDialog
        open={nudge === 'quote'}
        size="md"
        title="Ready for your first quote?"
        description="Your pricing is in — the next step is creating your first job."
        onRequestClose={closeNudge}
        footer={
          <>
            <QcButton onClick={openHelp}>Get help</QcButton>
            <QcButton variant="primary" onClick={() => go('/quotes/new')}>Start my first quote</QcButton>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Measure a roof, upload a plan, or start blank — every path ends in a real job you can
          price and send. Or grab us and we&apos;ll walk you through it.
        </p>
      </QcDialog>

      <GetInTouchDialog
        open={helpFor !== null}
        source={helpFor ? `${helpFor}_nudge` : 'nudge'}
        onRequestClose={() => setHelpFor(null)}
      />
    </>
  );
}
