'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { CustomerQuoteTemplateRow } from '@/app/lib/types';

interface Props {
  workspaceSlug: string;
  customerQuoteTemplates: CustomerQuoteTemplateRow[];
  initialTab: string;
}

export function TemplatesPageClient({ workspaceSlug, quoteTemplates, customerQuoteTemplates, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<'quote' | 'customer'>(
    initialTab === 'customer' ? 'customer' : 'quote'
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage quote templates and customer quote branding
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('quote')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'quote'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Quote Templates
            </button>
            <button
              onClick={() => setActiveTab('customer')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customer'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Customer Quote Templates
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'quote' ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-400 mb-4">Quote template management coming soon</p>
            <p className="text-sm text-slate-500">
              (Future: Create reusable quote structures with components)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header for Customer Tab */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Reusable branding layouts for customer-facing quotes
              </p>
              <Link
                href={`/${workspaceSlug}/customer-quote-templates/create`}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Create Template
              </Link>
            </div>

            {/* Customer Quote Templates List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {customerQuoteTemplates.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-400 mb-4">No customer quote templates created yet</p>
                  <Link
                    href={`/${workspaceSlug}/customer-quote-templates/create`}
                    className="inline-block px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Template
                  </Link>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Template Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Company Name
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {customerQuoteTemplates.map((template) => (
                      <tr key={template.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{template.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          {template.is_starter_template ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Starter
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Custom
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {template.company_name || '—'}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button className="text-sm text-blue-600 hover:text-blue-700">
                            View
                          </button>
                          {!template.is_starter_template && (
                            <button className="text-sm text-slate-600 hover:text-slate-700">
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
