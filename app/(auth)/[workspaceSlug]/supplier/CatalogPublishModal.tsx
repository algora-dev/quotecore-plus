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
  const isPublished = catalog.visibility === 'published';
  const [publicTitle, setPublicTitle] = useState(catalog.public_title || catalog.name);
  const [publicDescription, setPublicDescription] = useState(catalog.public_description || '');
  const [roofingTypes, setRoofingTypes] = useState<string[]>(catalog.roofing_types || []);
  const [brands, setBrands] = useState((catalog.brands || []).join(', '));
  const [keywords, setKeywords] = useState((catalog.keywords || []).join(', '));
  const [serviceAreas, setServiceAreas] = useState((catalog.service_areas || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateCatalogVisibility(catalog.id, {
        visibility: 'published',
        public_title: publicTitle.trim() || null,
        public_description: publicDescription.trim() || null,
        roofing_types: roofingTypes,
        brands: brands.split(',').map(s => s.trim()).filter(Boolean),
        keywords: keywords.split(',').map(s => s.trim()).filter(Boolean),
        service_areas: serviceAreas.split(',').map(s => s.trim()).filter(Boolean),
      });
      if (!result.ok) { setError(result.message); } else { onSaved(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setSaving(false); }
  }

  async function handleUnpublish() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateCatalogVisibility(catalog.id, { visibility: 'private' });
      if (!result.ok) { setError(result.message); } else { onSaved(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-slate-900">Publish Catalogue</h3>
          {isPublished && (
            <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-medium">
              Published v{catalog.published_version}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-4">{catalog.name}</p>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {!isPublished ? (
          <>
            <p className="text-sm text-slate-500 mb-4">Publish this catalogue to the supplier directory so users can find it and add it to their own account.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Public Title</label>
                <input type="text" value={publicTitle} onChange={e => setPublicTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="Public catalogue name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Public Description</label>
                <textarea value={publicDescription} onChange={e => setPublicDescription(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="Brief description of what's in this catalogue..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Locations / Service Areas (comma-separated)</label>
                <input type="text" value={serviceAreas} onChange={e => setServiceAreas(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                  placeholder="Chicago, Illinois, United States" />
                <p className="text-[11px] text-slate-400 mt-0.5">Users search by location to find suppliers near them.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Roofing Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROOFING_TYPES.map(rt => {
                    const selected = roofingTypes.includes(rt);
                    return (
                      <button key={rt} type="button"
                        onClick={() => setRoofingTypes(selected ? roofingTypes.filter(x => x !== rt) : [...roofingTypes, rt])}
                        className={`rounded-full border px-3 py-1 text-xs transition ${selected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                        {rt}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Brands (comma-separated)</label>
                <input type="text" value={brands} onChange={e => setBrands(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="Colorsteel, Dimond, Steel & Tube..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Keywords (comma-separated)</label>
                <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="flashing, ridge, valley, gutter..." />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-4">
              <button onClick={handlePublish} disabled={saving}
                className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition disabled:opacity-40">
                {saving ? 'Publishing...' : 'Publish Catalogue'}
              </button>
              <button onClick={onClose}
                className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                This catalogue is live in the supplier directory. Users can find it and add it to their account.
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Public Title</label>
                <input type="text" value={publicTitle} onChange={e => setPublicTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Public Description</label>
                <textarea value={publicDescription} onChange={e => setPublicDescription(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Locations / Service Areas (comma-separated)</label>
                <input type="text" value={serviceAreas} onChange={e => setServiceAreas(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                  placeholder="Chicago, Illinois, United States" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Roofing Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROOFING_TYPES.map(rt => {
                    const selected = roofingTypes.includes(rt);
                    return (
                      <button key={rt} type="button"
                        onClick={() => setRoofingTypes(selected ? roofingTypes.filter(x => x !== rt) : [...roofingTypes, rt])}
                        className={`rounded-full border px-3 py-1 text-xs transition ${selected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                        {rt}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Brands (comma-separated)</label>
                <input type="text" value={brands} onChange={e => setBrands(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Keywords (comma-separated)</label>
                <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <button onClick={handlePublish} disabled={saving}
                className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-40">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleUnpublish} disabled={saving}
                className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-40">
                {saving ? '...' : 'Unpublish'}
              </button>
              <button onClick={onClose}
                className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
