// Supplier enquiry modal - ported from free-roofing-takeoff-builder
// (self-contained rule: copied, not imported). Same UX: name + email,
// four intent options, message, hide/show toggles for quantities / pricing,
// attachments, marketing consent. Payload adapted to this tool's
// priceOutput lines + custom components.

'use client';

import { useRef, useState } from 'react';
import { priceOutput, fmt } from './pricing';
import { useSupplierConfig, toolUrls } from './supplierConfig';

type Intent = 'detailed_quote' | 'order_request' | 'pricing_question' | 'general_enquiry';

const intentOptions: { value: Intent; label: string; desc: string }[] = [
  { value: 'detailed_quote', label: 'Detailed Quote', desc: 'Ask the supplier for a full formal quote' },
  { value: 'order_request', label: 'Order Request', desc: 'I want to order these materials' },
  { value: 'pricing_question', label: 'Pricing Question', desc: 'Ask about pricing or better rates' },
  { value: 'general_enquiry', label: 'General Enquiry', desc: 'Something else' },
];

export interface EnquiryModalProps {
  supplierName: string;
  supplierSlug: string;
  measureSet: import('./types').MeasurementSet;
  catalog: import('./types').SupplierProduct[];
  currency: string;
  /** 'quote' pre-selects detailed_quote, 'order' pre-selects order_request */
  initialIntent?: 'quote' | 'order';
  onClose: () => void;
}

