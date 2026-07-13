'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateCustomerQuoteTemplate } from './actions';
import { createClient } from '@/app/lib/supabase/client';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';

interface Props {
  workspaceSlug: string;
  template: CustomerQuoteTemplateRow;
  isOverStorage?: boolean;
}

export function TemplateEditor({ workspaceSlug, template, isOverStorage }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);

  const [templateName, setTemplateName] = useState(template.name);
  const [nameError, setNameError] = useState('');
  const [companyName, setCompanyName] = useState(template.company_name || '');
  const [companyAddress, setCompanyAddress] = useState(template.company_address || '');
  const [companyPhone, setCompanyPhone] = useState(template.company_phone || '');
  const [companyEmail, setCompanyEmail] = useState(template.company_email || '');
  const [footerText, setFooterText] = useState(template.footer_text || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(template.company_logo_url);
  const [uploading, setUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isOverStorage) { setStorageBlocked(true); return; }
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File too large. Maximum size is 2MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const fileName = `template-${template.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const storagePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

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
    if (!templateName.trim()) {
      setNameError('Template name is required');
      return;
    }

    setSaving(true);
    setNameError('');
    try {
      await updateCustomerQuoteTemplate(template.id, {
        name: templateName,
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        footerText,
        companyLogoUrl: logoUrl,
      });

      router.push(`/${workspaceSlug}/customer-quote-templates`);
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('already exists')) {
        setNameError('A template with this name already exists');
      } else {
        alert('Failed to update template: ' + msg);
      }
      setSaving(false);
    }
  };

  return (
    <>
    <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/${workspaceSlug}/customer-quote-templates`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Templates
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">Edit Template</h1>
        </div>

        {/* Template Name */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => {
              setTemplateName(e.target.value);
              setNameError('');
            }}
            placeholder="e.g. Standard Roofing Quote"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
              nameError
                ? 'border-red-400 focus:ring-red-500'
                : 'border-slate-300 focus:ring-orange-500'
            }`}
          />
          {nameError && (
            <p className="mt-1.5 text-xs text-red-500">{nameError}</p>
          )}
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
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Company Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="+64 21 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="info@yourcompany.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address
              </label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="123 Main Street, City, Country"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                    className="hidden"
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
                    <button
                      onClick={handleLogoRemove}
                      type="button"
                      className="ml-auto px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-full hover:bg-red-50"
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

          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="e.g. Payment due within 30 days. Quote valid for 30 days. All work carried out to industry standards."
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Preview</h2>

          <div className="p-6 bg-slate-50 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">QUOTE #1000</h3>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium">Client:</span> Sample Client</p>
                  <p><span className="font-medium">Job:</span> Sample Job</p>
                  <p><span className="font-medium">Date:</span> {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right text-sm text-slate-700">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="h-16 w-auto object-contain mb-3 ml-auto"
                  />
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
            href={`/${workspaceSlug}/customer-quote-templates`}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
