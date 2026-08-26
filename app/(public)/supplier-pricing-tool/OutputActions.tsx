// Output actions: convert-to-quote URL (free quote generator handoff),
// supplier request / order request payloads (mailto MVP - no backend yet),
// and the continue-in-app stub.

'use client';

import { useState } from 'react';
import type { MeasurementSet, SupplierProduct } from './types';
import { priceOutput, fmt } from './pricing';
import { SUPPLIER } from './supplier';

/** Build a /free-quote-generator URL carrying the priced lines, same contract
 *  as the measurement-to-quote-tool handoff (amount + encoded lines + ref). */
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

function buildRequestBody(measureSet: MeasurementSet, catalog: SupplierProduct[], kind: 'quote' | 'order', customer: { name: string; email: string; jobRef: string }): string {
  const output = priceOutput(measureSet, catalog);
  const cur = SUPPLIER.currency;
  const rows = output.lines.map(l =>
    `${l.name} (${l.code}) - ${fmt(l.purchaseQty, 1)} ${l.basisUnit} @ ${cur}${fmt(l.unitPrice)} = ${cur}${fmt(l.lineTotal)}`,
  ).join('\n');
  const subject = kind === 'quote'
    ? `Quote request - ${customer.jobRef || 'new job'} (${SUPPLIER.name})`
    : `Order request - ${customer.jobRef || 'new job'} (${SUPPLIER.name})`;
  const body = [
    kind === 'quote'
      ? `Hi ${SUPPLIER.name}, please provide a quote for the following job:`
      : `Hi ${SUPPLIER.name}, I'd like to place an order request for the following:`,
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
    `Generated with the ${SUPPLIER.name} pricing tool (powered by QuoteCore+).`,
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

  const quoteUrl = buildConvertToQuoteUrl(measureSet, catalog);

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
        <a
          href={quoteUrl}
          className="text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50/40"
        >
          <div className="text-sm font-semibold text-slate-900">Convert to customer quote</div>
          <div className="mt-0.5 text-xs text-slate-500">Editable quote document with your markup - opens the quote generator.</div>
        </a>
        <ActionTile
          title="Continue in QuoteCore+"
          desc="Save this job, reuse your measurements and order again faster."
          onClick={() => window.open('/signup', '_blank')}
        />
      </div>

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
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Job reference (optional)</label>
                <input type="text" value={jobRef} onChange={e => setJobRef(e.target.value)} placeholder="e.g. 12 Smith Street" className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setModal(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
                Cancel
              </button>
              <a
                href={buildRequestBody(measureSet, catalog, modal, { name, email, jobRef })}
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

function ActionTile({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50/40 cursor-pointer"
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
    </button>
  );
}
