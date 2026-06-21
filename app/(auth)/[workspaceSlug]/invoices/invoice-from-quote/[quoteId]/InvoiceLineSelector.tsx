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
  if (amount == null) return '—';
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
  const noneFilteredSelected = filtered.every(l => !selected.has(l.id));

  function selectAll() {
    setSelected(prev => { const s = new Set(prev); filtered.forEach(l => s.add(l.id)); return s; });
  }

  function deselectAll() {
    setSelected(prev => { const s = new Set(prev); filtered.forEach(l => s.delete(l.id)); return s; });
  }

  function toggleLine(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function toggleMaster() {
    if (allFilteredSelected) deselectAll(); else selectAll();
  }

  function handleCreate() {
    const lineIds = lines.filter(l => selected.has(l.id)).map(l => l.id);
    if (lineIds.length === 0) return;
    setNavigating(true);
    const params = new URLSearchParams({ quoteId, lines: lineIds.join(',') });
    router.push(`/${workspaceSlug}/invoices/new-from-quote?${params.toString()}`);
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
        <p className="text-sm text-slate-500 font-medium">No customer quote lines saved yet</p>
        <p className="text-xs text-slate-400 mt-1">Build the customer quote first, then come back to create an invoice from it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + bulk action buttons */}
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
          onClick={selectAll}
          disabled={allFilteredSelected}
          className="px-3 py-2 text-xs font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-orange-300 hover:text-orange-700 disabled:opacity-40 disabled:cursor-default transition-all"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={deselectAll}
          disabled={noneFilteredSelected}
          className="px-3 py-2 text-xs font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-orange-300 hover:text-orange-700 disabled:opacity-40 disabled:cursor-default transition-all"
        >
          Deselect all
        </button>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {selected.size} of {lines.length} selected
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleMaster}
            className="w-4 h-4 rounded text-orange-600 border-slate-300"
          />
          <span className="flex-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Line</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right w-24">Amount</span>
        </div>

        {/* Line rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">No lines match your search.</p>
          </div>
        ) : filtered.map(line => {
          const isSelected = selected.has(line.id);
          return (
            <label
              key={line.id}
              className={`flex items-center gap-4 px-4 py-3.5 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${
                isSelected ? 'bg-white hover:bg-orange-50/30' : 'bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleLine(line.id)}
                className="w-4 h-4 rounded text-orange-600 border-slate-300 flex-shrink-0"
              />
              <span className={`flex-1 text-sm truncate ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                {line.custom_text || <em className="text-slate-400">Unnamed line</em>}
              </span>
              <span className={`text-sm tabular-nums text-right w-24 ${isSelected ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                {formatAmount(line.custom_amount)}
              </span>
            </label>
          );
        })}
      </div>

      {/* Sticky bottom bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm text-slate-600">
          {selected.size === 0
            ? 'No lines selected.'
            : `${selected.size} line${selected.size !== 1 ? 's' : ''} will be added to the invoice.`}
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={selected.size === 0 || navigating}
          className="px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.25)] disabled:opacity-40 transition-all"
        >
          {navigating ? 'Loading…' : 'Create Invoice →'}
        </button>
      </div>
    </div>
  );
}
