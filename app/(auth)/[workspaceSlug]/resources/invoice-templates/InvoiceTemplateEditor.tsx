'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { FileUploader } from '@/app/components/FileUploader';
import { checkStorageQuota, saveFileMetadata } from '@/app/lib/files/storage-actions';
import {
  createInvoiceTemplate,
  updateInvoiceTemplate,
  type InvoiceTemplate,
} from '@/app/(auth)/[workspaceSlug]/invoices/template-actions';

interface Props {
  workspaceSlug: string;
  companyId: string;
  template?: InvoiceTemplate; // undefined = create mode
}

export function InvoiceTemplateEditor({ workspaceSlug, companyId, template }: Props) {
  const router = useRouter();
  const isNew = !template;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const hasQuota = await checkStorageQuota(companyId, file.size);
      if (!hasQuota) throw new Error('Storage quota exceeded.');

      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const fileName = `invoice-template-logo-${template?.id ?? 'new'}.${ext}`;
      const storagePath = `${companyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(storagePath, file, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(storagePath);
      setCompanyLogoUrl(urlData.publicUrl);

      await saveFileMetadata({
        companyId,
        fileType: 'logo',
        fileName,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
      });
    } finally {
      setLogoUploading(false);
    }
  }

  function handleSave() {
    if (!name.trim()) { setError('Template name is required.'); return; }
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

    startTransition(async () => {
      try {
        if (isNew) {
          await createInvoiceTemplate(input);
        } else {
          await updateInvoiceTemplate(template.id, input);
        }
        router.push(`/${workspaceSlug}/resources/invoice-templates`);
      } catch {
        setError('Failed to save template. Please try again.');
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Template name */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Template Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standard UK Invoice, Stripe Pay, Construction"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          autoFocus
        />
        <p className="text-xs text-slate-400">Shown when selecting a template at invoice creation.</p>
      </div>

      {/* ── Header section ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Header</h2>
          <p className="text-sm text-slate-500 mt-0.5">Appears at the top of every invoice using this template.</p>
        </div>

        {/* Logo upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
          <FileUploader
            accept="image/jpeg,image/png,image/webp"
            maxSize={2097152}
            onUpload={handleLogoUpload}
            currentFileUrl={companyLogoUrl || null}
            label="Upload Logo"
            description="PNG, JPG or WebP (max 2 MB). Appears in the dark header."
          />
        </div>

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
            <label className="block text-sm font-medium text-slate-700 mb-1">Footer Text <span className="text-slate-400 font-normal">(opt)</span></label>
            <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. Thank you for your business!"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)}
            rows={3} placeholder="Your business address"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-orange-500 focus:outline-none" />
        </div>

        {/* Live header preview */}
        {(companyName || companyAddress || companyEmail || companyLogoUrl) && (
          <div className="rounded-xl bg-slate-900 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-3 font-semibold">Header preview</p>
            <div className="flex items-start justify-between gap-4">
              <div>
                {companyLogoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={companyLogoUrl} alt="logo" className="h-10 w-auto object-contain mb-2" />
                )}
                <p className="text-xl font-bold text-white">INVOICE</p>
                <p className="text-slate-400 text-xs font-mono mt-0.5">INV-2026-000001</p>
              </div>
              <div className="text-right">
                {companyName && <p className="font-semibold text-white text-sm">{companyName}</p>}
                {companyAddress && <p className="text-slate-400 text-xs whitespace-pre-line mt-0.5">{companyAddress}</p>}
                {companyEmail && <p className="text-slate-400 text-xs">{companyEmail}</p>}
                {companyPhone && <p className="text-slate-400 text-xs">{companyPhone}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Payment details ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payment Details</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Shown in the Payment Instructions section of every invoice. Customers get individual copy buttons for each field.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
            <input type="text" value={payAccountName} onChange={(e) => setPayAccountName(e.target.value)}
              placeholder="e.g. Smith Roofing Ltd"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
            <p className="text-xs text-slate-400 mt-1">Name on your bank account / payment recipient</p>
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

        {/* Payment preview */}
        {(payAccountName || payAccountNumber || paySortCode) && (
          <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">Payment Instructions preview</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Amount Due</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">1,500.00</span>
                  <span className="text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5">Copy</span>
                </div>
              </div>
              {payAccountName && <div className="flex justify-between"><span className="text-slate-500">Account Name</span><div className="flex items-center gap-2"><span className="font-medium">{payAccountName}</span><span className="text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5">Copy</span></div></div>}
              {payBankName && <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="font-medium">{payBankName}</span></div>}
              {payAccountNumber && <div className="flex justify-between"><span className="text-slate-500">Account Number</span><div className="flex items-center gap-2"><span className="font-mono font-medium">{payAccountNumber}</span><span className="text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5">Copy</span></div></div>}
              {paySortCode && <div className="flex justify-between"><span className="text-slate-500">Sort Code</span><div className="flex items-center gap-2"><span className="font-mono font-medium">{paySortCode}</span><span className="text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5">Copy</span></div></div>}
              <div className="flex justify-between border-t border-orange-200 pt-2 mt-2">
                <span className="text-slate-500">Payment Reference</span>
                <div className="flex items-center gap-2"><span className="font-mono text-orange-700">QCP-INV-2026-000001</span><span className="text-xs text-orange-600 border border-orange-300 rounded-full px-2 py-0.5">Copy</span></div>
              </div>
            </div>
            {payLink && <div className="mt-3 rounded-full bg-orange-600 py-2 text-center text-sm font-semibold text-white">Pay Online</div>}
          </div>
        )}
      </div>

      {/* ── Default content ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Default Content</h2>
          <p className="text-sm text-slate-500 mt-0.5">Pre-fills Notes and Terms on every invoice using this template. Still editable per-invoice.</p>
        </div>
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
      </div>

      {/* Actions */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 pb-8">
        <button
          type="button"
          onClick={() => router.push(`/${workspaceSlug}/resources/invoice-templates`)}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || logoUploading || !name.trim()}
          className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          {isPending ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
