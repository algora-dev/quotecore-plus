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

  const handleRename = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = await renameCatalog(catalog.id, name);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  };

  const handleRemap = async () => {
    setSaving(true);
    setError(null);
    const result = await updateCatalogMapping(catalog.id, mapping);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-slate-900 mb-4">Edit catalog</h2>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5 border-b border-slate-200">
          {(['rename', 'remap'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-black text-black'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'rename' ? 'Rename' : 'Column mapping'}
            </button>
          ))}
        </div>

        {tab === 'rename' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
              maxLength={120}
              autoFocus
            />
          </div>
        )}

        {tab === 'remap' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Update which columns map to each field without re-uploading the file. Changes apply to future quote line inserts from this catalog.
            </p>
            {(['description', 'quantity', 'price'] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{field}</label>
                <select
                  value={mapping[field] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || null }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
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

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={tab === 'rename' ? handleRename : handleRemap}
            disabled={saving || (tab === 'rename' && !name.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
