'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CustomerQuoteTemplateRow, TemplateRow } from '@/app/lib/types';
import { deleteTemplate, deleteCustomerQuoteTemplate } from './actions';
import { ViewCustomerTemplateModal } from './ViewCustomerTemplateModal';
import { EditCustomerTemplateModal } from './EditCustomerTemplateModal';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { deleteEmailTemplate } from './email-actions';
import type { EmailTemplate } from './email-actions';


interface Props {
  workspaceSlug: string;
  companyId: string;
  quoteTemplates: TemplateRow[];
  customerQuoteTemplates: CustomerQuoteTemplateRow[];
  emailTemplates: EmailTemplate[];
  initialTab: string;
}

export function TemplatesPageClient({ workspaceSlug, companyId, quoteTemplates, customerQuoteTemplates, emailTemplates, initialTab }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'quote' | 'customer' | 'email'>(
    initialTab === 'customer' ? 'customer' : initialTab === 'email' ? 'email' : 'quote'
  );
  
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewingCustomerTemplate, setViewingCustomerTemplate] = useState<CustomerQuoteTemplateRow | null>(null);
  const [editingCustomerTemplate, setEditingCustomerTemplate] = useState<CustomerQuoteTemplateRow | null>(null);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null | undefined>(undefined);

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

  async function handleDeleteEmailTemplate(id: string, name: string) {
    if (!confirm(`Delete email template "${name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteEmailTemplate(id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
          <p className="text-sm text-slate-500 mt-1">Manage quote, customer, and email templates.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
          <button
            onClick={() => setActiveTab('quote')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'quote'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Quote
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'customer'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Customer
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'email'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Email
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'email' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Email templates for sending quotes to customers with acceptance links
              </p>
              <button
                onClick={() => setEditingEmailTemplate(null)}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                + Create Template
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {emailTemplates.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-400 mb-4">No email templates created yet</p>
                  <button
                    onClick={() => setEditingEmailTemplate(null)}
                    className="inline-block px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                  >
                    Create Your First Email Template
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Default</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {emailTemplates.map((template) => (
                      <tr key={template.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">{template.name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {template.subject || '—'}
                        </td>
                        <td className="px-6 py-4">
                          {template.is_default && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              Default
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => setEditingEmailTemplate(template)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white pill-shimmer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEmailTemplate(template.id, template.name)}
                            disabled={deleting === template.id}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-red-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
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
        ) : activeTab === 'quote' ? (
          <div className="space-y-4">
            {/* Header for Quote Templates Tab */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Reusable roof quote structures with predefined components
              </p>
              <Link
                href={`/${workspaceSlug}/templates/create`}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-80 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
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
                    className="inline-block px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-80 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
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
                        <td className="px-6 py-4 text-right space-x-2">
                          <Link
                            href={`/${workspaceSlug}/templates/${template.id}/edit`}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white pill-shimmer"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/${workspaceSlug}/quotes/new?template=${template.id}`}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                          >
                            Use
                          </Link>
                          <button
                            onClick={() => handleDeleteQuoteTemplate(template.id, template.name)}
                            disabled={deleting === template.id}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-red-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
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
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-80 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
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
                    className="inline-block px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-80 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
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
                          <button
                            onClick={() => setViewingCustomerTemplate(template)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white pill-shimmer"
                          >
                            View
                          </button>
                          {!template.is_starter_template && (
                            <>
                              <button
                                onClick={() => setEditingCustomerTemplate(template)}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white pill-shimmer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCustomerTemplate(template.id, template.name)}
                                disabled={deleting === template.id}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-red-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
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

      {/* Modals */}
      {viewingCustomerTemplate && (
        <ViewCustomerTemplateModal
          template={viewingCustomerTemplate}
          onClose={() => setViewingCustomerTemplate(null)}
        />
      )}

      {editingCustomerTemplate && (
        <EditCustomerTemplateModal
          template={editingCustomerTemplate}
          companyId={companyId}
          onClose={() => setEditingCustomerTemplate(null)}
          onSaved={() => {
            setEditingCustomerTemplate(null);
            router.refresh();
          }}
        />
      )}

      {editingEmailTemplate !== undefined && (
        <EmailTemplateEditor
          template={editingEmailTemplate}
          onClose={() => setEditingEmailTemplate(undefined)}
          onSaved={() => {
            setEditingEmailTemplate(undefined);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
