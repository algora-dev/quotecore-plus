'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { QuoteRow } from '@/app/lib/types';
import { saveQuoteAsTemplate } from './actions';

interface Props {
  workspaceSlug: string;
  quote: QuoteRow;
  savedLines: any[];
  templateName: string;
}

export function SaveFromQuote({ workspaceSlug, quote, savedLines, templateName }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('Your Company Name');
  const [companyAddress, setCompanyAddress] = useState('123 Main Street, City, Country, Postcode');
  const [companyPhone, setCompanyPhone] = useState('+64 21 123 4567');
  const [companyEmail, setCompanyEmail] = useState('info@yourcompany.com');
  const [footerText, setFooterText] = useState(
    'Terms & Conditions: Payment due within 30 days. Quote valid for 30 days from issue date. All work carried out in accordance with industry standards.'
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveQuoteAsTemplate({
        quoteId: quote.id,
        name: templateName,
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        footerText,
      });

      router.push(`/${workspaceSlug}/customer-quote-templates`);
    } catch (error) {
      alert('Failed to save template: ' + (error as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}/customer-edit`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Quote Editor
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">
            Save as Template: {templateName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            This will save your current customer quote layout ({savedLines.length} items) as a reusable template
          </p>
        </div>

        {/* Company Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Company Details for Template</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <input
                type="tel"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Footer / Terms</h2>
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Line Items Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Template will include {savedLines.length} items
          </h2>
          <div className="space-y-1">
            {savedLines.slice(0, 5).map((line, idx) => (
              <div key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                <span className="text-slate-400">•</span>
                <span className="flex-1">{line.custom_text}</span>
                {line.show_price && (
                  <span className="font-medium">${line.custom_amount?.toFixed(2)}</span>
                )}
              </div>
            ))}
            {savedLines.length > 5 && (
              <p className="text-sm text-slate-400 italic">...and {savedLines.length - 5} more</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}/customer-edit`}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Saving Template...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
