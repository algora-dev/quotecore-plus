'use client';

// Modal for adding/editing a single line-by-line order line. Mirrors the
// customer quote editor's "Add Custom Line" UX (tidy modal) but adapted to the
// order line shape: primary text, optional quantity/detail, optional price,
// and a show-price toggle.

import { useState } from 'react';

interface Props {
  /** When editing, the existing values to prefill. */
  initial?: {
    text: string;
    quantityText: string | null;
    amount: number;
    showPrice: boolean;
  };
  currencySymbol?: string;
  onSave: (line: { text: string; quantityText: string | null; amount: number; showPrice: boolean }) => void;
  onClose: () => void;
}

export function AddOrderLineModal({ initial, currencySymbol = '', onSave, onClose }: Props) {
  const [text, setText] = useState(initial?.text ?? '');
  const [quantityText, setQuantityText] = useState(initial?.quantityText ?? '');
  const [price, setPrice] = useState(initial?.amount ? String(initial.amount) : '');
  const [showPrice, setShowPrice] = useState(initial?.showPrice ?? true);

  const isEdit = !!initial;
  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const amountNum = parseFloat(price.replace(/[^0-9.-]/g, ''));
    onSave({
      text: t,
      quantityText: quantityText.trim() || null,
      amount: Number.isFinite(amountNum) ? amountNum : 0,
      showPrice,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Edit line' : 'Add line'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item / Description *</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Concrete roof tile, Ridge flashing"
              className={inputCls}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity / extra detail (optional)</label>
            <input
              type="text"
              value={quantityText}
              onChange={(e) => setQuantityText(e.target.value)}
              placeholder="e.g. 24 per pack, 5.5m length"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Price {currencySymbol ? `(${currencySymbol})` : ''} (optional)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="aol-showPrice"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded"
            />
            <label htmlFor="aol-showPrice" className="text-sm text-slate-700">Show price on this line</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={!text.trim()} className="flex-1 px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-40 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">
              {isEdit ? 'Save line' : 'Add line'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
