'use client';

import { useState } from 'react';
import type { MaterialOrderTemplateRow, MaterialOrderTemplateInsert } from '@/app/lib/types';
import { createOrderTemplate, updateOrderTemplate, deleteOrderTemplate } from './template-actions';
import { TemplateForm } from './template-form';

interface Props {
  initialTemplates: MaterialOrderTemplateRow[];
  onClose: () => void;
}

export function TemplateManager({ initialTemplates, onClose }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MaterialOrderTemplateRow | null>(null);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create template');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update template');
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
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleteLoading(false);
    }
  }

  // Show create form
  if (showForm) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Create Template</h2>
            <p className="text-sm text-slate-600 mt-0.5">Set default values for quick order creation</p>
          </div>
          <div className="p-6">
            <TemplateForm
              mode="create"
              onSubmit={handleCreateSubmit}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          </div>
        </div>
      </div>
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
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Edit Template</h2>
            <p className="text-sm text-slate-600 mt-0.5">Update template: {editingTemplate.name}</p>
          </div>
          <div className="p-6">
            <TemplateForm
              mode="edit"
              initialData={initialData}
              onSubmit={handleUpdateSubmit}
              onCancel={() => setEditingTemplate(null)}
              saving={saving}
            />
          </div>
        </div>
      </div>
    );
  }

  // Template list view
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Supplier Templates</h2>
            <p className="text-sm text-slate-600 mt-0.5">Manage reusable order templates</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
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
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors"
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
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-slate-900">{template.name}</h3>
                    <div className="flex gap-4 mt-0.5 text-xs text-slate-400">
                      {template.default_supplier_name && <span>To: {template.default_supplier_name}</span>}
                      {template.default_from_company && <span>From: {template.default_from_company}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTemplateId(template.id); }}
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

        {/* Delete Modal */}
        {deleteTemplateId && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Delete Template</h3>
              <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The template will be permanently deleted.</p>
              <div className="flex gap-3 justify-end mt-6">
                <button onClick={() => setDeleteTemplateId(null)} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={deleteLoading}>Cancel</button>
                <button onClick={confirmDeleteTemplate} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {templates.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <p className="text-sm text-slate-600">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors"
            >
              Create Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
