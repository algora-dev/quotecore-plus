'use client';

/**
 * Custom-plan card for custom_setup subscribers (V5 pricing, 2026-10-11).
 * One plan, itemised: what is included, monthly cost, renewal, and a
 * "Change my setup" flow that re-opens the pricing calculator in a modal
 * and swaps the Stripe subscription with proration. Usage meters live in
 * the existing "Your setup usage" panel above this card.
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FocusDialog } from '@/app/components/pricing/calculator/FocusDialog';
import { PricingCalculator } from '@/app/components/pricing/calculator/PricingCalculator';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { serializeSetup } from '@/app/components/pricing/calculator/persistence';
import type { PlanIntent } from '@/app/components/pricing/calculator/types';
import { applyCustomSetupChange, loadCustomSetupInfo, previewCustomSetupChange } from './actions';

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
const CAPACITY_NAMES: Record<string, string> = { low: 'Toolbox', medium: 'Workbench', high: 'Workshop' };
const ASSISTANT_NAMES: Record<string, string> = { light: 'Light', regular: 'Regular', heavy: 'Heavy' };
function codeLabel(code: string): string {
  if (code === 'core_access') return 'QuoteCore+ access';
  if (code.startsWith('capacity_')) return `Capacity: ${CAPACITY_NAMES[code.slice('capacity_'.length)] ?? code.slice(9)}`;
  if (code === 'digital_takeoff') return 'Digital takeoff';
  if (code.startsWith('scan_tokens_')) return `Scan tokens: ${CAPACITY_NAMES[code.slice('scan_tokens_'.length)] ?? code.slice(12)}`;
  if (code.startsWith('offcuts')) return 'Offcuts planner';
  if (code.startsWith('assistant_')) return `Smart Assistant: ${ASSISTANT_NAMES[code.slice('assistant_'.length)] ?? code.slice(10)}`;
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface SetupInfo { monthlyCents: number; currency: 'USD' | 'NZD'; componentCodes: string[]; creditBalanceCents: number }
type PreviewState = { direction: string; currentMonthlyCents: number; newMonthlyCents: number; proratedTodayCents: number; newRows: { productName: string; monthlyCents: number }[] };

export function CustomPlanCard({ currentPeriodEnd, onManage, manageDisabled }: {
  currentPeriodEnd: string | null;
  onManage: () => void;
  manageDisabled: boolean;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [confirming, startConfirm] = useTransition();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    loadCustomSetupInfo().then(result => { if (live && result.ok) setInfo({ monthlyCents: result.monthlyCents ?? 0, currency: (result.currency ?? 'USD').toUpperCase() === 'NZD' ? 'NZD' : 'USD', componentCodes: result.componentCodes ?? [], creditBalanceCents: result.creditBalanceCents ?? 0 }); });
    return () => { live = false; };
  }, [reload]);

  const closeDialog = useCallback(() => { setOpen(false); setPreview(null); setError(''); setRaw(''); }, []);

  const onContinue = useCallback(async (intent: PlanIntent) => {
    let serialized = '';
    try { serialized = serializeSetup(intent); } catch { setError('Your setup could not be saved. Try again.'); return { message: 'Your setup could not be saved. Try again.' }; }
    const result = await previewCustomSetupChange(serialized);
    if (!result.ok) { setError(result.message); return { message: result.message }; }
    setError('');
    setRaw(serialized);
    setPreview({ direction: result.direction ?? 'upgrade', currentMonthlyCents: result.currentMonthlyCents ?? 0, newMonthlyCents: result.newMonthlyCents ?? 0, proratedTodayCents: result.proratedTodayCents ?? 0, newRows: result.newRows ?? [] });
    // Clean modal flow (owner 2026-10-11): the wizard only BUILDS the setup.
    // Review + confirm live in the billing section below the current plan.
    setOpen(false);
    return { message: 'Review the change below your current plan, then confirm.' };
  }, []);

  function confirmChange() {
    setError(''); setDone('');
    startConfirm(async () => {
      const result = await applyCustomSetupChange(raw);
      if (!result.ok) { setError(result.message); return; }
      setDone(result.message);
      setPreview(null);
      setReload(n => n + 1); // refetch card info: effect keyed on state, not a ref (stale-card bug 2026-10-11)
      router.refresh();
      setTimeout(() => closeDialog(), 2600);
    });
  }

  const renewal = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div className="qc-flow-panel" data-qc-custom-plan-card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Current plan</p>
          <h3 className="text-lg font-semibold text-slate-900 mt-1">Custom plan</h3>
          <p className="text-sm text-slate-600 mt-1">
            {info ? `${formatMoney(info.monthlyCents)}/mo · ${info.componentCodes.length} components` : 'Loading your setup…'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-block text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-800">active</span>
            {renewal && <span className="text-xs text-slate-500">Renews {renewal}</span>}
            {info && info.creditBalanceCents > 0 && (
              <span title="Automatically applied to your next invoices until it's used up" className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Credit {formatMoney(info.creditBalanceCents)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={() => { setOpen(true); setDone(''); }}
            className="qc-flow-control qc-button px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:shadow-[0_0_12px_rgba(255,107,53,0.35)] min-h-[44px]">
            Change my setup
          </button>
          <button data-qc-variant="ghost" type="button" onClick={onManage} disabled={manageDisabled}
            title="Cancel, update card, or view invoices"
            className="qc-flow-control qc-button px-4 py-2 text-sm font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[44px]">
            Manage subscription
          </button>
        </div>
      </div>

      {info && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">What&rsquo;s included</p>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-700">
            {info.componentCodes.map(code => (
              <li key={code} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-[#FF6B35]">&#9679;</span>
                <span>{codeLabel(code)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900" role="status">{done}</div>
      )}

      {preview && !open && (
        <div className="mt-4 rounded-xl border-2 border-[#FF6B35] bg-white p-4" data-qc-change-review>
          <h4 className="text-sm font-bold text-slate-900">Review your change</h4>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-600">Current</span>
            <span className="font-medium text-slate-900">{formatMoney(preview.currentMonthlyCents)}/mo</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-600">New ({preview.direction})</span>
            <span className="font-semibold text-slate-900">{formatMoney(preview.newMonthlyCents)}/mo</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-600">Billed today (prorated)</span>
            <span className={`font-medium ${preview.proratedTodayCents > 0 ? 'text-slate-900' : preview.proratedTodayCents < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {preview.proratedTodayCents > 0 ? formatMoney(preview.proratedTodayCents) : preview.proratedTodayCents < 0 ? `${formatMoney(Math.abs(preview.proratedTodayCents))} credit` : 'No charge'}
            </span>
          </div>
          <ul className="mt-2 text-xs text-slate-500 list-disc pl-5">
            {preview.newRows.map((r, i) => <li key={`${r.productName}-${i}`}>{r.productName} · {formatMoney(r.monthlyCents)}/mo</li>)}
          </ul>
          {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={confirmChange} disabled={confirming}
              className="qc-flow-control qc-button px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:shadow-[0_0_12px_rgba(255,107,53,0.35)] disabled:opacity-50 min-h-[44px]">
              {confirming ? 'Applying…' : 'Confirm change'}
            </button>
            <button data-qc-variant="glass" type="button" onClick={() => setOpen(true)} disabled={confirming}
              className="qc-flow-control qc-button px-4 py-2 text-sm font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[44px]">
              Adjust choices
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">The exact prorated amount is calculated by our payment provider at confirmation. Your billing period and already-used allowances are unchanged.{info && info.creditBalanceCents > 0 ? ` Your ${formatMoney(info.creditBalanceCents)} account credit is applied first.` : ''}</p>
        </div>
      )}

      {open && (
        <FocusDialog title="Change your setup" eyebrow="Billing" onClose={closeDialog} wide>
          <PricingCalculator
            catalog={PREVIEW_CATALOG}
            variant="billing"
            currentSubscription={info ? { billingSystem: 'custom_setup', displayName: 'Custom plan', monthlyCents: info.monthlyCents, currency: info.currency, componentCodes: info.componentCodes } : undefined}
            onContinue={onContinue}
            continueLabel="Review this change"
          />
          {!preview && error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        </FocusDialog>
      )}
    </div>
  );
}
