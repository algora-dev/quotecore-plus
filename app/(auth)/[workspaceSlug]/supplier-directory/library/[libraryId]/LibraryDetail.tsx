'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DirectoryLibrary } from '../../actions';
import type { UserCollection } from '../../actions';
import { createComponentCollection } from '../../../components/actions';

type ComponentPreview = {
  id: string;
  name: string;
  component_type: string;
  measurement_type: string;
  default_material_rate: number;
  default_labour_rate: number;
  default_waste_type: string;
  default_waste_percent: number;
  default_waste_fixed: number;
  default_pitch_type: string;
  pack_price: number | null;
  pack_size: number | null;
  pack_coverage_m2: number | null;
  pricing_strategy: string;
  waste_unit: string;
  show_price_default: boolean;
  show_dimensions_default: boolean;
  eligible_for_orders: boolean | null;
  height_value_mm: number | null;
  depth_value_mm: number | null;
  notes: string | null;
  sku: string | null;
  takeoff_slot: string | null;
  sort_order: number;
};

type ImportState = 'idle' | 'importing' | 'success' | 'error';

export function LibraryDetail({
  workspaceSlug,
  library,
  components,
  userCollections,
  alreadyImportedIds,
}: {
  workspaceSlug: string;
  library: DirectoryLibrary;
  components: ComponentPreview[];
  userCollections: UserCollection[];
  alreadyImportedIds: Set<string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collectionList, setCollectionList] = useState<UserCollection[]>(userCollections);
  const [targetCollection, setTargetCollection] = useState<string>(
    userCollections.find(c => c.is_bootstrap)?.id ?? userCollections[0]?.id ?? ''
  );
  const [showNewLibraryInput, setShowNewLibraryInput] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [creatingLibrary, setCreatingLibrary] = useState(false);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; message: string } | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    // Only select components not already imported
    setSelected(new Set(components.filter(c => !alreadyImportedIds.has(c.id)).map(c => c.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleImport() {
    if (!selected.size || !targetCollection) return;
    setImportState('importing');
    setImportResult(null);

    try {
      const res = await fetch('/api/supplier-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLibraryId: library.id,
          targetCollectionId: targetCollection,
          componentIds: [...selected],
          alertsEnabled,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setImportState('success');
        setImportResult({
          imported: data.imported,
          skipped: data.skipped,
          message: data.imported > 0
            ? `Imported ${data.imported} component${data.imported !== 1 ? 's' : ''}${data.skipped > 0 ? ` (${data.skipped} already imported)` : ''}`
            : `All ${data.skipped} selected component${data.skipped !== 1 ? 's' : ''} already imported`,
        });
        // Clear selection after successful import
        setSelected(new Set());
        // Refresh to update already-imported state
        router.refresh();
      } else {
        setImportState('error');
        setImportResult({ imported: 0, skipped: 0, message: data.errors?.[0] ?? 'Import failed' });
      }
    } catch {
      setImportState('error');
      setImportResult({ imported: 0, skipped: 0, message: 'Network error. Please try again.' });
    }
  }

  async function handleCreateLibrary() {
    if (!newLibraryName.trim()) return;
    setCreatingLibrary(true);
    try {
      const result = await createComponentCollection(newLibraryName.trim());
      if (result.ok) {
        // Add to local collections list and select it
        const newCol: UserCollection = { id: result.id, name: result.name, is_bootstrap: false, component_count: 0 };
        setCollectionList(prev => [...prev, newCol]);
        setTargetCollection(result.id);
        setShowNewLibraryInput(false);
        setNewLibraryName('');
      } else {
        alert(result.message || 'Failed to create library');
      }
    } catch {
      alert('Failed to create library');
    } finally {
      setCreatingLibrary(false);
    }
  }

  const selectedCount = selected.size;
  const availableCount = components.filter(c => !alreadyImportedIds.has(c.id)).length;
  const importedCount = components.length - availableCount;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumb */}
        <Link
          href={`/${workspaceSlug}/supplier-directory`}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Directory
        </Link>

        {/* Library header */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-slate-900">{library.public_title || library.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">by {library.supplier_name}</p>
              {library.public_description && (
                <p className="text-sm text-slate-600 mt-2">{library.public_description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {library.roofing_types?.map(rt => (
                  <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>
                ))}
                {library.brands?.map(b => (
                  <span key={b} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{b}</span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-semibold text-slate-900">{components.length}</div>
              <div className="text-xs text-slate-400">components</div>
            </div>
          </div>
        </div>

        {/* Import success banner */}
        {importState === 'success' && importResult && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-emerald-800">{importResult.message}</span>
            </div>
            <Link
              href={`/${workspaceSlug}/components`}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 rounded-full border border-emerald-300 px-3 py-1"
            >
              View My Components
            </Link>
          </div>
        )}

        {/* Import error banner */}
        {importState === 'error' && importResult && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-red-800">{importResult.message}</span>
          </div>
        )}

        {/* Component list */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer">Select All</button>
              {selectedCount > 0 && (
                <button onClick={deselectAll} className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer">Clear</button>
              )}
              {importedCount > 0 && (
                <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs">
                  {importedCount} already imported
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-700">
              {selectedCount > 0 ? `${selectedCount} selected` : `${components.length} components`}
            </span>
          </div>

          {components.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No components in this library.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {components.map(comp => {
                const isImported = alreadyImportedIds.has(comp.id);
                return (
                  <div
                    key={comp.id}
                    className={`flex items-center gap-3 px-4 py-3 transition ${
                      isImported ? 'opacity-50' : selected.has(comp.id) ? 'bg-orange-50/50' : 'hover:bg-orange-50/30'
                    } ${!isImported ? 'cursor-pointer' : ''}`}
                    onClick={() => !isImported && toggleSelect(comp.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(comp.id)}
                      onChange={() => !isImported && toggleSelect(comp.id)}
                      onClick={e => e.stopPropagation()}
                      disabled={isImported}
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">{comp.name}</span>
                        {comp.sku && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-mono">SKU: {comp.sku}</span>
                        )}
                        {comp.takeoff_slot && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{comp.takeoff_slot}</span>
                        )}
                        {isImported && (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs">
                            Imported
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {comp.component_type} - {comp.measurement_type} - {comp.pricing_strategy}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {comp.pack_price != null ? (
                        <div className="text-sm font-medium text-slate-900">
                          ${comp.pack_price.toFixed(2)}
                          <span className="text-xs text-slate-400">/pack</span>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-slate-900">
                          ${comp.default_material_rate.toFixed(2)}
                          <span className="text-xs text-slate-400">/unit</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Import bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Collection selector + Create new */}
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Import to library</label>
              {!showNewLibraryInput ? (
                <div className="flex gap-2">
                  <select
                    value={targetCollection}
                    onChange={e => {
                      if (e.target.value === '__new__') {
                        setShowNewLibraryInput(true);
                        setNewLibraryName(library.public_title || library.name);
                      } else {
                        setTargetCollection(e.target.value);
                      }
                    }}
                    disabled={importState === 'importing' || availableCount === 0}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none disabled:bg-slate-50"
                  >
                    {collectionList.map(col => (
                      <option key={col.id} value={col.id}>
                        {col.name} ({col.component_count} components){col.is_bootstrap ? ' - Default' : ''}
                      </option>
                    ))}
                    <option value="__new__">+ Create New Library...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLibraryName}
                    onChange={e => setNewLibraryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateLibrary(); } }}
                    placeholder="Library name"
                    maxLength={80}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateLibrary()}
                    disabled={creatingLibrary || !newLibraryName.trim()}
                    className="px-3 py-2 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {creatingLibrary ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewLibraryInput(false); setNewLibraryName(''); setTargetCollection(collectionList[0]?.id ?? ''); }}
                    className="px-3 py-2 text-xs rounded-full border border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Import button */}
            <div className="flex items-end gap-2">
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || !targetCollection || importState === 'importing' || showNewLibraryInput}
                className="cursor-pointer rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e55a2b] transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {importState === 'importing' ? 'Importing...' : `Import Selected (${selectedCount})`}
              </button>
              <Link
                href={`/${workspaceSlug}/supplier-directory`}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </Link>
            </div>
          </div>
          {availableCount === 0 && (
            <p className="text-xs text-slate-400 mt-2">All components from this library have already been imported.</p>
          )}

          {/* Alert opt-in */}
          {selectedCount > 0 && availableCount > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertsEnabled}
                  onChange={e => setAlertsEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-700">Notify me about supplier updates</span>
                  <p className="text-xs text-slate-400">Get an alert when this supplier changes imported components.</p>
                </div>
                <span className="relative group">
                  <svg className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-56 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg z-10 pointer-events-none">
                    Turn this on to review price and component-detail changes published by the supplier. You stay in control of which updates are applied.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
