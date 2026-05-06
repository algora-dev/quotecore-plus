'use client';

import { useId } from 'react';

/**
 * Generic editable list of {name, rate} taxes used in two places:
 *   1. /settings → company-wide defaults
 *   2. customer-edit → per-quote overrides (with extra Show/Include toggles)
 *
 * The component is purely controlled: parent owns the list, this just renders
 * inputs and emits the new array on every change. Optional `extras` slot lets
 * callers append per-row toggles without forking the layout (used by the
 * customer-edit version to add Show/Include checkboxes).
 */
export interface EditableTax {
  /** Stable id; new rows use a `tmp-…` id until they're saved. */
  id: string;
  /** Original DB id for existing rows (undefined for new rows so the server inserts). */
  dbId?: string;
  name: string;
  rate_percent: number;
  /** Per-quote rows pass this through unchanged so we don't lose linkage on save. */
  source_tax_id?: string | null;
  /** Per-quote toggles. Settings page ignores these. */
  include_in_quote?: boolean;
  include_in_labor?: boolean;
}

interface Props {
  taxes: EditableTax[];
  onChange: (next: EditableTax[]) => void;
  /** When true, render Show-on-Quote and Show-on-Labor checkboxes per row. */
  showAudienceToggles?: boolean;
  /** Disable all inputs while saving. */
  disabled?: boolean;
}

export function TaxEditor({ taxes, onChange, showAudienceToggles = false, disabled = false }: Props) {
  const idBase = useId();

  function update(idx: number, patch: Partial<EditableTax>) {
    const next = taxes.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    onChange(next);
  }

  function remove(idx: number) {
    onChange(taxes.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([
      ...taxes,
      {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        rate_percent: 0,
        include_in_quote: true,
        include_in_labor: true,
      },
    ]);
  }

  return (
    <div className="space-y-2">
      {taxes.length === 0 && (
        <p className="text-xs text-slate-500 italic">
          No taxes configured. Click &quot;Add tax&quot; to create one.
        </p>
      )}

      {taxes.map((tax, idx) => (
        <div
          key={tax.id}
          className="flex flex-wrap items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50"
        >
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
              Name
            </label>
            <input
              id={`${idBase}-name-${idx}`}
              type="text"
              value={tax.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              disabled={disabled}
              placeholder="e.g. GST"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="w-28">
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
              Rate (%)
            </label>
            <input
              id={`${idBase}-rate-${idx}`}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={tax.rate_percent}
              onChange={(e) => {
                const n = Number(e.target.value);
                update(idx, { rate_percent: Number.isFinite(n) ? n : 0 });
              }}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {showAudienceToggles && (
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tax.include_in_quote ?? true}
                  onChange={(e) => update(idx, { include_in_quote: e.target.checked })}
                  disabled={disabled}
                />
                Quote
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tax.include_in_labor ?? true}
                  onChange={(e) => update(idx, { include_in_labor: e.target.checked })}
                  disabled={disabled}
                />
                Labor sheet
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={() => remove(idx)}
            disabled={disabled}
            title="Remove tax"
            className="icon-btn icon-btn--danger ml-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="px-3 py-1.5 text-sm font-medium rounded-full border border-dashed border-slate-300 text-slate-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition disabled:opacity-50"
      >
        + Add tax
      </button>
    </div>
  );
}
