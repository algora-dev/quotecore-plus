'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Component {
  id: string;
  name: string;
  measurement_type: string | null;
  final_quantity: number | null;
  priced_quantity: number | null;
  material_cost: number | null;
  labour_cost: number | null;
}

interface Props {
  quoteId: string;
  workspaceSlug: string;
  layout: string;
  column?: string;
  components: Component[];
}

function formatQty(comp: Component): string {
  // Fixed Quantity: show priced units (rounded-up purchasable count)
  // plus the actual measurement in brackets.
  const priced = comp.priced_quantity;
  const qty = comp.final_quantity;
  if (!qty) return '';
  const mt = comp.measurement_type;
  const unit =
    mt === 'lineal' ? 'm'
    : mt === 'area' ? 'm²'
    : mt === 'quantity' ? 'pcs'
    : '';
  const measurementStr = `${Math.round(qty * 100) / 100}${unit ? ' ' + unit : ''}`;
  if (priced != null) {
    return `${priced} (${measurementStr})`;
  }
  return measurementStr;
}

export function LineSelector({ quoteId, workspaceSlug, layout, column, components }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(components.map(c => c.id)));
  const [search, setSearch] = useState('');

  const filtered = search
    ? components.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : components;

  const allFilteredSelected = filtered.every(c => selected.has(c.id));

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(components.map(c => c.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.add(c.id));
        return next;
      });
    }
  }

  function handleCreateOrder() {
    if (selected.size === 0) return;
    const componentIds = components.filter(c => selected.has(c.id)).map(c => c.id).join(',');
    const colParam = column ? `&column=${column}` : '';
    router.push(
      `/${workspaceSlug}/material-orders/create?quoteId=${quoteId}&layout=${layout}&components=${componentIds}${colParam}`
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>

        {/* Select / deselect controls */}
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600 transition"
          >
            Select all
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-600 hover:border-slate-400 transition"
          >
            Deselect all
          </button>
        </div>

        {/* Selected count badge */}
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-800">{selected.size}</span> of {components.length} selected
        </span>
      </div>

      {/* Header row */}
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-[32px_1fr_120px] gap-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <label className="flex items-center cursor-pointer" title={allFilteredSelected ? 'Deselect all shown' : 'Select all shown'}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              className="w-3.5 h-3.5 rounded text-orange-600"
            />
          </label>
          <span>Component</span>
          <span className="text-right">Qty</span>
        </div>
      )}

      {/* Component rows */}
      {filtered.length > 0 ? (
        <div className="grid gap-1">
          {filtered.map(comp => {
            const isSelected = selected.has(comp.id);
            return (
              <div
                key={comp.id}
                onClick={() => toggle(comp.id)}
                className={`grid sm:grid-cols-[32px_1fr_120px] gap-4 items-center rounded-xl border px-4 py-3 cursor-pointer transition select-none ${
                  isSelected
                    ? 'border-orange-200 bg-orange-50/60 hover:border-orange-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(comp.id)}
                    className="w-4 h-4 rounded text-orange-600"
                  />
                </div>
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                  {comp.name}
                </p>
                <p className={`text-sm text-right tabular-nums ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
                  {formatQty(comp)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-slate-500">No components match your search.</p>
        </div>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-4 pt-4">
        <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-md">
          <p className="text-sm text-slate-600">
            {selected.size === 0
              ? 'Select at least one component to continue.'
              : `${selected.size} component${selected.size !== 1 ? 's' : ''} will be added to the order.`}
          </p>
          <button
            onClick={handleCreateOrder}
            disabled={selected.size === 0}
            className="px-5 py-2 text-sm font-medium rounded-full bg-black text-white disabled:opacity-40 hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Create Order →
          </button>
        </div>
      </div>
    </div>
  );
}
