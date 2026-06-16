'use client';

/**
 * AddLineItemModal — shared "Add Line Item" modal used by:
 *   - Customer Quote Editor (quotes/[id]/customer-edit)
 *   - Blank Quote Builder   (quotes/[id]/blank-build)
 *   - Order Line-by-Line Editor (material-orders/create)
 *
 * This is the invoice-modal UX pattern applied universally. Three tabs:
 *   Custom   — Title + Description + Qty + Unit + Unit Price
 *   Catalog  — Select catalog → browse/search rows → set Qty + Unit Cost
 *   Component — Pick from component library → set Qty + Unit Cost
 *
 * The modal emits a normalised LineItemPayload[] via onAdd. Each consuming
 * editor maps this payload to its own line shape (QuoteLine, LineByLineItem,
 * etc.) in its onAdd handler — the modal itself stays format-agnostic.
 */

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/app/lib/currency/currencies';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineItemPayload {
  lineSourceType: 'custom' | 'catalog' | 'component';
  sourceId: string | null;
  /** Primary text / item name (column 1). */
  title: string;
  /** Optional secondary detail text (column 2 — Description). */
  description: string | null;
  /** Numeric quantity. */
  quantity: number;
  /** Unit label (e.g. "item", "m²"). */
  unit: string;
  /** Per-unit price. */
  unitPrice: number;
  /** Computed total = quantity × unitPrice. */
  lineTotal: number;
  showPrice: boolean;
}

type LineMode = 'custom' | 'catalog' | 'component';

interface CatalogRow {
  id: string;
  catalog_id: string;
  raw_row: Record<string, string>;
  search_text: string;
  row_index: number;
}

