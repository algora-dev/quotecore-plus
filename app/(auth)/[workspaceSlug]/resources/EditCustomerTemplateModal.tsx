'use client';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';
import '@/app/components/ui/v2/qc-library.css';
import { QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { useState, useRef, useId } from 'react';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';
import { updateCustomerQuoteTemplate } from './actions';
import { CustomerTemplateLogoUploader } from './CustomerTemplateLogoUploader';

interface Props {
  template: CustomerQuoteTemplateRow;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
  /** When true the company is over storage - block logo upload. */
  isOverStorage?: boolean;
}

export function EditCustomerTemplateModal({ template, companyId, onClose, onSaved, isOverStorage }: Props) {
  const nameErrorId = useId();
  const [nameError, setNameError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const { notify, feedback } = useQcFeedback();
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
      setNameError('Enter a template name.');
      nameRef.current?.focus();
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
      await notify(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <QcJourneyDialog label="Edit Template" size="lg">
      {feedback}
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Edit Template</h2>
          <button aria-label="Close" data-qc-variant="ghost"
            onClick={onClose}
            className="qc-button qc-flow-control qc-library-control "
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
            <input aria-label="Template Name" ref={nameRef} aria-invalid={!!nameError} aria-describedby={nameError ? nameErrorId : undefined}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
              {nameError && <p id={nameErrorId} className="qc-flow-error" role="alert">{nameError}</p>}
          </div>

          {/* Header Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Header Information</h3>
            
            <div className="qc-library-field-grid grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input aria-label="Company Name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input aria-label="Phone"
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input aria-label="Address"
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input aria-label="Email"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                isOverStorage={isOverStorage}
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
              className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button data-qc-variant="ghost"
            onClick={onClose}
            className="qc-button qc-flow-control qc-library-control "
          >
            Cancel
          </button>
          <button data-qc-variant="primary"
            onClick={handleSave}
            disabled={saving}
            className="qc-button qc-flow-control qc-library-control "
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </QcJourneyDialog>
  );
}
