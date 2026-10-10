'use client';

/**
 * Paywall card for the V5 pricing calculator setup.
 *
 * Renders ONLY when the visitor arrived with a stored calculator setup
 * (sessionStorage carried from /pricing through signup, or the qc_setup URL
 * param). Shows the configured components + monthly total with one pay CTA
 * that mints a multi-item Stripe Checkout via the server action. The server
 * re-validates everything; this component only displays and forwards the
 * opaque setup string.
 *
 * Same-device flow for now: the setup lives in sessionStorage (survives the
 * signup -> onboarding -> paywall journey in one tab). Cross-device/email
 * verification hand-off is a documented V1 gap.
 */

import { useEffect, useState, useTransition } from 'react';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import {
  SETUP_QUERY_KEY,
  restoreSetup,
  saveSetup,
  readStoredSetup,
  serializeSetup,
} from '@/app/components/pricing/calculator/persistence';
import { resolveIntent } from '@/app/components/pricing/calculator/routing';
import { expandBillingSelection } from '@/app/components/pricing/calculator/billingCatalogue';
import type { PlanIntent } from '@/app/components/pricing/calculator/types';
import { createCustomCheckoutSession } from '@/app/(auth)/[workspaceSlug]/account/billing/actions';

function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function CustomSetupPayCard() {
  const [raw, setRaw] = useState<string | null>(null);
  const [intent, setIntent] = useState<PlanIntent | null>(null);
  const [checkoutState, setCheckoutState] = useState<'idle' | 'success' | 'canceled'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') setCheckoutState('success');
    else if (params.get('checkout') === 'canceled') setCheckoutState('canceled');

    // URL param wins; persist it so later in-app pages keep the setup.
    const fromUrl = restoreSetup(params.get(SETUP_QUERY_KEY), PREVIEW_CATALOG);
    if (fromUrl.status === 'restored' || fromUrl.status === 'updated') {
      try { saveSetup(window.sessionStorage, fromUrl.intent); } catch { /* optional */ }
      setRaw(params.get(SETUP_QUERY_KEY));
      setIntent(fromUrl.intent);
      return;
    }
    const stored = readStoredSetup(window.sessionStorage, PREVIEW_CATALOG);
    if (stored.status === 'restored' || stored.status === 'updated') {
      try { setRaw(serializeSetup(stored.intent)); } catch { setRaw(null); return; }
      setIntent(stored.intent);
    }
  }, []);

  if (!intent) return null;

  let rows: { productName: string; priceLabel: string; monthlyCents: number }[] = [];
  let total = 0;
  try {
    const result = resolveIntent(intent, PREVIEW_CATALOG);
    rows = expandBillingSelection(result, PREVIEW_CATALOG).map(r => ({
      productName: r.productName, priceLabel: r.priceLabel, monthlyCents: r.monthlyCents,
    }));
    total = result.monthlyCents;
  } catch {
    return null; // Corrupted setup - fall back to the standard plan cards.
  }

  function pay() {
    setError(null);
    startTransition(async () => {
      const res = await createCustomCheckoutSession(raw ?? '');
      if (res.ok) {
        window.location.href = res.url;
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="rounded-xl border-2 border-[#FF6B35] bg-white p-6 shadow-sm mb-6" data-qc-custom-setup-card>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">Your configured setup</h2>
        <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-xs font-medium text-[#BD4A1A] whitespace-nowrap">
          From the pricing tool
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        The setup you built on the pricing page, ready to activate. Pay once to start your subscription.
      </p>

      <ul className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li key={`${r.productName}-${i}`} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-700">
              <span className="font-medium text-slate-900">{r.productName}</span>
              <span className="text-slate-400"> · {r.priceLabel}</span>
            </span>
            <span className="text-slate-900 whitespace-nowrap">{formatUsd(r.monthlyCents)}/mo</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-sm font-semibold text-slate-900">Monthly total</span>
        <span className="text-2xl font-bold text-slate-900">{formatUsd(total)}<span className="text-xs font-normal text-slate-400"> /month</span></span>
      </div>

      {checkoutState === 'success' ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-semibold">Payment received.</span> Confirming your subscription - this usually takes
          a few seconds. <a href="/paywall" className="underline">Refresh</a> once the confirmation email arrives.
        </div>
      ) : (
        <>
          {checkoutState === 'canceled' && (
            <p className="mt-3 text-xs text-slate-500">Checkout canceled - your setup is saved, activate whenever you are ready.</p>
          )}
          <button
            type="button"
            onClick={pay}
            disabled={isPending}
            data-qc-variant="primary"
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-60"
          >
            {isPending ? 'Preparing checkout…' : `Pay ${formatUsd(total)}/mo & activate`}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">Secure checkout via Stripe · cancel anytime · 30-day money-back guarantee</p>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{error}</p>
      )}
    </div>
  );
}
