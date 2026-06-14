'use client';
import { useState, useEffect } from 'react';
import type { EditableLine } from './InvoiceEditor';
import { formatCurrency } from '@/app/lib/currency/currencies';

type LineMode = 'custom' | 'catalog' | 'component';

interface Props {
  currency: string;
  catalogs: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  componentLibrary: { id: string; name: string; collection_id: string | null }[];
  onAdd: (lines: EditableLine[]) => void;
  onClose: () => void;
}

type CatalogRow = {
  id: string;
  catalog_id: string;
  raw_row: Record<string, string>;
  search_text: string;
  row_index: number;
};

// Extract best display label and price guess from raw_row
function extractCatalogLine(row: CatalogRow): { label: string; price: number } {
  const vals = Object.values(row.raw_row).map(String);
  const label = vals[0] ?? 'Catalog item';
  // Try to find a numeric value that looks like a price
  const priceGuess = vals
    .map((v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')))
    .find((n) => !isNaN(n) && n > 0) ?? 0;
  return { label, price: priceGuess };
}

function uuid() {
  return crypto.randomUUID();
}

export function AddInvoiceLineModal({ currency, catalogs, collections, componentLibrary, onAdd, onClose }: Props) {
  const [mode, setMode] = useState<LineMode>('custom');

  // Custom line
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('item');
  const [unitPrice, setUnitPrice] = useState('');

  // Catalog
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(catalogs[0]?.id ?? '');
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogRow, setSelectedCatalogRow] = useState<CatalogRow | null>(null);
  const [catalogQty, setCatalogQty] = useState('1');
  const [catalogUnitPrice, setCatalogUnitPrice] = useState('');

  // Component
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<{ id: string; name: string } | null>(null);
  const [compPrice, setCompPrice] = useState('');
  const [compQty, setCompQty] = useState('1');

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
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

  const lineTotal = () => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(unitPrice) || 0;
    return Number((q * p).toFixed(2));
  };

  function handleAddCustom() {
    if (!title.trim()) return;
    const q = parseFloat(quantity) || 1;
    const p = parseFloat(unitPrice) || 0;
    onAdd([{
      localId: uuid(),
      line_source_type: 'custom',
      source_id: null,
      title: title.trim(),
      description: description.trim() || null,
      quantity: q,
      unit: unit.trim() || 'item',
      unit_price: p,
      line_total: Number((q * p).toFixed(2)),
      show_price: true,
      show_quantity: true,
      show_description: true,
      include_in_total: true,
      is_visible: true,
    }]);
    onClose();
  }

  function handleAddCatalog() {
    if (!selectedCatalogRow) return;
    const { label } = extractCatalogLine(selectedCatalogRow);
    const q = parseFloat(catalogQty) || 1;
    const p = parseFloat(catalogUnitPrice) || 0;
    onAdd([{
      localId: uuid(),
      line_source_type: 'catalog',
      source_id: selectedCatalogRow.id,
      title: label,
      description: null,
      quantity: q,
      unit: 'item',
      unit_price: p,
      line_total: Number((q * p).toFixed(2)),
      show_price: true,
      show_quantity: true,
      show_description: true,
      include_in_total: true,
      is_visible: true,
    }]);
    onClose();
  }

  function handleAddComponent() {
    if (!selectedComponent) return;
    const q = parseFloat(compQty) || 1;
    const p = parseFloat(compPrice) || 0;
    onAdd([{
      localId: uuid(),
      line_source_type: 'component',
      source_id: selectedComponent.id,
      title: selectedComponent.name,
      description: null,
      quantity: q,
      unit: 'item',
      unit_price: p,
      line_total: Number((q * p).toFixed(2)),
      show_price: true,
      show_quantity: true,
      show_description: true,
      include_in_total: true,
      is_visible: true,
    }]);
    onClose();
  }

  // Filtering is server-side via search param; client filter not needed
  const filteredCatalogRows = catalogRows;

  const filteredComponents = componentLibrary.filter(
    (c) => !selectedCollection || c.collection_id === selectedCollection
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Add Line Item</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
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
                mode === m ? 'border-b-2 border-orange-500 text-orange-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {m === 'component' ? 'Component' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {/* ── Custom ── */}
          {mode === 'custom' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(opt)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Additional detail shown on the invoice"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Qty</label>
                  <input type="number" value={quantity} min={0} step={0.01} onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
                  <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="item"
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit Price</label>
                  <input type="number" value={unitPrice} min={0} step={0.01} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
              </div>
              {unitPrice && (
                <div className="flex justify-end text-sm font-semibold text-slate-900">
                  Line total: {formatCurrency(lineTotal(), currency)}
                </div>
              )}
            </div>
          )}

          {/* ── Catalog ── */}
          {mode === 'catalog' && (
            <div className="space-y-3">
              {catalogs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No catalogs found. Upload one in Resources.</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catalog</label>
                    <select
                      value={selectedCatalogId}
                      onChange={(e) => { setSelectedCatalogId(e.target.value); setSelectedCatalogRow(null); }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    >
                      {catalogs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    ) : filteredCatalogRows.length === 0 ? (
                      <p className="p-4 text-sm text-slate-400 text-center">No rows found.</p>
                    ) : (
                      filteredCatalogRows.map((row) => {
                        const { label, price } = extractCatalogLine(row);
                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => {
                              setSelectedCatalogRow(row);
                              setCatalogUnitPrice(String(price)); // always update on row change
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 ${selectedCatalogRow?.id === row.id ? 'bg-orange-50' : ''}`}
                          >
                            <p className="text-sm font-medium text-slate-900 truncate">{label}</p>
                            {price > 0 && <span className="text-sm text-slate-700 ml-4 flex-shrink-0">{formatCurrency(price, currency)}</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {selectedCatalogRow && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" value={catalogQty} min={0} step={0.01} onChange={(e) => setCatalogQty(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Unit Price</label>
                        <input type="number" value={catalogUnitPrice} min={0} step={0.01} onChange={(e) => setCatalogUnitPrice(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Component ── */}
          {mode === 'component' && (
            <div className="space-y-3">
              {collections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Collection</label>
                  <select
                    value={selectedCollection ?? ''}
                    onChange={(e) => { setSelectedCollection(e.target.value || null); setSelectedComponent(null); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">All collections</option>
                    {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${selectedComponent?.id === comp.id ? 'bg-orange-50' : ''}`}
                    >
                      {comp.name}
                    </button>
                  ))
                )}
              </div>
              {selectedComponent && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Qty</label>
                    <input type="number" value={compQty} min={0} step={0.01} onChange={(e) => setCompQty(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Unit Price</label>
                    <input type="number" value={compPrice} min={0} step={0.01} onChange={(e) => setCompPrice(e.target.value)} placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={mode === 'custom' ? handleAddCustom : mode === 'catalog' ? handleAddCatalog : handleAddComponent}
            disabled={
              mode === 'custom' ? !title.trim() :
              mode === 'catalog' ? !selectedCatalogRow :
              !selectedComponent
            }
            className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-all disabled:opacity-50 transition-all"
          >
            Add Line
          </button>
        </div>
      </div>
    </div>
  );
}
