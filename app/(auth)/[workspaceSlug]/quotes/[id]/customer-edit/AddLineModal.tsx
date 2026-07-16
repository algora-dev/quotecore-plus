'use client';

// Unified "Add new line" modal for the Customer Quote Editor.
//
// One entry point replacing the old two buttons (Add Custom Line / Search
// Catalog). Presents three options:
//   1. Custom line   - description (text) + quantity/detail (text) + price (number)
//   2. Add component - pick a library (collection) then a component; the line
//                      lands with the component NAME pre-filled and quantity +
//                      price blank (user edits via the preview pencil)
//   3. Search catalog - reuses the existing CatalogSearchModal system unchanged
//
// This same modal is reused by the orders editor (Phase 2) since orders share
// the CustomerQuoteEditor.

import { useState } from 'react';
import { CatalogSearchModal } from './CatalogSearchModal';

const ALL_LIBRARIES = '__all__';

type Tab = 'custom' | 'component' | 'catalog';

interface ComponentLibraryItem {
  id: string;
  name: string;
  collection_id: string | null;
}

interface Props {
  workspaceSlug: string;
  collections: { id: string; name: string }[];
  componentLibrary: ComponentLibraryItem[];
  /** Custom line: (text, amount, showPrice, quantityText). */
  onAddCustom: (text: string, amount: number, showPrice: boolean, quantityText: string | null) => void;
  /** Component line: name pre-filled, qty + price blank. */
  onAddComponent: (name: string) => void;
  onClose: () => void;
}

export function AddLineModal({
  workspaceSlug,
  collections,
  componentLibrary,
  onAddCustom,
  onAddComponent,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('custom');

  // --- Custom line state ---
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [showPrice, setShowPrice] = useState(true);

  // --- Component picker state ---
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(ALL_LIBRARIES);
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');

  const filteredComponents = componentLibrary.filter((c) =>
    selectedLibraryId === ALL_LIBRARIES ? true : (c.collection_id ?? null) === selectedLibraryId,
  );

  // The catalog tab launches the existing standalone CatalogSearchModal so the
  // proven search/picker behaviour is reused verbatim.
  if (tab === 'catalog') {
    return (
      <CatalogSearchModal
        workspaceSlug={workspaceSlug}
        onAdd={(text, amount, sp, quantity) => onAddCustom(text, amount, sp, quantity)}
        onClose={onClose}
      />
    );
  }

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    const text = desc.trim();
    if (!text) return;
    const amountNum = price.trim() === '' ? 0 : parseFloat(price.replace(/[^0-9.-]/g, ''));
    onAddCustom(text, Number.isFinite(amountNum) ? amountNum : 0, showPrice, qty.trim() || null);
    onClose();
  }

  function handleAddComponent() {
    const picked = componentLibrary.find((c) => c.id === selectedComponentId);
    if (!picked) return;
    onAddComponent(picked.name);
    onClose();
  }

  const tabBtn = (key: Tab, label: string) => (
    <button
      type="button"
      data-copilot={key === 'catalog' ? 'add-line-catalog-tab' : undefined}
      onClick={() => setTab(key)}
      className={`flex-1 px-3 py-2 text-sm font-medium rounded-full transition-all ${
        tab === key
          ? 'bg-black text-white shadow-[0_0_10px_rgba(255,107,53,0.35)]'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-2 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Add New Line</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Option selector */}
        <div className="px-6 pt-4">
          <div data-copilot="add-line-tabs" className="flex gap-1 bg-slate-50 rounded-full p-1">
            {tabBtn('custom', 'Custom line')}
            {tabBtn('component', 'Add a component')}
            {tabBtn('catalog', 'Search catalog')}
          </div>
        </div>

        {/* --- Custom line --- */}
        {tab === 'custom' && (
          <form onSubmit={handleAddCustom} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Additional materials, Custom work"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-full focus:border-orange-500 focus:outline-none"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantity / detail <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 12 lengths, 3 boxes"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-full focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-full focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showPriceAddLine"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded"
              />
              <label htmlFor="showPriceAddLine" className="text-sm text-slate-700">
                Show price in customer quote
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!desc.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-40 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Add Line
              </button>
            </div>
          </form>
        )}

        {/* --- Add a component --- */}
        {tab === 'component' && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Library</label>
              <select
                value={selectedLibraryId}
                onChange={(e) => {
                  setSelectedLibraryId(e.target.value);
                  setSelectedComponentId('');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
              >
                <option value={ALL_LIBRARIES}>All</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Component</label>
              <select
                value={selectedComponentId}
                onChange={(e) => setSelectedComponentId(e.target.value)}
                disabled={filteredComponents.length === 0}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {componentLibrary.length === 0
                    ? 'No saved components'
                    : filteredComponents.length === 0
                      ? 'No components in this library'
                      : 'Choose a component…'}
                </option>
                {filteredComponents.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-800">
                <strong>Note:</strong> Adding a component here only pulls its <strong>name</strong> into the quote line. Labor rates, material rates, and measurement breakdowns from the component library are <strong>not</strong> included — use the quote builder's Components phase for full pricing.
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Set quantity and price afterwards with the pencil edit tool.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddComponent}
                disabled={!selectedComponentId}
                className="flex-1 px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-40 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Add to Quote
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
