'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface QuoteLine {
  id: string;
  custom_text: string | null;
  custom_amount: number | null;
  line_type: string | null;
  sort_order: number | null;
}

interface Props {
  quoteId: string;
  workspaceSlug: string;
  lines: QuoteLine[];
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '';
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(amount);
}

export function InvoiceLineSelector({ quoteId, workspaceSlug, lines }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(lines.map(l => l.id)));
  const [search, setSearch] = useState('');
  const [navigating, setNavigating] = useState(false);

  const filtered = search
    ? lines.filter(l => (l.custom_text ?? '').toLowerCase().includes(search.toLowerCase()))
    : lines;

  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id));

  function toggleSelectAll() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach(l => next.delete(l.id));
      } else {
        filtered.forEach(l => next.add(l.id));
      }
      return next;
    });
  }

  function toggleLine(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCreateInvoice() {
    const lineIds = lines.filter(l => selected.has(l.id)).map(l => l.id);
    if (lineIds.length === 0) return;
    setNavigating(true);
    const params = new URLSearchParams({ quoteId, lines: lineIds.join(',') });
    router.push(`/${workspaceSlug}/invoices/new-from-quote?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Search + bulk actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lines…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-orange-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={toggleSelectAll}
          className="px-3 py-2 text-xs font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-orange-300 hover:text-orange-700 transition-all whitespace-nowrap"
        >
          {allFilteredSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Line list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">
            {lines.length === 0
              ? 'No customer quote lines saved for this quote yet. Build the customer quote first.'
              : 'No lines match your search.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {filtered.map(line => {
            const isSelected = selected.has(line.id);
            return (
              <label
                key={line.id}
                className={`flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-white hover:bg-orange-50/40' : 'bg-slate-50/60 opacity-50 hover:opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleLine(line.id)}
                  className="w-4 h-4 rounded text-orange-600 border-slate-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 truncate">
                    {line.custom_text || <em className="text-slate-400">Unnamed line</em>}
                  </p>
                  {line.line_type && line.line_type !== 'custom' && (
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">{line.line_type}</p>
                  )}
                </div>
                {line.custom_amount != null && (
                  <span className="text-sm font-medium text-slate-700 tabular-nums">
                    {formatAmount(line.custom_amount)}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}

      {/* Selection count + CTA */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-slate-500">
          {selected.size} of {lines.length} line{lines.length !== 1 ? 's' : ''} selected
        </p>
        <button
          type="button"
          onClick={handleCreateInvoice}
          disabled={selected.size === 0 || navigating}
          className="px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.25)] disabled:opacity-40 transition-all"
        >
          {navigating ? 'Loading…' : `Create Invoice → (${selected.size} lines)`}
        </button>
      </div>
    </div>
  );
}
