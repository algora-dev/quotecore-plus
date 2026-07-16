'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CustomerQuoteTemplateRow, TemplateRow, MaterialOrderTemplateRow } from '@/app/lib/types';
import { deleteTemplate, deleteCustomerQuoteTemplate } from './actions';
import { ViewCustomerTemplateModal } from './ViewCustomerTemplateModal';
import { EditCustomerTemplateModal } from './EditCustomerTemplateModal';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { deleteEmailTemplate } from './email-actions';
import type { EmailTemplate } from './email-actions';
import { AttachmentsTab } from '../attachments/AttachmentsTab';
import type { AttachmentRow } from '../attachments/actions';
import { TemplateManager } from '../material-orders/template-manager-new';
import { CatalogList } from '../catalogs/catalog-list';
import type { CatalogRow } from '../catalogs/actions';

interface Props {
  workspaceSlug: string;
  companyId: string;
  quoteTemplates: TemplateRow[];
  customerQuoteTemplates: CustomerQuoteTemplateRow[];
  emailTemplates: EmailTemplate[];
  attachments: AttachmentRow[];
  attachmentEntitlements: {
    attachmentsEnabled: boolean;
    attachmentLimit: number | null;
    attachmentCount: number;
    isActive: boolean;
    effectivePlanCode: string;
    isOverStorage?: boolean;
  };
  orderTemplates: MaterialOrderTemplateRow[];
  catalogs: CatalogRow[];
  catalogsEnabled: boolean;
  catalogLimit: number | null;
  catalogCount: number;
  catalogEffectivePlanCode: string;
  catalogSubscriptionActive: boolean;
  initialTab: string;
  /** When true, render a single section with no tab bar (sub-route mode). */
  hideTabBar?: boolean;
}