export function SupplierEnquiryModal({
  supplierName, supplierSlug, measureSet, catalog, currency, initialIntent, onClose,
}: EnquiryModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [intent, setIntent] = useState<Intent>(initialIntent === 'order' ? 'order_request' : 'detailed_quote');
  const [message, setMessage] = useState('');
  const [includeQuantities, setIncludeQuantities] = useState(true);
  const [includePricing, setIncludePricing] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { config: supplierCfg } = useSupplierConfig();
  const urls = toolUrls(supplierCfg);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = emailRegex.test(email);
  const nameValid = name.trim().length >= 2;
  const canSend = nameValid && emailValid && !sending;

  const output = priceOutput(measureSet, catalog);
  const cur = currency;

  /** Enriched totals payload: groups -> lines, respecting the toggles. */
  function buildTotals() {
    const byGroup = new Map<string, { label: string; unit: string; items: Record<string, unknown>[] }>();
    for (const l of output.lines) {
      const g = byGroup.get(l.groupKey) ?? { label: l.groupLabel, unit: l.basisUnit, items: [] };
      g.items.push({
        name: l.name,
        code: l.code,
        entryLabel: l.entryLabel ?? undefined,
        ...(includeQuantities
          ? { calcQty: Number(l.calcQty.toFixed(2)), purchaseQty: Number(l.purchaseQty.toFixed(2)), wastePct: l.wastePct }
          : {}),
        ...(includePricing
          ? { unitPrice: Number(l.unitPrice.toFixed(2)), lineTotal: l.lineTotal, labourTotal: l.labourTotal }
          : {}),
      });
      byGroup.set(l.groupKey, g);
    }
    const customs = output.customs.map(c => ({
      name: c.name,
      ...(includeQuantities ? { quantity: c.quantity, basis: c.basis } : {}),
      ...(includePricing ? { unitPrice: c.unitPrice, labourRate: c.labourRate, lineTotal: Number((c.quantity * c.unitPrice).toFixed(2)) } : {}),
    }));
    return {
      groups: Array.from(byGroup.values()),
      ...(customs.length > 0 ? { customComponents: customs } : {}),
      ...(includePricing
        ? {
            materialsTotal: output.material,
            labourTotal: output.labour,
            total: output.material + output.labour,
          }
        : {}),
      currency: cur,
    };
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const valid = selected.filter(f => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024);
    setFiles([...files, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      // Upload attachments first if any
      const attachmentIds: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(urls.enquiryApi, { method: 'PUT', body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.ok && uploadData.fileId) attachmentIds.push(uploadData.fileId);
      }
      const res = await fetch(urls.enquiryApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierSlug,
          senderName: name,
          senderEmail: email,
          senderPhone: phone || undefined,
          intent,
          message,
          includeQuantities,
          includePricing,
          includeResultLink: false,
          totals: buildTotals(),
          currency: cur,
          marketingConsent,
          attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
      } else {
        setError(data.error || 'Failed to send enquiry. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-2 md:p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Enquiry sent!</h3>
          <p className="mt-2 text-sm text-slate-500">
            Your message has been sent to {supplierName}. They&apos;ll reply directly to your email at {email}.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-full bg-black text-white px-5 py-3 text-sm font-semibold hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-2 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Send to {supplierName}</h2>
            <p className="text-xs text-slate-400">They&apos;ll reply directly to your email</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-slate-400 hover:text-slate-600 transition rounded-full hover:bg-slate-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Name + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="spt-enquiry-name" className="block text-xs font-medium text-slate-600 mb-1">Your name *</label>
              <input
                id="spt-enquiry-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label htmlFor="spt-enquiry-email" className="block text-xs font-medium text-slate-600 mb-1">Your email *</label>
              <input
                id="spt-enquiry-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${email && !emailValid ? 'border-red-300 focus:border-red-500' : 'border-slate-300 focus:border-blue-500'}`}
                placeholder="john@example.com"
              />
              {email && !emailValid && <p className="mt-1 text-xs text-red-500">Please enter a valid email address.</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="spt-enquiry-phone" className="block text-xs font-medium text-slate-600 mb-1">Phone (optional)</label>
            <input
              id="spt-enquiry-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="+64 21 123 456"
            />
          </div>

          {/* Intent */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">What do you need?</label>
            <div className="grid grid-cols-2 gap-2">
              {intentOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setIntent(opt.value)}
                  className={`text-left rounded-lg border p-2.5 transition cursor-pointer ${intent === opt.value ? 'border-[#FF6B35] bg-orange-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xs font-semibold text-slate-900">{opt.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="spt-enquiry-message" className="block text-xs font-medium text-slate-600 mb-1">Message</label>
            <textarea
              id="spt-enquiry-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={5000}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
              placeholder={`Hi, I've priced up a job using your materials. Can you provide a formal quote? Materials total ${cur}${fmt(output.material)}...`}
            />
            <p className="mt-1 text-[11px] text-slate-400 text-right">{message.length}/5000</p>
          </div>

          {/* Include toggles */}
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Include in email:</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeQuantities} onChange={(e) => setIncludeQuantities(e.target.checked)} className="rounded border-slate-300 text-[#FF6B35] focus:ring-[#FF6B35]" />
              <span className="text-xs text-slate-600">Takeoff quantities (measurements per component)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includePricing} onChange={(e) => setIncludePricing(e.target.checked)} className="rounded border-slate-300 text-[#FF6B35] focus:ring-[#FF6B35]" />
              <span className="text-xs text-slate-600">Pricing breakdown (material + labour costs)</span>
            </label>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Attachments (optional, max 5 files, 10MB each)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 5}
              className="w-full rounded-lg border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-500 hover:border-[#FF6B35] hover:bg-orange-50/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {files.length >= 5 ? 'Maximum 5 files reached' : '+ Add file (PDF, JPG, PNG, WebP)'}
            </button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="text-xs text-slate-600 truncate flex-1">{file.name}</span>
                    <span className="text-[11px] text-slate-400 ml-2">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                    <button onClick={() => setFiles(files.filter((_, i) => i !== idx))} className="ml-2 text-slate-300 hover:text-red-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Marketing consent */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-[#FF6B35] focus:ring-[#FF6B35]"
            />
            <span className="text-xs text-slate-500">
              Send me product updates, deals, and news from {supplierName}. I can unsubscribe at any time.
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_16px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Sending...
              </>
            ) : (
              <>
                Send to {supplierName}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
