'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  renameCatalog,
  updateCatalogMapping,
  loadCatalogMaps,
  createCatalogMap,
  updateCatalogMap,
  deleteCatalogMap,
} from './actions';
import type { CatalogRow, CatalogMapRow } from './actions';

interface Props {
  catalog: CatalogRow;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'rename' | 'remap' | 'maps';

const MAPPING_FIELDS: { key: 'description' | 'quantity' | 'price'; label: string }[] = [
  { key: 'description', label: 'Item / Description' },
  { key: 'quantity', label: 'Description / Quantity' },
  { key: 'price', label: 'Price' },
];

const emptyMapping = (): Record<string, string | null> => ({
  description: null,
  quantity: null,
  price: null,
});

export function EditCatalogModal({ catalog, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('rename');
  const [name, setName] = useState(catalog.name);
  const [mapping, setMapping] = useState<Record<string, string | null>>({
    description: (catalog.column_mapping as Record<string, string | null>).description ?? null,
    quantity: (catalog.column_mapping as Record<string, string | null>).quantity ?? null,
    price: (catalog.column_mapping as Record<string, string | null>).price ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headers = catalog.headers as string[];

  // --- Maps tab state ---
  const [maps, setMaps] = useState<CatalogMapRow[]>([]);
  const [mapsLoading, setMapsLoading] = useState(false);
  // The map being created/edited in the inline editor. null = list view.
  const [editingMap, setEditingMap] = useState<
    | { mode: 'create'; name: string; mapping: Record<string, string | null> }
    | { mode: 'edit'; id: string; name: string; mapping: Record<string, string | null>; isPrimary: boolean }
    | null
  >(null);

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none';

  const refreshMaps = useCallback(async () => {
    setMapsLoading(true);
    const rows = await loadCatalogMaps(catalog.id);
    setMaps(rows);
    setMapsLoading(false);
  }, [catalog.id]);

  useEffect(() => {
    if (tab === 'maps' && maps.length === 0 && !mapsLoading) {
      void refreshMaps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleRename = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = await renameCatalog(catalog.id, name);
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    onSaved();
  };

  const handleRemap = async () => {
    setSaving(true);
    setError(null);
    const result = await updateCatalogMapping(catalog.id, mapping);
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    onSaved();
  };

  const handleSaveMap = async () => {
    if (!editingMap) return;
    if (!editingMap.name.trim()) { setError('Map name is required.'); return; }
    setSaving(true);
    setError(null);
    const result =
      editingMap.mode === 'create'
        ? await createCatalogMap(catalog.id, editingMap.name, editingMap.mapping)
        : await updateCatalogMap(editingMap.id, editingMap.name, editingMap.mapping);
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    setEditingMap(null);
    await refreshMaps();
  };

  const handleDeleteMap = async (id: string) => {
    setSaving(true);
    setError(null);
    const result = await deleteCatalogMap(id);
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    await refreshMaps();
  };

  const mappingEditor = (
    value: Record<string, string | null>,
    onChange: (m: Record<string, string | null>) => void,
  ) => (
    <div className="space-y-3">
      {MAPPING_FIELDS.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <select
            value={value[field.key] ?? ''}
            onChange={(e) => onChange({ ...value, [field.key]: e.target.value || null })}
            className={inputCls + ' bg-white'}
          >
            <option value="">— Skip —</option>
            {headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-slate-900">Edit catalog</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit mb-5">
            {(['rename', 'remap', 'maps'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setEditingMap(null); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'rename' ? 'Rename' : t === 'remap' ? 'Column mapping' : 'Maps'}
              </button>
            ))}
          </div>

          {tab === 'rename' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                maxLength={120}
                autoFocus
              />
            </div>
          )}

          {tab === 'remap' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Update which columns map to each field without re-uploading. This edits the catalog&rsquo;s default map.
              </p>
              {mappingEditor(mapping, setMapping)}
            </div>
          )}

          {tab === 'maps' && (
            <div className="space-y-4">
              {!editingMap && (
                <>
                  <p className="text-xs text-slate-500">
                    Add extra column mappings over the same file. Each named map appears as its own
                    selectable option when searching the catalog &mdash; no re-upload, no extra storage.
                  </p>
                  {mapsLoading ? (
                    <p className="text-sm text-slate-400 py-4 text-center">Loading maps…</p>
                  ) : (
                    <div className="space-y-2">
                      {maps.map((m) => (
                        <div key={m.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {m.name}
                              {m.is_primary && (
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">default</span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() =>
                                setEditingMap({
                                  mode: 'edit',
                                  id: m.id,
                                  name: m.name,
                                  mapping: {
                                    description: (m.column_mapping as Record<string, string | null>).description ?? null,
                                    quantity: (m.column_mapping as Record<string, string | null>).quantity ?? null,
                                    price: (m.column_mapping as Record<string, string | null>).price ?? null,
                                  },
                                  isPrimary: m.is_primary,
                                })
                              }
                              className="text-xs text-slate-600 hover:text-orange-600"
                            >
                              Edit
                            </button>
                            {!m.is_primary && (
                              <button
                                onClick={() => void handleDeleteMap(m.id)}
                                disabled={saving}
                                className="text-xs text-red-500 hover:text-red-600 disabled:opacity-40"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setEditingMap({ mode: 'create', name: '', mapping: emptyMapping() })}
                    className="w-full px-3 py-2 text-sm font-medium border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-orange-400 hover:text-orange-600 transition"
                  >
                    + Add extra map for this catalog
                  </button>
                </>
              )}

              {editingMap && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Map name</label>
                    <input
                      type="text"
                      value={editingMap.name}
                      onChange={(e) => setEditingMap({ ...editingMap, name: e.target.value })}
                      className={inputCls}
                      maxLength={120}
                      placeholder="e.g. Retail markup, Cost only"
                      autoFocus
                    />
                    {editingMap.mode === 'edit' && editingMap.isPrimary && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        This is the catalog&rsquo;s default map.
                      </p>
                    )}
                  </div>
                  {mappingEditor(editingMap.mapping, (m) => setEditingMap({ ...editingMap, mapping: m }))}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={tab === 'maps' && editingMap ? () => { setEditingMap(null); setError(null); } : onClose}
              className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50"
            >
              {tab === 'maps' && editingMap ? 'Back' : 'Cancel'}
            </button>
            <button
              onClick={
                tab === 'rename'
                  ? handleRename
                  : tab === 'remap'
                    ? handleRemap
                    : editingMap
                      ? handleSaveMap
                      : onClose
              }
              disabled={
                saving ||
                (tab === 'rename' && !name.trim()) ||
                (tab === 'maps' && !!editingMap && !editingMap.name.trim())
              }
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40"
            >
              {saving ? 'Saving...' : tab === 'maps' && !editingMap ? 'Done' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
