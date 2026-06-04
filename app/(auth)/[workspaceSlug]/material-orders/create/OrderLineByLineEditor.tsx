'use client';

// Focused line-by-line order editor (Option B, 2026-06-04).
//
// A deliberately small, order-only editor that produces the SAME line shape
// (LineByLineItem) the OrderBody render surfaces consume. It is NOT the
// CustomerQuoteEditor — that one is tightly coupled to the quote schema
// (roof areas / components / margins / quote taxes / branding autosave) and
// is shared by the live customer-quote + labor-sheet flows. Reusing it for
// orders (which may have no quote at all) would have meant either faking
// quote infrastructure or destabilising two production editors. This keeps
// the order flow isolated and the quote editors untouched.
//
// Left: item list with add / edit / show-hide / include-in-total / reorder.
// Right: live preview matching the OrderBody line-by-line table.

import { useState, useCallback } from 'react';
import { formatCurrency } from '@/app/lib/currency/currencies';
import {
  lineByLineTotal,
  lineDisplayText,
  type LineByLineItem,
} from '../lineByLine';

interface Props {
  initialLines: LineByLineItem[];
  currency: string;
  /** Called on every change so the parent form can persist on save. */
  onChange: (lines: LineByLineItem[]) => void;
}

function makeId(): string {
  return `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OrderLineByLineEditor({ initialLines, currency, onChange }: Props) {
  const [lines, setLines] = useState<LineByLineItem[]>(
    initialLines.length > 0 ? initialLines : []
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  // Draft fields for the add/edit row.
  const [draftText, setDraftText] = useState('');
  const [draftQty, setDraftQty] = useState('');
  const [draftPrice, setDraftPrice] = useState('');

  const commit = useCallback(
    (next: LineByLineItem[]) => {
      const reSorted = next.map((l, i) => ({ ...l, sortOrder: i }));
      setLines(reSorted);
      onChange(reSorted);
    },
    [onChange]
  );

  const resetDraft = () => {
    setDraftText('');
    setDraftQty('');
    setDraftPrice('');
    setEditingId(null);
  };

  const handleAddOrUpdate = () => {
    const text = draftText.trim();
    if (!text) return;
    const amount = parseFloat(draftPrice.replace(/[^0-9.-]/g, ''));
    const item: Omit<LineByLineItem, 'id' | 'sortOrder'> = {
      text,
      quantityText: draftQty.trim() || null,
      amount: Number.isFinite(amount) ? amount : 0,
      showPrice: true,
      isVisible: true,
      includeInTotal: true,
    };

    if (editingId) {
      commit(
        lines.map((l) => (l.id === editingId ? { ...l, ...item } : l))
      );
    } else {
      commit([
        ...lines,
        { ...item, id: makeId(), sortOrder: lines.length },
      ]);
    }
    resetDraft();
  };

  const startEdit = (line: LineByLineItem) => {
    setEditingId(line.id);
    setDraftText(line.text);
    setDraftQty(line.quantityText ?? '');
    setDraftPrice(line.amount ? String(line.amount) : '');
  };

  const removeLine = (id: string) => {
    commit(lines.filter((l) => l.id !== id));
    if (editingId === id) resetDraft();
  };

  const patchLine = (id: string, patch: Partial<LineByLineItem>) => {
    commit(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  const visibleLines = lines.filter((l) => l.isVisible);
  const total = lineByLineTotal(lines);

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: controls */}
      <div className="space-y-4" data-assistant-id="order-lbl-controls">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {editingId ? 'Edit line' : 'Add a line'}
          </h3>
          <div className="space-y-2">
            <input
              type="text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Item / description"
              className={inputCls}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddOrUpdate(); }
              }}
            />
            <input
              type="text"
              value={draftQty}
              onChange={(e) => setDraftQty(e.target.value)}
              placeholder="Quantity / extra detail (optional)"
              className={inputCls}
            />
            <input
              type="text"
              inputMode="decimal"
              value={draftPrice}
              onChange={(e) => setDraftPrice(e.target.value)}
              placeholder="Price (optional)"
              className={inputCls}
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleAddOrUpdate}
                disabled={!draftText.trim()}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-40 transition"
              >
                {editingId ? 'Update line' : 'Add line'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Existing lines with controls */}
        <div className="space-y-2">
          {lines.length === 0 ? (
            <p className="text-sm text-slate-400 italic px-1">No lines yet — add your first above.</p>
          ) : (
            lines.map((line, index) => (
              <div
                key={line.id}
                className={`rounded-lg border p-3 ${line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 truncate">{lineDisplayText(line)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {line.showPrice ? formatCurrency(line.amount, currency) : 'Price hidden'}
                      {!line.includeInTotal && line.isVisible ? ' · not in total' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" title="Move up" onClick={() => move(index, -1)} disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">▲</button>
                    <button type="button" title="Move down" onClick={() => move(index, 1)} disabled={index === lines.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">▼</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                  <button type="button" onClick={() => startEdit(line)} className="text-orange-600 hover:text-orange-700 font-medium">Edit</button>
                  <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                    <input type="checkbox" checked={line.isVisible} onChange={(e) => patchLine(line.id, { isVisible: e.target.checked })} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                    Show
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                    <input type="checkbox" checked={line.showPrice} onChange={(e) => patchLine(line.id, { showPrice: e.target.checked })} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                    Price
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                    <input type="checkbox" checked={line.includeInTotal} onChange={(e) => patchLine(line.id, { includeInTotal: e.target.checked })} className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                    In total
                  </label>
                  <button type="button" onClick={() => removeLine(line.id)} className="text-red-500 hover:text-red-600 ml-auto">Remove</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: live preview (mirrors OrderBody line-by-line table) */}
      <div className="lg:sticky lg:top-4 h-fit">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Preview</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 font-semibold text-slate-600">Item / Description</th>
                <th className="py-2 pl-3 text-right font-semibold text-slate-600 whitespace-nowrap">Price</th>
              </tr>
            </thead>
            <tbody>
              {visibleLines.length === 0 ? (
                <tr><td colSpan={2} className="py-4 text-center text-slate-400 italic">No items yet.</td></tr>
              ) : (
                visibleLines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 text-slate-800 whitespace-pre-line">{lineDisplayText(line)}</td>
                    <td className="py-2 pl-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                      {line.showPrice ? formatCurrency(line.amount, currency) : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {visibleLines.some((l) => l.showPrice) ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td className="py-2 pr-3 text-right font-semibold text-slate-700">Total</td>
                  <td className="py-2 pl-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                    {formatCurrency(total, currency)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
