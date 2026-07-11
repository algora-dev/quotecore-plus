'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalcResultPopup } from '../free-calculators/_shared/CalcResultPopup';
import { PublicFooter } from '@/app/components/PublicFooter';

/**
 * Free Invoice Generator — no signup required.
 * Pre-fills from URL params: ?amount=4250&client=John&ref=free-quote-generator
 */

interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

function InvoiceGeneratorForm() {
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const clientParam = searchParams.get('client');

  const [companyName, setCompanyName] = useState('');
  const [clientName, setClientName] = useState(clientParam ?? '');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [invoiceNumber, setInvoiceNumber] = useState('INV-001');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<InvoiceLine[]>(() => {
    if (amountParam) {
      return [{
        id: '1',
        description: 'Roofing works',
        qty: 1,
        unit: 'job',
        rate: parseFloat(amountParam) || 0,
      }];
    }
    return [{ id: '1', description: '', qty: 1, unit: 'job', rate: 0 }];
  });

  const [generated, setGenerated] = useState(false);
  const [popupTrigger, setPopupTrigger] = useState(false);

  const subtotal = lines.reduce((sum, l) => sum + (l.qty * l.rate), 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  function addLine() {
    setLines([...lines, { id: String(Date.now()), description: '', qty: 1, unit: 'job', rate: 0 }]);
  }
  function removeLine(id: string) {
    setLines(lines.filter(l => l.id !== id));
  }
  function updateLine(id: string, field: keyof InvoiceLine, value: string | number) {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  }
  function generateInvoice() {
    setGenerated(true);
    setPopupTrigger(false);
    setTimeout(() => setPopupTrigger(true), 1500);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link href="/free-calculators" className="flex items-center gap-2">
            <img src="/logo.png" alt="QuoteCore+" className="h-8" />
          </Link>
          <Link href="/signup" className="text-xs font-medium text-[#FF6B35] hover:text-orange-600 transition-colors">
            Get full invoicing tools →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <section className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Invoice Generator</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Create a professional invoice in minutes. No signup required — fill in the details and download as PDF.
          </p>
        </section>

        {!generated ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Your business</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Company name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Your Company Ltd" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Invoice number</label>
                  <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="INV-001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Invoice date</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Due date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Bill to</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Client name</label>
                  <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="John Smith" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Email</label>
                  <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="client@example.com" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Address</label>
                  <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="123 Main Street, Town, Postcode" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Line items</h2>
                <button onClick={addLine} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition">+ Add line</button>
              </div>
              <div className="space-y-3">
                {lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-5">
                      <input type="text" value={line.description} onChange={(e) => updateLine(line.id, 'description', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Description" />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input type="number" value={line.qty || ''} onChange={(e) => updateLine(line.id, 'qty', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Qty" />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <input type="text" value={line.unit} onChange={(e) => updateLine(line.id, 'unit', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Unit" />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input type="number" value={line.rate || ''} onChange={(e) => updateLine(line.id, 'rate', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Rate" step="0.01" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-sm font-semibold text-slate-700 pt-2">£{(line.qty * line.rate).toFixed(2)}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeLine(line.id)} className="p-2 text-slate-400 hover:text-red-500 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <div className="w-full sm:w-64 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900">£{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">VAT (20%)</span><span className="font-medium text-slate-900">£{vat.toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5"><span className="text-slate-900">Total due</span><span className="text-slate-900">£{total.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <label className="text-xs font-medium text-slate-600">Notes / payment terms</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Bank transfer details, payment terms..." />
            </div>

            <button onClick={generateInvoice} className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">
              Generate invoice
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-8 print:border-0 print:p-0" id="invoice-print">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{companyName || 'Your Company'}</h2>
                  <p className="text-sm text-slate-500 mt-1">Invoice {invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Date: {invoiceDate}</p>
                  <p className="text-sm text-slate-500">Due: {dueDate}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-medium text-slate-400 mb-1">Bill to:</p>
                <p className="text-sm font-semibold text-slate-900">{clientName || 'Client name'}</p>
                {clientEmail && <p className="text-sm text-slate-500">{clientEmail}</p>}
                {clientAddress && <p className="text-sm text-slate-500">{clientAddress}</p>}
              </div>

              <table className="w-full mb-6">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-xs font-medium text-slate-500 pb-2">Description</th>
                    <th className="text-right text-xs font-medium text-slate-500 pb-2 w-20">Qty</th>
                    <th className="text-right text-xs font-medium text-slate-500 pb-2 w-16">Unit</th>
                    <th className="text-right text-xs font-medium text-slate-500 pb-2 w-24">Rate</th>
                    <th className="text-right text-xs font-medium text-slate-500 pb-2 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.filter(l => l.description).map((line) => (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="py-2 text-sm text-slate-700">{line.description}</td>
                      <td className="py-2 text-sm text-slate-700 text-right">{line.qty}</td>
                      <td className="py-2 text-sm text-slate-500 text-right">{line.unit}</td>
                      <td className="py-2 text-sm text-slate-700 text-right">£{line.rate.toFixed(2)}</td>
                      <td className="py-2 text-sm font-medium text-slate-900 text-right">£{(line.qty * line.rate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900">£{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">VAT (20%)</span><span className="font-medium text-slate-900">£{vat.toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5"><span className="text-slate-900">Total due</span><span className="text-slate-900">£{total.toFixed(2)}</span></div>
                </div>
              </div>

              {notes && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{notes}</p>
                </div>
              )}

              <div className="mt-8 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">Generated with QuoteCore+ Free Invoice Generator — {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Download PDF
              </button>
              <button onClick={() => setGenerated(false)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 transition">Edit invoice</button>
            </div>

            <CalcResultPopup
              trigger={popupTrigger}
              stage="calc-to-quote"
              slug="free-invoice-generator"
              resultLabel={`£${total.toFixed(2)} invoice`}
              resultDetails={`${invoiceNumber} for ${clientName || 'client'}`}
              ctaText="Manage all quotes, orders & invoices"
              ctaHref="/signup?ref=free-invoice-generator"
              secondaryText="Start free trial — full quoting, takeoff, and job management"
            />
          </>
        )}

        <section className="mt-16 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Free invoice generator FAQ</h2>
            <div className="mt-4 space-y-2">
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Is this invoice generator really free?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes — completely free with no signup. Generate as many invoices as you need. Download as PDF using your browser&apos;s print function.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Can I turn a quote into an invoice?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes. If you generated a quote with our <Link href="/free-quote-generator" className="text-[#FF6B35] font-medium">free quote generator</Link>, the invoice is pre-filled with the same amount and client details automatically.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Does the invoice include VAT?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">VAT is calculated at 20% by default. You can adjust line item rates to work ex-VAT or inc-VAT as needed. If you&apos;re not VAT-registered, simply set rates to zero.</p></div>
              </details>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
      <style jsx global>{`@media print { body { background: white; } header, footer, button { display: none !important; } }`}</style>
    </main>
  );
}

export default function FreeInvoiceGeneratorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <InvoiceGeneratorForm />
    </Suspense>
  );
}
