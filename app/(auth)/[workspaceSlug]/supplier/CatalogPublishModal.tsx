'use client';

import { useState } from 'react';
import { updateCatalogVisibility, type SupplierCatalogData } from './actions';

const ROOFING_TYPES = ['All Roofing', 'Metal Roofing', 'Tile Roofing', 'Flat Roofing', 'Shingle Roofing', 'Membrane', 'EPDM/TPO', 'Slate'];

export function CatalogPublishModal({
  catalog,
  onClose,
  onSaved,
}: {
  catalog: SupplierCatalogData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'published'>(
    (catalog.visibility as 'private' | 'unlisted' | 'published') || 'private'
  );
  const [publicTitle, setPublicTitle] = useState(catalog.public_title || catalog.name);
  const [publicDescription, setPublicDescription] = useState(catalog.public_description || '');
  const [roofingTypes, setRoofingTypes] = useState<string[]>(catalog.roofing_types || []);
  const [brands, setBrands] = useState((catalog.brands || []).join(', '));
  const [keywords, setKeywords] = useState((catalog.keywords || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateCatalogVisibility(catalog.id, {
        visibility,
        public_title: publicTitle.trim() || null,
        public_description: publicDescription.trim() || null,
        roofing_types: roofingTypes,
        brands: brands.split(',').map(s => s.trim()).filter(Boolean),
        keywords: keywords.split(',').map(s => s.trim()).filter(Boolean),
      });
      if (!result.ok) {
        setError(result.message);
      } else {
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Catalogue Settings</h3>
        <p className="text-sm text-slate-400 mb-4">{catalog.name}</p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        {/* Visibility */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Visibility</label>
          <div className="flex gap-2">
            {(['private', 'unlisted', 'published'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  visibility === v
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {visibility === 'private' && <p className="text-[11px] text-slate-400 mt-1">Only visible to your company.</p>}
          {visibility === 'unlisted' && <p className="text-[11px] text-slate-400 mt-1">Visible to anyone with the direct link.</p>}
          {visibility === 'published' && <p className="text-[11px] text-slate-400 mt-1">Appears in the supplier directory for all users to find.</p>}
        </div>

        {/* Public Title */}
        <div className="mb-3">
          <label className="text-xs font-medium text-slate-600">Public Title</label>
          <input
            type="text"
            value={publicTitle}
            onChange={e => setPublicTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            placeholder="Public catalogue name"
          />
        </div>

        {/* Public Description */}
        <div className="mb-3">
          <label className="text-xs font-medium text-slate-600">Public Description</label>
          <textarea
            value={publicDescription}
            onChange={e => setPublicDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            placeholder="Brief description of what's in this catalogue..."
          />
        </div>

        {/* Roofing Types */}
        <div className="mb-3">
          <label className="text-xs font-medium text-slate-600">Roofing Types</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ROOFING_TYPES.map(rt => {
              const selected = roofingTypes.includes(rt);
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setRoofingTypes(selected ? roofingTypes.filter(x => x !== rt) : [...roofingTypes, rt])}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    selected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {rt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brands */}
        <div className="mb-3">
          <label className="text-xs font-medium text-slate-600">Brands (comma-separated)</label>
          <input
            type="text"
            value={brands}
            onChange={e => setBrands(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            placeholder="Colorsteel, Dimond, Steel & Tube..."
          />
        </div>

        {/* Keywords */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-600">Keywords (comma-separated)</label>
          <input
            type="text"
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
            placeholder="flashing, ridge, valley, gutter..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
