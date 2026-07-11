'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalcResultPopup } from '../free-calculators/_shared/CalcResultPopup';
import { PublicFooter } from '@/app/components/PublicFooter';
import { ImageUpload, type ParsedUploadResult } from './ImageUpload';

/**
 * Free Quote Generator — no signup required.
 * Pre-fills from URL params: ?area=122.1&pitch=35&ref=free-roofing-calculator
 * Generates a printable quote that can be downloaded as PDF (print-to-PDF).
 * Shows conversion popup after generation → "Turn into an order or invoice?"
 */

interface QuoteLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

type MeasurementSystem = 'metric' | 'imperial';
type MeasurementType = 'unit' | 'length' | 'small_length' | 'area' | 'volume';

const MEASUREMENT_OPTIONS: { value: MeasurementType; label: string; metric: string; imperial: string }[] = [
  { value: 'unit', label: 'Unit', metric: 'pcs', imperial: 'pcs' },
  { value: 'length', label: 'M / Ft', metric: 'm', imperial: 'ft' },
  { value: 'small_length', label: 'mm / in', metric: 'mm', imperial: 'in' },
  { value: 'area', label: 'm² / ft²', metric: 'm²', imperial: 'ft²' },
  { value: 'volume', label: 'm³ / ft³', metric: 'm³', imperial: 'ft³' },
];

const CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZD (NZ$)' },
];

function unitForSystem(type: MeasurementType, system: MeasurementSystem): string {
  const opt = MEASUREMENT_OPTIONS.find(o => o.value === type)!;
  return system === 'metric' ? opt.metric : opt.imperial;
}

