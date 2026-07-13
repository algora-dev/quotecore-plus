import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';

export default async function ViewTemplatePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; templateId: string }>;
}) {
  const { workspaceSlug, templateId } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template } = await supabase
    .from('customer_quote_templates')
    .select('*')
    .eq('id', templateId)
    .eq('company_id', profile.company_id)
    .single<CustomerQuoteTemplateRow>();

  if (!template) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${workspaceSlug}/customer-quote-templates`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to Templates
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 mt-2">{template.name}</h1>
            <p className="text-sm text-slate-500 mt-1">Template preview</p>
          </div>
          <Link
            href={`/${workspaceSlug}/customer-quote-templates/${template.id}/edit`}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Edit Template
          </Link>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
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
                {template.company_logo_url && (
                  <img
                    src={template.company_logo_url}
                    alt="Company Logo"
                    className="h-16 w-auto object-contain mb-3 ml-auto"
                  />
                )}
                <p className="font-semibold">{template.company_name || 'Your Company Name'}</p>
                <p>{template.company_address || '123 Main Street, City'}</p>
                <p>{template.company_phone || '+64 21 123 4567'}</p>
                <p>{template.company_email || 'info@yourcompany.com'}</p>
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
            {template.footer_text && (
              <div className="pt-4 border-t text-xs text-slate-600 italic">
                {template.footer_text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
