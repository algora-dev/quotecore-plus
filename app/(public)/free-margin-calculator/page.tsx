'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { parseConvertLines, buildConvertUrl, type ConvertibleLine } from '../shared/convertLines';
import { ImageUpload, type ParsedUploadResult } from '../free-quote-generator/ImageUpload';
import { PromptBox } from '../free-quote-generator/PromptBox';
import { PublicFooter } from '@/app/components/PublicFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { FreeToolsAuthButton } from '../_components/FreeToolsAuthButton';
import { FreeToolsSignupBanner } from '../_components/FreeToolsSignupBanner';

/**
 * Free Margin Calculator - no signup required, purely client-side.
 * Two modes: Quick (total cost + margin %) and Line-by-Line (per-line margin).
 * Pre-fills from the Free Quote Generator via ?lines=...&ref=free-quote-generator.
 */

interface MarginLine {
  id: string;
  description: string;
  cost: number;
  /** Null = inherit default margin. */
  marginPercent: number | null;
}

const CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZD (NZ$)' },
];

function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

/** Sell price from cost + margin %. Margin is on the sell price: sell = cost / (1 - m). */
function sellFromMargin(cost: number, marginPct: number): number {
  const m = marginPct / 100;
  if (m >= 1) return Infinity;
  return cost / (1 - m);
}

/** Markup % that produces the same sell price as the given margin %. */
function marginToMarkup(marginPct: number): number {
  const m = marginPct / 100;
  if (m >= 1) return Infinity;
  return (m / (1 - m)) * 100;
}

const SESSION_KEY = 'qcp:fr…margin-calc';

