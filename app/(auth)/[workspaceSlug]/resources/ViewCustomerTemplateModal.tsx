'use client';
import '@/app/components/ui/v2/qc-library.css';
import { QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';

interface Props {
  template: CustomerQuoteTemplateRow;
  onClose: () => void;
}

export function ViewCustomerTemplateModal({ template, onClose }: Props) {
  return (
    <QcJourneyDialog label="Header Information" size="lg">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{template.name}</h2>
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
          {/* Header Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Header Information</h3>
            
            <div className="qc-library-field-grid grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Company Name</label>
                <p className="text-sm text-slate-900">{template.company_name || '-'}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                <p className="text-sm text-slate-900">{template.company_phone || '-'}</p>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                <p className="text-sm text-slate-900">{template.company_address || '-'}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <p className="text-sm text-slate-900">{template.company_email || '-'}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Logo URL</label>
                <p className="text-sm text-slate-900 truncate">{template.company_logo_url || '-'}</p>
              </div>
            </div>

            {template.company_logo_url && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Logo Preview</label>
                <img 
                  src={template.company_logo_url} 
                  alt="Company Logo" 
                  className="h-16 object-contain border border-slate-200 rounded p-2"
                />
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Footer Text</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {template.footer_text || '-'}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
          <button data-qc-variant="ghost"
            onClick={onClose}
            className="qc-button qc-flow-control qc-library-control "
          >
            Close
          </button>
        </div>
      </div>
    </QcJourneyDialog>
  );
}
