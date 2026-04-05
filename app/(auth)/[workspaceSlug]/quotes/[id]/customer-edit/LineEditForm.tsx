'use client';
import { useState } from 'react';

interface Props {
  initialText: string;
  initialAmount: number;
  initialShowPrice: boolean;
  onSave: (text: string, amount: number, showPrice: boolean) => void;
  onCancel: () => void;
}

export function LineEditForm({ initialText, initialAmount, initialShowPrice, onSave, onCancel }: Props) {
  const [text, setText] = useState(initialText);
  const [amount, setAmount] = useState(initialAmount.toString());
  const [showPrice, setShowPrice] = useState(initialShowPrice);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!text.trim() || isNaN(amountNum) || amountNum < 0) {
      alert('Please enter valid text and amount');
      return;
    }
    onSave(text.trim(), amountNum, showPrice);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-300">
      <div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
          placeholder="Line text"
          autoFocus
          required
        />
      </div>
      
      <div className="flex gap-2 items-center">
        <div className="flex-1">
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
        
        <div className="flex items-center gap-1">
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
          className="flex-1 px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700"
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
