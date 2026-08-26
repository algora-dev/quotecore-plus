// Output actions: convert-to-quote URL (free quote generator handoff),
// supplier request / order request payloads (mailto MVP - no backend yet),
// and the continue-in-app stub.

'use client';

import { useEffect, useState } from 'react';
import type { MeasurementSet, SupplierProduct } from './types';
import { priceOutput, fmt } from './pricing';
import { useSupplierConfig, addLead } from './supplierConfig';
import { GROUP_DEFS, groupPitchedTotal } from './types';

/** Save the takeoff output as a draft quote handoff (areas + component groups
 *  with measured quantities and pitches). Component persistence is deliberately
 *  skipped - this tool prices supplier products, not user components. */
async function saveDraftQuote(measureSet: MeasurementSet): Promise<string | null> {
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
  const params = new URLSearchParams();
  params.set('amount', (output.material + output.labour).toFixed(2));
  if (lines.length > 0) params.set('lines', encodeURIComponent(JSON.stringify(lines)));
  params.set('ref', 'supplier-pricing-tool');
  return `/free-quote-generator?${params.toString()}`;
}

function buildRequestBody(measureSet: MeasurementSet, catalog: SupplierProduct[], kind: 'quote' | 'order', customer: { name: string; email: string; jobRef: string }, supplierName: string, cur: string): string {
  const output = priceOutput(measureSet, catalog);
  const rows = output.lines.map(l =>
    `${l.name} (${l.code}) - ${fmt(l.purchaseQty, 1)} ${l.basisUnit} @ ${cur}${fmt(l.unitPrice)} = ${cur}${fmt(l.lineTotal)}`,
  ).join('\n');
  const subject = kind === 'quote'
    ? `Quote request - ${customer.jobRef || 'new job'} (${supplierName})`
    : `Order request - ${customer.jobRef || 'new job'} (${supplierName})`;
  const body = [
    kind === 'quote'
      ? `Hi ${supplierName}, please provide a quote for the following job:`
      : `Hi ${supplierName}, I'd like to place an order request for the following:`,
    '',
    customer.jobRef ? `Job reference: ${customer.jobRef}` : '',
    customer.name ? `Name: ${customer.name}` : '',
    customer.email ? `Email: ${customer.email}` : '',
    '',
    '--- Items ---',
    rows,
    '',
    `Materials total: ${cur}${fmt(output.material)}`,
    output.labour > 0 ? `Labour total: ${cur}${fmt(output.labour)}` : '',
    `Total: ${cur}${fmt(output.material + output.labour)}`,
    '',
    `Generated with the ${supplierName} pricing tool (powered by QuoteCore+).`,
  ].filter(Boolean).join('\n');
  return `mailto:orders@roofline.example?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Actions card under the output: request supplier quote, order request,
 *  convert to customer quote (free quote generator), continue in QuoteCore+. */
export function OutputActions({ measureSet, catalog }: {
  measureSet: MeasurementSet;
  catalog: SupplierProduct[];
}) {
  const [modal, setModal] = useState<'quote' | 'order' | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [jobRef, setJobRef] = useState('');
  const { config: supplierCfg } = useSupplierConfig();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Email capture (lead-gen for the supplier): one-time modal on the output.
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');

  useEffect(() => {
    if (supplierCfg.features.emailCapture && !leadDone) {
      const t = setTimeout(() => setLeadOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, [supplierCfg.features.emailCapture, leadDone]);

  function captureLead() {
    if (!leadEmail.trim()) return;
    addLead({ email: leadEmail.trim(), name: leadName.trim() });
    setLeadDone(true);
    setLeadOpen(false);
  }

  const quoteUrl = buildConvertToQuoteUrl(measureSet, catalog);

  async function continueInApp() {
    setSaving(true);
    setSaveError(false);
    try {
      const id = await saveDraftQuote(measureSet);
      if (!id) {
        setSaveError(true);
        return;
      }
      window.location.href = `/signup?ref=supplier-pricing-tool&draft=${id}`;
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <h3 className="text-sm font-semibold text-slate-900">What next?</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <ActionTile
          title="Request supplier quote"
          desc="Send this pricing to the supplier and ask for a formal quote."
          onClick={() => setModal('quote')}
        />
        <ActionTile
          title="Send order request"
          desc="Place an order request for these products and quantities."
          onClick={() => setModal('order')}
        />
        {supplierCfg.features.convertToQuote && (
          <a
            href={quoteUrl}
            className="text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <div className="text-sm font-semibold text-slate-900">Convert to customer quote</div>
            <div className="mt-0.5 text-xs text-slate-500">Editable quote document with your markup - opens the quote generator.</div>
          </a>
        )}
        {supplierCfg.poweredBy && supplierCfg.features.quoteCoreConnect && (
          <ActionTile
            title="Continue in QuoteCore+"
            desc="Save this takeoff as a draft quote - measurements and pitches carry into the app."
            onClick={continueInApp}
            disabled={saving}
          />
        )}
      </div>
      {saveError && (
        <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          Could not save right now. Check your connection and try again.
        </p>
      )}

      {/* Email-capture modal: supplier lead-gen ("sign up, get 5% off") */}
      {leadOpen && !leadDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Get 5% off this job</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pop your email in and {supplierCfg.name} will send your saving code plus a copy of this pricing.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Your name</label>
                <input type="text" value={leadName} onChange={e => setLeadName(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Sam Taylor" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="sam@example.com" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
              <button onClick={() => setLeadOpen(false)} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition">
                No thanks
              </button>
              <button
                onClick={captureLead}
                disabled={!leadEmail.trim()}
                className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                Get my 5% off
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {modal === 'quote' ? 'Request a supplier quote' : 'Send an order request'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                We&apos;ll put your items, quantities and totals into the request.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Your name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Job reference (optional)</label>
                <input type="text" value={jobRef} onChange={e => setJobRef(e.target.value)} placeholder="e.g. 12 Smith Street" className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setModal(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
                Cancel
              </button>
              <a
                href={buildRequestBody(measureSet, catalog, modal, { name, email, jobRef }, supplierCfg.name, supplierCfg.currency)}
                onClick={() => setModal(null)}
                className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {modal === 'quote' ? 'Send quote request' : 'Send order request'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionTile({ title, desc, onClick, disabled }: { title: string; desc: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer disabled:opacity-50"
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
    </button>
  );
}
