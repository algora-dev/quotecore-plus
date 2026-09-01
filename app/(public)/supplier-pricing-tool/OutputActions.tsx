// Output actions: convert-to-quote URL (free quote generator handoff),
// supplier request / order request payloads (mailto MVP - no backend yet),
// and the continue-in-app stub.

'use client';

import { useEffect, useState } from 'react';
import type { MeasurementSet, SupplierProduct } from './types';
import { priceOutput, fmt } from './pricing';
import { useSupplierConfig, addLead, toolUrls } from './supplierConfig';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';
import { GROUP_DEFS, groupPitchedTotal, CUSTOM_BASIS_UNIT } from './types';
import { SupplierEnquiryModal } from './SupplierEnquiryModal';

/** Save the takeoff output as a draft quote handoff (areas + component groups
 *  with measured quantities and pitches). Component persistence is deliberately
 *  skipped - this tool prices supplier products, not user components. */
async function saveDraftQuote(measureSet: MeasurementSet, draftsApi: string): Promise<string | null> {
  const payload = {
    tool: 'supplier-pricing-tool',
    unitSystem: 'metric' as const,
    roofAreas: measureSet.groups.roofAreas.entries.map((a, i) => ({
      id: a.id,
      name: a.label || `Roof Area ${i + 1}`,
      // plan area for pitch conversion in the app import; takeoff-measured
      // areas are already pitched so the value passes through unchanged.
      area: entryPlanArea(measureSet, a.id),
      pitch: a.pitchDegrees ?? 0,
    })),
    componentGroups: GROUP_DEFS
      .filter(d => d.key !== 'roofAreas')
      .flatMap(d => {
        const entries = measureSet.groups[d.key].entries;
        if (entries.length === 0) return [];
        return [{
          componentId: `g-${d.key}`,
          name: d.label,
          isSystem: true,
          semantic: null,
          count: entries.length,
          total: groupPitchedTotal(measureSet, d.key),
          measurementType: d.basis === 'count' ? 'quantity' : d.basis,
          measurements: entries.map(e => ({ value: e.value * (e.quantity || 1), quoteRoofAreaId: null })),
        }];
      }),
    savedAt: new Date().toISOString(),
  };
  const res = await fetch('/api/free-tools/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftType: 'takeoff', payload }),
  });
  if (!res.ok) return null;
  const { id } = await res.json() as { id: string };
  return id;
}

/** Plan (pre-pitch) area of one roof-area entry, undoing the pitch factor. */
function entryPlanArea(measureSet: MeasurementSet, entryId: string): number {
  const e = measureSet.groups.roofAreas.entries.find(x => x.id === entryId);
  if (!e) return 0;
  return e.value * (e.quantity || 1);
}
export function buildConvertToQuoteUrl(measureSet: MeasurementSet, catalog: SupplierProduct[]): string {
  const output = priceOutput(measureSet, catalog);
  const lines = output.lines.map(l => ({
    description: l.entryLabel ? `${l.name} (${l.entryLabel})` : l.name,
    qty: Math.round(l.purchaseQty * 100) / 100,
    unit: l.basisUnit,
    rate: Math.round(l.unitPrice * 100) / 100,
  }));
  // custom components ride along as plain priced lines
  for (const c of output.customs) {
    lines.push({
      description: c.name,
      qty: Math.round(c.quantity * 100) / 100,
      unit: CUSTOM_BASIS_UNIT[c.basis],
      rate: Math.round((c.unitPrice + c.labourRate) * 100) / 100,
    });
  }
  const params = new URLSearchParams();
  params.set('amount', (output.material + output.labour).toFixed(2));
  if (lines.length > 0) params.set('lines', encodeURIComponent(JSON.stringify(lines)));
  params.set('ref', 'supplier-pricing-tool');
  // Self-contained supplier quote builder (per-line + global markup/margin,
  // branding) - replaces the /free-quote-generator handoff.
  return `/supplier-pricing-tool/quote?${params.toString()}`;
}

/** Actions card under the output: request supplier quote, order request,
 *  convert to customer quote (free quote generator), continue in QuoteCore+. */