interface Props {
  /** Used to scope catalog-row search. */
  workspaceSlug: string;
  currency: string;
  /** Available catalogs for the catalog tab. Pass [] to hide the tab. */
  catalogs: { id: string; name: string }[];
  /** Named collections for the component picker. */
  collections: { id: string; name: string }[];
  /** Full company component library for the component picker. */
  componentLibrary: { id: string; name: string; collection_id: string | null }[];
  onAdd: (lines: LineItemPayload[]) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid() {
  // crypto.randomUUID is available in all supported browsers / Node 14.17+
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function calcTotal(qty: string, price: string): number {
  const q = parseFloat(qty) || 0;
  const p = parseFloat(price) || 0;
  return Number((q * p).toFixed(2));
}

/**
 * Pull a display label and a price guess out of a raw catalog row object.
 * Mirrors the same logic used in AddInvoiceLineModal and CatalogSearchModal.
 */
function extractCatalogLine(row: CatalogRow): { label: string; price: number } {
  const vals = Object.values(row.raw_row).map(String);
  const label = vals[0] ?? 'Catalog item';
  const priceGuess =
    vals
      .map((v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')))
      .find((n) => !isNaN(n) && n > 0) ?? 0;
  return { label, price: priceGuess };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddLineItemModal({
  workspaceSlug,
  currency,
  catalogs,
  collections,
  componentLibrary,
  onAdd,
  onClose,
}: Props) {
  const [mode, setMode] = useState<LineMode>('custom');

  // ── Custom tab state ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('item');
  const [unitPrice, setUnitPrice] = useState('');

  // ── Catalog tab state ──
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(catalogs[0]?.id ?? '');
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogRow, setSelectedCatalogRow] = useState<CatalogRow | null>(null);
  const [catalogQty, setCatalogQty] = useState('1');
  const [catalogUnitPrice, setCatalogUnitPrice] = useState('');

  // ── Component tab state ──
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<{ id: string; name: string } | null>(null);
  const [compQty, setCompQty] = useState('1');
  const [compPrice, setCompPrice] = useState('');

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load catalog rows when catalog selected or search changes
  useEffect(() => {
    if (mode !== 'catalog' || !selectedCatalogId) return;
    setCatalogLoading(true);
    const qs = new URLSearchParams({ catalogId: selectedCatalogId, search: catalogSearch });
    fetch(`/api/invoices/catalog-rows?${qs}`)
      .then((r) => r.json())
      .then((d) => setCatalogRows(d.rows ?? []))
      .catch(() => setCatalogRows([]))
      .finally(() => setCatalogLoading(false));
  }, [mode, selectedCatalogId, catalogSearch]);

  // ── Handlers ──

  function handleAddCustom() {
    if (!title.trim()) return;
    const q = parseFloat(quantity) || 1;
    const p = parseFloat(unitPrice) || 0;
    const total = Number((q * p).toFixed(2));
    onAdd([{
      lineSourceType: 'custom',
      sourceId: null,
      title: title.trim(),
      description: description.trim() || null,
      quantity: q,
      unit: unit.trim() || 'item',
      unitPrice: p,
      lineTotal: total,
      showPrice: true,
    }]);
    onClose();
  }

  function handleAddCatalog() {
    if (!selectedCatalogRow) return;
    const { label } = extractCatalogLine(selectedCatalogRow);
    const q = parseFloat(catalogQty) || 1;
    const p = parseFloat(catalogUnitPrice) || 0;
    const total = Number((q * p).toFixed(2));
    onAdd([{
      lineSourceType: 'catalog',
      sourceId: selectedCatalogRow.id,
      title: label,
      description: null,
      quantity: q,
      unit: 'item',
      unitPrice: p,
      lineTotal: total,
      showPrice: true,
    }]);
    onClose();
  }

  function handleAddComponent() {
    if (!selectedComponent) return;
    const q = parseFloat(compQty) || 1;
    const p = parseFloat(compPrice) || 0;
    const total = Number((q * p).toFixed(2));
    onAdd([{
      lineSourceType: 'component',
      sourceId: selectedComponent.id,
      title: selectedComponent.name,
      description: null,
      quantity: q,
      unit: 'item',
      unitPrice: p,
      lineTotal: total,
      showPrice: true,
    }]);
    onClose();
  }

  const filteredComponents = componentLibrary.filter(
    (c) => !selectedCollection || c.collection_id === selectedCollection,
  );

  const customTotal = calcTotal(quantity, unitPrice);
  const catalogTotal = calcTotal(catalogQty, catalogUnitPrice);
  const compTotal = calcTotal(compQty, compPrice);

  const canAdd =
    mode === 'custom' ? !!title.trim() :
    mode === 'catalog' ? !!selectedCatalogRow :
    !!selectedComponent;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Add Line Item</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {(['custom', 'catalog', 'component'] as LineMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`py-2.5 px-3 text-sm font-medium capitalize transition-colors ${
                mode === m
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {m === 'component' ? 'Component' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">

          {/* ── Custom tab ── */}
          {mode === 'custom' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  placeholder="e.g. Labour – Roof installation"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Additional detail shown on the quote line"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Qty</label>
                  <input
                    type="number"
                    value={quantity}
                    min={0}
                    step={0.01}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="item"
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit Cost</label>
                  <input
                    type="number"
                    value={unitPrice}
                    min={0}
                    step={0.01}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              {unitPrice && (
                <div className="flex justify-end text-sm font-semibold text-slate-900">
                  Line total: {formatCurrency(customTotal, currency)}
                </div>
              )}
            </div>
          )}

          {/* ── Catalog tab ── */}
          {mode === 'catalog' && (
            <div className="space-y-3">
              {catalogs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No catalogs found. Upload one in Resources → Catalogs.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catalog</label>
                    <select
                      value={selectedCatalogId}
                      onChange={(e) => {
                        setSelectedCatalogId(e.target.value);
                        setSelectedCatalogRow(null);
                        setCatalogUnitPrice('');
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    >
                      {catalogs.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search rows…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {catalogLoading ? (
                      <p className="p-4 text-sm text-slate-400 text-center">Loading…</p>
                    ) : catalogRows.length === 0 ? (
                      <p className="p-4 text-sm text-slate-400 text-center">No rows found.</p>
                    ) : (
                      catalogRows.map((row) => {
                        const { label, price } = extractCatalogLine(row);
                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => {
                              setSelectedCatalogRow(row);
                              setCatalogUnitPrice(String(price)); // always update on row change
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 ${
                              selectedCatalogRow?.id === row.id ? 'bg-orange-50' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-slate-900 truncate">{label}</p>
                            {price > 0 && (
                              <span className="text-sm text-slate-700 ml-4 flex-shrink-0">
                                {formatCurrency(price, currency)}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {selectedCatalogRow && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={catalogQty}
                          min={0}
                          step={0.01}
                          onChange={(e) => setCatalogQty(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Unit Cost</label>
                        <input
                          type="number"
                          value={catalogUnitPrice}
                          min={0}
                          step={0.01}
                          onChange={(e) => setCatalogUnitPrice(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      {catalogUnitPrice && (
                        <div className="col-span-2 flex justify-end text-sm font-semibold text-slate-900">
                          Line total: {formatCurrency(catalogTotal, currency)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Component tab ── */}
          {mode === 'component' && (
            <div className="space-y-3">
              {collections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Collection</label>
                  <select
                    value={selectedCollection ?? ''}
                    onChange={(e) => {
                      setSelectedCollection(e.target.value || null);
                      setSelectedComponent(null);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">All collections</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {filteredComponents.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400 text-center">No components found.</p>
                ) : (
                  filteredComponents.map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setSelectedComponent(comp)}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                        selectedComponent?.id === comp.id ? 'bg-orange-50' : ''
                      }`}
                    >
                      {comp.name}
                    </button>
                  ))
                )}
              </div>
              {selectedComponent && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Qty</label>
                      <input
                        type="number"
                        value={compQty}
                        min={0}
                        step={0.01}
                        onChange={(e) => setCompQty(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Unit Cost</label>
                      <input
                        type="number"
                        value={compPrice}
                        min={0}
                        step={0.01}
                        onChange={(e) => setCompPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  {compPrice && (
                    <div className="flex justify-end text-sm font-semibold text-slate-900">
                      Line total: {formatCurrency(compTotal, currency)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={
              mode === 'custom' ? handleAddCustom :
              mode === 'catalog' ? handleAddCatalog :
              handleAddComponent
            }
            disabled={!canAdd}
            className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            Add Line
          </button>
        </div>
      </div>
    </div>
  );
}
