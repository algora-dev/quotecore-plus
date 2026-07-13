'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalcResultPopup } from '../free-calculators/_shared/CalcResultPopup';
import { PublicFooter } from '@/app/components/PublicFooter';
import { ImageUpload, type ParsedUploadResult } from '../free-quote-generator/ImageUpload';
import { PromptBox } from '../free-quote-generator/PromptBox';
import { SaveToAppButton, type FreeDocumentData } from '../shared/SaveToAppButton';

/**
 * Free Invoice Generator - no signup required.
 * Pre-fills from URL params: ?amount=4250&client=John&ref=free-quote-generator
 * Upload a photo or paste text and AI fills in the form - or type manually.
 */

interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  hidePrice: boolean;
}

type MeasurementSystem = 'metric' | 'imperial';
type MeasurementType = 'unit' | 'length' | 'small_length' | 'area' | 'volume';

const MEASUREMENT_OPTIONS: { value: MeasurementType; label: string; metric: string; imperial: string }[] = [
  { value: 'unit', label: 'Unit (pieces)', metric: 'pcs', imperial: 'pcs' },
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

function InvoiceGeneratorForm() {
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const clientParam = searchParams.get('client');

  // Settings
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>('metric');
  const [measurementType, setMeasurementType] = useState<MeasurementType>('unit');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [logo, setLogo] = useState<string | null>(null);
  const defaultUnit = unitForSystem(measurementType, measurementSystem);

  const [companyName, setCompanyName] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [hideAllPrices, setHideAllPrices] = useState(false);
  const [hideTotals, setHideTotals] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
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
  const [footer, setFooter] = useState('');
  const [footerItalic, setFooterItalic] = useState(false);
  const [taxRate, setTaxRate] = useState(20);
  const [taxName, setTaxName] = useState('Tax');

  const [lines, setLines] = useState<InvoiceLine[]>(() => {
    if (amountParam) {
      return [{
        id: '1',
        description: 'Roofing works',
        qty: 1,
        unit: 'job',
        rate: parseFloat(amountParam) || 0,
        hidePrice: false,
      }];
    }
    return [{ id: '1', description: '', qty: 1, unit: 'pcs', rate: 0, hidePrice: false }];
  });

  const [generated, setGenerated] = useState(false);
  const [popupTrigger, setPopupTrigger] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('free-tools-email');
    if (saved) { setUserEmail(saved); setEmailSaved(true); }
  }, []);

  const subtotal = lines.reduce((sum, l) => sum + (l.qty * l.rate), 0);
  const vat = subtotal * (taxRate / 100);
  const total = subtotal + vat;
  const sym = currency.symbol;

  function addLine() {
    setLines([...lines, { id: String(Date.now()), description: '', qty: 1, unit: defaultUnit, rate: 0, hidePrice: false }]);
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

  function updateLine(id: string, field: keyof InvoiceLine, value: string | number | boolean) {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  function handleParsed(data: ParsedUploadResult) {
    if (data.companyName) setCompanyName(data.companyName);
    if (data.clientName) setClientName(data.clientName);
    if (data.clientEmail) setClientEmail(data.clientEmail);
    if (data.clientAddress) setClientAddress(data.clientAddress);
    // API returns quoteDate for all document types
    if (data.quoteDate) setInvoiceDate(data.quoteDate);
    if (data.notes) setNotes(data.notes);
    if (data.lines && data.lines.length > 0) {
      setLines(data.lines.map((l, i) => ({
        id: String(Date.now() + i),
        description: l.description,
        qty: l.qty,
        unit: l.unit || defaultUnit,
        rate: l.rate,
        hidePrice: false,
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

  function generateInvoice() {
    setGenerated(true);
    setPopupTrigger(false);
    setTimeout(() => setPopupTrigger(true), 1500);
  }

  function resetInvoice() {
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
            Get full invoicing tools →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Hero */}
        <section className="mb-8 print:hidden">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Free Invoice Generator</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Create a professional invoice in minutes. Upload a photo of your existing invoice and
            AI will fill in the form - or paste your details, or type it manually. No signup required.
          </p>
        </section>

          {/* Email capture */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 print:hidden">
            {!emailSaved ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1">
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" placeholder="Enter your email for more free generations and no watermark" />
                  <p className="mt-1 text-xs text-slate-400">Image upload: 3/day · Text parse: 5/day · Manual: Unlimited</p>
                </div>
                <button onClick={() => { if (userEmail.trim()) { localStorage.setItem('free-tools-email', userEmail.trim()); setEmailSaved(true); } }} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition whitespace-nowrap">Save</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700">✓ {userEmail}</p>
                  <p className="mt-1 text-xs text-slate-400">Image upload: 10/day · Text parse: 20/day · Manual: Unlimited</p>
                </div>
                <button onClick={() => setEmailSaved(false)} className="text-xs font-medium text-[#FF6B35] hover:text-orange-600 transition">Change</button>
              </div>
            )}
          </div>

        {!generated ? (
          <>
            {/* Invoice form */}
            <div className="space-y-6 print:hidden">
              {/* AI upload */}
              <ImageUpload
                documentType="invoice"
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

              {/* Text prompt */}
              <PromptBox
                documentType="invoice"
                onParsed={(data) => handleParsed(data)}
                onError={(msg) => { setUploadError(msg); setAiNotice(''); }}
              />

              {/* Settings bar */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Document settings</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
                  <div>
                    <label className="text-xs font-medium text-slate-600">Tax rate (%)</label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.5"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Tax name</label>
                    <input
                      type="text"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="Tax"
                    />
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
                  <div>
                    <label className="text-xs font-medium text-slate-600">Invoice number</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="INV-001"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Invoice date</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Due date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Contact name</label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Phone</label>
                    <input
                      type="text"
                      value={fromPhone}
                      onChange={(e) => setFromPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="+44 1234 567890"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Email</label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="you@company.com"
                    />
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
                    <span className="text-xs text-slate-400">Shown in top-right of invoice</span>
                  </div>
                </div>
              </div>

              {/* Bill to */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Bill to</h2>
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
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={hideAllPrices} onChange={(e) => setHideAllPrices(e.target.checked)} className="rounded border-slate-300" />
                      Hide line prices
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={hideTotals} onChange={(e) => setHideTotals(e.target.checked)} className="rounded border-slate-300" />
                      Hide totals
                    </label>
                    <button
                      onClick={addLine}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition"
                    >
                      + Add line
                    </button>
                  </div>
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
                          <option value="">-</option>
                          {MEASUREMENT_OPTIONS.map(o => (
                            <option key={o.value} value={measurementSystem === 'metric' ? o.metric : o.imperial}>
                              {measurementSystem === 'metric' ? o.metric : o.imperial}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!hideAllPrices && (
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
                      )}
                      {!hideAllPrices && (
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-sm font-semibold text-slate-700 pt-2">{formatMoney(line.qty * line.rate, sym)}</p>
                      </div>
                      )}
                      <div className="col-span-1 flex justify-end gap-1">
                        <button onClick={() => updateLine(line.id, 'hidePrice', !line.hidePrice)} className="p-2 text-slate-400 hover:text-[#FF6B35] transition" title={line.hidePrice ? 'Show price' : 'Hide price'}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {line.hidePrice ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            ) : (
                              <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </>
                            )}
                          </svg>
                        </button>
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
                {!hideAllPrices && !hideTotals && (
                <div className="mt-4 flex justify-end">
                  <div className="w-full sm:w-64 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium text-slate-900">{formatMoney(subtotal, sym)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{taxName} ({taxRate}%)</span>
                      <span className="font-medium text-slate-900">{formatMoney(vat, sym)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5">
                      <span className="text-slate-900">Total due</span>
                      <span className="text-slate-900">{formatMoney(total, sym)}</span>
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <label className="text-xs font-medium text-slate-600">Notes / payment terms</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  placeholder="Bank transfer details, payment terms..."
                />
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
                <p className="mt-1 text-xs text-slate-400">Appears at the bottom of the invoice, below the notes.</p>
              </div>

              {/* Generate */}
              <button
                onClick={generateInvoice}
                className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
              >
                Generate invoice
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Generated invoice - printable */}
            <div className="rounded-xl border border-slate-200 bg-white p-8 print:border-0 print:p-0 relative overflow-hidden" id="invoice-print">
              {!emailSaved && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: 0 }}>
                  <img src="/logo.png" alt="" className="w-[400px] opacity-[0.07]" style={{ transform: 'rotate(-45deg)' }} />
                </div>
              )}
              <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="flex items-start justify-between mb-8">
                {/* Left: Spacer matching logo height, then Invoice number + Bill to: below */}
                <div>
                  {logo && <div style={{ height: '4rem' }} />}
                  <p className="text-sm font-semibold text-slate-900 mb-2">{invoiceNumber}</p>
                  <p className="text-xs font-medium text-slate-400 mb-1">Bill to:</p>
                  <p className="text-sm font-semibold text-slate-900">{clientName || 'Client name'}</p>
                  {clientEmail && <p className="text-sm text-slate-500">{clientEmail}</p>}
                  {clientAddress && <p className="text-sm text-slate-500">{clientAddress}</p>}
                  <p className="text-sm text-slate-500 mt-1">Date: {invoiceDate}</p>
                  <p className="text-sm text-slate-500">Due: {dueDate}</p>
                </div>
                {/* Right: Logo at top (highest item), From: below */}
                <div className="text-right">
                  {logo && <img src={logo} alt="Company logo" className="h-16 w-auto object-contain ml-auto mb-2" />}
                  <p className="text-xs font-medium text-slate-400 mb-1">From:</p>
                  {fromName && <p className="text-sm font-semibold text-slate-900">{fromName}</p>}
                  {companyName && <p className="text-sm text-slate-700">{companyName}</p>}
                  {fromPhone && <p className="text-sm text-slate-500">{fromPhone}</p>}
                  {fromEmail && <p className="text-sm text-slate-500">{fromEmail}</p>}
                </div>
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
                      <td className="py-2 text-sm text-slate-700 text-right">{hideAllPrices || line.hidePrice ? '-' : formatMoney(line.rate, sym)}</td>
                      <td className="py-2 text-sm font-medium text-slate-900 text-right">{hideAllPrices || line.hidePrice ? '-' : formatMoney(line.qty * line.rate, sym)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!hideAllPrices && !hideTotals && (
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-900">{formatMoney(subtotal, sym)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{taxName} ({taxRate}%)</span>
                    <span className="font-medium text-slate-900">{formatMoney(vat, sym)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5">
                    <span className="text-slate-900">Total due</span>
                    <span className="text-slate-900">{formatMoney(total, sym)}</span>
                  </div>
                </div>
              </div>
              )}

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

              {!emailSaved && (
              <div className="mt-8 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Generated with QuoteCore+ Free Invoice Generator - {new Date().toLocaleDateString('en-GB')}
                </p>
              </div>
              )}
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
              <SaveToAppButton
                documentType="invoice"
                documentData={{
                  companyName,
                  fromName,
                  fromPhone,
                  fromEmail,
                  clientName,
                  clientEmail,
                  clientAddress,
                  documentNumber: invoiceNumber,
                  documentDate: invoiceDate,
                  notes,
                  footer,
                  logo,
                  currency: currency.code,
                  taxRate,
                  taxName,
                  lines: lines.map(l => ({ description: l.description, qty: l.qty, unit: l.unit, rate: l.rate })),
                } as FreeDocumentData}
                userEmail={userEmail}
              />
              <button
                onClick={resetInvoice}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 transition"
              >
                Edit invoice
              </button>
            </div>

            {/* Conversion popup */}
            <CalcResultPopup
              trigger={popupTrigger}
              stage="calc-to-quote"
              slug="free-invoice-generator"
              resultLabel={`${formatMoney(total, sym)} invoice`}
              resultDetails={`${invoiceNumber} for ${clientName || 'client'}`}
              ctaText="Create a purchase order"
              ctaHref={`/free-purchase-order-generator?amount=${total.toFixed(2)}&ref=free-invoice-generator`}
              secondaryText={!emailSaved ? "Enter your email on the form to remove the watermark" : "Need to order materials? Generate a PO for your supplier - no signup needed"}
            />
          </>
        )}

        {/* SEO content */}
        <section className="mt-16 space-y-8 print:hidden">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Free invoice generator FAQ</h2>
            <div className="mt-4 space-y-2">
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Is this invoice generator really free?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes - completely free with no signup. Generate as many invoices as you need. Download as PDF using your browser&apos;s print function. You can also upload a photo of an existing invoice and our AI will extract the details automatically, or paste your invoice text and let AI fill in the form.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Can I upload a photo of my invoice and have AI fill it in?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes. Click the upload area to upload a photo or screenshot of an existing invoice. Our AI will extract the company name, client details, line items, dates, and amounts - then fill in the form for you to review and edit before generating. You get 5 free scans per day.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Can I turn a quote into an invoice?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes. If you generated a quote with our <Link href="/free-quote-generator" className="text-[#FF6B35] font-medium">free quote generator</Link>, the invoice is pre-filled with the same amount and client details automatically.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Does the invoice include VAT?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Tax is calculated at 20% by default, but you can change the rate and name in the document settings. You can adjust line item rates to work ex-VAT or inc-VAT as needed. If you&apos;re not VAT-registered, simply set the tax rate to zero.</p></div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 hover:text-[#FF6B35] transition select-none">Can I use different currencies?</summary>
                <div className="px-4 pb-4"><p className="text-sm text-slate-600">Yes. The currency selector in the document settings bar supports GBP, USD, EUR, AUD, CAD, and NZD. All amounts in the form and the generated invoice will use the selected currency symbol.</p></div>
              </details>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />

      <style jsx global>{`
        @media print {
          @page { margin: 0; }
          body { background: white; }
          header, footer, button { display: none !important; }
          main > div > *:not(#invoice-print) { display: none !important; }
          #invoice-print { border: none !important; padding: 2cm !important; }
        }
      `}</style>
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