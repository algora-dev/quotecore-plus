'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalcResultPopup } from '../free-calculators/_shared/CalcResultPopup';
import { PublicFooter } from '@/app/components/PublicFooter';

/**
 * Free Purchase Order Generator — no signup required.
 * Pre-fills from URL params: ?amount=4250&ref=free-quote-generator
 */

interface POLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

function POGeneratorForm() {
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');

  const [companyName, setCompanyName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [poDate, setPODate] = useState(() => new Date().toISOString().slice(0, 10));
  const [poNumber, setPONumber] = useState('PO-001');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<POLine[]>(() => {
    if (amountParam) {
      return [{ id: '1', description: 'Materials', qty: 1, unit: 'lot', rate: parseFloat(amountParam) || 0 }];
    }
    return [{ id: '1', description: '', qty: 0, unit: 'units', rate: 0 }];
  });

  const [generated, setGenerated] = useState(false);
  const [popupTrigger, setPopupTrigger] = useState(false);

  const subtotal = lines.reduce((sum, l) => sum + (l.qty * l.rate), 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  function addLine() { setLines([...lines, { id: String(Date.now()), description: '', qty: 0, unit: 'units', rate: 0 }]); }
  function removeLine(id: string) { setLines(lines.filter(l => l.id !== id)); }
  function updateLine(id: string, field: keyof POLine, value: string | number) {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  }
  function generatePO() {
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
          <Link href="/signup" className="text-xs font-medium text-[#FF6B35] hover:text-orange-600 transition-colors">Get full order tools →</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <section className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Purchase Order Generator</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Create a professional purchase order for your suppliers. No signup required — fill in the details and download as PDF.
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
                  <label className="text-xs font-medium text-slate-600">PO number</label>
                  <input type="text" value={poNumber} onChange={(e) => setPONumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="PO-001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">PO date</label>
                  <input type="date" value={poDate} onChange={(e) => setPODate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Required delivery date</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Supplier</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Supplier name</label>
                  <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="ABC Supplies Ltd" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Email</label>
                  <input type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="orders@abcsupplies.co.uk" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Address</label>
                  <input type="text" value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="123 Industrial Estate, Town, Postcode" />
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
                    <div className="col-span-12 sm:col-span-5"><input type="text" value={line.description} onChange={(e) => updateLine(line.id, 'description', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Description" /></div>
                    <div className="col-span-3 sm:col-span-2"><input type="number" value={line.qty || ''} onChange={(e) => updateLine(line.id, 'qty', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Qty" /></div>
                    <div className="col-span-3 sm:col-span-1"><input type="text" value={line.unit} onChange={(e) => updateLine(line.id, 'unit', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Unit" /></div>
                    <div className="col-span-3 sm:col-span-2"><input type="number" value={line.rate || ''} onChange={(e) => updateLine(line.id, 'rate', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Rate" step="0.01" /></div>
                    <div className="col-span-2 sm:col-span-1"><p className="text-sm font-semibold text-slate-700 pt-2">£{(line.qty * line.rate).toFixed(2)}</p></div>
                    <div className="col-span-1 flex justify-end"><button onClick={() => removeLine(line.id)} className="p-2 text-slate-400 hover:text-red-500 transition"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <div className="w-full sm:w-64 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900">£{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">VAT (20%)</span><span className="font-medium text-slate-900">£{vat.toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5"><span className="text-slate-900">Total</span><span className="text-slate-900">£{total.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <label className="text-xs font-medium text-slate-600">Notes / delivery instructions</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Delivery instructions, site contact, access notes..." />
            </div>

            <button onClick={generatePO} className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">
              Generate purchase order
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-8 print:border-0 print:p-0" id="po-print">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{companyName || 'Your Company'}</h2>
                  <p className="text-sm text-slate-500 mt-1">Purchase Order {poNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Date: {poDate}</p>
                  {deliveryDate && <p className="text-sm text-slate-500">Required by: {deliveryDate}</p>}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-medium text-slate-400 mb-1">Supplier:</p>
                <p className="text-sm font-semibold text-slate-900">{supplierName || 'Supplier name'}</p>
                {supplierEmail && <p className="text-sm text-slate-500">{supplierEmail}</p>}
                {supplierAddress && <p className="text-sm text-slate-500">{supplierAddress}</p>}
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
                  <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5"><span className="text-slate-900">Total</span><span className="text-slate-900">£{total.toFixed(2)}</span></div>
                </div>
              </div>

              {notes && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{notes}</p>
                </div>
              )}

              <div className="mt-8 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">Generated with QuoteCore+ Free PO Generator — {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Download PDF
              </button>
              <button onClick={() => setGenerated(false)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 transition">Edit order</button>
            </div>

            <CalcResultPopup
              trigger={popupTrigger}
              stage="calc-to-quote"
              slug="free-purchase-order-generator"
              resultLabel={`£${total.toFixed(2)} purchase order`}
              resultDetails={`${poNumber} to ${supplierName || 'supplier'}`}
              ctaText="Manage all orders & suppliers"
              ctaHref="/signup?ref=free-purchase-order-generator"
              secondaryText="Start free trial — full quoting, takeoff, and job management"
            />
          </>
        )}

        <section className="mt-16 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Free purchase order generator FAQ</h2>
            <div className="mt-4 space-y-2">
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Is this PO generator free?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes — completely free with no signup. Generate as many purchase orders as you need and download as PDF.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Why use a purchase order?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">A purchase order (PO) is a formal document sent to a supplier requesting materials or services at agreed prices. It protects both parties — the supplier knows exactly what to deliver, and you have a written record of the order for your accounts.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Can I manage suppliers in QuoteCore+?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes. QuoteCore+ includes a full supplier database, reusable line items, and order tracking — so you can raise POs from your saved materials list in seconds. <Link href="/signup" className="text-[#FF6B35] font-medium">Start a free trial →</Link></p></div>
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

export default function FreePOGeneratorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <POGeneratorForm />
    </Suspense>
  );
}
