'use client';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';

import '@/app/components/ui/v2/qc-library.css';
import { QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { useState } from 'react';
import type { MaterialOrderTemplateRow, MaterialOrderTemplateInsert } from '@/app/lib/types';
import { createOrderTemplate, updateOrderTemplate, deleteOrderTemplate } from './template-actions';
import { TemplateForm } from './template-form';

interface Props {
  initialTemplates: MaterialOrderTemplateRow[];
  onClose: () => void;
  /** When true the company is over storage - block logo upload. */
  isOverStorage?: boolean;
  /** Optional entry point used by the unified library; legacy callers retain the list. */
  initialMode?: 'list' | 'create' | 'edit';
  initialTemplateId?: string;
  singleEditor?: boolean;
}

export function TemplateManager({ initialTemplates, onClose, isOverStorage, initialMode = 'list', initialTemplateId, singleEditor = false }: Props) {
  const { notify, feedback } = useQcFeedback();
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(initialMode === 'create');
  const [editingTemplate, setEditingTemplate] = useState<MaterialOrderTemplateRow | null>(() => initialMode === 'edit' ? initialTemplates.find(t => t.id === initialTemplateId) ?? null : null);
  const [saving, setSaving] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleCreateSubmit(data: any) {
    setSaving(true);
    
    const input: MaterialOrderTemplateInsert = {
      name: data.name,
      description: data.description || null,
      default_supplier_name: data.toSupplier || null,
      default_reference: data.reference || null,
      default_order_type: data.orderType || null,
      default_colours: data.colours.length > 0 ? data.colours : null,
      default_delivery_address: data.deliveryAddress || null,
      default_header_notes: data.orderNotes || null,
      default_logo_url: data.logoUrl || null,
      default_from_company: data.fromCompany || null,
      default_contact_person: data.contactPerson || null,
      default_contact_details: data.contactDetails || null,
    };

    try {
      const created = await createOrderTemplate(input);
      setTemplates(prev => [...prev, created]);
      setShowForm(false);
      if (singleEditor) onClose();
    } catch (err) {
      await notify(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSubmit(data: any) {
    if (!editingTemplate) return;
    
    setSaving(true);
    
    const input: Partial<MaterialOrderTemplateInsert> = {
      name: data.name,
      description: data.description || null,
      default_supplier_name: data.toSupplier || null,
      default_reference: data.reference || null,
      default_order_type: data.orderType || null,
      default_colours: data.colours.length > 0 ? data.colours : null,
      default_delivery_address: data.deliveryAddress || null,
      default_header_notes: data.orderNotes || null,
      default_logo_url: data.logoUrl || null,
      default_from_company: data.fromCompany || null,
      default_contact_person: data.contactPerson || null,
      default_contact_details: data.contactDetails || null,
    };

    try {
      const updated = await updateOrderTemplate(editingTemplate.id, input);
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t));
      setEditingTemplate(null);
      if (singleEditor) onClose();
    } catch (err) {
      await notify(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteTemplate() {
    if (!deleteTemplateId) return;
    setDeleteLoading(true);
    try {
      await deleteOrderTemplate(deleteTemplateId);
      setTemplates(prev => prev.filter(t => t.id !== deleteTemplateId));
      setDeleteTemplateId(null);
    } catch (err) {
      await notify(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleteLoading(false);
    }
  }

  // Show create form
  if (showForm) {
    return (
      <QcJourneyDialog label="Create order template" size="lg" pending={saving}>
        {feedback}
        <div className="qc-order-template-form w-full">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Create order template</h2>
            <p className="text-sm text-slate-600 mt-0.5">Save the supplier, delivery and header details you reuse. The template name appears in the order selector.</p>
          </div>
          <div className="p-2 md:p-6">
            <TemplateForm
              mode="create"
              onSubmit={handleCreateSubmit}
              onCancel={() => singleEditor ? onClose() : setShowForm(false)}
              saving={saving}
              isOverStorage={isOverStorage}
            />
          </div>
        </div>
      </QcJourneyDialog>
    );
  }

  // Show edit form
  if (editingTemplate) {
    const initialData = {
      name: editingTemplate.name,
      description: editingTemplate.description || '',
      toSupplier: editingTemplate.default_supplier_name || '',
      reference: editingTemplate.default_reference || '',
      orderType: editingTemplate.default_order_type || '',
      colours: editingTemplate.default_colours || [],
      deliveryAddress: editingTemplate.default_delivery_address || '',
      orderNotes: editingTemplate.default_header_notes || '',
      logoUrl: editingTemplate.default_logo_url || '',
      fromCompany: editingTemplate.default_from_company || '',
      contactPerson: editingTemplate.default_contact_person || '',
      contactDetails: editingTemplate.default_contact_details || '',
    };
    
    return (
      <QcJourneyDialog label="Edit order template" size="lg" pending={saving}>
        {feedback}
        <div className="qc-order-template-form w-full">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Edit order template</h2>
            <p className="text-sm text-slate-600 mt-0.5">Update template: {editingTemplate.name}</p>
          </div>
          <div className="p-2 md:p-6">
            <TemplateForm
              mode="edit"
              initialData={initialData}
              onSubmit={handleUpdateSubmit}
              onCancel={() => singleEditor ? onClose() : setEditingTemplate(null)}
              saving={saving}
              isOverStorage={isOverStorage}
            />
          </div>
        </div>
      </QcJourneyDialog>
    );
  }

  // Template list view
  return (
    <QcJourneyDialog label="Supplier Templates" size="lg">
        {feedback}
      <div className="w-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Order templates</h2>
            <p className="text-sm text-slate-600 mt-0.5">Manage reusable order templates</p>
          </div>
          <button aria-label="Close" data-qc-variant="ghost"
            onClick={onClose}
            className="qc-button qc-flow-control qc-library-control "
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto p-6">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-500 mb-4">No templates yet</p>
              <button data-qc-variant="primary"
                onClick={() => setShowForm(true)}
                className="qc-button qc-flow-control qc-library-control "
              >
                Create First Template
              </button>
            </div>
          ) : (
            <div className="grid gap-1">
              {templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => setEditingTemplate(template)}
                  title="Click to edit"
                  className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-slate-900"><button type="button" className="qc-library-action-name" onClick={(event) => { event.stopPropagation(); setEditingTemplate(template); }}>{template.name}</button></h3>
                    <div className="flex flex-wrap gap-4 mt-0.5 text-xs text-slate-400">
                      {template.default_supplier_name && <span>To: {template.default_supplier_name}</span>}
                      {template.default_from_company && <span>From: {template.default_from_company}</span>}
                    </div>
                  </div>
                  <button aria-label="Click to delete" data-qc-variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setDeleteTemplateId(template.id); }}
                    title="Click to delete"
                    className="qc-button qc-flow-control qc-library-control "
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Modal */}
        {deleteTemplateId && (
          <QcJourneyDialog label="Delete Template" size="sm">
            <div className="p-4 md:p-6 w-full">
              <h3 className="text-lg font-semibold text-slate-900">Delete Template</h3>
              <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The template will be permanently deleted.</p>
              <div className="flex gap-3 justify-end mt-6">
                <button data-qc-variant="ghost" onClick={() => setDeleteTemplateId(null)} className="qc-button qc-flow-control qc-library-control " disabled={deleteLoading}>Cancel</button>
                <button data-qc-variant="danger" onClick={confirmDeleteTemplate} className="qc-button qc-flow-control qc-library-control " disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </QcJourneyDialog>
        )}

        {/* Footer */}
        {templates.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <p className="text-sm text-slate-600">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
            <button data-qc-variant="primary"
              onClick={() => setShowForm(true)}
              className="qc-button qc-flow-control qc-library-control "
            >
              Create Template
            </button>
          </div>
        )}
      </div>
    </QcJourneyDialog>
  );
}
