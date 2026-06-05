'use client';

// Line-by-line order editor (Phase 2, 2026-06-04).
//
// A focused, order-only editor that produces the SAME line shape
// (LineByLineItem) the OrderBody render surfaces consume. It deliberately does
// NOT reuse the CustomerQuoteEditor in place — that one is tightly coupled to
// the quote schema (roof areas / components / margins / quote taxes / quote
// branding autosave) and is shared by the live customer-quote + labor-sheet
// flows, so reusing it for orders (which may have no quote at all) risks
// regressing two production editors. Instead, this editor REUSES the same
// SHARED building blocks the quote editor uses (AddLineModal, CatalogSearchModal,
// LineEditForm) so the UX matches exactly, while keeping order persistence
// fully isolated.
//
// Capabilities (parity with the quote editor's line workflow):
//   - Unified "+ Add New Line" modal: Custom line / Add a component / Search catalog
//   - Left: line list with show / price / in-total toggles + reorder + remove
//   - Right: live priced preview mirroring OrderBody, with a per-line PENCIL edit
//   - Footer free-text (rendered on preview / public / PDF)
//   - Optional taxes (default none; add custom OR apply a company default)

import { useState, useCallback, useEffect, useRef } from 'react';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { AddLineModal } from '../../quotes/[id]/customer-edit/AddLineModal';
import { LineEditForm } from '../../quotes/[id]/customer-edit/LineEditForm';
import {
  lineByLineTotal,
  lineDisplayText,
  computeLineByLineTaxes,
  type LineByLineItem,
  type LineByLineTax,
} from '../lineByLine';

interface Props {
  initialLines: LineByLineItem[];
  initialFooter: string;
  initialTaxes: LineByLineTax[];
  currency: string;
  /** Workspace slug for the catalog search modal endpoint. */
  workspaceSlug: string;
  /** Named component libraries for the "Add a component" picker. */
  collections: { id: string; name: string }[];
  /** Full company component library for the "Add a component" picker. */
  componentLibrary: { id: string; name: string; collection_id: string | null }[];
  /** Active company default taxes, for the "apply default tax" picker. */
  companyTaxes: { id: string; name: string; rate_percent: number }[];
  /** Called on every line change so the parent form can persist on save. */
  onChange: (lines: LineByLineItem[]) => void;
  onFooterChange: (footer: string) => void;
  onTaxesChange: (taxes: LineByLineTax[]) => void;
}

