'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CustomerQuoteTemplateRow, TemplateRow } from '@/app/lib/types';
import { deleteTemplate, deleteCustomerQuoteTemplate } from './actions';

interface Props {
  workspaceSlug: string;
  quoteTemplates: TemplateRow[];
  customerQuoteTemplates: CustomerQuoteTemplateRow[];
  initialTab: string;
}

export function TemplatesPageClient({ workspaceSlug, quoteTemplates, customerQuoteTemplates, initialTab }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'quote' | 'customer'>(
    initialTab === 'customer' ? 'customer' : 'quote'
  );
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDeleteQuoteTemplate(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteTemplate(id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteCustomerTemplate(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteCustomerQuoteTemplate(id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(null);
    }
  }

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
          <div className="space-y-4">
            {/* Header for Quote Templates Tab */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Reusable roof quote structures with predefined components
              </p>
              <Link
                href={`/${workspaceSlug}/templates/create`}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Create Template
              </Link>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {quoteTemplates.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-400 mb-4">No quote templates created yet</p>
                  <Link
                    href={`/${workspaceSlug}/templates/create`}
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
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {quoteTemplates.map((template) => (
                      <tr key={template.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{template.name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {template.description || '—'}
                        </td>
                        <td className="px-6 py-4">
                          {template.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Link
                            href={`/${workspaceSlug}/templates/${template.id}/edit`}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/${workspaceSlug}/quotes/create?template=${template.id}`}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 hover:bg-green-200"
                          >
                            Use
                          </Link>
                          <button
                            onClick={() => handleDeleteQuoteTemplate(template.id, template.name)}
                            disabled={deleting === template.id}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
                          >
                            {deleting === template.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
                          <button className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200">
                            View
                          </button>
                          {!template.is_starter_template && (
                            <>
                              <button className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200">
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCustomerTemplate(template.id, template.name)}
                                disabled={deleting === template.id}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
                              >
                                {deleting === template.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </>
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
