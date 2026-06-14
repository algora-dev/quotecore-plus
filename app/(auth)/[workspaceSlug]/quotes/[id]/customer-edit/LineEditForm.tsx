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
  onSave: (
    text: string,
    quantity: string | null,
    amount: number,
    showPrice: boolean,
    qty: number,
    unitPrice: number | null,
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

  // Derived line total when qty column is active
  const lineTotal = showQuantityColumn
    ? Number(((parseFloat(qty) || 1) * (parseFloat(amount) || 0)).toFixed(2))
    : parseFloat(amount) || 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!text.trim() || isNaN(amountNum) || amountNum < 0) {
      alert('Please enter valid text and amount');
      return;
    }
    const qtyText = quantity.trim() === '' ? null : quantity.trim();

    if (showQuantityColumn) {
      const qtyNum = Math.max(1, parseInt(qty) || 1);
      const unitP = amountNum;
      const total = Number((qtyNum * unitP).toFixed(2));
      onSave(text.trim(), qtyText, total, showPrice, qtyNum, unitP);
    } else {
      onSave(text.trim(), qtyText, amountNum, showPrice, 1, null);
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
