'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/app/lib/currency/currencies';

interface CustomerLine {
  id: string;
  custom_text: string;
  custom_amount: number | null;
  show_price: boolean;
  is_visible: boolean;
  include_in_total: boolean;
}

interface Props {
  workspaceSlug: string;
  quoteId: string;
  customerLines: CustomerLine[];
  hasCustomerQuote: boolean;
  quote: {
    quote_number: number | null;
    customer_name: string;
    job_name: string | null;
    site_address: string | null;
    created_at: string;
    tax_rate: number;
    cq_company_name: string | null;
    cq_company_address: string | null;
    cq_company_phone: string | null;
    cq_company_email: string | null;
    cq_company_logo_url: string | null;
    cq_footer_text: string | null;
  };
  effectiveCurrency: string;
  hasLaborSheet: boolean;
  laborLines: CustomerLine[];
  children: ReactNode;
  summaryActions: ReactNode;
}

export function SummaryTabs({
  workspaceSlug,
  quoteId,
  customerLines,
  hasCustomerQuote,
  quote,
  effectiveCurrency,
  hasLaborSheet,
  laborLines,
  children,
  summaryActions,
}: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'customer' | 'labor'>('summary');

  return (
    <>
      {/* Tabs + Context Actions */}
      <div className="flex items-center justify-between data-exclude-pdf">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'customer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Customer Quote
          </button>
          <button
            onClick={() => setActiveTab('labor')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'labor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Labor Sheet
          </button>
        </div>

        {/* Contextual actions per tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'summary' && summaryActions}
          {activeTab === 'customer' && hasCustomerQuote && (
            <Link
              href={`/${workspaceSlug}/quotes/${quoteId}/customer-edit`}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 bg-white hover:bg-slate-50 transition pill-shimmer"
            >
              Edit Customer Quote
            </Link>
          )}
          {activeTab === 'labor' && hasLaborSheet && (
            <Link
              href={`/${workspaceSlug}/quotes/${quoteId}/labor-sheet`}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 bg-white hover:bg-slate-50 transition pill-shimmer"
            >
              Edit Labor Sheet
            </Link>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && children}

      {activeTab === 'customer' && (
        <CustomerQuotePreview
          workspaceSlug={workspaceSlug}
          quoteId={quoteId}
          hasCustomerQuote={hasCustomerQuote}
          customerLines={customerLines}
          quote={quote}
          effectiveCurrency={effectiveCurrency}
        />
      )}

      {activeTab === 'labor' && (
        <LaborSheetPreview
          workspaceSlug={workspaceSlug}
          quoteId={quoteId}
          hasLaborSheet={hasLaborSheet}
          laborLines={laborLines}
          quote={quote}
          effectiveCurrency={effectiveCurrency}
        />
      )}
    </>
  );
}

function CustomerQuotePreview({
  workspaceSlug,
  quoteId,
  hasCustomerQuote,
  customerLines,
  quote,
  effectiveCurrency,
}: {
  workspaceSlug: string;
  quoteId: string;
  hasCustomerQuote: boolean;
  customerLines: CustomerLine[];
  quote: Props['quote'];
  effectiveCurrency: string;
}) {
  if (!hasCustomerQuote) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500 mb-3">No customer quote created yet.</p>
        <Link
          href={`/${workspaceSlug}/quotes/${quoteId}/customer-edit`}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          Create Customer Quote
        </Link>
      </div>
    );
  }

  const visibleLines = customerLines.filter(l => l.is_visible);
  const subtotal = customerLines.filter(l => l.include_in_total).reduce((sum, l) => sum + (l.custom_amount || 0), 0);
  const tax = subtotal * (quote.tax_rate / 100);
  const total = subtotal + tax;

  return (
    <div>
      <div className="bg-white rounded-xl border border-black p-12 space-y-8">
        {/* Header */}
        <div className="border-b-2 border-black pb-6 mb-6">
          <div className="flex justify-end mb-6">
            {quote.cq_company_logo_url ? (
              <img src={quote.cq_company_logo_url} alt="Logo" className="h-16 object-contain" />
            ) : (
              <div className="w-32 h-16 border-2 border-dashed border-black rounded flex items-center justify-center">
                <span className="text-xs text-black">Logo</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-black mb-4">QUOTE #{quote.quote_number || 'DRAFT'}</h1>
              <div className="space-y-2">
                <p className="text-base text-black"><span className="font-semibold">Client:</span> {quote.customer_name}</p>
                {quote.job_name && <p className="text-base text-black"><span className="font-semibold">Job:</span> {quote.job_name}</p>}
                {quote.site_address && <p className="text-base text-black"><span className="font-semibold">Site:</span> {quote.site_address}</p>}
                <p className="text-base text-black"><span className="font-semibold">Date:</span> {new Date(quote.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            {(quote.cq_company_name || quote.cq_company_address || quote.cq_company_phone || quote.cq_company_email) && (
              <div className="text-right space-y-1">
                {quote.cq_company_name && <p className="font-semibold text-base text-black">{quote.cq_company_name}</p>}
                {quote.cq_company_address && <p className="text-sm text-black">{quote.cq_company_address}</p>}
                {quote.cq_company_phone && <p className="text-sm text-black">{quote.cq_company_phone}</p>}
                {quote.cq_company_email && <p className="text-sm text-black">{quote.cq_company_email}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-3">
          {visibleLines.map(line => (
            <div key={line.id} className="flex items-start justify-between py-3 border-b border-black">
              <p className="text-black">{line.custom_text}</p>
              {line.show_price && (
                <p className="text-black font-medium whitespace-nowrap ml-4">
                  {formatCurrency(line.custom_amount || 0, effectiveCurrency)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Totals */}
        {visibleLines.length > 0 && (
          <div className="space-y-3 pt-4 border-t-2 border-black">
            <div className="flex justify-between text-base">
              <span className="text-black">Subtotal</span>
              <span className="font-medium text-black">{formatCurrency(subtotal, effectiveCurrency)}</span>
            </div>
            {quote.tax_rate > 0 && (
              <div className="flex justify-between text-base">
                <span className="text-black">Tax ({quote.tax_rate}%)</span>
                <span className="font-medium text-black">{formatCurrency(tax, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold border-t-2 border-black pt-3">
              <span className="text-black">Total</span>
              <span className="text-black">{formatCurrency(total, effectiveCurrency)}</span>
            </div>
          </div>
        )}

        {quote.cq_footer_text && (
          <div className="pt-6 border-t border-black">
            <p className="text-sm text-black italic whitespace-pre-wrap">{quote.cq_footer_text}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LaborSheetPreview({
  workspaceSlug,
  quoteId,
  hasLaborSheet,
  laborLines,
  quote,
  effectiveCurrency,
}: {
  workspaceSlug: string;
  quoteId: string;
  hasLaborSheet: boolean;
  laborLines: CustomerLine[];
  quote: Props['quote'];
  effectiveCurrency: string;
}) {
  if (!hasLaborSheet) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500 mb-3">No labor sheet created yet.</p>
        <Link
          href={`/${workspaceSlug}/quotes/${quoteId}/labor-sheet`}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          Create Labor Sheet
        </Link>
      </div>
    );
  }

  const visibleLines = laborLines.filter(l => l.is_visible);
  const subtotal = laborLines.filter(l => l.include_in_total).reduce((sum, l) => sum + (l.custom_amount || 0), 0);
  const tax = subtotal * (quote.tax_rate / 100);
  const total = subtotal + tax;

  return (
    <div>
      <div className="bg-white rounded-xl border border-black p-12 space-y-8">
        <div className="border-b-2 border-black pb-6">
          <h1 className="text-xl font-bold text-black mb-4">LABOR SHEET — Quote #{quote.quote_number || 'DRAFT'}</h1>
          <p className="text-base text-black"><span className="font-semibold">Client:</span> {quote.customer_name}</p>
          {quote.job_name && <p className="text-base text-black"><span className="font-semibold">Job:</span> {quote.job_name}</p>}
        </div>

        <div className="space-y-3">
          {visibleLines.map(line => (
            <div key={line.id} className="flex items-start justify-between py-3 border-b border-black">
              <p className="text-black">{line.custom_text}</p>
              {line.show_price && (
                <p className="text-black font-medium whitespace-nowrap ml-4">
                  {formatCurrency(line.custom_amount || 0, effectiveCurrency)}
                </p>
              )}
            </div>
          ))}
        </div>

        {visibleLines.length > 0 && (
          <div className="space-y-3 pt-4 border-t-2 border-black">
            <div className="flex justify-between text-base">
              <span className="text-black">Subtotal</span>
              <span className="font-medium text-black">{formatCurrency(subtotal, effectiveCurrency)}</span>
            </div>
            {quote.tax_rate > 0 && (
              <div className="flex justify-between text-base">
                <span className="text-black">Tax ({quote.tax_rate}%)</span>
                <span className="font-medium text-black">{formatCurrency(tax, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold border-t-2 border-black pt-3">
              <span className="text-black">Total</span>
              <span className="text-black">{formatCurrency(total, effectiveCurrency)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
