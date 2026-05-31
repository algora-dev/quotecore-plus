'use client';

import { useState } from 'react';
import { renameCatalog, updateCatalogMapping } from './actions';
import type { CatalogRow } from './actions';

interface Props {
  catalog: CatalogRow;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'rename' | 'remap';

const MAPPING_FIELDS: { key: 'description' | 'quantity' | 'price'; label: string }[] = [
  { key: 'description', label: 'Item / Description' },
  { key: 'quantity', label: 'Description / Quantity' },
  { key: 'price', label: 'Price' },
];

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

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none';

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-6 py-4 flex items-center justify-between">
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
            {(['rename', 'remap'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'rename' ? 'Rename' : 'Column mapping'}
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
                Update which columns map to each field without re-uploading. Item and Description combine into the quote line text.
              </p>
              {MAPPING_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value || null }))}
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
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={tab === 'rename' ? handleRename : handleRemap}
              disabled={saving || (tab === 'rename' && !name.trim())}
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
