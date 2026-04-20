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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?\n\nThis cannot be undone.`)) return;
    
    try {
      await deleteOrderTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete template');
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
            <div className="space-y-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-slate-600 mt-0.5">{template.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        {template.default_supplier_name && (
                          <span>To: {template.default_supplier_name}</span>
                        )}
                        {template.default_from_company && (
                          <span>From: {template.default_from_company}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setEditingTemplate(template)}
                        className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        className="px-3 py-1.5 text-xs font-medium rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
