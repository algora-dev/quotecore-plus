'use client';
import { useState } from 'react';

interface Props {
  onAdd: (text: string, amount: number) => void;
  onClose: () => void;
}

export function AddCustomLineModal({ onAdd, onClose }: Props) {
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!text.trim() || isNaN(amountNum) || amountNum < 0) {
      alert('Please enter valid description and amount');
      return;
    }
    onAdd(text.trim(), amountNum);
    onClose();
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Add Custom Line</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Additional materials, Custom work"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Line
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
