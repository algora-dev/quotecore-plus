'use client';

// Line-by-line order editor (Phase 2, 2026-06-04).
//
// A focused, order-only editor that produces the SAME line shape
// (LineByLineItem) the OrderBody render surfaces consume. It deliberately does
// NOT reuse the CustomerQuoteEditor in place - that one is tightly coupled to
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
import { CollapsiblePanel, CollapseButton, ExpandTab } from '@/app/components/editor/CollapsiblePanel';
import { AddLineItemModal, type LineItemPayload } from '@/app/components/AddLineItemModal';
import { LineEditForm } from '../../quotes/[id]/customer-edit/LineEditForm';
import { ConfirmModal } from '@/app/components/ConfirmModal';
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
  /** Hide line-item prices (independent of totals). */
  initialHideLinePrices?: boolean;
  /** Hide subtotal + taxes + total footer (independent of line prices). */
  initialHideTotals?: boolean;
  initialShowQuantityColumn?: boolean;
  currency: string;
  /** Workspace slug for the catalog search modal endpoint. */
  workspaceSlug: string;
  /** Named component libraries for the "Add a component" picker. */
  collections: { id: string; name: string }[];
  /** Full company component library for the "Add a component" picker. */
  componentLibrary: { id: string; name: string; collection_id: string | null }[];
  /** Catalogs for the "Add from catalog" tab. */
  catalogs?: { id: string; name: string }[];
  /** Active company default taxes, for the "apply default tax" picker. */
  companyTaxes: { id: string; name: string; rate_percent: number }[];
  /** Called on every line change so the parent form can persist on save. */
  onChange: (lines: LineByLineItem[]) => void;
  onFooterChange: (footer: string) => void;
  onTaxesChange: (taxes: LineByLineTax[]) => void;
  onHideLinePricesChange?: (hide: boolean) => void;
  onHideTotalsChange?: (hide: boolean) => void;
  onShowQuantityColumnChange?: (show: boolean) => void;
}

