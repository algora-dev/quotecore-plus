'use client';
import { QcLibrary } from '@/app/components/ui/v2/QcLibrary';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createCustomerQuoteTemplate } from './actions';
import { createClient } from '@/app/lib/supabase/client';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';

interface Props {
  workspaceSlug: string;
  templateName: string;
  /** When true the company is over storage - block logo upload. */
  isOverStorage?: boolean;
  /** Optional source template - prefills the builder when copying an existing header. */
  sourceTemplate?: CustomerQuoteTemplateRow | null;
}

export function TemplateBuilder({ workspaceSlug, templateName, isOverStorage, sourceTemplate }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);

  // Company details (prefilled when copying an existing template)
  const [companyName, setCompanyName] = useState(sourceTemplate?.company_name ?? '');
  const [companyAddress, setCompanyAddress] = useState(sourceTemplate?.company_address ?? '');
  const [companyPhone, setCompanyPhone] = useState(sourceTemplate?.company_phone ?? '');
  const [companyEmail, setCompanyEmail] = useState(sourceTemplate?.company_email ?? '');
  const [footerText, setFooterText] = useState(sourceTemplate?.footer_text ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(sourceTemplate?.company_logo_url ?? null);
  const [uploading, setUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isOverStorage) { setStorageBlocked(true); return; }
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('File too large. Maximum size is 2MB.');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      
      // Use a temporary filename (will be renamed after template creation if needed)
      const fileName = `temp-${Date.now()}.${file.name.split('.').pop()}`;
      const storagePath = fileName;
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(storagePath);

      setLogoUrl(urlData.publicUrl);
    } catch (error) {
      alert('Logo upload failed: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = () => {
    setLogoUrl(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const _templateId = await createCustomerQuoteTemplate({
        name: templateName,
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        footerText,
        companyLogoUrl: logoUrl,
      });

      // Successful explicit save only: refresh the library on return, never poll a workspace.
      router.refresh();
      router.push(`/${workspaceSlug}/resources/document-templates?type=quote&kind=quote-header`);
    } catch (error) {
      alert('Failed to create template: ' + (error as Error).message);
      setSaving(false);
    }
  };

  return (
    <>
    <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
    <QcLibrary className="qc-template-editor">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/${workspaceSlug}/resources/document-templates?type=quote&kind=quote-header`}
            className="qc-flow-link qc-library-control text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back
          </Link>
          <h1 className="qc-library-title text-2xl font-semibold text-slate-900 mt-2">
            {templateName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {sourceTemplate
              ? `Started from "${sourceTemplate.name}" - adjust anything before saving. No quote prices or line items are saved here.`
              : 'Add your company details, logo and footer. No quote prices or line items are saved here.'}
          </p>
        </div>

        {/* Company Details Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Company Details</h2>
          <p className="text-sm text-slate-500">
            These details will appear on customer quotes created with this template
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Name
              </label>
              <input aria-label="Company Name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Company Name"
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input aria-label="Phone"
                type="tel"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="+64 21 123 4567"
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input aria-label="Email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="info@yourcompany.com"
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address
              </label>
              <input aria-label="Address"
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="123 Main Street, City, Country"
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Logo
            </label>
            
            {!logoUrl ? (
              <div className="space-y-2">
                <label
                  htmlFor="logo-upload"
                  className={`block border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-orange-400 transition-colors ${
                    uploading ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">
                      {uploading ? 'Uploading...' : 'Click to upload logo'}
                    </p>
                    <p className="text-xs text-slate-500">
                      PNG, JPG up to 2MB
                    </p>
                  </div>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="qc-flow-file qc-library-control"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center gap-4">
                    <img 
                      src={logoUrl} 
                      alt="Company Logo" 
                      className="h-16 w-auto object-contain"
                    />
                    <button data-qc-variant="ghost"
                      onClick={handleLogoRemove}
                      type="button"
                      className="qc-button qc-flow-control qc-library-control ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Footer / Terms & Conditions</h2>
          <p className="text-sm text-slate-500">
            This text will appear at the bottom of customer quotes (disclaimers, payment terms, etc.)
          </p>

          <textarea aria-label="Footer text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="e.g. Payment due within 30 days. Quote valid for 30 days. All work carried out to industry standards."
            rows={4}
            className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Example content preview</h2>
          <p className="qc-flow-description">Sample values only. Final document styling is provided by Document Studio.</p>
          
          <div className="p-6 bg-slate-50 space-y-4">
            {/* Header */}
            <div className="flex flex-wrap gap-4 justify-between items-start border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">QUOTE #1000</h3>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium">Client:</span> Sample Client</p>
                  <p><span className="font-medium">Job:</span> Sample Job</p>
                  <p><span className="font-medium">Date:</span> {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right text-sm text-slate-700 break-words min-w-0">
                {logoUrl && (
                  <img src={logoUrl} alt="Company Logo" className="h-16 w-auto object-contain mb-3 ml-auto" />
                )}
                <p className="font-semibold">{companyName || 'Your Company Name'}</p>
                <p>{companyAddress || '123 Main Street, City'}</p>
                <p>{companyPhone || '+64 21 123 4567'}</p>
                <p>{companyEmail || 'info@yourcompany.com'}</p>
              </div>
            </div>

            {/* Sample Items */}
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-700">Sample Item 1</span>
                <span className="text-sm font-medium text-slate-900">$500.00</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-700">Sample Item 2</span>
                <span className="text-sm font-medium text-slate-900">$750.00</span>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 pt-4 border-t-2 border-slate-300">
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Subtotal</span>
                <span className="font-medium text-slate-900">$1,250.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Tax (15%)</span>
                <span className="font-medium text-slate-900">$187.50</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t-2 border-slate-300 pt-2">
                <span className="text-slate-900">Total</span>
                <span className="text-slate-900">$1,437.50</span>
              </div>
            </div>

            {/* Footer */}
            {footerText && (
              <div className="pt-4 border-t text-xs text-slate-600 italic">
                {footerText}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4">
          <Link
            href={`/${workspaceSlug}/resources/document-templates?type=quote&kind=quote-header`}
            className="qc-button qc-flow-control"
          >
            Cancel
          </Link>
          <button data-qc-variant="primary"
            onClick={handleSave}
            disabled={saving || !companyName.trim()}
            className="qc-button qc-flow-control qc-library-control "
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </QcLibrary>
    </>
  );
}
