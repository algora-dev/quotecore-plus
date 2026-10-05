'use client';

import '@/app/components/ui/v2/qc-library.css';
import { QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { useState } from 'react';
import { updateLibraryVisibility } from '../actions';

const ROOFING_TYPES = [
  'All Roofing',
  'Metal Roofing',
  'Tile Roofing',
  'Flat Roofing',
  'Shingle Roofing',
  'Membrane',
  'EPDM/TPO',
  'Slate',
];

export function PublishLibraryModal({
  collectionId,
  collectionName,
  currentVisibility,
  publicTitle,
  publicDescription,
  roofingTypes,
  onClose,
  onSaved,
}: {
  collectionId: string;
  collectionName: string;
  currentVisibility: 'private' | 'unlisted' | 'published';
  publicTitle: string;
  publicDescription: string;
  roofingTypes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'published'>(currentVisibility);
  const [title, setTitle] = useState(publicTitle || collectionName);
  const [description, setDescription] = useState(publicDescription);
  const [selectedRoofingTypes, setSelectedRoofingTypes] = useState<string[]>(roofingTypes);
  const [keywords, setKeywords] = useState('');
  const [brands, setBrands] = useState('');
  const [productCategories, setProductCategories] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRoofingType(type: string) {
    setSelectedRoofingTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateLibraryVisibility(collectionId, {
        visibility,
        public_title: title.trim() || null,
        public_description: description.trim() || null,
        roofing_types: selectedRoofingTypes,
        product_categories: productCategories.split(',').map(s => s.trim()).filter(Boolean),
        brands: brands.split(',').map(s => s.trim()).filter(Boolean),
        keywords: keywords.split(',').map(s => s.trim()).filter(Boolean),
      });
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <QcJourneyDialog label="Library Visibility" size="lg">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Library Visibility</h2>
            <button aria-label="Close" data-qc-variant="ghost" onClick={onClose} className="qc-button qc-flow-control qc-library-control ">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Publishing <span className="font-medium text-slate-700">{collectionName}</span> makes it
            searchable by QuoteCore+ users looking for supplier components.
          </p>

          {/* Visibility selector */}
          <div className="space-y-2">
            <label className="block text-xs text-slate-500 mb-1">Visibility</label>
            {[
              { value: 'private', label: 'Private', desc: 'Only visible in your account' },
              { value: 'unlisted', label: 'Unlisted', desc: 'Not searchable, but accessible via direct link' },
              { value: 'published', label: 'Published', desc: 'Searchable by all QuoteCore+ users' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVisibility(opt.value as 'private' | 'unlisted' | 'published')}
                className={"qc-flow-control qc-library-choice " + (`w-full text-left px-3 py-2 rounded-xl border transition ${
                  visibility === opt.value
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-orange-200'
                }`)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                  {visibility === opt.value && (
                    <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* Public details - only relevant when not private */}
          {visibility !== 'private' && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Public Title</label>
                <input aria-label="Public Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="qc-input qc-library-control w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Public Description</label>
                <textarea aria-label="Public Description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="qc-input qc-library-control w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Roofing Types</label>
                <div className="flex flex-wrap gap-1.5">
                  {ROOFING_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleRoofingType(type)}
                      className={"qc-flow-control qc-library-choice " + (`text-xs px-2.5 py-1 rounded-full border transition ${
                        selectedRoofingTypes.includes(type)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'
                      }`)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Brands (comma-separated)</label>
                  <input aria-label="Brands (comma-separated)"
                    value={brands}
                    onChange={e => setBrands(e.target.value)}
                    placeholder="e.g. Marley, Klober"
                    className="qc-input qc-library-control w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Product Categories</label>
                  <input aria-label="Product Categories"
                    value={productCategories}
                    onChange={e => setProductCategories(e.target.value)}
                    placeholder="e.g. Tiles, Membranes"
                    className="qc-input qc-library-control w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Keywords (comma-separated)</label>
                <input aria-label="Keywords (comma-separated)"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="e.g. breathable membrane, ventilation"
                  className="qc-input qc-library-control w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          <div className="flex gap-2 pt-2">
            <button data-qc-variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="qc-button qc-flow-control qc-library-control inline-flex"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button data-qc-variant="ghost"
              onClick={onClose}
              className="qc-button qc-flow-control qc-library-control "
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </QcJourneyDialog>
  );
}
