'use client';

// Focused line-by-line order editor (Option B, 2026-06-04; UX revised to match
// the customer quote editor).
//
// NOT the CustomerQuoteEditor — that one is tightly coupled to the quote schema
// (roof areas / components / margins / quote taxes / branding autosave) and is
// shared by the live customer-quote + labor-sheet flows. This is an isolated
// order-only editor producing the shared LineByLineItem shape that the
// OrderBody render surfaces consume.
//
// Layout: a button cluster at the top (Add line modal / Add from component
// library / Search catalog), then the chosen items listed below with per-line
// Show / Price / In-total toggles, reorder, pencil-edit (opens the modal), and
// remove. The real document preview (with header) is the order preview/PDF.

import { useState } from 'react';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { getCurrencySymbol } from '@/app/lib/currency/currencies';
import {
  lineByLineTotal,
  lineDisplayText,
  type LineByLineItem,
} from '../lineByLine';
import { AddOrderLineModal } from './AddOrderLineModal';

interface ComponentOption {
  id: string;
  name: string;
}

interface Props {
  /** Controlled line list (owned by the parent form). */
  lines: LineByLineItem[];
  currency: string;
  onChange: (lines: LineByLineItem[]) => void;
  /** Component library options for the "add from library" dropdown. */
  components: ComponentOption[];
  /** Open the catalog search modal (owned by the parent form). */
  onRequestCatalog: () => void;
}

function makeId(): string {
  return `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const editIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export function OrderLineByLineEditor({ lines, currency, onChange, components, onRequestCatalog }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const commit = (next: LineByLineItem[]) => onChange(next.map((l, i) => ({ ...l, sortOrder: i })));

  const addLine = (partial: { text: string; quantityText: string | null; amount: number; showPrice: boolean }) => {
    commit([
      ...lines,
      { ...partial, id: makeId(), isVisible: true, includeInTotal: true, sortOrder: lines.length },
    ]);
  };

  const patchLine = (id: string, patch: Partial<LineByLineItem>) =>
    commit(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeLine = (id: string) => commit(lines.filter((l) => l.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  const editingLine = editingId ? lines.find((l) => l.id === editingId) ?? null : null;
  const total = lineByLineTotal(lines);
  const currencySymbol = getCurrencySymbol(currency);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4" data-assistant-id="order-lbl-editor">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Order items</h3>
        <p className="text-xs text-slate-500">
          {lines.filter((l) => l.isVisible && l.showPrice).length > 0 ? `Total ${formatCurrency(total, currency)}` : ''}
        </p>
      </div>

      {/* Add cluster — all add controls in one place */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-full hover:bg-orange-50 hover:border-orange-300 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.35)]"
          data-assistant-id="order-lbl-add-line"
        >
          + Add line
        </button>
        <select
          value=""
          onChange={(e) => {
            const comp = components.find((c) => c.id === e.target.value);
            if (comp) addLine({ text: comp.name, quantityText: null, amount: 0, showPrice: true });
            e.target.value = '';
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-full bg-white text-slate-600 hover:border-slate-300 focus:outline-none"
          data-assistant-id="order-lbl-add-component"
        >
          <option value="">+ Add from component library…</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRequestCatalog}
          className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all"
          data-assistant-id="order-lbl-add-catalog"
        >
          Search catalog…
        </button>
      </div>

      {/* Chosen items */}
      <div className="space-y-2">
        {lines.length === 0 ? (
          <p className="text-sm text-slate-400 italic px-1 py-6 text-center border border-dashed border-slate-200 rounded-lg">
            No items yet — add a line, a component, or search your catalog above.
          </p>
        ) : (
          lines.map((line, index) => (
            <div
              key={line.id}
              className={`rounded-lg border p-3 ${line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-sm truncate ${line.isVisible ? 'text-slate-900' : 'text-slate-400'}`}>
                      {lineDisplayText(line)}
                    </p>
                    <p className={`text-sm font-medium whitespace-nowrap ${line.isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                      {line.showPrice ? formatCurrency(line.amount, currency) : '—'}
                    </p>
                  </div>
                  {/* Toggle row */}
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={line.isVisible} onChange={(e) => patchLine(line.id, { isVisible: e.target.checked })} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                      Show
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={line.showPrice} disabled={!line.isVisible} onChange={(e) => patchLine(line.id, { showPrice: e.target.checked })} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                      Price
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={line.includeInTotal} onChange={(e) => patchLine(line.id, { includeInTotal: e.target.checked })} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                      Add to total
                    </label>
                    <button type="button" onClick={() => setEditingId(line.id)} className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium">
                      {editIcon} Edit
                    </button>
                    <button type="button" onClick={() => removeLine(line.id)} className="text-xs text-red-500 hover:text-red-600 ml-auto">Remove</button>
                  </div>
                </div>
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === lines.length - 1} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">↓</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <AddOrderLineModal
          currencySymbol={currencySymbol}
          onSave={addLine}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editingLine && (
        <AddOrderLineModal
          initial={{
            text: editingLine.text,
            quantityText: editingLine.quantityText,
            amount: editingLine.amount,
            showPrice: editingLine.showPrice,
          }}
          currencySymbol={currencySymbol}
          onSave={(vals) => patchLine(editingLine.id, vals)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