function MarginCalculator() {
  const searchParams = useSearchParams();
  const linesParam = searchParams.get('lines');
  const currencyParam = searchParams.get('currency');
  const importedLines = parseConvertLines(linesParam);

  const [mode, setMode] = useState<'quick' | 'lines'>(importedLines && importedLines.length > 0 ? 'lines' : 'quick');
  const [currency, setCurrency] = useState(() => {
    if (currencyParam) {
      const found = CURRENCIES.find(c => c.code === currencyParam);
      if (found) return found;
    }
    if (typeof window !== 'undefined' && window.location.hostname.includes('quote-core.co.nz')) {
      return CURRENCIES.find(c => c.code === 'NZD') || CURRENCIES[0];
    }
    return CURRENCIES[0];
  });
  const sym = currency.symbol;

  // Quick mode
  const [quickCost, setQuickCost] = useState<number>(0);
  const [quickMargin, setQuickMargin] = useState<number>(20);

  // Line-by-line mode
  const [defaultMargin, setDefaultMargin] = useState<number>(20);
  const [lines, setLines] = useState<MarginLine[]>(() => {
    if (importedLines && importedLines.length > 0) {
      // Quote generator lines arrive as sell prices. Seed them as cost with 0
      // profit assumption? No: seed cost = rate and let the user adjust costs.
      // Better: seed cost so the current rate equals default-margin sell? We
      // cannot know the user's costs, so seed cost = quoted rate and margin 0.
      // Users then enter true costs per line.
      return importedLines.map((l: ConvertibleLine, i: number) => ({
        id: String(Date.now() + i),
        description: l.description,
        cost: l.qty * l.rate,
        marginPercent: null,
      }));
    }
    return [
      { id: '1', description: '', cost: 0, marginPercent: null },
    ];
  });

  // Session persistence
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && !(importedLines && importedLines.length > 0)) {
      try {
        const data = JSON.parse(saved);
        if (data.mode) setMode(data.mode);
        if (data.currencyCode) setCurrency(CURRENCIES.find(c => c.code === data.currencyCode) || CURRENCIES[0]);
        if (data.quickCost !== undefined) setQuickCost(data.quickCost);
        if (data.quickMargin !== undefined) setQuickMargin(data.quickMargin);
        if (data.defaultMargin !== undefined) setDefaultMargin(data.defaultMargin);
        if (data.lines && data.lines.length > 0) setLines(data.lines);
      } catch {}
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          mode, currencyCode: currency.code, quickCost, quickMargin, defaultMargin, lines,
        }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, currency, quickCost, quickMargin, defaultMargin, lines]);

  // Geo currency default
  useEffect(() => {
    fetch('/api/geo').then(r => r.json()).then(({ country }) => {
      const map: Record<string, string> = { GB: 'GBP', US: 'USD', AU: 'AUD', CA: 'CAD', NZ: 'NZD', IE: 'EUR', DE: 'EUR', FR: 'EUR' };
      const code = map[country] || 'GBP';
      const found = CURRENCIES.find(c => c.code === code);
      if (found) setCurrency(found);
    }).catch(() => {});
  }, []);

  function addLine() {
    setLines([...lines, { id: String(Date.now()), description: '', cost: 0, marginPercent: null }]);
  }
  function removeLine(id: string) {
    setLines(lines.filter(l => l.id !== id));
  }
  function updateLine(id: string, field: keyof MarginLine, value: string | number | null) {
    setLines(lines.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  }
  function applyDefaultToAll() {
    setLines(lines.map(l => ({ ...l, marginPercent: null })));
  }

  const effectiveMargin = (l: MarginLine) => l.marginPercent ?? defaultMargin;
  const lineSell = (l: MarginLine) => sellFromMargin(l.cost, effectiveMargin(l));

  const totalCost = lines.reduce((s, l) => s + l.cost, 0);
  const totalSell = lines.reduce((s, l) => s + lineSell(l), 0);
  const totalProfit = totalSell - totalCost;
  const overallMargin = totalSell > 0 ? (totalProfit / totalSell) * 100 : 0;

  // Quick mode outputs
  const quickSell = sellFromMargin(quickCost, quickMargin);
  const quickProfit = quickSell - quickCost;
  const quickMarkup = marginToMarkup(quickMargin);

  // Round-trip back to quote generator with adjusted sell prices
  const sendBackUrl = buildConvertUrl({
    targetPath: '/free-quote-generator',
    amount: totalSell,
    lines: lines
      .filter(l => l.description || l.cost > 0)
      .map(l => ({ description: l.description, qty: 1, unit: 'pcs', rate: Math.round(lineSell(l) * 100) / 100 })),
    ref: 'free-margin-calculator',
  });

  const imported = !!(importedLines && importedLines.length > 0);

  const [uploadError, setUploadError] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  // AI quote import - fills the Line-by-Line calculator from an uploaded/pasted quote.
  // Quoted prices are used as the starting cost; the user corrects to true costs.
  function handleParsed(data: ParsedUploadResult) {
    if (data.lines && data.lines.length > 0) {
      setMode('lines');
      setLines(data.lines.map((l, i) => ({
        id: String(Date.now() + i),
        description: l.description,
        cost: l.qty * l.rate,
        marginPercent: null,
      })));
    }
    const noticeParts: string[] = [];
    if (data.confidence === 'medium') noticeParts.push('medium confidence');
    if (data.confidence === 'low') noticeParts.push('low confidence');
    if (data.warnings && data.warnings.length > 0) noticeParts.push(data.warnings.join('; '));
    if (data.remaining <= 2) noticeParts.push(`${data.remaining} free AI scans left today`);
    setAiNotice(noticeParts.length > 0 ? `AI extraction: ${noticeParts.join(' · ')}` : '');
    setUploadError('');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link href="/free-tools" className="flex items-center gap-2">
            <img src="/logo.png" alt="QuoteCore+" className="h-8" />
          </Link>
          <div className="flex items-center gap-3">
            <FreeToolsAuthButton compact />
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-2">
          <Link href="/free-tools" prefetch={false} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#BD4A1A] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Free Tools
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Hero */}
        <section className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Margin Calculator</h1>
          <p className="mt-1 text-sm font-medium text-[#BD4A1A]">Enter costs, add margin, see your profit - free, no signup required.</p>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Calculate gross margin on a single total or line by line across a whole quote. Works for
            materials, labour, installation, delivery - any cost at all.
          </p>
        </section>

        <FreeToolsSignupBanner />

        {imported && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
            <p className="text-sm text-blue-700">
              Lines imported from your quote. Enter the true cost for each line - your quoted
              prices were used as the starting point. Adjust the margin per line, then send the
              adjusted prices back.
            </p>
          </div>
        )}

        {/* Mode tabs */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setMode('quick')}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition ${mode === 'quick' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
          >
            Quick
          </button>
          <button
            onClick={() => setMode('lines')}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition ${mode === 'lines' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
          >
            Line-by-line
          </button>
        </div>

        {/* Currency selector */}
        <div className="mt-4 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Currency</label>
            <select
              value={currency.code}
              onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value)!)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {mode === 'quick' ? (
          <div className="mt-4 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Quick margin</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">Total cost</label>
                  <input
                    type="number"
                    value={quickCost || ''}
                    onChange={(e) => setQuickCost(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Margin %</label>
                  <input
                    type="number"
                    value={quickMargin || ''}
                    onChange={(e) => setQuickMargin(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="99"
                    step="0.5"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    placeholder="20"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Selling price</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{formatMoney(quickSell, sym)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Gross profit</p>
                  <p className="mt-1 text-xl font-semibold text-[#BD4A1A]">{formatMoney(quickProfit, sym)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Equivalent markup</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{Number.isFinite(quickMarkup) ? `${quickMarkup.toFixed(1)}%` : '-'}</p>
                </div>
              </div>

              {/* Cost/profit split bar */}
              {quickSell > 0 && Number.isFinite(quickSell) && (
                <div className="mt-4">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-slate-700" style={{ width: `${(quickCost / quickSell) * 100}%` }} />
                    <div className="bg-[#FF6B35]" style={{ width: `${(quickProfit / quickSell) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                    <span>Cost {formatMoney(quickCost, sym)}</span>
                    <span>Profit {formatMoney(quickProfit, sym)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Margin vs markup explainer */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Margin vs markup - they are not the same</h2>
              <p className="text-sm text-slate-600">
                Margin is a percentage of the <strong>selling price</strong>. Markup is a percentage of the <strong>cost</strong>.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">£100 cost + 20% margin</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">£125.00</p>
                  <p className="text-xs text-slate-500">100 ÷ (1 - 0.20)</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">£100 cost + 20% markup</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">£120.00</p>
                  <p className="text-xs text-slate-500">100 × 1.20</p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-xs font-medium text-slate-500 py-2">Margin %</th>
                      <th className="text-left text-xs font-medium text-slate-500 py-2">Same as markup</th>
                      <th className="text-left text-xs font-medium text-slate-500 py-2">Sell price on £100 cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[10, 15, 20, 25, 30, 35, 40, 50].map(m => (
                      <tr key={m} className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-700">{m}%</td>
                        <td className="py-1.5 text-slate-700">{marginToMarkup(m).toFixed(1)}%</td>
                        <td className="py-1.5 text-slate-700">{formatMoney(sellFromMargin(100, m), sym)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* AI import - upload or paste an existing quote to fill the lines */}
            <ImageUpload
              documentType="quote"
              onParsed={handleParsed}
              onError={(msg) => { setUploadError(msg); setAiNotice(''); }}
            />
            {uploadError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5">
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}
            {aiNotice && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
                <p className="text-sm text-blue-700">{aiNotice}</p>
              </div>
            )}
            <PromptBox
              documentType="quote"
              onParsed={(data) => handleParsed(data as unknown as ParsedUploadResult)}
              onError={(msg) => { setUploadError(msg); setAiNotice(''); }}
            />

            {/* Default margin */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Default margin %</label>
                  <input
                    type="number"
                    value={defaultMargin || ''}
                    onChange={(e) => setDefaultMargin(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="99"
                    step="0.5"
                    className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    placeholder="20"
                  />
                  <p className="mt-1 text-xs text-slate-400">New lines inherit this. Change any line individually.</p>
                </div>
                <button
                  onClick={applyDefaultToAll}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#FF6B35] hover:text-[#BD4A1A] transition"
                >
                  Reset all lines to default
                </button>
              </div>
            </div>

            {/* Lines */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Lines</h2>
                <button
                  onClick={addLine}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#FF6B35] hover:text-[#BD4A1A] transition"
                >
                  + Add line
                </button>
              </div>
              <div className="space-y-3">
                {lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                        placeholder="Description (e.g. Roof tiles, Labour...)"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        value={line.cost || ''}
                        onChange={(e) => updateLine(line.id, 'cost', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                        placeholder="Cost"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <div className="relative">
                        <input
                          type="number"
                          value={line.marginPercent ?? ''}
                          onChange={(e) => updateLine(line.id, 'marginPercent', e.target.value === '' ? null : parseFloat(e.target.value))}
                          min="0"
                          max="99"
                          step="0.5"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm focus:border-orange-500 focus:outline-none"
                          placeholder={String(defaultMargin)}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-right">
                      <p className="text-sm font-semibold text-slate-900">{Number.isFinite(lineSell(line)) ? formatMoney(lineSell(line), sym) : '-'}</p>
                      <p className="text-xs text-[#BD4A1A]">+{Number.isFinite(lineSell(line)) ? formatMoney(lineSell(line) - line.cost, sym) : '-'}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeLine(line.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition"
                        title="Delete line"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {lines.length === 0 && (
                  <p className="text-sm text-slate-400 py-6 text-center rounded-xl border border-dashed border-slate-200 px-6">
                    No lines yet. Click + Add line to start.
                  </p>
                )}
              </div>

              {/* Totals */}
              {lines.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <div className="w-full sm:w-72 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total cost</span>
                      <span className="font-medium text-slate-900">{formatMoney(totalCost, sym)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Gross profit</span>
                      <span className="font-medium text-[#BD4A1A]">{Number.isFinite(totalProfit) ? formatMoney(totalProfit, sym) : '-'}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5">
                      <span className="text-slate-900">Selling price</span>
                      <span className="text-slate-900">{Number.isFinite(totalSell) ? formatMoney(totalSell, sym) : '-'}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Gross margin</span>
                      <span>{overallMargin.toFixed(1)}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 pt-1">Gross figures based on the costs you enter - before overheads, tax and business running costs.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Send back to quote generator */}
            {lines.some(l => l.description && l.cost > 0) && (
              <a
                href={sendBackUrl}
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
              >
                Send adjusted prices to Quote Generator
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* SEO content */}
        <section className="mt-16 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">What this margin calculator does</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Three ways to work. <strong>Quick mode</strong>: enter a single total cost, apply margin or markup, and see
              the selling price, gross profit and equivalent markup live. <strong>Line-by-line mode</strong>: add every
              item in a quote, set a default margin, then override the margin on any line individually. <strong>AI
              import</strong>: upload a photo of a supplier list or quote (or paste the text) and the lines populate
              automatically - fully editable afterwards. When you are done, one click sends the adjusted prices to the{' '}
              <Link href="/free-quote-generator" className="text-[#BD4A1A] font-medium">free quote generator</Link> to
              build the finished document.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Margin vs markup - the short version</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Margin is a percentage of the <strong>selling price</strong>; markup is a percentage of the <strong>cost</strong>.
              A £100 cost sold at £125 has 25% markup but only 20% margin. Selling price from margin is calculated as
              cost ÷ (1 − margin%). Confusing the two systematically underprices your work - the full explanation with a
              conversion table is in our guide to{' '}
              <Link href="/blog/margin-vs-markup" className="text-[#BD4A1A] font-medium">margin vs markup for contractors</Link>.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">How to set different margins per item</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Switch to Line-by-line mode, set your default margin at the top, then add your lines. Every new line
              inherits the default - type a margin into any line to override it, and clear the field to inherit the
              default again. The totals panel tracks total cost, gross profit, selling price and the blended margin
              across the whole quote, live as you type. It is the same per-line margin behaviour as the quote editor in
              the full QuoteCore+ app - <Link href="/free-trial" className="text-[#BD4A1A] font-medium">try it free</Link> when you
              want margins, measurements, material orders and invoicing connected.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Margin questions, answered</h2>
            <div className="mt-4 space-y-2">
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#BD4A1A] transition select-none">
                  What is the difference between margin and markup?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">Markup is calculated on your cost. Margin is calculated on your selling price. £100 cost marked up 20% sells for £120 - but that is only 16.7% margin, because £20 profit on a £120 sell price is 16.7%. If you want a true 20% margin, you must sell at £125. Trades who confuse the two systematically underprice their work.</p>
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#BD4A1A] transition select-none">
                  Should I apply different margins to materials and labour?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">You can - and it is common practice, though the right split varies by trade and business model. Some trades apply a higher margin to labour than materials (or the other way round) because of where their risk sits: rework and errors usually eat labour time, while material price changes eat material profit. There is no universal rule - this calculator simply lets you set a different margin on every line so you can price each part of the job the way your business works.</p>
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#BD4A1A] transition select-none">
                  What is a safe margin for a small trade business?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">This calculator shows <strong>gross margin</strong>: profit on the costs you enter, before overheads like insurance, vehicles, office costs and your own time quoting. There is no single right number - the appropriate margin depends on your trade, your costs, your overheads, the risk and complexity of the job, material price volatility, and how competitive your local market is. Many trades work at different margins for materials versus labour, and change margin by job type. If you are unsure, an accountant or trade association for your trade can help you find a number that covers your overheads and leaves a real profit.</p>
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#BD4A1A] transition select-none">
                  Can I use this on a quote I already built?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">Yes. Generate your quote in our <Link href="/free-quote-generator" className="text-[#BD4A1A] font-medium">free quote generator</Link>, then click &quot;Check / Add Margin&quot; - every line transfers straight into this calculator. Set your margins line by line and send the adjusted prices back to the quote in one click.</p>
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#BD4A1A] transition select-none">
                  Is this calculator really free?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">Yes - the calculator itself is completely free, no signup required, with no limits on how many calculations you run. Everything calculates in your browser. The only limited feature is the AI quote import (photo upload or paste text), which has a small number of free scans per day and offers a free account for more. If you want quote tracking, follow-ups, digital takeoff and client management, <Link href="/signup" className="text-[#BD4A1A] font-medium">try QuoteCore+ free &rarr;</Link></p>
                </div>
              </details>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}

export default function FreeMarginCalculatorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <FreeToolsAuthProvider>
        <MarginCalculator />
      </FreeToolsAuthProvider>
    </Suspense>
  );
}
