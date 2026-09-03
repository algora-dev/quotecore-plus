'use client';

// Supplier-branded quote generator (self-contained copy of the free quote
// generator pattern, tailored to the supplier tool): line items carried in
// via URL from the tool output, per-line markup/margin, global markup/margin,
// logo + brand colour, per-column show/hide controls for multi-save use
// (full-info copy + clean customer copy), print/PDF output.

import { Suspense, useEffect, useRef, useState } from 'react';
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
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Generic clean default accent - user picks their own brand colour in settings. */
const DEFAULT_ACCENT = '#2563EB';
const CURRENCY = '\u00A3'; // GBP default (matches the supplier tool demos)

function QuoteBuilder() {
  const [ready, setReady] = useState(false);
  const [fromName, setFromName] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quoteNumber, setQuoteNumber] = useState('Q-001');
  const [validDays, setValidDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [notesItalic, setNotesItalic] = useState(false);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [globalMode, setGlobalMode] = useState<'markup' | 'margin'>('markup');
  const [globalPct, setGlobalPct] = useState('0');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(20);
  const [taxName, setTaxName] = useState('VAT');
  const [showSettings, setShowSettings] = useState(true);

  // Column visibility - untick for a clean customer copy, tick for the
  // full-info copy; print as many times as you like.
  const [showRate, setShowRate] = useState(true);
  const [showQty, setShowQty] = useState(true);
  const [showLinePrice, setShowLinePrice] = useState(true);
  const [showLineText, setShowLineText] = useState(true);
  const [showMarkup, setShowMarkup] = useState(true);
  const [showGlobal, setShowGlobal] = useState(true);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [savingToApp, setSavingToApp] = useState(false);

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

  const lineAmount = (l: QuoteLine) => {
    const m = l.markupPct ?? 0;
    return l.qty * l.rate * (1 + m / 100);
  };

  const subtotal = lines.reduce((s, l) => s + lineAmount(l), 0);
  const gp = parseFloat(globalPct) || 0;
  const globalAdjusted = globalMode === 'markup'
    ? subtotal * (1 + gp / 100)
    : gp > 0 && gp < 100
      ? subtotal / (1 - gp / 100)
      : subtotal;
  const tax = taxEnabled ? globalAdjusted * (taxRate / 100) : 0;
  const total = globalAdjusted + tax;

  // Save the finished quote into QuoteCore+ as a draft - persists through
  // the signup flow (same contract as the other free tools).
  async function saveToApp() {
    setSavingToApp(true);
    try {
      const payload = {
        companyName: fromName || 'Quote',
        fromName,
        fromPhone,
        fromEmail,
        clientName,
        clientAddress,
        documentNumber: quoteNumber,
        documentDate: quoteDate,
        validDays,
        notes,
        logo,
        currency: CURRENCY,
        taxRate: taxEnabled ? taxRate : 0,
        taxName,
        lines: lines.map(l => ({
          description: l.description,
          qty: l.qty,
          unit: l.unit,
          rate: Math.round(lineAmount(l) / Math.max(l.qty, 0.0001) * 100) / 100,
        })),
      };
      const res = await fetch('/api/free-tools/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftType: 'document', payload, email: fromEmail || undefined }),
      });
      if (!res.ok) throw new Error('save failed');
      const { id } = await res.json() as { id: string };
      window.location.href = `/signup?ref=supplier-pricing-tool&draft=${id}`;
    } catch {
      setSavingToApp(false);
      alert('Could not save right now. Please try again.');
    }
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogo(typeof r.result === 'string' ? r.result : null);
    r.readAsDataURL(f);
  }

  if (!ready) return <main className="spt-scope min-h-screen flex items-center justify-center text-sm text-slate-400">Loading quote...</main>;

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-slate-900" />
      {label}
    </label>
  );

  return (
    <main className="spt-scope min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Customer quote</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(s => !s)} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition">
              {showSettings ? 'Hide settings' : 'Show settings'}
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
                <label className="text-xs font-medium text-slate-600">Your address</label>
                <input type="text" value={fromAddress} onChange={e => setFromAddress(e.target.value)} className={inputCls} placeholder="12 Main Street, Auckland" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Client name</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} placeholder="Mr &amp; Mrs Smith" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Quote address</label>
                <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)} className={inputCls} placeholder="34 Hill Road, Wellington" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Quote number</label>
                <input type="text" value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Valid for (days)</label>
                <input type="number" min="1" value={validDays} onChange={e => setValidDays(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Brand colour</label>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="h-9 w-9 rounded-lg border border-slate-200 shadow-sm" style={{ backgroundColor: accent }} aria-hidden="true" />
                  <label
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-slate-800 transition cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                    </svg>
                    Edit
                    <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="sr-only" aria-label="Custom brand colour" />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {/* Logo drop/upload - same pattern as the app's logo container */}
              <div>
                <label className="text-xs font-medium text-slate-600">Logo</label>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="mt-0.5 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-2.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50/40 transition cursor-pointer"
                >
                  {logo ? (
                    <>
                      <img src={logo} alt="Logo" className="h-6 w-auto object-contain" />
                      <span className="text-slate-400">Change</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
                      </svg>
                      Upload logo
                    </>
                  )}
                </button>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} className="hidden" />
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
                <input type="text" value={taxName} onChange={e => setTaxName(e.target.value)} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" aria-label="Tax name" />
                <input type="number" min="0" max="50" step="0.5" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" aria-label="Tax rate percent" />
                %
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Notes / footer (shown on quote)</label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={notesItalic} onChange={e => setNotesItalic(e.target.checked)} className="h-3.5 w-3.5 accent-slate-900" />
                  Italic
                </label>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Payment terms, availability, exclusions..." />
            </div>
          </div>
        )}

        {/* Column show/hide controls - sit just above the quote document */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 print:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Show on quote</span>
          <Toggle label="Line text" checked={showLineText} onChange={setShowLineText} />
          <Toggle label="Qty" checked={showQty} onChange={setShowQty} />
          <Toggle label="Rate" checked={showRate} onChange={setShowRate} />
          <Toggle label="Line price" checked={showLinePrice} onChange={setShowLinePrice} />
          <Toggle label="Markup" checked={showMarkup} onChange={setShowMarkup} />
          <Toggle label="Global markup/margin" checked={showGlobal} onChange={setShowGlobal} />
          <span className="ml-auto text-[11px] text-slate-400">Untick for a clean customer copy, print again</span>
        </div>

        {/* ---------- The quote document ---------- */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-10">
          <div className="flex items-start justify-between gap-6 pb-5" style={{ borderBottom: `3px solid ${accent}` }}>
            {/* Customer (client) left */}
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Quote for</div>
              <div className="text-base font-bold text-slate-900 mt-1">{clientName || 'Your client'}</div>
              {clientAddress && <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{clientAddress}</div>}
            </div>
            {/* Sender right with logo - app layout */}
            <div className="flex items-start gap-3 flex-1 min-w-0 justify-end text-right">
              <div>
                <div className="text-base font-bold text-slate-900">{fromName || 'Your Business'}</div>
                {(fromPhone || fromEmail || fromAddress) && (
                  <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{[fromPhone, fromEmail, fromAddress].filter(Boolean).join('\n')}</div>
                )}
              </div>
              {logo && <img src={logo} alt="Logo" className="h-14 w-auto object-contain flex-shrink-0" />}
            </div>
          </div>

          <div className="flex items-center justify-between py-4">
            <div className="text-xl font-bold" style={{ color: accent }}>QUOTE</div>
            <div className="text-xs text-slate-500 text-right">
              <div>#{quoteNumber} · {quoteDate}</div>
              <div>Valid {validDays} days</div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                {showLineText && <th className="py-2 pr-2 font-medium">Item</th>}
                {showQty && <th className="py-2 pr-2 font-medium text-right">Qty</th>}
                {showRate && <th className="py-2 pr-2 font-medium text-right">Rate</th>}
                {showMarkup && <th className="py-2 pr-2 font-medium print:hidden text-right">Markup %</th>}
                {showLinePrice && <th className="py-2 font-medium text-right">Amount</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 group">
                  {showLineText && (
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text" value={l.description}
                          onChange={e => updateLine(i, { description: e.target.value })}
                          className="flex-1 min-w-0 bg-transparent border-none outline-none text-slate-900 focus:bg-slate-50 rounded px-1 -ml-1"
                          aria-label={`Description line ${i + 1}`}
                          placeholder="Item description"
                        />
                        <button
                          onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition print:hidden"
                          aria-label={`Delete line ${i + 1}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </td>
                  )}
                  {showQty && (
                    <td className="py-2.5 pr-2 text-right text-slate-600 whitespace-nowrap">
                      <input
                        type="number" min="0" step="any" value={l.qty}
                        onChange={e => updateLine(i, { qty: parseFloat(e.target.value) || 0 })}
                        className="w-20 bg-transparent border-none outline-none text-right focus:bg-slate-50 rounded px-1"
                        aria-label={`Quantity line ${i + 1}`}
                      />
                      <span className="text-xs text-slate-400 ml-1">{l.unit}</span>
                    </td>
                  )}
                  {showRate && (
                    <td className="py-2.5 pr-2 text-right text-slate-600 whitespace-nowrap">
                      {CURRENCY}<input
                        type="number" min="0" step="0.01" value={l.rate}
                        onChange={e => updateLine(i, { rate: parseFloat(e.target.value) || 0 })}
                        className="w-20 bg-transparent border-none outline-none text-right focus:bg-slate-50 rounded px-1"
                        aria-label={`Rate line ${i + 1}`}
                      />
                    </td>
                  )}
                  {showMarkup && (
                    <td className="py-2.5 pr-2 text-right print:hidden">
                      <input
                        type="number" min="0" max="200" step="0.5" value={l.markupPct ?? 0}
                        onChange={e => updateLine(i, { markupPct: parseFloat(e.target.value) || 0 })}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                        aria-label={`Markup percent line ${i + 1}`}
                      />
                    </td>
                  )}
                  {showLinePrice && (
                    <td className="py-2.5 text-right font-semibold text-slate-900">{CURRENCY}{fmtMoney(lineAmount(l))}</td>
                  )}
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-400">No line items - add them from the tool output.</td></tr>
              )}
            </tbody>
          </table>

          <div className="mt-2 print:hidden">
            <button
              onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unit: 'ea', rate: 0, markupPct: 0 }])}
              className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition cursor-pointer"
            >
              + Add line
            </button>
            {lines.length > 0 && (
              <span className="ml-2 text-[11px] text-slate-400">hover a row and click ✕ to delete it</span>
            )}
          </div>

          <div className="mt-5 ml-auto max-w-xs space-y-1.5 text-sm">
            {showLinePrice && (
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span><span>{CURRENCY}{fmtMoney(subtotal)}</span>
              </div>
            )}
            {!showLinePrice && lines.length > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({lines.length} items)</span><span>{CURRENCY}{fmtMoney(subtotal)}</span>
              </div>
            )}
            {showGlobal && gp > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{globalMode === 'markup' ? `Markup ${gp}%` : `Margin ${gp}%`}</span>
                <span>{CURRENCY}{fmtMoney(globalAdjusted - subtotal)}</span>
              </div>
            )}
            {taxEnabled && (
              <div className="flex justify-between text-slate-600">
                <span>{taxName} ({taxRate}%)</span><span>{CURRENCY}{fmtMoney(tax)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t-2 font-bold text-base" style={{ borderTopColor: accent }}>
              <span>Total</span><span style={{ color: accent }}>{CURRENCY}{fmtMoney(total)}</span>
            </div>
          </div>

          {notes && (
            <div
              className={`mt-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap ${notesItalic ? 'italic' : ''}`}
            >
              {notes}
            </div>
          )}
          <p className="mt-6 text-[10px] text-slate-400 text-center">
            Quote valid for {validDays} days from {quoteDate}. Prices include estimated quantities; final invoice may vary with site conditions.
          </p>
        </div>

        {/* Bottom CTA - download / next step sits AFTER the document so the
            natural reading flow ends on the action. */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 print:hidden">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">Happy with your quote?</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Download it as a PDF, or save it into QuoteCore+ to send, track and manage the job.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => window.print()} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
                Download / Print PDF
              </button>
              <button
                onClick={() => void saveToApp()}
                disabled={savingToApp}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40"
              >
                {savingToApp ? 'Saving...' : 'Save to QuoteCore+'}
              </button>
            </div>
          </div>
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
