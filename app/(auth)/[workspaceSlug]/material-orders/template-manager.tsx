'use client';

import { useState } from 'react';
import type { MaterialOrderTemplateRow, MaterialOrderTemplateInsert } from '@/app/lib/types';
import { createOrderTemplate, updateOrderTemplate, deleteOrderTemplate } from './template-actions';

interface Props {
  initialTemplates: MaterialOrderTemplateRow[];
  onClose: () => void;
}

export function TemplateManager({ initialTemplates, onClose }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const input: MaterialOrderTemplateInsert = {
      name: fd.get('name') as string,
      description: fd.get('description') as string || null,
      default_supplier_name: fd.get('default_supplier_name') as string || null,
      default_supplier_contact: fd.get('default_supplier_contact') as string || null,
      default_supplier_phone: fd.get('default_supplier_phone') as string || null,
      default_supplier_email: fd.get('default_supplier_email') as string || null,
      default_delivery_address: fd.get('default_delivery_address') as string || null,
      default_header_notes: fd.get('default_header_notes') as string || null,
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

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const input: Partial<MaterialOrderTemplateInsert> = {
      name: fd.get('name') as string,
      description: fd.get('description') as string || null,
      default_supplier_name: fd.get('default_supplier_name') as string || null,
      default_supplier_contact: fd.get('default_supplier_contact') as string || null,
      default_supplier_phone: fd.get('default_supplier_phone') as string || null,
      default_supplier_email: fd.get('default_supplier_email') as string || null,
      default_delivery_address: fd.get('default_delivery_address') as string || null,
      default_header_notes: fd.get('default_header_notes') as string || null,
    };

    try {
      const updated = await updateOrderTemplate(id, input);
      setTemplates(prev => prev.map(t => t.id === id ? updated : t));
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?`)) return;
    
    try {
      await deleteOrderTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Supplier Templates</h2>
            <p className="text-sm text-slate-600 mt-0.5">Save supplier info for faster order creation</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add New Button */}
          {!showForm && !editingId && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full mb-4 px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              + New Template
            </button>
          )}

          {/* Create Form */}
          {showForm && (
            <div className="mb-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
              <h3 className="font-semibold text-slate-900 mb-3">New Template</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Template Name *</label>
                    <input name="name" required placeholder="e.g., Main Supplier" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Description</label>
                    <input name="description" placeholder="Optional notes" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Supplier Name</label>
                    <input name="default_supplier_name" placeholder="Company name" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Contact Person</label>
                    <input name="default_supplier_contact" placeholder="Contact name" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Phone</label>
                    <input name="default_supplier_phone" type="tel" placeholder="Phone number" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Email</label>
                    <input name="default_supplier_email" type="email" placeholder="Email address" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Delivery Address</label>
                    <textarea name="default_delivery_address" rows={2} placeholder="Default delivery address" className="w-full px-2 py-1 text-sm border border-slate-300 rounded"></textarea>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Header Notes</label>
                    <textarea name="default_header_notes" rows={2} placeholder="Standard notes for this supplier" className="w-full px-2 py-1 text-sm border border-slate-300 rounded"></textarea>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50">
                    {saving ? 'Creating...' : 'Create Template'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Template List */}
          <div className="space-y-2">
            {templates.map(template => (
              <div key={template.id}>
                {editingId === template.id ? (
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                    <h3 className="font-semibold text-slate-900 mb-3">Edit {template.name}</h3>
                    <form onSubmit={(e) => handleUpdate(e, template.id)} className="space-y-3">
                      {/* Same form fields as create, but with defaultValue */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Template Name *</label>
                          <input name="name" required defaultValue={template.name} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Description</label>
                          <input name="description" defaultValue={template.description || ''} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Supplier Name</label>
                          <input name="default_supplier_name" defaultValue={template.default_supplier_name || ''} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Contact Person</label>
                          <input name="default_supplier_contact" defaultValue={template.default_supplier_contact || ''} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Phone</label>
                          <input name="default_supplier_phone" type="tel" defaultValue={template.default_supplier_phone || ''} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Email</label>
                          <input name="default_supplier_email" type="email" defaultValue={template.default_supplier_email || ''} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Delivery Address</label>
                          <textarea name="default_delivery_address" rows={2} defaultValue={template.default_delivery_address || ''} className="w-full px-2 py-1 text-sm border border-slate-300 rounded"></textarea>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Header Notes</label>
                          <textarea name="default_header_notes" rows={2} defaultValue={template.default_header_notes || ''} className="w-full px-2 py-1 text-sm border border-slate-300 rounded"></textarea>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50">
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{template.name}</h4>
                        {template.description && (
                          <p className="text-xs text-slate-600 mt-0.5">{template.description}</p>
                        )}
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {template.default_supplier_name && (
                            <div><span className="text-slate-500">Supplier:</span> <span className="text-slate-700">{template.default_supplier_name}</span></div>
                          )}
                          {template.default_supplier_contact && (
                            <div><span className="text-slate-500">Contact:</span> <span className="text-slate-700">{template.default_supplier_contact}</span></div>
                          )}
                          {template.default_supplier_phone && (
                            <div><span className="text-slate-500">Phone:</span> <span className="text-slate-700">{template.default_supplier_phone}</span></div>
                          )}
                          {template.default_supplier_email && (
                            <div><span className="text-slate-500">Email:</span> <span className="text-slate-700">{template.default_supplier_email}</span></div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => setEditingId(template.id)}
                          className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(template.id, template.name)}
                          className="px-3 py-1 text-xs font-medium rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {templates.length === 0 && !showForm && (
            <div className="text-center py-12 text-slate-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm mb-4">No templates yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600"
              >
                Create First Template
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
