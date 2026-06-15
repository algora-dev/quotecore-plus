'use client';
import { useState } from 'react';

interface Props {
  initialText: string;
  /** Free-text description (column 2). Separate from the title/name. */
  initialQuantity?: string | null;
  initialAmount: number;
  initialShowPrice: boolean;
  /** When true, show numeric qty + unit price inputs instead of just a total price. */
  showQuantityColumn?: boolean;
  /** Numeric quantity (used when showQuantityColumn=true). */
  initialQty?: number;
  /** Per-unit price (used when showQuantityColumn=true). */
  initialUnitPrice?: number | null;

  // ── Margin fields (Task 4) ──────────────────────────────────────────────────
  /** True when the line is a component line (shows both Margin + Labor Margin). */
  isComponentLine?: boolean;
  /** Raw material cost from the component (component lines only). */
  baseMaterialCost?: number;
  /** Raw labour cost from the component (component lines only, > 0 = show Labor Margin). */
  baseLabourCost?: number;
  /** Current per-line material/profit margin override. Null = use global. */
  initialLineMarginPercent?: number | null;
  /** Current per-line labor margin override. Null = use global. */
  initialLineLaborMarginPercent?: number | null;
  /**
   * Global margin % for this quote (blank quotes, Task 3).
   * Shows as the default in the Margin % input when no per-line override is set.
   * Null = no global margin active.
   */
  globalMarginPercent?: number | null;
  /**
   * Default material margin % from the quote Review step (normal quotes).
   * Shows as the default in the Margin % input for non-blank quotes.
   */
  defaultMaterialMarginPercent?: number | null;
  /**
   * Default labor margin % from the quote Review step (normal quotes).
   * Shows as the default in the Labor Margin % input for non-blank quotes.
   */
  defaultLaborMarginPercent?: number | null;
  /** Quote entry mode — used to decide which margin defaults to show. */
  quoteEntryMode?: string | null;
  // ────────────────────────────────────────────────────────────────────────────

  onSave: (
    text: string,
    quantity: string | null,
    amount: number,
    showPrice: boolean,
    qty: number,
    unitPrice: number | null,
    lineMarginPercent: number | null,
    lineLaborMarginPercent: number | null,
  ) => void;
  onCancel: () => void;
}