function makeId(): string {
  return `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OrderLineByLineEditor({
  initialLines,
  initialFooter,
  initialTaxes,
  initialHideLinePrices = false,
  initialHideTotals = false,
  initialShowQuantityColumn = false,
  currency,
  workspaceSlug,
  collections,
  componentLibrary,
  catalogs = [],
  companyTaxes,
  onChange,
  onFooterChange,
  onTaxesChange,
  onHideLinePricesChange,
  onHideTotalsChange,
  onShowQuantityColumnChange,
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
    setHideLinePrices(initialHideLinePrices);
    setHideTotals(initialHideTotals);
  }, [initialLines, initialFooter, initialTaxes, initialHideLinePrices, initialHideTotals]);
  const [showAddLine, setShowAddLine] = useState(false);
  // id of the line currently being edited in the right-hand preview (pencil).
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  // Pending remove confirmation (destructive). Mirrors CustomerQuoteEditor:
  // the X opens a ConfirmModal rather than deleting immediately.
  const [removeLineId, setRemoveLineId] = useState<string | null>(null);
  // Master "hide all prices" override for long order forms. When true, the
  // PREVIEW shows NO pricing at all (no per-line price, no subtotal, no tax
  // lines, no total) - it overrides each line's own showPrice. When false, the
  // preview honours each line's individual showPrice toggle as before. This is
  // preview-only convenience state; it does not mutate the lines themselves.
  // Persisted to the envelope so the saved/sent order matches the editor.
  const [hideLinePrices, setHideLinePrices] = useState(initialHideLinePrices);
  const [hideTotals, setHideTotals] = useState(initialHideTotals);
  const [showQuantityColumn, setShowQuantityColumn] = useState(initialShowQuantityColumn);
  // Declutter: collapse the left controls so the preview fills the space.
  // Pure layout state - panel stays mounted (no edit loss).
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // Hover-to-highlight: when the user hovers a line in the left sidebar,
  // the matching row in the right preview gets an orange border so they
  // can quickly see which item they need to edit.
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);

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

  // --- Add-line handler (shared AddLineItemModal) -------------------------
  const handleAddLineItem = (payloads: LineItemPayload[]) => {
    commit([
      ...lines,
      ...payloads.map((p, i) => ({
        id: makeId(),
        text: p.title,
        quantityText: p.description,
        amount: p.lineTotal,
        unitPrice: p.unitPrice,
        quantity: p.quantity,
        showPrice: p.showPrice,
        isVisible: true,
        includeInTotal: true,
        sortOrder: lines.length + i,
      })),
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
  const saveLineEdit = (
    id: string,
    text: string,
    quantityText: string | null,
    amount: number,
    showPrice: boolean,
    qty: number = 1,
    unitPrice: number | null = null,
  ) => {
    commit(lines.map((l) => (l.id === id ? { ...l, text, quantityText, amount, showPrice, quantity: qty, unitPrice } : l)));
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
      {/* LEFT: line controls + footer + taxes - collapsible to declutter; on
          collapse the preview (flex-1) auto-fills the freed space. */}
      <CollapsiblePanel collapsed={panelCollapsed} widthClass="lg:w-[400px] lg:flex-shrink-0">
      <div className="w-full lg:w-[400px] space-y-4" data-assistant-id="order-lbl-controls" data-copilot="order-lbl-controls">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CollapseButton
                collapsed={panelCollapsed}
                onToggle={() => setPanelCollapsed(true)}
                label="Collapse panel"
              />
              <h3 className="text-sm font-semibold text-slate-900">Order items</h3>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none"
                title="Hides the price on each line item. The subtotal and total footer remain visible unless 'Hide totals' is also ticked."
              >
                <input
                  type="checkbox"
                  checked={hideLinePrices}
                  onChange={(e) => {
                    setHideLinePrices(e.target.checked);
                    onHideLinePricesChange?.(e.target.checked);
                  }}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                Hide line prices
              </label>
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none"
                title="Hides the subtotal, taxes, and grand total footer."
              >
                <input
                  type="checkbox"
                  checked={hideTotals}
                  onChange={(e) => {
                    setHideTotals(e.target.checked);
                    onHideTotalsChange?.(e.target.checked);
                  }}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                Hide totals
              </label>
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none"
                title="Adds a Qty column to each line. Total = Qty × Unit Price."
              >
                <input
                  type="checkbox"
                  checked={showQuantityColumn}
                  onChange={(e) => {
                    setShowQuantityColumn(e.target.checked);
                    onShowQuantityColumnChange?.(e.target.checked);
                  }}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                Qty column
              </label>
            </div>
          </div>

          {/* Existing lines with controls */}
          <div className="space-y-2">
            {lines.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1">No lines yet - add your first below.</p>
            ) : (
              lines.map((line, index) => (
                <div
                  key={line.id}
                  onMouseEnter={() => setHoveredLineId(line.id)}
                  onMouseLeave={() => setHoveredLineId(null)}
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
                      onClick={() => setRemoveLineId(line.id)}
                      title="Remove this line"
                      aria-label="Remove line"
                      className="p-0.5 text-red-400 hover:text-red-600 ml-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            data-copilot="order-lbl-add-line"
            onClick={() => setShowAddLine(true)}
            className="w-full py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-full hover:bg-orange-50 hover:border-orange-300 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.35)]"
          >
            + Add New Line
          </button>

        </div>

        {/* Footer */}
        <div data-copilot="order-lbl-footer" className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
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
        <div data-copilot="order-lbl-taxes" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
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
      </CollapsiblePanel>

      {/* Expand tab - only visible when collapsed; sits on the preview side so
          it is never clipped by the collapsing panel's overflow. */}
      <ExpandTab
        collapsed={panelCollapsed}
        onToggle={() => setPanelCollapsed(false)}
        label="Order items"
      />

      {/* RIGHT: live preview (mirrors OrderBody line-by-line table) - expands
          to fill the remaining body width up to the header's right frame edge. */}
      <div className="w-full lg:flex-1 lg:min-w-0 lg:sticky lg:top-4 h-fit">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
            <p className="text-xs text-slate-400 italic">
              Tip: to view the full preview with header, save, then view order.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
<tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 font-semibold text-slate-600">Item / Description</th>
                {showQuantityColumn && (
                  <th className="py-2 px-2 text-right font-semibold text-slate-600 whitespace-nowrap w-12">Qty</th>
                )}
                <th className="py-2 pl-3 text-right font-semibold text-slate-600 whitespace-nowrap">
                  {hideLinePrices ? '' : 'Price'}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleLines.length === 0 ? (
                <tr>
<td colSpan={showQuantityColumn ? 3 : 2} className="py-4 text-center text-slate-400 italic">
                    No items yet.
                  </td>
                </tr>
              ) : (
                visibleLines.map((line) =>
                  editingLineId === line.id ? (
<tr key={line.id}>
                      <td colSpan={showQuantityColumn ? 3 : 2} className="py-2">
<LineEditForm
                          initialText={line.text}
                          initialQuantity={line.quantityText}
                          initialAmount={line.amount}
                          initialShowPrice={line.showPrice}
                          showQuantityColumn={showQuantityColumn}
                          initialQty={line.quantity ?? 1}
                          initialUnitPrice={line.unitPrice ?? null}
                          onSave={(text, quantity, amount, sp, qty, unitPrice) => saveLineEdit(line.id, text, quantity, amount, sp, qty, unitPrice)}
                          onCancel={() => setEditingLineId(null)}
                        />
                      </td>
                    </tr>
                  ) : (
<tr key={line.id} className={`border-b border-slate-100 align-top ${hoveredLineId === line.id ? 'ring-2 ring-[#FF6B35] ring-inset' : ''}`}>
                      <td className="py-2 pr-3 text-slate-800 whitespace-pre-line">{lineDisplayText(line)}</td>
                      {showQuantityColumn && (
                        <td className="py-2 px-2 text-right text-slate-700 tabular-nums w-12">
                          {line.quantity ?? 1}
                        </td>
                      )}
                      <td className="py-2 pl-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          {!hideLinePrices && line.showPrice ? formatCurrency(line.amount, currency) : ''}
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
            {!hideTotals && (visibleLines.some((l) => l.showPrice) || taxLines.length > 0) ? (
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

      {/* Unified Add Line Item modal — invoice-style shared modal */}
      {showAddLine && (
        <AddLineItemModal
          workspaceSlug={workspaceSlug}
          currency={currency}
          catalogs={catalogs}
          collections={collections}
          componentLibrary={componentLibrary}
          onAdd={handleAddLineItem}
          onClose={() => setShowAddLine(false)}
        />
      )}

      {/* Remove-line confirmation (destructive: fully deletes the line).
          Matches CustomerQuoteEditor exactly for UX consistency. */}
      <ConfirmModal
        open={removeLineId !== null}
        title="Remove this line?"
        description="This removes the line from the order entirely."
        confirmLabel="Remove"
        onCancel={() => setRemoveLineId(null)}
        onConfirm={() => {
          if (removeLineId) removeLine(removeLineId);
          setRemoveLineId(null);
        }}
      />
    </div>
  );
}