function makeId(): string {
  return `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OrderLineByLineEditor({
  initialLines,
  initialFooter,
  initialTaxes,
  currency,
  workspaceSlug,
  collections,
  componentLibrary,
  companyTaxes,
  onChange,
  onFooterChange,
  onTaxesChange,
}: Props) {
  const [lines, setLines] = useState<LineByLineItem[]>(initialLines.length > 0 ? initialLines : []);
  const [footer, setFooter] = useState(initialFooter);
  const [taxes, setTaxes] = useState<LineByLineTax[]>(initialTaxes);

  // Quote-from-order (Decision #4) hydrates the parent's line-by-line state
  // ASYNCHRONOUSLY via effect, so the initial props arrive AFTER this editor's
  // useState snapshot was taken (empty). Sync ONCE when a non-empty initial set
  // first arrives. Ref-guarded so it can never clobber in-progress user edits
  // on later parent re-renders. No-op for the blank/custom path (empty initial).
  const seededRef = useRef(initialLines.length > 0);
  useEffect(() => {
    if (seededRef.current) return;
    if (initialLines.length === 0 && initialTaxes.length === 0 && !initialFooter) return;
    seededRef.current = true;
    setLines(initialLines);
    setFooter(initialFooter);
    setTaxes(initialTaxes);
  }, [initialLines, initialFooter, initialTaxes]);
  const [showAddLine, setShowAddLine] = useState(false);
  // id of the line currently being edited in the right-hand preview (pencil).
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  // Master "hide all prices" override for long order forms. When true, the
  // PREVIEW shows NO pricing at all (no per-line price, no subtotal, no tax
  // lines, no total) — it overrides each line's own showPrice. When false, the
  // preview honours each line's individual showPrice toggle as before. This is
  // preview-only convenience state; it does not mutate the lines themselves.
  const [hideAllPrices, setHideAllPrices] = useState(false);

  const commit = useCallback(
    (next: LineByLineItem[]) => {
      const reSorted = next.map((l, i) => ({ ...l, sortOrder: i }));
      setLines(reSorted);
      onChange(reSorted);
    },
    [onChange],
  );

  const commitTaxes = useCallback(
    (next: LineByLineTax[]) => {
      setTaxes(next);
      onTaxesChange(next);
    },
    [onTaxesChange],
  );

  // --- Add-line handlers (shared AddLineModal) -----------------------------
  const addCustomLine = (text: string, amount: number, showPrice: boolean, quantityText: string | null) => {
    commit([
      ...lines,
      {
        id: makeId(),
        text,
        quantityText,
        amount: Number.isFinite(amount) ? amount : 0,
        showPrice,
        isVisible: true,
        includeInTotal: true,
        sortOrder: lines.length,
      },
    ]);
  };

  // Component line: name pre-filled, qty + price blank (edit via pencil).
  const addComponentLine = (name: string) => {
    commit([
      ...lines,
      {
        id: makeId(),
        text: name,
        quantityText: null,
        amount: 0,
        showPrice: true,
        isVisible: true,
        includeInTotal: true,
        sortOrder: lines.length,
      },
    ]);
  };

  // --- Line mutations ------------------------------------------------------
  const patchLine = (id: string, patch: Partial<LineByLineItem>) => {
    commit(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLine = (id: string) => {
    commit(lines.filter((l) => l.id !== id));
    if (editingLineId === id) setEditingLineId(null);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  // Pencil save from the preview: updates text + amount + showPrice.
  const saveLineEdit = (id: string, text: string, amount: number, showPrice: boolean) => {
    commit(lines.map((l) => (l.id === id ? { ...l, text, amount, showPrice } : l)));
    setEditingLineId(null);
  };

  // --- Totals --------------------------------------------------------------
  const visibleLines = lines.filter((l) => l.isVisible);
  const subtotal = lineByLineTotal(lines);
  const { taxLines, taxTotal } = computeLineByLineTaxes(subtotal, taxes);
  const total = subtotal + taxTotal;

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none';

  return (
    // Width model (Shaun, 2026-06-05): the LEFT column (Order items / Footer /
    // Taxes) keeps its prior comfortable width; the RIGHT preview EXPANDS to
    // fill the remaining space so the body's right edge lines up with the
    // full-width header frame above. Fixed left basis + flexible preview
    // (min-w-0 so the preview table can shrink/grow without overflow). The
    // gap between the two columns is preserved.
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* LEFT: line controls + footer + taxes — fixed comfortable width
          (slightly narrower so the preview gets more room and the whole row
          shifts left toward the header's left frame). */}
      <div className="w-full lg:w-[400px] lg:flex-shrink-0 space-y-4" data-assistant-id="order-lbl-controls">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Order items</h3>
            <label
              className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none"
              title="Hide every price in the preview in one click (overrides each line's Price toggle). Untick to show prices as set per line."
            >
              <input
                type="checkbox"
                checked={hideAllPrices}
                onChange={(e) => setHideAllPrices(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Hide all prices
            </label>
          </div>

          {/* Existing lines with controls */}
          <div className="space-y-2">
            {lines.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1">No lines yet — add your first below.</p>
            ) : (
              lines.map((line, index) => (
                <div
                  key={line.id}
                  className={`rounded-lg border p-3 ${
                    line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">{lineDisplayText(line)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {line.showPrice ? formatCurrency(line.amount, currency) : 'Price hidden'}
                        {!line.includeInTotal && line.isVisible ? ' · not in total' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Move up"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        onClick={() => move(index, 1)}
                        disabled={index === lines.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingLineId(line.id)}
                      className="text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Edit
                    </button>
                    <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                      <input
                        type="checkbox"
                        checked={line.isVisible}
                        onChange={(e) => patchLine(line.id, { isVisible: e.target.checked })}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      Show
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                      <input
                        type="checkbox"
                        checked={line.showPrice}
                        onChange={(e) => patchLine(line.id, { showPrice: e.target.checked })}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      Price
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                      <input
                        type="checkbox"
                        checked={line.includeInTotal}
                        onChange={(e) => patchLine(line.id, { includeInTotal: e.target.checked })}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      In total
                    </label>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="text-red-500 hover:text-red-600 ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAddLine(true)}
            className="w-full py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-full hover:bg-orange-50 hover:border-orange-300 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.35)]"
          >
            + Add New Line
          </button>
        </div>

        {/* Footer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Footer (optional)</h3>
          <p className="text-xs text-slate-500">Terms, notes, or anything to print under the items.</p>
          <textarea
            value={footer}
            onChange={(e) => {
              setFooter(e.target.value);
              onFooterChange(e.target.value);
            }}
            placeholder="e.g. Payment terms, delivery instructions…"
            rows={3}
            className={inputCls}
          />
        </div>

        {/* Optional taxes (default none) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Taxes (optional)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Orders have no tax by default. Add a custom tax or apply a company default below.
            </p>
          </div>

          {taxes.length > 0 && (
            <div className="space-y-2">
              {taxes.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) =>
                      commitTaxes(taxes.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="Tax name"
                    className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={t.ratePercent}
                      onChange={(e) =>
                        commitTaxes(
                          taxes.map((x) =>
                            x.id === t.id ? { ...x, ratePercent: parseFloat(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                      className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => commitTaxes(taxes.filter((x) => x.id !== t.id))}
                    className="text-red-500 hover:text-red-600 text-xs px-1"
                    title="Remove tax"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              commitTaxes([
                ...taxes,
                { id: `tax-${Date.now()}`, sourceTaxId: null, name: '', ratePercent: 0 },
              ])
            }
            className="text-xs font-medium text-orange-600 hover:text-orange-700"
          >
            + Add custom tax
          </button>

          {companyTaxes.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">Apply company default</p>
              <div className="flex flex-wrap gap-2">
                {companyTaxes.map((ct) => {
                  const applied = taxes.some((t) => t.sourceTaxId === ct.id);
                  return (
                    <button
                      type="button"
                      key={ct.id}
                      onClick={() => {
                        if (applied) {
                          commitTaxes(taxes.filter((t) => t.sourceTaxId !== ct.id));
                        } else {
                          commitTaxes([
                            ...taxes,
                            {
                              id: `tax-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                              sourceTaxId: ct.id,
                              name: ct.name,
                              ratePercent: ct.rate_percent,
                            },
                          ]);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                        applied
                          ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                          : 'bg-white border-slate-300 text-slate-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      {ct.name} ({ct.rate_percent}%)
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: live preview (mirrors OrderBody line-by-line table) — expands
          to fill the remaining body width up to the header's right frame edge. */}
      <div className="w-full lg:flex-1 lg:min-w-0 lg:sticky lg:top-4 h-fit">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 font-semibold text-slate-600">Item / Description</th>
                {/* Keep the 2nd column header for layout (it also carries the
                    per-line pencil edit button), but blank the "Price" label
                    when all prices are hidden so nothing pricing-related shows. */}
                <th className="py-2 pl-3 text-right font-semibold text-slate-600 whitespace-nowrap">
                  {hideAllPrices ? '' : 'Price'}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleLines.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-slate-400 italic">
                    No items yet.
                  </td>
                </tr>
              ) : (
                visibleLines.map((line) =>
                  editingLineId === line.id ? (
                    <tr key={line.id}>
                      <td colSpan={2} className="py-2">
                        <LineEditForm
                          initialText={line.text}
                          initialAmount={line.amount}
                          initialShowPrice={line.showPrice}
                          onSave={(text, amount, showPrice) => saveLineEdit(line.id, text, amount, showPrice)}
                          onCancel={() => setEditingLineId(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={line.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 text-slate-800 whitespace-pre-line">{lineDisplayText(line)}</td>
                      <td className="py-2 pl-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          {!hideAllPrices && line.showPrice ? formatCurrency(line.amount, currency) : ''}
                          <button
                            type="button"
                            onClick={() => setEditingLineId(line.id)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                            title="Edit line"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
            {!hideAllPrices && (visibleLines.some((l) => l.showPrice) || taxLines.length > 0) ? (
              <tfoot>
                {taxLines.length > 0 && (
                  <>
                    <tr className="border-t border-slate-200">
                      <td className="py-1.5 pr-3 text-right text-slate-600">Subtotal</td>
                      <td className="py-1.5 pl-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                        {formatCurrency(subtotal, currency)}
                      </td>
                    </tr>
                    {taxLines.map((tl) => (
                      <tr key={tl.id}>
                        <td className="py-1.5 pr-3 text-right text-slate-600">
                          {tl.name} ({tl.ratePercent}%)
                        </td>
                        <td className="py-1.5 pl-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                          {formatCurrency(tl.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                <tr className="border-t-2 border-slate-300">
                  <td className="py-2 pr-3 text-right font-semibold text-slate-700">Total</td>
                  <td className="py-2 pl-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                    {formatCurrency(total, currency)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>

          {footer.trim() && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-sm text-slate-600 italic whitespace-pre-wrap">{footer}</p>
            </div>
          )}
        </div>
      </div>

      {/* Unified Add New Line modal: Custom line / Add a component / Search catalog */}
      {showAddLine && (
        <AddLineModal
          workspaceSlug={workspaceSlug}
          collections={collections}
          componentLibrary={componentLibrary}
          onAddCustom={addCustomLine}
          onAddComponent={addComponentLine}
          onClose={() => setShowAddLine(false)}
        />
      )}
    </div>
  );
}
