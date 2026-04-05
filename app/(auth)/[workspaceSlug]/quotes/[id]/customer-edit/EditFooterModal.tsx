'use client';
import { useState } from 'react';

interface Props {
  footerText: string;
  onSave: (footerText: string) => void;
  onCancel: () => void;
}

export function EditFooterModal({ footerText, onSave, onCancel }: Props) {
  const [text, setText] = useState(footerText);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Edit Footer / Terms & Conditions</h2>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Payment terms, disclaimers, etc."
          rows={6}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        />

        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(text)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