export function TemplatesPageClient({
  workspaceSlug,
  companyId,
  quoteTemplates,
  customerQuoteTemplates,
  emailTemplates,
  attachments,
  attachmentEntitlements,
  orderTemplates,
  catalogs,
  catalogsEnabled,
  catalogLimit,
  catalogCount,
  catalogEffectivePlanCode,
  catalogSubscriptionActive,
  initialTab,
  hideTabBar = false,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'quote' | 'customer' | 'email' | 'order' | 'catalogs' | 'attachments'>(
    initialTab === 'customer' ? 'customer'
    : initialTab === 'email' ? 'email'
    : initialTab === 'order' ? 'order'
    : initialTab === 'catalogs' ? 'catalogs'
    : initialTab === 'attachments' ? 'attachments'
    : 'quote'
  );

  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewingCustomerTemplate, setViewingCustomerTemplate] = useState<CustomerQuoteTemplateRow | null>(null);
  const [editingCustomerTemplate, setEditingCustomerTemplate] = useState<CustomerQuoteTemplateRow | null>(null);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null | undefined>(undefined);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = useState<'quote' | 'customer' | 'email' | null>(null);
  const [showOrderTemplatesModal, setShowOrderTemplatesModal] = useState(false);

  function requestDelete(id: string, type: 'quote' | 'customer' | 'email') {
    setPendingDeleteId(id);
    setPendingDeleteType(type);
  }

  async function confirmDelete() {
    if (!pendingDeleteId || !pendingDeleteType) return;
    setDeleting(pendingDeleteId);
    try {
      if (pendingDeleteType === 'quote') await deleteTemplate(pendingDeleteId);
      else if (pendingDeleteType === 'customer') await deleteCustomerQuoteTemplate(pendingDeleteId);
      else await deleteEmailTemplate(pendingDeleteId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
      setPendingDeleteId(null);
      setPendingDeleteType(null);
    }
  }

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'quote', label: 'Quote Templates' },
    { key: 'customer', label: 'Customer quote templates' },
    { key: 'email', label: 'Message Templates' },
    { key: 'order', label: 'Order Header Templates' },
    { key: 'catalogs', label: 'Catalogs' },
    { key: 'attachments', label: 'Attachments' },
  ];

  const activeTabLabel = TABS.find(t => t.key === activeTab)?.label ?? 'Resource Library';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{hideTabBar ? activeTabLabel : 'Resource Library'}</h1>
        {!hideTabBar && (
          <p className="text-sm text-slate-500 mt-1">Manage quote, message, and order templates, catalog files, and your attachment library.</p>
        )}
      </div>

      {/* Tabs (hidden in sub-route mode) */}
      {!hideTabBar && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.key}
              data-copilot={`resources-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-orange-600 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'attachments' ? (
        <AttachmentsTab
          workspaceSlug={workspaceSlug}
          attachments={attachments}
          entitlements={attachmentEntitlements}
        />
      ) : activeTab === 'catalogs' ? (
        <CatalogList
          initialCatalogs={catalogs}
          workspaceSlug={workspaceSlug}
          catalogsEnabled={catalogsEnabled}
          catalogLimit={catalogLimit}
          catalogCount={catalogCount}
          effectivePlanCode={catalogEffectivePlanCode}
          subscriptionActive={catalogSubscriptionActive}
          isOverStorage={attachmentEntitlements.isOverStorage}
        />
      ) : activeTab === 'order' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Reusable supplier info and order defaults for faster material order creation.</p>
            <button
              onClick={() => setShowOrderTemplatesModal(true)}
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              {orderTemplates.length > 0 ? 'Manage Templates' : '+ Create Template'}
            </button>
          </div>
          {orderTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
              <p className="text-sm text-slate-500">No order templates yet.</p>
            </div>
          ) : (
            <div className="grid gap-1">
              {orderTemplates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setShowOrderTemplatesModal(true)}
                  title="Click to manage"
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{t.name}</p>
                    {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                    {(t.default_supplier_name || t.default_from_company) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[
                          t.default_supplier_name ? `To: ${t.default_supplier_name}` : null,
                          t.default_from_company ? `From: ${t.default_from_company}` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {showOrderTemplatesModal && (
            <TemplateManager
              initialTemplates={orderTemplates}
              onClose={() => {
                setShowOrderTemplatesModal(false);
                router.refresh();
              }}
              isOverStorage={attachmentEntitlements.isOverStorage}
            />
          )}
        </div>
      ) : activeTab === 'email' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Message templates for sending quotes, orders, and follow-ups directly from the app.</p>
            <button
              onClick={() => setEditingEmailTemplate(null)}
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              + Create Template
            </button>
          </div>
          {emailTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
              <p className="text-sm text-slate-500">No message templates yet.</p>
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingEmailTemplate(template); }}
                      title="Edit template"
                      className="p-1.5 rounded-full text-slate-300 hover:text-orange-600 hover:bg-orange-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); requestDelete(template.id, 'email'); }}
                      disabled={deleting === template.id}
                      title="Delete template"
                      className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
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
              href={`/${workspaceSlug}/resources/create`}
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              + Create Template
            </Link>
          </div>
          {quoteTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
              <p className="text-sm text-slate-500">No quote templates yet.</p>
            </div>
          ) : (
            <div className="grid gap-1">
              {quoteTemplates.map((template) => (
                <Link
                  key={template.id}
                  href={`/${workspaceSlug}/resources/${template.id}/edit`}
                  title="Click to edit"
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{template.name}</p>
                    {template.description && <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/${workspaceSlug}/resources/${template.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      title="Edit template"
                      className="p-1.5 rounded-full text-slate-300 hover:text-orange-600 hover:bg-orange-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestDelete(template.id, 'quote'); }}
                      disabled={deleting === template.id}
                      title="Delete template"
                      className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Customer tab */
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
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
              <p className="text-sm text-slate-500">No customer quote templates yet.</p>
            </div>
          ) : (
            <div className="grid gap-1">
              {customerQuoteTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setEditingCustomerTemplate(template)}
                  title="Click to edit"
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{template.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{template.company_name || 'No company name'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingCustomerTemplate(template); }}
                      title="Preview"
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCustomerTemplate(template); }}
                      title="Edit template"
                      className="p-1.5 rounded-full text-slate-300 hover:text-orange-600 hover:bg-orange-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); requestDelete(template.id, 'customer'); }}
                      disabled={deleting === template.id}
                      title="Delete template"
                      className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
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
          isOverStorage={attachmentEntitlements.isOverStorage}
        />
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Template</h3>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The template will be permanently deleted.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => { setPendingDeleteId(null); setPendingDeleteType(null); }} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={!!deleting}>Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={!!deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {editingEmailTemplate !== undefined && (
        <EmailTemplateEditor
          template={editingEmailTemplate}
          attachments={attachments}
          attachmentsEnabled={attachmentEntitlements.attachmentsEnabled}
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
