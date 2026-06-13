'use client';
import { useState } from 'react';

interface Props {
  initialText: string;
  /** Quantity portion (e.g. "12 lm"), separate from the description. Optional -
   *  empty/blank means no quantity, which removes the description–quantity dash
   *  in the preview entirely. */
  initialQuantity?: string | null;
  initialAmount: number;
  initialShowPrice: boolean;
  onSave: (
    text: string,
    quantity: string | null,
    amount: number,
    showPrice: boolean,
  ) => void;
  onCancel: () => void;
}

export function LineEditForm({
  initialText,
  initialQuantity,
  initialAmount,
  initialShowPrice,
  onSave,
  onCancel,
}: Props) {
  const [text, setText] = useState(initialText);
  const [quantity, setQuantity] = useState(initialQuantity ?? '');
  const [amount, setAmount] = useState(initialAmount.toString());
  const [showPrice, setShowPrice] = useState(initialShowPrice);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!text.trim() || isNaN(amountNum) || amountNum < 0) {
      alert('Please enter valid text and amount');
      return;
    }
    // Empty quantity -> null, so the preview drops the dash between description
    // and quantity instead of rendering a trailing "Description -".
    const qty = quantity.trim() === '' ? null : quantity.trim();
    onSave(text.trim(), qty, amountNum, showPrice);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-300">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
          placeholder="Line description"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Quantity <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
          placeholder="e.g. 12 lm - leave blank for none"
        />
      </div>

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
