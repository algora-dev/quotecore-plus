'use client';
import { QcLibrary } from '@/app/components/ui/v2/QcLibrary';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ComponentLibraryRow, CustomerQuoteTemplateRow } from '@/app/lib/types';
import { createTemplate } from '../actions';

interface SelectedComponent {
  id: string;
  libraryId: string;
  name: string;
  type: 'main' | 'extra';
}

interface Props {
  workspaceSlug: string;
  componentLibrary: ComponentLibraryRow[];
  customerTemplates: CustomerQuoteTemplateRow[];
}

export function TemplateBuilder({ workspaceSlug, componentLibrary, customerTemplates }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roofingProfile, setRoofingProfile] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<SelectedComponent[]>([]);
  const [customerTemplateId, setCustomerTemplateId] = useState('');
  const [notes, setNotes] = useState('');
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

    // Validation modal for empty components/extras
    if (selectedComponents.length === 0 && selectedExtras.length === 0) {
      const confirmed = confirm(
        'You have not added any roof components or extras. Are you sure you want to continue? You can still add components/extras when building a quote, adding them here will just save you time when building each quote.'
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      await createTemplate({
        name,
        description,
        roofingProfile,
        components: selectedComponents.map(c => ({ libraryId: c.libraryId, type: c.type })),
        extras: selectedExtras.map(e => ({ libraryId: e.libraryId, type: e.type })),
        customerTemplateId,
        notes,
      });

      // Successful explicit save only: refresh the library on return, never poll a workspace.
      router.refresh();
      router.push(`/${workspaceSlug}/resources/document-templates?type=quote&kind=quote-structure`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <QcLibrary className="qc-template-editor">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${workspaceSlug}/resources/document-templates?type=quote&kind=quote-structure`}
              className="qc-flow-link qc-library-control text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to document templates
            </Link>
            <h1 className="qc-library-title text-2xl font-semibold text-slate-900 mt-1">Create quote structure</h1>
          </div>
        </div>

        <nav className="qc-template-sections" aria-label="Template sections">
          <a className="qc-button qc-flow-control" href="#template-setup">Details</a>
          <a className="qc-button qc-flow-control" href="#template-components">Components</a>
          <a className="qc-button qc-flow-control" href="#template-extras">Extras</a>
          <a className="qc-button qc-flow-control" href="#template-presentation">Notes</a>
        </nav>
        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Template Details */}
          <div className="space-y-4">
            <h2 id="template-setup" className="qc-template-section text-lg font-semibold text-slate-900">Template details</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input aria-label="Template Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard Quote Template"
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <input aria-label="Description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Standard setup for typical jobs"
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Profile / Type
              </label>
              <input aria-label="Profile / Type"
                type="text"
                value={roofingProfile}
                onChange={(e) => setRoofingProfile(e.target.value)}
                placeholder="e.g., Standard, Premium, Basic"
                className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Main Components */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <h3 id="template-components" className="qc-template-section text-sm font-semibold text-slate-900">Main components</h3>
            <p className="text-xs text-slate-500">
              Components that will be pre-added to areas when building a quote
            </p>

            <div>
              <select aria-label="Add component"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddComponent(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="qc-select qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                    <button data-qc-variant="ghost"
                      onClick={() => handleRemoveComponent(comp.id)}
                      className="qc-button qc-flow-control qc-library-control "
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
            <h3 id="template-extras" className="qc-template-section text-sm font-semibold text-slate-900">Extras</h3>
            <p className="text-xs text-slate-500">
              Extra components that will be available when building a quote
            </p>

            <div>
              <select aria-label="Add extra"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddExtra(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="qc-select qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                    <button data-qc-variant="ghost"
                      onClick={() => handleRemoveExtra(extra.id)}
                      className="qc-button qc-flow-control qc-library-control "
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
              className="qc-select qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
            <h3 id="template-presentation" className="text-sm font-semibold text-slate-900">Notes</h3>
            <textarea aria-label="Template notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this template..."
              rows={4}
              className="qc-input qc-library-control w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Link
              href={`/${workspaceSlug}/resources/document-templates?type=quote&kind=quote-structure`}
              className="qc-button qc-flow-control"
            >
              Cancel
            </Link>
            <button data-qc-variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="qc-button qc-flow-control qc-library-control "
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </QcLibrary>
  );
}
