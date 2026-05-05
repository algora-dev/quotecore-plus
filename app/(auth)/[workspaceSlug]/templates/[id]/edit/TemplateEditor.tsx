'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ComponentLibraryRow, CustomerQuoteTemplateRow } from '@/app/lib/types';
import { updateTemplate } from '../../actions';

interface SelectedComponent {
  id: string;
  libraryId: string;
  name: string;
  type: 'main' | 'extra';
}

interface Props {
  workspaceSlug: string;
  template: any; // TODO: Add proper type
  componentLibrary: ComponentLibraryRow[];
  customerTemplates: CustomerQuoteTemplateRow[];
}

export function TemplateEditor({ workspaceSlug, template, componentLibrary, customerTemplates }: Props) {
  const router = useRouter();

  // Initialize with template data
  const [name, setName] = useState(template.name || '');
  const [description, setDescription] = useState(template.description || '');
  const [roofingProfile, setRoofingProfile] = useState(template.roofing_profile || '');
  
  // Load existing components
  const initialComponents = (template.template_components || [])
    .filter((tc: any) => tc.component_type === 'main')
    .map((tc: any) => ({
      id: tc.id,
      libraryId: tc.component_library_id,
      name: tc.component_library?.name || 'Unknown',
      type: 'main' as const,
    }));

  const initialExtras = (template.template_components || [])
    .filter((tc: any) => tc.component_type === 'extra')
    .map((tc: any) => ({
      id: tc.id,
      libraryId: tc.component_library_id,
      name: tc.component_library?.name || 'Unknown',
      type: 'extra' as const,
    }));

  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>(initialComponents);
  const [selectedExtras, setSelectedExtras] = useState<SelectedComponent[]>(initialExtras);
  const [customerTemplateId, setCustomerTemplateId] = useState(template.customer_template_id || '');
  const [notes, setNotes] = useState(template.notes || '');
  const [saving, setSaving] = useState(false);

  const mainComponents = componentLibrary.filter(c => c.component_type === 'main' && c.is_active);
  const extraComponents = componentLibrary.filter(c => c.component_type === 'extra' && c.is_active);

  function handleAddComponent(libraryId: string) {
    const component = componentLibrary.find(c => c.id === libraryId);
    if (!component) return;

    const newComponent: SelectedComponent = {
      id: crypto.randomUUID(),
      libraryId: component.id,
      name: component.name,
      type: 'main',
    };

    setSelectedComponents(prev => [...prev, newComponent]);
  }

  function handleAddExtra(libraryId: string) {
    const component = componentLibrary.find(c => c.id === libraryId);
    if (!component) return;

    const newExtra: SelectedComponent = {
      id: crypto.randomUUID(),
      libraryId: component.id,
      name: component.name,
      type: 'extra',
    };

    setSelectedExtras(prev => [...prev, newExtra]);
  }

  function handleRemoveComponent(id: string) {
    setSelectedComponents(prev => prev.filter(c => c.id !== id));
  }

  function handleRemoveExtra(id: string) {
    setSelectedExtras(prev => prev.filter(e => e.id !== id));
  }

  async function handleSave() {
    if (!name.trim()) {
      alert('Template name is required');
      return;
    }

    if (selectedComponents.length === 0 && selectedExtras.length === 0) {
      const confirmed = confirm(
        'You have not added any roof components or extras. Are you sure you want to continue?'
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      await updateTemplate(template.id, {
        name,
        description,
        roofingProfile,
        components: selectedComponents.map(c => ({ libraryId: c.libraryId, type: c.type })),
        extras: selectedExtras.map(e => ({ libraryId: e.libraryId, type: e.type })),
        customerTemplateId,
        notes,
      });

      router.push(`/${workspaceSlug}/templates`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${workspaceSlug}/templates`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to Templates
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">Edit Template</h1>
          </div>
        </div>

        {/* Form (same structure as create) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Template Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Template Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard Residential Roof"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Standard setup for residential roofing jobs"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Roofing Profile
              </label>
              <input
                type="text"
                value={roofingProfile}
                onChange={(e) => setRoofingProfile(e.target.value)}
                placeholder="e.g., Tile, Metal, Shingle"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Main Components */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Main Components</h3>
            <p className="text-xs text-slate-500">
              Components that will be pre-added to roof areas when building a quote
            </p>

            <div>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddComponent(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Select component to add...</option>
                {mainComponents.map(comp => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedComponents.length > 0 && (
              <div className="space-y-2">
                {selectedComponents.map(comp => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200"
                  >
                    <span className="text-sm text-slate-700">{comp.name}</span>
                    <button
                      onClick={() => handleRemoveComponent(comp.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      × Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extras */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Extras</h3>
            <p className="text-xs text-slate-500">
              Extra components that will be available when building a quote
            </p>

            <div>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddExtra(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Select extra to add...</option>
                {extraComponents.map(comp => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedExtras.length > 0 && (
              <div className="space-y-2">
                {selectedExtras.map(extra => (
                  <div
                    key={extra.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200"
                  >
                    <span className="text-sm text-slate-700">{extra.name}</span>
                    <button
                      onClick={() => handleRemoveExtra(extra.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      × Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Quote Template */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Customer Quote Template (Optional)</h3>
            <p className="text-xs text-slate-500">
              Default branding template for customer-facing quotes
            </p>

            <select
              value={customerTemplateId}
              onChange={(e) => setCustomerTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">None (use default branding)</option>
              {customerTemplates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this template..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Link
              href={`/${workspaceSlug}/templates`}
              className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
