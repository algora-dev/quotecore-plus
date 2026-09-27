'use client';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';
import { QcLibrary } from '@/app/components/ui/v2/QcLibrary';
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

export function SaveFromQuote({ workspaceSlug, quote, savedLines: _savedLines, templateName }: Props) {
  const { notify, feedback } = useQcFeedback();
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

      // Successful explicit save only: refresh the library on return, never poll a workspace.
      router.refresh();
      router.push(`/${workspaceSlug}/resources/document-templates?type=quote&kind=quote-header`);
    } catch (error) {
      await notify('Failed to save template: ' + (error as Error).message);
      setSaving(false);
    }
  };

  return (
    <QcLibrary className="min-h-0 bg-slate-50">
      {feedback}
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}/customer-edit`}
            className="qc-flow-link qc-library-control text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Quote Editor
          </Link>
          <h1 className="qc-library-title text-2xl font-semibold text-slate-900 mt-2">
            Save Branding as Template: {templateName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            This will save company details and footer as a reusable template
          </p>
        </div>

        {/* Company Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Company Details for Template</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
              <input aria-label="Company Name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <input aria-label="Phone"
                type="tel"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input aria-label="Email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
              <input aria-label="Address"
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
            className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Info Note */}
        <div className="bg-orange-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Note:</span> This template saves branding only (company details + footer). 
            Component display preferences are controlled by component library defaults.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}/customer-edit`}
            className="qc-button qc-flow-control"
          >
            Cancel
          </Link>
          <button data-qc-variant="primary"
            onClick={handleSave}
            disabled={saving}
            className="qc-button qc-flow-control qc-library-control "
          >
            {saving ? 'Saving Template...' : 'Save Template'}
          </button>
        </div>
      </div>
    </QcLibrary>
  );
}
