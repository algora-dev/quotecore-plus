'use client';

import { useState } from 'react';
import { createQuoteFromTemplate, createBlankQuote } from '../actions';
import type { TemplateRow } from '@/app/lib/types';

export function NewQuoteForm({
  templates,
  preselectedTemplateId,
  workspaceSlug,
}: {
  templates: TemplateRow[];
  preselectedTemplateId?: string;
  workspaceSlug: string;
}) {
  const [customerName, setCustomerName] = useState('');
  const [templateId, setTemplateId] = useState(preselectedTemplateId || '');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) return;
    setCreating(true);

    try {
      if (templateId) {
        await createQuoteFromTemplate(templateId, customerName.trim());
      } else {
        await createBlankQuote(customerName.trim());
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create quote');
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
          placeholder="e.g. John Smith"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Start from Template</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
        >
          <option value="">Blank quote (no template)</option>
          {templates.filter((t) => t.is_active).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={creating || !customerName.trim()}
        className="w-full py-2.5 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {creating ? 'Creating...' : 'Create Quote'}
      </button>
    </form>
  );
}
