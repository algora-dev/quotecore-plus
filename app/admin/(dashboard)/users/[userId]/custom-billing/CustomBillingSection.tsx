'use client';

/**
 * Admin custom-billing section (2026-10-12): mirrors the owner-verified user
 * flows — the same calculator, the same preview/confirm shape. Two modes:
 *  - Grant/comp (no Stripe charge; legacy->custom migration path)
 *  - Stripe-linked change (admin-initiated swap + proration, update.ts path)
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FocusDialog } from '@/app/components/pricing/calculator/FocusDialog';
import { PricingCalculator } from '@/app/components/pricing/calculator/PricingCalculator';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { serializeSetup } from '@/app/components/pricing/calculator/persistence';
import type { PlanIntent } from '@/app/components/pricing/calculator/types';
import {
  getAdminCustomBillingState,
  adminPreviewGrant,
  adminGrantCustomSetup,
  adminPreviewCustomChange,
  adminApplyCustomChange,
  type AdminCustomBillingState,
} from './actions';
import { adminClearCustomSetup } from '../actions';

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
const CAPACITY_NAMES: Record<string, string> = { low: 'Toolbox', medium: 'Workbench', high: 'Workshop' };
const ASSISTANT_NAMES: Record<string, string> = { light: 'Light', regular: 'Regular', heavy: 'Heavy' };
function codeLabel(code: string): string {
  if (code === 'core_access') return 'QuoteCore+ access';
  if (code.startsWith('capacity_')) return `Capacity: ${CAPACITY_NAMES[code.slice('capacity_'.length)] ?? code.slice(9)}`;
  if (code === 'digital_takeoff') return 'Digital takeoff';
  if (code.startsWith('scan_')) return `Scan tokens: ${code.slice(5)}`;
  if (code.startsWith('offcuts_')) return 'Offcuts planner';
  if (code.startsWith('assistant_')) return `Smart Assistant: ${ASSISTANT_NAMES[code.slice('assistant_'.length)] ?? code.slice(10)}`;
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function defaultEndsAt(): string {
  const d = new Date(Date.now() + 365 * 86400000);
  return d.toISOString().slice(0, 10);
}

type GrantPreview = { monthlyCents: number; rows: { productName: string; monthlyCents: number }[]; codes: string[] };
type ChangePreview = { direction: string; currentMonthlyCents: number; newMonthlyCents: number; proratedTodayCents: number; newRows: { productName: string; monthlyCents: number }[] };

export function CustomBillingSection({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [state, setState] = useState<AdminCustomBillingState | null>(null);
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [grantPreview, setGrantPreview] = useState<GrantPreview | null>(null);
  const [changePreview, setChangePreview] = useState<ChangePreview | null>(null);
  const [reason, setReason] = useState('');
  const [endsAt, setEndsAt] = useState(defaultEndsAt);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    getAdminCustomBillingState(companyId).then(res => {
      if (live) setState(res.ok ? res.state : null);
    });
    return () => { live = false; };
  }, [companyId, reload]);

  const stripeLinked = !!state?.stripeLinked;
  const snapshot = state?.snapshot ?? null;
  const active = snapshot && snapshot.providerStatus !== 'canceled';

  const closeDialog = useCallback(() => { setOpen(false); setError(''); }, []);

  const onContinue = useCallback(async (intent: PlanIntent) => {
    let serialized = '';
    try { serialized = serializeSetup(intent); } catch { return { message: 'Your setup could not be saved. Try again.' }; }
    setError(''); setNotice('');
    if (stripeLinked) {
      const res = await adminPreviewCustomChange(companyId, serialized);
      if (!res.ok) return { message: res.message };
      setRaw(serialized);
      setChangePreview({ direction: res.direction ?? 'upgrade', currentMonthlyCents: res.currentMonthlyCents ?? 0, newMonthlyCents: res.newMonthlyCents ?? 0, proratedTodayCents: res.proratedTodayCents ?? 0, newRows: res.newRows ?? [] });
      setOpen(false);
      return { message: 'Review the change below, then apply.' };
    }
    const res = await adminPreviewGrant(serialized);
    if (!res.ok) return { message: res.error };
    setRaw(serialized);
    setGrantPreview({ monthlyCents: res.monthlyCents, rows: res.rows, codes: res.codes });
    setOpen(false);
    return { message: 'Review the grant below, then confirm.' };
  }, [companyId, stripeLinked]);

  function runAction(fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setError(''); setNotice('');
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setNotice(res.message);
        setGrantPreview(null); setChangePreview(null); setRaw(''); setReason(''); setConfirmClear(false);
        setReload(n => n + 1);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const periodEnd = snapshot?.periodEnd ? new Date(snapshot.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Custom Setup (billing)</h2>
          <p className="text-sm text-slate-500 mt-1">
            {state === null ? 'Loading billing state…'
              : stripeLinked ? 'Stripe-backed custom subscription. Changes swap the live subscription with proration.'
              : snapshot ? 'Admin-granted setup (no Stripe charge). Update or clear it here.'
              : 'Legacy billing. Grant a custom setup to migrate or comp this account.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stripeLinked ? (
            <button type="button" onClick={() => { setOpen(true); setNotice(''); }}
              className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
              disabled={pending}>Change setup</button>
          ) : (
            <button type="button" onClick={() => { setOpen(true); setNotice(''); }}
              className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
              disabled={pending}>{snapshot ? 'Update grant' : 'Grant custom setup'}</button>
          )}
          {snapshot && !stripeLinked && (
            confirmClear ? (
              <button type="button" onClick={() => reason.trim() ? runAction(() => adminClearCustomSetup(companyId, reason)) : setError('A reason is required for the audit trail.')}
                className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={pending}>{pending ? 'Clearing…' : 'Confirm clear'}</button>
            ) : (
              <button type="button" onClick={() => { setConfirmClear(true); setNotice(''); }}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={pending}>Clear grant</button>
            )
          )}
        </div>
      </div>

      {notice && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">✅ {notice}</div>}
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {snapshot && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-100'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {snapshot.providerStatus ?? 'unknown'}
            </span>
            <span className="text-sm font-medium text-slate-900">{formatMoney(snapshot.monthlyCents)}/mo</span>
            <span className="text-sm text-slate-500">· {snapshot.componentCodes.length} components</span>
            {periodEnd && <span className="text-xs text-slate-500">until {periodEnd}</span>}
            {stripeLinked && state && state.creditBalanceCents > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Credit {formatMoney(state.creditBalanceCents)}
              </span>
            )}
          </div>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-700">
            {snapshot.componentCodes.map(code => (
              <li key={code} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-[#FF6B35]">•</span>
                <span>{codeLabel(code)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmClear && !grantPreview && !changePreview && (
        <div className="mt-4 rounded-xl border-2 border-red-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Clear this admin-granted setup?</p>
          <p className="text-sm text-slate-600 mt-1">The company reverts to legacy billing. Requires an audit reason.</p>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Audit reason (required)"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
        </div>
      )}

      {grantPreview && !open && (
        <div className="mt-4 rounded-xl border-2 border-[#FF6B35] bg-white p-4">
          <h4 className="text-sm font-bold text-slate-900">{snapshot ? 'Review grant update' : 'Review grant'}</h4>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-600">New setup</span>
            <span className="font-semibold text-slate-900">{formatMoney(grantPreview.monthlyCents)}/mo</span>
          </div>
          <ul className="mt-2 text-xs text-slate-500 list-disc pl-5">
            {grantPreview.rows.map((r, i) => <li key={`${r.productName}-${i}`}>{r.productName} · {formatMoney(r.monthlyCents)}/mo</li>)}
          </ul>
          <p className="mt-2 text-xs text-slate-500">No Stripe charge. Entitlements apply immediately and lapse on the end date.</p>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Audit reason (required)"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-700">End date</label>
            <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => reason.trim() ? runAction(() => adminGrantCustomSetup(companyId, raw, reason, endsAt)) : setError('A reason is required for the audit trail.')}
              className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
              disabled={pending}>{pending ? 'Granting…' : 'Confirm grant'}</button>
            <button type="button" onClick={() => setOpen(true)} disabled={pending}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">Adjust choices</button>
          </div>
        </div>
      )}

      {changePreview && !open && (
        <div className="mt-4 rounded-xl border-2 border-[#FF6B35] bg-white p-4">
          <h4 className="text-sm font-bold text-slate-900">Review the change</h4>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-600">Current</span>
            <span className="font-medium text-slate-900">{formatMoney(changePreview.currentMonthlyCents)}/mo</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-600">New ({changePreview.direction})</span>
            <span className="font-semibold text-slate-900">{formatMoney(changePreview.newMonthlyCents)}/mo</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-600">Billed today (prorated)</span>
            <span className={`font-medium ${changePreview.proratedTodayCents > 0 ? 'text-slate-900' : changePreview.proratedTodayCents < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {changePreview.proratedTodayCents > 0 ? formatMoney(changePreview.proratedTodayCents) : changePreview.proratedTodayCents < 0 ? `${formatMoney(Math.abs(changePreview.proratedTodayCents))} credit` : 'No charge'}
            </span>
          </div>
          <ul className="mt-2 text-xs text-slate-500 list-disc pl-5">
            {changePreview.newRows.map((r, i) => <li key={`${r.productName}-${i}`}>{r.productName} · {formatMoney(r.monthlyCents)}/mo</li>)}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Charges the customer&apos;s card on file (pending_if_incomplete). Billing period and used allowances are unchanged.</p>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Audit reason (required)"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => reason.trim() ? runAction(() => adminApplyCustomChange(companyId, raw, reason)) : setError('A reason is required for the audit trail.')}
              className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
              disabled={pending}>{pending ? 'Applying…' : 'Apply change'}</button>
            <button type="button" onClick={() => setOpen(true)} disabled={pending}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">Adjust choices</button>
          </div>
        </div>
      )}

      {open && (
        <FocusDialog title={stripeLinked ? 'Change their setup' : 'Build their setup'} eyebrow="Admin billing" onClose={closeDialog} wide>
          <PricingCalculator
            catalog={PREVIEW_CATALOG}
            variant="billing"
            currentSubscription={snapshot ? { billingSystem: 'custom_setup', displayName: 'Custom plan', monthlyCents: snapshot.monthlyCents, currency: (snapshot.currency ?? 'USD').toUpperCase() === 'NZD' ? 'NZD' as const : 'USD' as const, componentCodes: snapshot.componentCodes } : undefined}
            onContinue={onContinue}
            continueLabel={stripeLinked ? 'Review this change' : 'Review this setup'}
          />
        </FocusDialog>
      )}
    </div>
  );
}
