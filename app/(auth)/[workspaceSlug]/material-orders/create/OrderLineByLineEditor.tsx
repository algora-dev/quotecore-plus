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

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { QcStudioToolbar, QcStudioInspectorHeading, QcStudioSection, QcStudioOverview, type QcStudioOption } from '@/app/components/ui/v2/QcDocumentStudio';
import { OrderBody, type OrderDocumentData } from '@/app/orders/[token]/OrderBody';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDocumentWorkspace, QcDocumentHeader, QcDocumentSaveState, QcDocumentBody, QcDocumentPanel, QcDocumentPanelHeader, QcDocumentSection, QcDocumentPreview, QcDocumentDialogScope } from '@/app/components/ui/v2/QcDocumentWorkspace';

import { AddLineItemModal, type LineItemPayload } from '@/app/components/AddLineItemModal';
import { AiUploadModal } from '@/app/components/ai-import/AiUploadModal';
import { AiTextPromptModal } from '@/app/components/ai-import/AiTextPromptModal';
import type { ParsedDocumentResult } from '@/app/components/ai-import/types';
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
  /** Existing parent-owned supplier/company form. Presentation slot only. */
  details?: ReactNode;
  /** Render-only header projection from the existing parent form. */
  document: OrderDocumentData;
  /** UI guard only: prevent saving while a local item draft has not been applied. */
  onDraftChange?: (pending: boolean) => void;
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
  details,
  document,
  onDraftChange,
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
  const [showAiUpload, setShowAiUpload] = useState(false);
  const [showAiText, setShowAiText] = useState(false);
  // id of the line currently being edited in the right-hand preview (pencil).
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [studioSection, setStudioSection] = useState('document');
  const [studioPreview, setStudioPreview] = useState(false);
  const [studioLineDirty, setStudioLineDirty] = useState(false);
  const [pendingStudioTarget, setPendingStudioTarget] = useState<string | null>(null);
  useEffect(() => { onDraftChange?.(studioLineDirty); }, [studioLineDirty, onDraftChange]);
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

  // --- AI import handler --------------------------------------------------
  const handleAiParsed = (data: ParsedDocumentResult) => {
    commit([
      ...lines,
      ...data.lines.map((l, i) => ({
        id: makeId(),
        text: l.description,
        quantityText: l.unit ? `${l.qty} ${l.unit}` : `${l.qty}`,
        amount: l.qty * l.rate,
        unitPrice: l.rate,
        quantity: l.qty,
        showPrice: true,
        isVisible: true,
        includeInTotal: true,
        sortOrder: lines.length + i,
      })),
    ]);
    // Populate footer if AI extracted notes and footer is empty
    if (data.notes && !footer) {
      setFooter(data.notes);
      onFooterChange(data.notes);
    }
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

  const studioOptions: QcStudioOption[] = [
    { id: 'details', label: 'Order details', description: 'Supplier, delivery, your business and templates' },
    { id: 'appearance', label: 'Price & quantity display', description: 'Choose what the supplier sees' },
    { id: 'footer', label: 'Footer & terms', description: 'Closing notes beneath the items' },
    { id: 'taxes', label: 'Taxes', description: 'Optional custom or company taxes' },
    { id: 'import', label: 'Import items', description: 'Add lines from an image or text' },
  ];
  const studioLine = lines.find(line => line.id === editingLineId);
  function goToStudioSection(target: string) {
    setStudioSection(target); setStudioPreview(false); setPanelCollapsed(false);
    setStudioLineDirty(false); setEditingLineId(target.startsWith('line:') ? target.slice(5) : null);
  }
  function selectStudioSection(target: string) {
    if (target === studioSection) { setPanelCollapsed(false); setStudioPreview(false); return; }
    if (studioLineDirty) { setPendingStudioTarget(target); return; }
    goToStudioSection(target);
  }

  return (
    <>
      <QcStudioToolbar section={studioSection} onSelect={selectStudioSection} options={studioOptions}
        preview={studioPreview} onPreview={() => setStudioPreview(!studioPreview)}
        primary={<QcButton variant="secondary" size="sm" data-copilot="order-lbl-add-line" onClick={() => setShowAddLine(true)}>+ Add item</QcButton>} />
      {studioLineDirty && <p className="qc-document-note" role="status">Item changes are not applied yet. Choose Apply changes in the editing panel before saving.</p>}
      <QcDocumentBody collapsed={panelCollapsed || studioPreview}>
        <QcDocumentPanel collapsed={panelCollapsed || studioPreview} data-assistant-id="order-lbl-controls" data-copilot="order-lbl-controls">
          <QcStudioInspectorHeading section={studioSection}
            title={studioSection.startsWith('line:') ? 'Order item' : studioSection === 'items' ? 'All items' : studioOptions.find(option => option.id === studioSection)?.label ?? 'Your order'}
            onBack={() => selectStudioSection('document')} onCollapse={() => setPanelCollapsed(true)} />
          <QcStudioSection active={studioSection === 'document'}><QcStudioOverview options={studioOptions} onSelect={selectStudioSection} /></QcStudioSection>
          <QcStudioSection active={studioSection.startsWith('line:')}>
            {studioLine ? <div className="qc-document-panel-content">
              <div className="qc-document-line-toggles">
                <label><input type="checkbox" checked={studioLine.isVisible} onChange={e => patchLine(studioLine.id, { isVisible: e.target.checked })} /> Show item</label>
                <label><input type="checkbox" checked={studioLine.includeInTotal} onChange={e => patchLine(studioLine.id, { includeInTotal: e.target.checked })} /> In total</label>
              </div>
              <p className="qc-document-help">Hidden order items remain editable here, but do not contribute to the order total.</p>
              <div className="qc-document-row-actions">
                <QcButton size="sm" onClick={() => move(lines.indexOf(studioLine), -1)} disabled={lines.indexOf(studioLine) === 0}>↑ Move up</QcButton>
                <QcButton size="sm" onClick={() => move(lines.indexOf(studioLine), 1)} disabled={lines.indexOf(studioLine) === lines.length - 1}>↓ Move down</QcButton>
                <QcButton size="sm" variant="ghost" className="qc-document-danger-control" onClick={() => setRemoveLineId(studioLine.id)}>Remove</QcButton>
              </div>
              <div className="qc-studio-line-form">
                <LineEditForm key={studioLine.id} onDraftChange={setStudioLineDirty} initialText={studioLine.text} initialQuantity={studioLine.quantityText}
                  initialAmount={studioLine.amount} initialShowPrice={studioLine.showPrice} showQuantityColumn={showQuantityColumn}
                  initialQty={studioLine.quantity ?? 1} initialUnitPrice={studioLine.unitPrice ?? null}
                  currency={currency} saveLabel="Apply changes"
                  onSave={(text, quantity, amount, sp, qty, unitPrice) => { saveLineEdit(studioLine.id, text, quantity, amount, sp, qty, unitPrice); setStudioLineDirty(false); setStudioSection('items'); }}
                  onCancel={() => goToStudioSection('items')} />
              </div>
            </div> : <p className="qc-document-empty">Choose an item on the document or in All items.</p>}
          </QcStudioSection>
          <QcDocumentSection hidden={studioSection !== 'import'} title="Import items" description="Add lines from an image, PDF or text, then review them.">
            <div className="qc-document-imports"><QcButton variant="ghost" size="sm"
              type="button"
              onClick={() => setShowAiUpload(true)}
              title="Upload image to auto-fill order lines"
              className="flex-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload Image
            </QcButton><QcButton variant="ghost" size="sm"
              type="button"
              onClick={() => setShowAiText(true)}
              title="Paste text to auto-fill order lines"
              className="flex-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Text Prompt
            </QcButton></div>
          </QcDocumentSection>
          <QcDocumentSection hidden={studioSection !== 'items'} title="Order items" description="Hidden order items are retained but do not contribute to the total. In total applies to visible items.">          {/* Existing lines with controls */}
          <div className="space-y-2">
            {lines.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1">No items yet. Use Add item to get started.</p>
            ) : (
              lines.map((line, index) => (
                <div
                  key={line.id}
                  onMouseEnter={() => setHoveredLineId(line.id)}
                  onMouseLeave={() => setHoveredLineId(null)}
                  className="qc-document-line" data-visible={line.isVisible}
               >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button type="button" className="qc-studio-item-link" onClick={() => selectStudioSection(`line:${line.id}`)}>{lineDisplayText(line)}</button>
                      {!line.isVisible && <span className="qc-studio-hidden-badge">Hidden</span>}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {line.showPrice ? formatCurrency(line.amount, currency) : 'Price hidden'}
                        {!line.includeInTotal && line.isVisible ? ' · not in total' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <QcButton variant="ghost" size="sm" aria-label="Move up"
                        type="button"
                        title="Move up"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="qc-document-icon"
                      >
                        ▲
                      </QcButton>
                      <QcButton variant="ghost" size="sm" aria-label="Move down"
                        type="button"
                        title="Move down"
                        onClick={() => move(index, 1)}
                        disabled={index === lines.length - 1}
                        className="qc-document-icon"
                      >
                        ▼
                      </QcButton>
                    </div>
                  </div>
                  <div className="qc-document-line-toggles">
                    <QcButton variant="ghost" size="sm"
                      type="button"
                      onClick={() => selectStudioSection(`line:${line.id}`)}
                      
                    >
                      Edit
                    </QcButton>
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
                    <QcButton variant="ghost" size="sm"
                      type="button"
                      onClick={() => setRemoveLineId(line.id)}
                      title="Remove this line"
                      aria-label="Remove line"
                      className="ml-auto qc-document-icon qc-document-danger-control"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </QcButton>
                  </div>
                </div>
              ))
            )}
          </div>

</QcDocumentSection>
          <QcDocumentSection hidden={studioSection !== 'appearance'} title="Document appearance" description="Choose whether the supplier sees prices and totals.">
            <label
            className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-900 select-none p-2 -m-2 rounded-lg hover:bg-orange-50/50 transition-colors"
            title="When unticked, all pricing is hidden from the order. Tick to show line prices and totals. Most users don't send prices to suppliers."
          >
            <input
              type="checkbox"
              checked={!hideLinePrices && !hideTotals}
              onChange={(e) => {
                const show = e.target.checked;
                setHideLinePrices(!show);
                setHideTotals(!show);
                onHideLinePricesChange?.(!show);
                onHideTotalsChange?.(!show);
              }}
              className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            Show all pricing
          </label><div className="qc-document-visibility"><label
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
                title="Adds a Quantity column to each line. Total = Qty × Unit Price."
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
                Quantity column
              </label></div>
          </QcDocumentSection>
          {details && <QcDocumentSection hidden={studioSection !== 'details'} title="Order details" className="qc-document-order-details-section">{details}</QcDocumentSection>}
          <div hidden={studioSection !== 'footer'} data-copilot="order-lbl-footer" className="qc-document-section space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Footer & notes</h3>
          <p className="text-xs text-slate-500">Terms, notes, or anything to print under the items.</p>
          <textarea aria-label="Order footer"
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
          <div hidden={studioSection !== 'taxes'} data-copilot="order-lbl-taxes" className="qc-document-section space-y-3">
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
                    aria-label="Tax name" value={t.name}
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
                      aria-label="Tax rate percent" value={t.ratePercent}
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
                  <QcButton variant="ghost" size="sm"
                    type="button"
                    onClick={() => commitTaxes(taxes.filter((x) => x.id !== t.id))}
                    className="qc-document-danger-control"
                    title="Remove tax"
                  >
                    Remove
                  </QcButton>
                </div>
              ))}
            </div>
          )}

          <QcButton variant="ghost" size="sm"
            type="button"
            onClick={() =>
              commitTaxes([
                ...taxes,
                { id: `tax-${Date.now()}`, sourceTaxId: null, name: '', ratePercent: 0 },
              ])
            }
            
          >
            + Add custom tax
          </QcButton>

          {companyTaxes.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">Apply company default</p>
              <div className="flex flex-wrap gap-2">
                {companyTaxes.map((ct) => {
                  const applied = taxes.some((t) => t.sourceTaxId === ct.id);
                  return (
                    <QcButton variant="ghost" size="sm" aria-pressed={applied}
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
                      className="qc-document-danger-control"
                    >
                      {ct.name} ({ct.rate_percent}%)
                    </QcButton>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </QcDocumentPanel>
        <QcDocumentPreview title={studioPreview ? 'Recipient preview' : 'Your order'}
          description={studioPreview ? 'The same document renderer is used for the saved order, supplier page and PDF.' : 'Click an item or section to edit it. Use All items to restore hidden items.'}
          collapsed={panelCollapsed || studioPreview} onExpand={() => { setPanelCollapsed(false); setStudioPreview(false); }}>
          <div className="qc-document-paper"><OrderBody
            order={{ ...document, layout_mode: 'line_by_line', line_by_line_data: { lines, footer, taxes, hideLinePrices, hideTotals, showQuantityColumn } }}
            lines={[]} flashings={[]} currency={currency}
            selection={studioPreview ? undefined : { active: studioSection, hovered: hoveredLineId ? `line:${hoveredLineId}` : undefined, onSelect: selectStudioSection }} />
          </div>
        </QcDocumentPreview>
      </QcDocumentBody>
      <QcDocumentDialogScope>
      <ConfirmModal appearance="v2" open={pendingStudioTarget !== null} title="Discard unapplied item changes?"
        description="Your quick display changes are already applied. The text and pricing draft has not been applied to this item."
        confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setPendingStudioTarget(null)}
        onConfirm={() => { const target = pendingStudioTarget; setPendingStudioTarget(null); if (target) goToStudioSection(target); }} />      {/* Unified Add Line Item modal - invoice-style shared modal */}
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
      <ConfirmModal appearance="v2"
        open={removeLineId !== null}
        title="Remove this line?"
        description="This removes the line from the order entirely."
        confirmLabel="Remove"
        onCancel={() => setRemoveLineId(null)}
        onConfirm={() => {
          if (removeLineId) {
            removeLine(removeLineId);
            if (removeLineId === editingLineId) { setStudioLineDirty(false); setStudioSection('items'); }
          }
          setRemoveLineId(null);
        }}
      />

      {/* AI import modals */}
      {showAiUpload && (
        <AiUploadModal
          documentType="order"
          onParsed={handleAiParsed}
          onClose={() => setShowAiUpload(false)}
        />
      )}
      {showAiText && (
        <AiTextPromptModal
          documentType="order"
          onParsed={handleAiParsed}
          onClose={() => setShowAiText(false)}
        />
      )}
</QcDocumentDialogScope>
    </>
  );
}