function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toFixed(2)}`;
}

function QuoteGeneratorForm() {
  const searchParams = useSearchParams();
  const refSlug = searchParams.get('ref');
  const areaParam = searchParams.get('area');
  const pitchParam = searchParams.get('pitch');

  // Settings
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>('metric');
  const [measurementType, setMeasurementType] = useState<MeasurementType>('area');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [logo, setLogo] = useState<string | null>(null);
  const defaultUnit = unitForSystem(measurementType, measurementSystem);

  const [companyName, setCompanyName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validDays, setValidDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [footer, setFooter] = useState('');
  const [footerItalic, setFooterItalic] = useState(false);

  const [lines, setLines] = useState<QuoteLine[]>(() => {
    if (areaParam) {
      return [{
        id: '1',
        description: `Roofing work — ${areaParam} m²${pitchParam ? ` at ${pitchParam}° pitch` : ''}`,
        qty: parseFloat(areaParam) || 0,
        unit: 'm²',
        rate: 0,
      }];
    }
    return [{ id: '1', description: '', qty: 0, unit: 'm²', rate: 0 }];
  });

  const [generated, setGenerated] = useState(false);
  const [popupTrigger, setPopupTrigger] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  const subtotal = lines.reduce((sum, l) => sum + (l.qty * l.rate), 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;
  const sym = currency.symbol;

  function addLine() {
    setLines([...lines, { id: String(Date.now()), description: '', qty: 0, unit: defaultUnit, rate: 0 }]);
  }

  function handleMeasurementChange(system: MeasurementSystem, type: MeasurementType) {
    const newUnit = unitForSystem(type, system);
    const oldUnit = unitForSystem(measurementType, measurementSystem);
    setMeasurementSystem(system);
    setMeasurementType(type);
    setLines(prev => prev.map(l => l.unit === oldUnit ? { ...l, unit: newUnit } : l));
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError('Logo too large. Maximum 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 300;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(img, 0, 0, w, h); setLogo(canvas.toDataURL('image/png')); }
        else { setLogo(reader.result as string); }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function removeLine(id: string) {
    setLines(lines.filter(l => l.id !== id));
  }

  function updateLine(id: string, field: keyof QuoteLine, value: string | number) {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  function handleParsed(data: ParsedUploadResult) {
    if (data.companyName) setCompanyName(data.companyName);
    if (data.clientName) setClientName(data.clientName);
    if (data.clientEmail) setClientEmail(data.clientEmail);
    if (data.clientAddress) setClientAddress(data.clientAddress);
    if (data.quoteDate) setQuoteDate(data.quoteDate);
    if (data.validDays) setValidDays(data.validDays);
    if (data.notes) setNotes(data.notes);
    if (data.lines && data.lines.length > 0) {
      setLines(data.lines.map((l, i) => ({
        id: String(Date.now() + i),
        description: l.description,
        qty: l.qty,
        unit: l.unit || defaultUnit,
        rate: l.rate,
      })));
    }
    const noticeParts: string[] = [];
    if (data.confidence === 'medium') noticeParts.push('medium confidence');
    if (data.confidence === 'low') noticeParts.push('low confidence');
    if (data.warnings && data.warnings.length > 0) noticeParts.push(data.warnings.join('; '));
    if (data.remaining <= 2) noticeParts.push(`${data.remaining} free scans left today`);
    setAiNotice(noticeParts.length > 0 ? `AI extraction: ${noticeParts.join(' · ')}` : '');
    setUploadError('');
  }

  function generateQuote() {
    setGenerated(true);
    setPopupTrigger(false);
    setTimeout(() => setPopupTrigger(true), 1500);
  }

  function resetQuote() {
    setGenerated(false);
    setPopupTrigger(false);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link href="/free-calculators" className="flex items-center gap-2">
            <img src="/logo.png" alt="QuoteCore+" className="h-8" />
          </Link>
          <Link href="/signup" className="text-xs font-medium text-[#FF6B35] hover:text-orange-600 transition-colors">
            Get full quoting tools →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Hero */}
        <section className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Quote Generator</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Create a professional roofing or construction quote in minutes. Upload a photo of your
            existing quote and AI will fill in the form — or type it manually. No signup required.
          </p>
        </section>

        {!generated ? (
          <>
            {/* Quote form */}
            <div className="space-y-6">
              {/* AI upload */}
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

              {/* Settings bar */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Document settings</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Measurement system</label>
                    <div className="mt-1 flex rounded-lg border border-slate-300 overflow-hidden">
                      <button
                        onClick={() => handleMeasurementChange('metric', measurementType)}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition ${measurementSystem === 'metric' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Metric
                      </button>
                      <button
                        onClick={() => handleMeasurementChange('imperial', measurementType)}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition ${measurementSystem === 'imperial' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Imperial
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Default unit type</label>
                    <select
                      value={measurementType}
                      onChange={(e) => handleMeasurementChange(measurementSystem, e.target.value as MeasurementType)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    >
                      {MEASUREMENT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Currency</label>
                    <select
                      value={currency.code}
                      onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value)!)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Your details */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Your business</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Company name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="Your Company Ltd"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Quote date</label>
                      <input
                        type="date"
                        value={quoteDate}
                        onChange={(e) => setQuoteDate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Valid for</label>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="number"
                          value={validDays}
                          onChange={(e) => setValidDays(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">days</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Logo upload */}
                <div className="mt-4">
                  <label className="text-xs font-medium text-slate-600">Business logo (optional)</label>
                  <div className="mt-1 flex items-center gap-3">
                    {logo ? (
                      <div className="flex items-center gap-3">
                        <img src={logo} alt="Logo" className="h-12 w-auto rounded border border-slate-200" />
                        <button
                          onClick={() => setLogo(null)}
                          className="text-xs font-medium text-red-500 hover:text-red-600 transition"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload logo
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    )}
                    <span className="text-xs text-slate-400">Shown in top-right of quote</span>
                  </div>
                </div>
              </div>

              {/* Client details */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Client details</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Client name</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Email</label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="client@example.com"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600">Address</label>
                    <input
                      type="text"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="123 Main Street, Town, Postcode"
                    />
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">Line items</h2>
                  <button
                    onClick={addLine}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition"
                  >
                    + Add line
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div key={line.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-12 sm:col-span-5">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                          placeholder="Description"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          value={line.qty || ''}
                          onChange={(e) => updateLine(line.id, 'qty', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-1">
                        <select
                          value={line.unit}
                          onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                        >
                          <option value="">—</option>
                          {MEASUREMENT_OPTIONS.map(o => (
                            <option key={o.value} value={measurementSystem === 'metric' ? o.metric : o.imperial}>
                              {measurementSystem === 'metric' ? o.metric : o.imperial}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          value={line.rate || ''}
                          onChange={(e) => updateLine(line.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                          placeholder="Rate"
                          step="0.01"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-sm font-semibold text-slate-700 pt-2">{formatMoney(line.qty * line.rate, sym)}</p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => removeLine(line.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-4 flex justify-end">
                  <div className="w-full sm:w-64 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium text-slate-900">{formatMoney(subtotal, sym)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tax (20%)</span>
                      <span className="font-medium text-slate-900">{formatMoney(vat, sym)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5">
                      <span className="text-slate-900">Total</span>
                      <span className="text-slate-900">{formatMoney(total, sym)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <label className="text-xs font-medium text-slate-600">Notes / terms</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  placeholder="Payment terms, validity, scope notes..."
                />
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600">Quote valid for</label>
                  <input
                    type="number"
                    value={validDays}
                    onChange={(e) => setValidDays(e.target.value)}
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">days</span>
                </div>
              </div>

              {/* Footer */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">Footer</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    <button
                      onClick={() => setFooterItalic(false)}
                      className={`px-3 py-1 text-xs font-medium transition ${!footerItalic ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setFooterItalic(true)}
                      className={`px-3 py-1 text-xs font-medium transition ${footerItalic ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      style={{ fontStyle: 'italic' }}
                    >
                      Italic
                    </button>
                  </div>
                </div>
                <textarea
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  rows={2}
                  className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none ${footerItalic ? 'italic' : ''}`}
                  placeholder="Thank you for your business. Contact us for any questions."
                />
                <p className="mt-1 text-xs text-slate-400">Appears at the bottom of the quote, below the notes.</p>
              </div>

              {/* Generate */}
              <button
                onClick={generateQuote}
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
              >
                Generate quote
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Generated quote — printable */}
            <div className="rounded-xl border border-slate-200 bg-white p-8 print:border-0 print:p-0" id="quote-print">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{companyName || 'Your Company'}</h2>
                  <p className="text-sm text-slate-500 mt-1">Quote</p>
                </div>
                <div className="flex items-start gap-4">
                  {logo && (
                    <img src={logo} alt="Company logo" className="h-16 w-auto object-contain" />
                  )}
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Date: {quoteDate}</p>
                    <p className="text-sm text-slate-500">Valid for: {validDays} days</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-medium text-slate-400 mb-1">Quote to:</p>
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
                      <td className="py-2 text-sm text-slate-700 text-right">{formatMoney(line.rate, sym)}</td>
                      <td className="py-2 text-sm font-medium text-slate-900 text-right">{formatMoney(line.qty * line.rate, sym)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-900">{formatMoney(subtotal, sym)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax (20%)</span>
                    <span className="font-medium text-slate-900">{formatMoney(vat, sym)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5">
                    <span className="text-slate-900">Total</span>
                    <span className="text-slate-900">{formatMoney(total, sym)}</span>
                  </div>
                </div>
              </div>

              {notes && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{notes}</p>
                </div>
              )}

              {footer && (
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <p className={`text-sm text-slate-500 whitespace-pre-wrap ${footerItalic ? 'italic' : ''}`}>{footer}</p>
                </div>
              )}

              <div className="mt-8 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Generated with QuoteCore+ Free Quote Generator — {new Date().toLocaleDateString('en-GB')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Download PDF
              </button>
              <button
                onClick={resetQuote}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 transition"
              >
                Edit quote
              </button>
            </div>

            {/* Conversion popup */}
            <CalcResultPopup
              trigger={popupTrigger}
              stage="calc-to-quote"
              slug="free-quote-generator"
              resultLabel={`${formatMoney(total, sym)} quote`}
              resultDetails={`${lines.length} line item${lines.length !== 1 ? 's' : ''} for ${clientName || 'client'}`}
              ctaText="Turn into an invoice"
              ctaHref={`/free-invoice-generator?amount=${total.toFixed(2)}&client=${encodeURIComponent(clientName)}&ref=free-quote-generator`}
              secondaryText="Create a professional invoice and get paid faster — no signup needed"
            />
          </>
        )}

        {/* SEO content */}
        <section className="mt-16 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">How to use this free quote generator</h2>
            <div className="mt-4 space-y-2">
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">
                  Can I use this quote generator without signing up?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">Yes — this tool is completely free with no signup required. Fill in your details, generate the quote, and download it as a PDF using your browser's print function. No data is sent anywhere — everything stays in your browser.</p>
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">
                  Can I pre-fill the quote from a calculator result?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">Yes. If you came from one of our free calculators (e.g. the roofing calculator), your calculation results are automatically pre-filled as a line item. You can add more lines, adjust quantities, and set your rates before generating the quote.</p>
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">
                  How do I download the quote as a PDF?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">After generating your quote, click "Download PDF". This opens your browser's print dialog — select "Save as PDF" as the destination. The quote is formatted to print cleanly on A4.</p>
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">
                  What's the difference between this and QuoteCore+?
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-slate-600">This free tool generates a one-off quote. QuoteCore+ gives you a full quoting system — saved templates, component library, takeoff measurements, client database, order and invoice management, and online quote acceptance. <Link href="/signup" className="text-[#FF6B35] font-medium">Start a free trial →</Link></p>
                </div>
              </details>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />

      <style jsx global>{`
        @media print {
          body { background: white; }
          header, footer, button { display: none !important; }
        }
      `}</style>
    </main>
  );
}

export default function FreeQuoteGeneratorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <QuoteGeneratorForm />
    </Suspense>
  );
}
