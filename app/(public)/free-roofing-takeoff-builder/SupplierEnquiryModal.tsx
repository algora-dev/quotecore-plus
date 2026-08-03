'use client';

import { useState, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { COMPONENT_DEFS } from './calc';
import { componentLabel } from './helpers';

interface SupplierEnquiryModalProps {
  supplierName: string;
  supplierSlug: string;
  resultToken?: string;
  resultUrl?: string;
  totals?: Record<string, any>;
  sections?: Record<string, any>;
  allKeys?: string[];
  getComponentById?: (id: string | null) => any;
  currency?: string;
  onClose: () => void;
}

type Intent = 'detailed_quote' | 'order_request' | 'pricing_question' | 'general_enquiry';

const intentOptions: { value: Intent; label: string; desc: string }[] = [
  { value: 'detailed_quote', label: 'Detailed Quote', desc: 'Ask the supplier for a full formal quote' },
  { value: 'order_request', label: 'Order Request', desc: 'I want to order these materials' },
  { value: 'pricing_question', label: 'Pricing Question', desc: 'Ask about pricing or better rates' },
  { value: 'general_enquiry', label: 'General Enquiry', desc: 'Something else' },
];

export function SupplierEnquiryModal({
  supplierName,
  supplierSlug,
  resultToken,
  resultUrl,
  totals,
  sections,
  allKeys,
  getComponentById,
  currency,
  onClose,
}: SupplierEnquiryModalProps) {
  console.log('[SupplierEnquiryModal] resultUrl:', resultUrl, 'resultToken:', resultToken);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [intent, setIntent] = useState<Intent>('detailed_quote');
  const [message, setMessage] = useState('');
  const [includeQuantities, setIncludeQuantities] = useState(true);
  const [includePricing, setIncludePricing] = useState(true);
  const [includeResultLink, setIncludeResultLink] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = emailRegex.test(email);
  const nameValid = name.trim().length >= 2;
  const canSend = nameValid && emailValid && !sending;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const valid = selected.filter(f => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024);
    const combined = [...files, ...valid].slice(0, 5);
    setFiles(combined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);

    try {
      // Upload files first if any
      let attachmentIds: string[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await fetch('/api/free-tools/supplier-enquiry', {
            method: 'PUT',
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadData.ok && uploadData.fileId) {
            attachmentIds.push(uploadData.fileId);
          }
        }
      }

      // Build enriched totals with component details
      const enrichedTotals: Record<string, any> = {};
      if (totals && allKeys) {
        for (const key of allKeys) {
          const t = totals[key];
          if (!t || t.count === 0) continue;
          const section = sections?.[key];
          const def = COMPONENT_DEFS[key];
          const label = componentLabel(key, section?.customDef);
          const unit = def?.unit || (section?.customDef?.measurementType === 'linear' ? 'm' : section?.customDef?.measurementType === 'area' ? 'm\u00B2' : 'ea');
          // Get component name from first entry
          let componentName = label;
          if (section?.entries?.[0]?.selectedComponentId && getComponentById) {
            const comp = getComponentById(section.entries[0].selectedComponentId);
            if (comp?.name) componentName = comp.name;
          }
          enrichedTotals[key] = {
            label: componentName,
            rawTotal: Number(t.rawTotal?.toFixed(2) ?? 0),
            withWaste: Number(t.withWaste?.toFixed(2) ?? 0),
            count: t.count,
            unit: unit,
            materialCost: Number(t.materialCost?.toFixed(2) ?? 0),
            labourCost: Number(t.labourCost?.toFixed(2) ?? 0),
            totalCost: Number(t.totalCost?.toFixed(2) ?? 0),
            wastePercent: section?.wastePercent ?? 0,
          };
        }
      }

      // Submit enquiry
      const res = await fetch('/api/free-tools/supplier-enquiry', {
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
          includeResultLink,
          resultToken,
          resultUrl,
          totals: enrichedTotals,
          currency,
          marketingConsent,
          attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSent(true);
        trackEvent('supplier_enquiry_sent', {
          supplier: supplierSlug,
          intent,
          has_attachments: files.length > 0 ? 1 : 0,
          marketing_consent: marketingConsent ? 1 : 0,
        });
      } else {
        setError(data.error || 'Failed to send enquiry. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSending(false);
    }
  };

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
              <label htmlFor="enquiry-name" className="block text-xs font-medium text-slate-600 mb-1">Your name *</label>
              <input
                id="enquiry-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label htmlFor="enquiry-email" className="block text-xs font-medium text-slate-600 mb-1">Your email *</label>
              <input
                id="enquiry-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${email && !emailValid ? 'border-red-300 focus:border-red-500' : 'border-slate-300 focus:border-orange-500'}`}
                placeholder="john@example.com"
              />
              {email && !emailValid && <p className="mt-1 text-xs text-red-500">Please enter a valid email address.</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="enquiry-phone" className="block text-xs font-medium text-slate-600 mb-1">Phone (optional)</label>
            <input
              id="enquiry-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
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
                  className={`text-left rounded-lg border p-2.5 transition ${intent === opt.value ? 'border-[#FF6B35] bg-orange-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xs font-semibold text-slate-900">{opt.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="enquiry-message" className="block text-xs font-medium text-slate-600 mb-1">Message</label>
            <textarea
              id="enquiry-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={5000}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none resize-none"
              placeholder="Hi, I've estimated my roof takeoff using your pricing. Can you provide a formal quote? I've attached the roof plan..."
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeResultLink} onChange={(e) => setIncludeResultLink(e.target.checked)} className="rounded border-slate-300 text-[#FF6B35] focus:ring-[#FF6B35]" />
              <span className="text-xs text-slate-600">Link to full takeoff result</span>
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
                    <button onClick={() => removeFile(idx)} className="ml-2 text-slate-300 hover:text-red-500">
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
              Send me product updates, deals, and news from QuoteCore+. I can unsubscribe at any time.
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
