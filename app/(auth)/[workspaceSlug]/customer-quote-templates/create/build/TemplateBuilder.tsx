'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';
import { createCustomerQuoteTemplate } from './actions';

interface Props {
  workspaceSlug: string;
  templateName: string;
  useStarter: boolean;
  starterTemplate: CustomerQuoteTemplateRow | null;
}

export function TemplateBuilder({ workspaceSlug, templateName, useStarter, starterTemplate }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Company details (pre-filled from starter if applicable)
  const [companyName, setCompanyName] = useState(
    useStarter && starterTemplate ? starterTemplate.company_name || '' : ''
  );
  const [companyAddress, setCompanyAddress] = useState(
    useStarter && starterTemplate ? starterTemplate.company_address || '' : ''
  );
  const [companyPhone, setCompanyPhone] = useState(
    useStarter && starterTemplate ? starterTemplate.company_phone || '' : ''
  );
  const [companyEmail, setCompanyEmail] = useState(
    useStarter && starterTemplate ? starterTemplate.company_email || '' : ''
  );
  const [footerText, setFooterText] = useState(
    useStarter && starterTemplate ? starterTemplate.footer_text || '' : ''
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const templateId = await createCustomerQuoteTemplate({
        name: templateName,
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        footerText,
      });

      router.push(`/${workspaceSlug}/customer-quote-templates`);
    } catch (error) {
      alert('Failed to create template: ' + (error as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/${workspaceSlug}/customer-quote-templates/create`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">
            {templateName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {useStarter ? 'Customize starter template details' : 'Build your customer quote template'}
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
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Company Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Logo Upload (Future) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Logo
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <p className="text-sm text-slate-500">Logo upload coming soon</p>
            </div>
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
          
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50 space-y-4">
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
            href={`/${workspaceSlug}/customer-quote-templates/create`}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !companyName.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
