'use client';
import { useState } from 'react';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';
import { updateCustomerQuoteTemplate } from './actions';
import { CustomerTemplateLogoUploader } from './CustomerTemplateLogoUploader';

interface Props {
  template: CustomerQuoteTemplateRow;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditCustomerTemplateModal({ template, companyId, onClose, onSaved }: Props) {
  const [name, setName] = useState(template.name);
  const [companyName, setCompanyName] = useState(template.company_name || '');
  const [companyAddress, setCompanyAddress] = useState(template.company_address || '');
  const [companyPhone, setCompanyPhone] = useState(template.company_phone || '');
  const [companyEmail, setCompanyEmail] = useState(template.company_email || '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(template.company_logo_url || '');
  const [footerText, setFooterText] = useState(template.footer_text || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      alert('Template name is required');
      return;
    }

    setSaving(true);
    try {
      await updateCustomerQuoteTemplate(template.id, {
        name,
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        companyLogoUrl,
        footerText,
      });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Edit Template</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>

          {/* Header Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Header Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Logo Uploader */}
            <div className="pt-4 border-t border-slate-200">
              <CustomerTemplateLogoUploader
                companyId={companyId}
                templateId={template.id}
                currentLogoUrl={companyLogoUrl}
                onUploadComplete={(url) => setCompanyLogoUrl(url)}
              />
            </div>
          </div>

          {/* Footer Section */}
          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Footer Text</h3>
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-full hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-5 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