export function OutputActions({ measureSet, catalog }: {
  measureSet: MeasurementSet;
  catalog: SupplierProduct[];
}) {
  const [modal, setModal] = useState<'quote' | 'order' | null>(null);
  const { config: supplierCfg } = useSupplierConfig();
  const { user, signInWithGoogle } = useFreeToolsAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Email capture (lead-gen for the supplier): one-time modal on the output.
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const urls = toolUrls(supplierCfg);

  useEffect(() => {
    if (supplierCfg.features.emailCapture && !leadDone) {
      // Let the user actually read their output before pitching (12s)
      const t = setTimeout(() => setLeadOpen(true), 12000);
      return () => clearTimeout(t);
    }
  }, [supplierCfg.features.emailCapture, leadDone]);

  function captureLead() {
    if (!leadEmail.trim()) return;
    addLead({ email: leadEmail.trim(), name: leadName.trim() }, supplierCfg.slug);
    setLeadDone(true);
    setLeadOpen(false);
  }

  // Google sign-in captures the email without the form
  async function googleLead() {
    const before = user?.email;
    await signInWithGoogle();
    if (before == null && user?.email) {
      addLead({ email: user.email, name: user.email?.split('@')[0] ?? '' }, supplierCfg.slug);
      setLeadDone(true);
      setLeadOpen(false);
    }
  }

  const quoteUrl = buildConvertToQuoteUrl(measureSet, catalog);

  async function continueInApp() {
    setSaving(true);
    setSaveError(false);
    try {
      const id = await saveDraftQuote(measureSet, urls.draftsApi);
      // Cross-origin (T3 Labs port) without CORS: skip the draft handoff and
      // still send the user to signup so the CTA never dead-ends.
      if (id) {
        window.open(`${urls.signup}?ref=supplier-pricing-tool&draft=${id}`, '_blank', 'noopener');
      } else {
        window.open(`${urls.signup}?ref=supplier-pricing-tool`, '_blank', 'noopener');
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <h3 className="text-base font-bold text-slate-900">What next?</h3>

      {/* Featured hero card - QuoteCore+ is the option we push */}
      {supplierCfg.poweredBy && supplierCfg.features.quoteCoreConnect && (
        <button
          onClick={continueInApp}
          disabled={saving}
          className="relative mt-3 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-5 text-left ring-1 ring-blue-500/30 transition hover:shadow-[0_0_24px_rgba(37,99,235,0.35)] cursor-pointer disabled:opacity-50"
        >
          <span className="absolute right-4 top-4 rounded-full bg-blue-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-300 ring-1 ring-blue-400/40">
            Recommended
          </span>
          <div className="flex items-start gap-4 pr-24">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-400/40">
              <svg className="h-6 w-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div>
              <div className="text-base font-bold text-white">Continue in QuoteCore+</div>
              <div className="mt-0.5 text-xs leading-relaxed text-slate-400">
                Turn this takeoff into a full quote - measurements, pitches and products carry straight into the app. Opens in a new tab.
              </div>
            </div>
          </div>
        </button>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <ActionTile
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          }
          title="Convert to customer quote"
          desc="Editable quote document with your markup - opens the quote builder in a new tab."
          href={quoteUrl}
        />
        <ActionTile
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          }
          title="Request supplier quote"
          desc="Send this pricing to the supplier and ask for a formal quote."
          onClick={() => setModal('quote')}
        />
        <ActionTile
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          }
          title="Send order request"
          desc="Place an order request for these products and quantities."
          onClick={() => setModal('order')}
        />
      </div>
      {saveError && (
        <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          Could not save right now. Check your connection and try again.
        </p>
      )}

      {/* Email-capture modal: supplier lead-gen ("sign up, get 5% off") */}
      {leadOpen && !leadDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="relative bg-slate-900 px-6 py-7 text-center">
              <button onClick={() => setLeadOpen(false)} className="absolute top-3 right-3 text-slate-400 hover:text-white transition" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/20 ring-1 ring-blue-500/40">
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-3 text-lg font-bold text-white">Get 5% off this job</h3>
              <p className="mt-1 text-xs text-slate-400">
                Join {supplierCfg.name} pricing list - we&apos;ll email your saving code plus a copy of this pricing.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => void googleLead()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-[11px] text-slate-500">or</span>
                <div className="h-px flex-1 bg-white/15" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email (optional to add your name)</label>
                <input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') captureLead(); }} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" placeholder="sam@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Name (optional)</label>
                <input type="text" value={leadName} onChange={e => setLeadName(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" placeholder="Sam Taylor" />
              </div>
              <button
                onClick={captureLead}
                disabled={!leadEmail.trim()}
                className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-40"
              >
                Send my 5% saving code
              </button>
              <p className="text-center text-[11px] text-slate-400">No spam. One email with your code, that&apos;s it.</p>
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-center">
              <button onClick={() => setLeadOpen(false)} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition">
                No thanks, I&apos;ll pay full price
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <SupplierEnquiryModal
          supplierName={supplierCfg.name}
          supplierSlug={supplierCfg.slug}
          measureSet={measureSet}
          catalog={catalog}
          currency={supplierCfg.currency}
          initialIntent={modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function ActionTile({ title, desc, onClick, href, icon, disabled }: {
  title: string;
  desc: string;
  onClick?: () => void;
  /** link tile - always opens in a new tab so the output page stays put */
  href?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {icon}
          </svg>
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
        </div>
      </div>
    </>
  );
  const cls = 'text-left rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] disabled:opacity-50';
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cls} cursor-pointer`}
    >
      {inner}
    </button>
  );
}