export function LineEditForm({
  initialText,
  initialQuantity,
  initialAmount,
  initialShowPrice,
  showQuantityColumn = false,
  initialQty = 1,
  initialUnitPrice = null,
  isComponentLine = false,
  baseMaterialCost,
  baseLabourCost,
  initialLineMarginPercent,
  initialLineLaborMarginPercent,
  globalMarginPercent,
  defaultMaterialMarginPercent,
  defaultLaborMarginPercent,
  quoteEntryMode,
  onSave,
  onCancel,
}: Props) {
  const [text, setText] = useState(initialText);
  const [quantity, setQuantity] = useState(initialQuantity ?? '');
  const [amount, setAmount] = useState(
    showQuantityColumn && initialUnitPrice != null
      ? initialUnitPrice.toString()
      : initialAmount.toString(),
  );
  const [showPrice, setShowPrice] = useState(initialShowPrice);
  const [qty, setQty] = useState(initialQty.toString());

  // ── Margin state ─────────────────────────────────────────────────────────────
  // Determine the "effective default" margin to show in the input.
  // For blank quotes: use globalMarginPercent.
  // For normal quotes: use defaultMaterialMarginPercent from the Review step.
  const isBlankQuote = quoteEntryMode === 'blank';
  const defaultMargin = isBlankQuote
    ? (globalMarginPercent ?? 0)
    : (defaultMaterialMarginPercent ?? 0);
  const defaultLaborMargin = defaultLaborMarginPercent ?? 0;

  // The input value = per-line override if set, otherwise the global/review default.
  const [marginPercent, setMarginPercent] = useState<string>(
    (initialLineMarginPercent ?? defaultMargin).toString()
  );
  const [laborMarginPercent, setLaborMarginPercent] = useState<string>(
    (initialLineLaborMarginPercent ?? defaultLaborMargin).toString()
  );

  // Show Labor Margin field only for:
  //   - component lines (not custom/catalog)
  //   - that actually have labour cost > 0 (materials-only components skip it)
  //   - AND the quote has labor margin enabled (default labor margin > 0 means it was enabled)
  // Show the labor margin field for any component line that has labour cost,
  // regardless of whether a quote-level default is configured. This ensures
  // users can always see and adjust the labor margin, even on quotes where
  // labor_margin_percent was set to 0 or was never explicitly configured.
  const showLaborMarginField =
    isComponentLine &&
    !isBlankQuote &&
    (baseLabourCost ?? 0) > 0;
  // ─────────────────────────────────────────────────────────────────────────────

  // Derived line total when qty column is active
  const lineTotal = showQuantityColumn
    ? Number(((parseFloat(qty) || 1) * (parseFloat(amount) || 0)).toFixed(2))
    : parseFloat(amount) || 0;

  /**
   * Recompute the price when the margin % changes.
   * - Component lines: use baseMaterialCost + baseLabourCost for accuracy.
   * - Custom lines: proportional formula using the current displayed amount.
   */
  function recalcForMarginChange(newMaterialMargin: number, newLaborMargin: number) {
    // Use base-cost formula ONLY when the component has real cost figures.
    // If both costs are 0 (e.g. price set manually in Review stage), the formula
    // would produce $0 — fall back to the proportional formula in that case.
    const hasRealBaseCosts =
      isComponentLine &&
      baseMaterialCost !== undefined &&
      baseLabourCost !== undefined &&
      (baseMaterialCost + baseLabourCost) > 0;

    if (hasRealBaseCosts) {
      // Component line with known costs: compute directly from base costs.
      const newAmt = Math.round(
        (baseMaterialCost! * (1 + newMaterialMargin / 100) +
          baseLabourCost! * (1 + newLaborMargin / 100)) *
          100
      ) / 100;
      setAmount(newAmt.toString());
    } else {
      // Custom, catalog, or manually-priced component line: proportional formula.
      // Reads marginPercent BEFORE setMarginPercent applies (React state is async
      // within the same event), so oldEffective correctly reflects the PREVIOUS margin.
      const oldEffective = parseFloat(marginPercent) || 0;
      const currentAmt = parseFloat(amount) || 0;
      const base = currentAmt / (1 + oldEffective / 100);
      const newAmt = Math.round(base * (1 + newMaterialMargin / 100) * 100) / 100;
      setAmount(newAmt.toString());
    }
  }

  function handleMarginChange(val: string) {
    setMarginPercent(val);
    const newMat = parseFloat(val) || 0;
    const newLab = showLaborMarginField ? (parseFloat(laborMarginPercent) || 0) : newMat;
    recalcForMarginChange(newMat, newLab);
  }

  function handleLaborMarginChange(val: string) {
    setLaborMarginPercent(val);
    const newMat = parseFloat(marginPercent) || 0;
    const newLab = parseFloat(val) || 0;
    recalcForMarginChange(newMat, newLab);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!text.trim() || isNaN(amountNum) || amountNum < 0) {
      alert('Please enter valid text and amount');
      return;
    }
    const qtyText = quantity.trim() === '' ? null : quantity.trim();

    // Determine margin values to persist.
    const matMarginVal = parseFloat(marginPercent);
    const labMarginVal = showLaborMarginField ? parseFloat(laborMarginPercent) : null;

    // If the user hasn't changed from the default, store null (= use global).
    const finalLineMarginPercent =
      !isNaN(matMarginVal) && matMarginVal !== defaultMargin ? matMarginVal : null;
    const finalLineLaborMarginPercent =
      showLaborMarginField && !isNaN(labMarginVal!) && labMarginVal !== defaultLaborMargin
        ? labMarginVal
        : null;

    if (showQuantityColumn) {
      const qtyNum = Math.max(1, parseInt(qty) || 1);
      const unitP = amountNum;
      const total = Number((qtyNum * unitP).toFixed(2));
      onSave(text.trim(), qtyText, total, showPrice, qtyNum, unitP, finalLineMarginPercent, finalLineLaborMarginPercent);
    } else {
      onSave(text.trim(), qtyText, amountNum, showPrice, 1, null, finalLineMarginPercent, finalLineLaborMarginPercent);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-300">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Title / Name</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
          placeholder="Line title"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
          placeholder="e.g. 12 lm — leave blank for none"
        />
      </div>

      {showQuantityColumn ? (
        <div className="flex gap-2 items-end">
          <div className="w-20">
            <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Unit Price</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-600">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-1 pb-1">
            <input
              type="checkbox"
              id="edit-showPrice"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded"
            />
            <label htmlFor="edit-showPrice" className="text-xs text-slate-600 whitespace-nowrap">
              Show $
            </label>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Price</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-600">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-1 self-end pb-1">
            <input
              type="checkbox"
              id="edit-showPrice"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded"
            />
            <label htmlFor="edit-showPrice" className="text-xs text-slate-600 whitespace-nowrap">
              Show $
            </label>
          </div>
        </div>
      )}

      {showQuantityColumn && (
        <div className="text-right text-xs font-semibold text-slate-700">
          Line total: ${lineTotal.toFixed(2)}
        </div>
      )}

      {/* ── Margin fields (Task 4) ─────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-200 space-y-2">
        <p className="text-xs font-medium text-slate-500">Margin</p>
        <div className="flex gap-3 flex-wrap">
          {/* Material / Profit Margin */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 whitespace-nowrap">
              {showLaborMarginField ? 'Material' : 'Margin'}
            </label>
            <input
              type="number"
              min="0"
              max="999"
              step="0.5"
              value={marginPercent}
              onChange={(e) => handleMarginChange(e.target.value)}
              className="w-16 px-2 py-1 text-xs border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
          {/* Labor Margin — only for component lines with labour_cost > 0 */}
          {showLaborMarginField && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 whitespace-nowrap">Labor</label>
              <input
                type="number"
                min="0"
                max="999"
                step="0.5"
                value={laborMarginPercent}
                onChange={(e) => handleLaborMarginChange(e.target.value)}
                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {showLaborMarginField
            ? 'Adjust material and labor margins for this line. Changing these updates the price above.'
            : 'Adjust the profit margin for this line. Changing this updates the price above.'}
        </p>
      </div>
      {/* ──────────────────────────────────────────────────────────────────── */}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 px-3 py-1 text-xs font-medium bg-black text-white rounded hover:bg-slate-800"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
