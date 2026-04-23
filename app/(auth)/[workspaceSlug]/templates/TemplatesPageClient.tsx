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
              <p className="text-sm text-slate-500">Email templates for sending quotes with acceptance links.</p>
              <button
                onClick={() => setEditingEmailTemplate(null)}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                + Create Template
              </button>
            </div>
            {emailTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">No email templates yet.</p>
              </div>
            ) : (
              <div className="grid gap-1">
                {emailTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setEditingEmailTemplate(template)}
                    title="Click to edit"
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{template.name}</p>
                      {template.is_default && (
                        <span className="text-xs text-orange-600 font-medium">Default</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEmailTemplate(template.id, template.name); }}
                      disabled={deleting === template.id}
                      title="Click to delete"
                      className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'quote' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Reusable quote structures with predefined components.</p>
              <Link
                href={`/${workspaceSlug}/templates/create`}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                + Create Template
              </Link>
            </div>
            {quoteTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">No quote templates yet.</p>
              </div>
            ) : (
              <div className="grid gap-1">
                {quoteTemplates.map((template) => (
                  <Link
                    key={template.id}
                    href={`/${workspaceSlug}/templates/${template.id}/edit`}
                    title="Click to edit"
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{template.name}</p>
                      {template.description && <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>}
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuoteTemplate(template.id, template.name); }}
                      disabled={deleting === template.id}
                      title="Click to delete"
                      className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Branding layouts for customer-facing quotes.</p>
              <Link
                href={`/${workspaceSlug}/customer-quote-templates/create`}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                + Create Template
              </Link>
            </div>
            {customerQuoteTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-500">No customer quote templates yet.</p>
              </div>
            ) : (
              <div className="grid gap-1">
                {customerQuoteTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => !template.is_starter_template ? setEditingCustomerTemplate(template) : setViewingCustomerTemplate(template)}
                    title={template.is_starter_template ? 'Click to view' : 'Click to edit'}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{template.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{template.company_name || 'No company name'}</p>
                      </div>
                      {template.is_starter_template && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Starter</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewingCustomerTemplate(template); }}
                        title="Preview"
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      {!template.is_starter_template && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCustomerTemplate(template.id, template.name); }}
                          disabled={deleting === template.id}
                          title="Click to delete"
                          className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
