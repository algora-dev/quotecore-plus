'use client';

// Supplier-branded quote generator (self-contained copy of the free quote
// generator pattern, tailored to the supplier tool): line items carried in
// via URL from the tool output, per-line markup/margin, global markup/margin,
// logo + brand colour, print/PDF output. Gated upstream by the
// convertToQuote feature flag.

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';

interface QuoteLine {
  description: string;
  qty: number;
  unit: string;
  rate: number;
  /** per-line markup % on top of rate (0 = none) */
  markupPct?: number;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function QuoteBuilder() {
  const [ready, setReady] = useState(false);
  const [fromName, setFromName] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [accent, setAccent] = useState('#2563EB');
  const [clientName, setClientName] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quoteNumber, setQuoteNumber] = useState('Q-001');
  const [validDays, setValidDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [globalMode, setGlobalMode] = useState<'markup' | 'margin'>('markup');
  const [globalPct, setGlobalPct] = useState('0');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(15);
  const [taxName, setTaxName] = useState('GST');
  const [showSettings, setShowSettings] = useState(true);

  // Read the carried lines from the tool output handoff
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('lines');
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw)) as QuoteLine[];
        if (Array.isArray(parsed) && parsed.length > 0) setLines(parsed);
      } catch { /* ignore bad params */ }
    }
    const c = params.get('client');
    if (c) setClientName(c);
    setReady(true);
  }, []);

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  function updateLine(i: number, patch: Partial<QuoteLine>) {
    setLines(ls => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  // Line amount = qty x rate x (1 + markup). Margin mode on a line converts
  // the margin % into the equivalent markup: markup = margin/(100-margin).
  const lineAmount = (l: QuoteLine) => {
    const m = l.markupPct ?? 0;
    return l.qty * l.rate * (1 + m / 100);
  };

  const subtotal = lines.reduce((s, l) => s + lineAmount(l), 0);

  // Global adjustment: markup adds % on top; margin targets a margin % of
  // the final price (sell = cost / (1 - margin)).
  const gp = parseFloat(globalPct) || 0;
  const globalAdjusted = globalMode === 'markup'
    ? subtotal * (1 + gp / 100)
    : gp > 0 && gp < 100
      ? subtotal / (1 - gp / 100)
      : subtotal;
  const tax = taxEnabled ? globalAdjusted * (taxRate / 100) : 0;
  const total = globalAdjusted + tax;

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogo(typeof r.result === 'string' ? r.result : null);
    r.readAsDataURL(f);
  }

  if (!ready) return <main className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading quote...</main>;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Customer quote</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(s => !s)} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition">
              {showSettings ? 'Hide settings' : 'Show settings'}
            </button>
            <button onClick={() => window.print()} className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition">
              Download / Print PDF
            </button>
            <Link href="/supplier-pricing-tool" className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition">
              Back to tool
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 pb-16 space-y-4">
        {showSettings && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-4 print:hidden">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Your business name</label>
                <input type="text" value={fromName} onChange={e => setFromName(e.target.value)} className={inputCls} placeholder="Taylor Roofing" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Phone</label>
                <input type="text" value={fromPhone} onChange={e => setFromPhone(e.target.value)} className={inputCls} placeholder="021 555 123" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} className={inputCls} placeholder="sam@taylorroofing.co.nz" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Client name</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} placeholder="Mr & Mrs Smith" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Quote number</label>
                <input type="text" value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Valid for (days)</label>
                <input type="number" min="1" value={validDays} onChange={e => setValidDays(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Logo</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} className="mt-0.5 text-xs" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Brand colour</label>
                <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="mt-0.5 h-9 w-14 rounded border border-slate-300 cursor-pointer" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Global adjustment</label>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <select value={globalMode} onChange={e => setGlobalMode(e.target.value as 'markup' | 'margin')} className="rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="markup">Markup %</option>
                    <option value="margin">Margin %</option>
                  </select>
                  <input type="number" min="0" max="90" step="0.5" value={globalPct} onChange={e => setGlobalPct(e.target.value)} className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} className="h-4 w-4 accent-slate-900" />
                {taxName}
                <input type="number" min="0" max="50" step="0.5" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
                %
              </label>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Notes (shown on quote)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Payment terms, availability, exclusions..." />
            </div>
          </div>
        )}

        {/* ---------- The quote document ---------- */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-10">
          <div className="flex items-start justify-between gap-4 pb-5" style={{ borderBottom: `3px solid ${accent}` }}>
            <div className="flex items-center gap-3">
              {logo && <img src={logo} alt="Logo" className="h-14 w-auto object-contain" />}
              <div>
                <div className="text-lg font-bold text-slate-900">{fromName || 'Your Business'}</div>
                {(fromPhone || fromEmail) && (
                  <div className="text-xs text-slate-500">{[fromPhone, fromEmail].filter(Boolean).join(' · ')}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold" style={{ color: accent }}>QUOTE</div>
              <div className="text-xs text-slate-500 mt-0.5">#{quoteNumber} · {quoteDate}</div>
              <div className="text-xs text-slate-500">Valid {validDays} days</div>
            </div>
          </div>

          <div className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Prepared for</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">{clientName || 'Your client'}</div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-medium">Item</th>
                <th className="py-2 pr-2 font-medium text-right">Qty</th>
                <th className="py-2 pr-2 font-medium text-right">Rate</th>
                <th className="py-2 pr-2 font-medium print:hidden text-right">Markup %</th>
                <th className="py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2.5 pr-2">
                    <input
                      type="text" value={l.description}
                      onChange={e => updateLine(i, { description: e.target.value })}
                      className="w-full bg-transparent border-none outline-none text-slate-900 focus:bg-slate-50 rounded px-1 -ml-1"
                      aria-label={`Description line ${i + 1}`}
                    />
                  </td>
                  <td className="py-2.5 pr-2 text-right text-slate-600 whitespace-nowrap">
                    <input
                      type="number" min="0" step="any" value={l.qty}
                      onChange={e => updateLine(i, { qty: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-transparent border-none outline-none text-right focus:bg-slate-50 rounded px-1"
                      aria-label={`Quantity line ${i + 1}`}
                    />
                    <span className="text-xs text-slate-400 ml-1">{l.unit}</span>
                  </td>
                  <td className="py-2.5 pr-2 text-right text-slate-600 whitespace-nowrap">
                    $<input
                      type="number" min="0" step="0.01" value={l.rate}
                      onChange={e => updateLine(i, { rate: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-transparent border-none outline-none text-right focus:bg-slate-50 rounded px-1"
                      aria-label={`Rate line ${i + 1}`}
                    />
                  </td>
                  <td className="py-2.5 pr-2 text-right print:hidden">
                    <input
                      type="number" min="0" max="200" step="0.5" value={l.markupPct ?? 0}
                      onChange={e => updateLine(i, { markupPct: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                      aria-label={`Markup percent line ${i + 1}`}
                    />
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">${fmtMoney(lineAmount(l))}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-400">No line items - add them from the tool output.</td></tr>
              )}
            </tbody>
          </table>

          <div className="mt-5 ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>${fmtMoney(subtotal)}</span>
            </div>
            {gp > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{globalMode === 'markup' ? `Markup ${gp}%` : `Margin ${gp}%`}</span>
                <span>${fmtMoney(globalAdjusted - subtotal)}</span>
              </div>
            )}
            {taxEnabled && (
              <div className="flex justify-between text-slate-600">
                <span>{taxName} ({taxRate}%)</span><span>${fmtMoney(tax)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t-2 font-bold text-base" style={{ borderTopColor: accent }}>
              <span>Total</span><span style={{ color: accent }}>${fmtMoney(total)}</span>
            </div>
          </div>

          {notes && (
            <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap">{notes}</div>
          )}
          <p className="mt-6 text-[10px] text-slate-400 text-center">
            Quote valid for {validDays} days from {quoteDate}. Prices include estimated quantities; final invoice may vary with site conditions.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SupplierQuotePage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading...</main>}>
      <QuoteBuilder />
    </Suspense>
  );
}
