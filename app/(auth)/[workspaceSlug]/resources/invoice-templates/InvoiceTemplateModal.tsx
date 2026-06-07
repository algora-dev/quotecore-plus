'use client';
import { useState, useEffect } from 'react';
import {
  createInvoiceTemplate,
  updateInvoiceTemplate,
  type InvoiceTemplate,
} from '@/app/(auth)/[workspaceSlug]/invoices/template-actions';

interface Props {
  template: InvoiceTemplate | null; // null = create mode
  onSaved: (saved: InvoiceTemplate) => void;
  onClose: () => void;
}

type Tab = 'header' | 'payment' | 'defaults';

export function InvoiceTemplateModal({ template, onSaved, onClose }: Props) {
  const isNew = !template;

  // Form state
  const [name, setName] = useState(template?.name ?? '');
  const [companyName, setCompanyName] = useState(template?.company_name ?? '');
  const [companyAddress, setCompanyAddress] = useState(template?.company_address ?? '');
  const [companyEmail, setCompanyEmail] = useState(template?.company_email ?? '');
  const [companyPhone, setCompanyPhone] = useState(template?.company_phone ?? '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(template?.company_logo_url ?? '');
  const [footerText, setFooterText] = useState(template?.footer_text ?? '');
  const [payAccountName, setPayAccountName] = useState(template?.payment_account_name ?? '');
  const [payBankName, setPayBankName] = useState(template?.payment_bank_name ?? '');
  const [payAccountNumber, setPayAccountNumber] = useState(template?.payment_account_number ?? '');
  const [paySortCode, setPaySortCode] = useState(template?.payment_sort_code ?? '');
  const [payLink, setPayLink] = useState(template?.payment_link ?? '');
  const [defaultNotes, setDefaultNotes] = useState(template?.default_notes ?? '');
  const [defaultTerms, setDefaultTerms] = useState(template?.default_terms ?? '');

  const [tab, setTab] = useState<Tab>('header');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim()) { setError('Template name is required.'); return; }
    setSaving(true);
    setError(null);
    const input = {
      name: name.trim(),
      company_name: companyName || null,
      company_address: companyAddress || null,
      company_email: companyEmail || null,
      company_phone: companyPhone || null,
      company_logo_url: companyLogoUrl || null,
      footer_text: footerText || null,
      payment_account_name: payAccountName || null,
      payment_bank_name: payBankName || null,
      payment_account_number: payAccountNumber || null,
      payment_sort_code: paySortCode || null,
      payment_link: payLink || null,
      default_notes: defaultNotes || null,
      default_terms: defaultTerms || null,
    };
    try {
      if (isNew) {
        const id = await createInvoiceTemplate(input);
        onSaved({ ...input, id, company_id: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as InvoiceTemplate);
      } else {
        await updateInvoiceTemplate(template.id, input);
        onSaved({ ...template, ...input, updated_at: new Date().toISOString() });
      }
    } catch {
      setError('Failed to save template. Please try again.');
      setSaving(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'header', label: 'Header' },
    { key: 'payment', label: 'Payment Details' },
    { key: 'defaults', label: 'Defaults' },
  ];

  const hasPayment = payAccountName || payAccountNumber || paySortCode;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center backdrop-blur-sm bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? 'New Invoice Template' : `Edit — ${template.name}`}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Template name */}
        <div className="px-6 pt-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard UK Invoice, Stripe Pay, etc."
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-slate-200 mt-5 px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`py-2.5 px-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* ── Header tab ── */}
          {tab === 'header' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Smith Roofing Ltd"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="hello@business.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="+44 7700 000000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL <span className="text-slate-400 font-normal">(opt)</span></label>
                  <input type="url" value={companyLogoUrl} onChange={(e) => setCompanyLogoUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)}
                  rows={3} placeholder="Your business address"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Footer Text <span className="text-slate-400 font-normal">(opt)</span></label>
                <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)}
                  placeholder="e.g. Thank you for your business!"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
              </div>

              {/* Live preview */}
              {(companyName || companyAddress || companyEmail) && (
                <div className="rounded-xl bg-slate-900 p-4 text-sm">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-3 font-semibold">Header preview</p>
                  {companyLogoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={companyLogoUrl} alt="logo" className="h-8 w-auto object-contain mb-2" />
                  )}
                  {companyName && <p className="font-semibold text-white">{companyName}</p>}
                  {companyAddress && <p className="text-slate-400 text-xs whitespace-pre-line mt-0.5">{companyAddress}</p>}
                  {companyEmail && <p className="text-slate-400 text-xs">{companyEmail}</p>}
                  {companyPhone && <p className="text-slate-400 text-xs">{companyPhone}</p>}
                </div>
              )}
            </>
          )}

          {/* ── Payment Details tab ── */}
          {tab === 'payment' && (
            <>
              <p className="text-sm text-slate-500">
                These appear in the <strong>Payment Instructions</strong> section of every invoice using this template. Customers see individual copy buttons for each field.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
                  <input type="text" value={payAccountName} onChange={(e) => setPayAccountName(e.target.value)}
                    placeholder="e.g. Smith Roofing Ltd"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                  <p className="text-xs text-slate-400 mt-1">The name on your bank account / payment recipient</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                  <input type="text" value={payBankName} onChange={(e) => setPayBankName(e.target.value)}
                    placeholder="e.g. Barclays"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                  <input type="text" value={payAccountNumber} onChange={(e) => setPayAccountNumber(e.target.value)}
                    placeholder="12345678"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Code</label>
                  <input type="text" value={paySortCode} onChange={(e) => setPaySortCode(e.target.value)}
                    placeholder="00-00-00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Link <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="url" value={payLink} onChange={(e) => setPayLink(e.target.value)}
                  placeholder="https://pay.stripe.com/… or paypal.me/…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                <p className="text-xs text-slate-400 mt-1">Shown as a &ldquo;Pay Online&rdquo; button on the invoice</p>
              </div>

              {/* Preview */}
              {hasPayment && (
                <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">Payment Instructions preview</p>
                  <div className="space-y-2 text-sm">
                    {payAccountName && (
                      <div className="flex justify-between"><span className="text-slate-500">Account Name</span><span className="font-medium">{payAccountName}</span></div>
                    )}
                    {payBankName && (
                      <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="font-medium">{payBankName}</span></div>
                    )}
                    {payAccountNumber && (
                      <div className="flex justify-between"><span className="text-slate-500">Account Number</span><span className="font-mono font-medium">{payAccountNumber}</span></div>
                    )}
                    {paySortCode && (
                      <div className="flex justify-between"><span className="text-slate-500">Sort Code</span><span className="font-mono font-medium">{paySortCode}</span></div>
                    )}
                    <div className="flex justify-between border-t border-orange-200 pt-2 mt-2">
                      <span className="text-slate-500">Payment Reference</span><span className="font-mono text-orange-700">QCP-INV-YYYY-NNNNNN</span>
                    </div>
                  </div>
                  {payLink && (
                    <div className="mt-3 rounded-full bg-orange-600 py-2 text-center text-sm font-semibold text-white">Pay Online</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Defaults tab ── */}
          {tab === 'defaults' && (
            <>
              <p className="text-sm text-slate-500">
                These pre-fill the Notes and Terms fields on every invoice using this template. Still editable per-invoice.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Notes</label>
                <textarea value={defaultNotes} onChange={(e) => setDefaultNotes(e.target.value)}
                  rows={4} placeholder="e.g. All prices include VAT. Thank you for your business."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Terms</label>
                <textarea value={defaultTerms} onChange={(e) => setDefaultTerms(e.target.value)}
                  rows={4} placeholder="e.g. Payment due within 14 days of invoice date. Late payment fees may apply."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-orange-500 focus:outline-none" />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {error && <p className="px-6 text-sm text-red-600">{error}</p>}
        <div className="px-6 pb-5 flex gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !name.trim()}
            className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all">
            {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
