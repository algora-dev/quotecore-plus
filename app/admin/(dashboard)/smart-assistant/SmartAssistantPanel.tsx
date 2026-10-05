'use client';

import { useState, useTransition } from 'react';
import type { SmartAssistantCompanyRow } from './actions';
import { setSmartAssistantEnabled } from './actions';

export function SmartAssistantPanel({ initialRows }: { initialRows: SmartAssistantCompanyRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = filter.trim()
    ? rows.filter((r) => {
        const q = filter.trim().toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.slug ?? '').toLowerCase().includes(q) ||
          (r.owner_email ?? '').toLowerCase().includes(q)
        );
      })
    : rows;

  function toggle(row: SmartAssistantCompanyRow) {
    setBusyId(row.company_id);
    setError(null);
    startTransition(async () => {
      const result = await setSmartAssistantEnabled(row.company_id, !row.enabled);
      if (result.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.company_id === row.company_id
              ? { ...r, enabled: !r.enabled, enabled_at: new Date().toISOString() }
              : r,
          ),
        );
      } else {
        setError(result.error);
      }
      setBusyId(null);
    });
  }

  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search company, slug or owner email"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {enabledCount} of {rows.length} companies enabled
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No companies match this search.
          </div>
        )}
        {filtered.map((row) => (
          <div
            key={row.company_id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-orange-50/40 hover:border-orange-200 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 truncate">{row.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    row.enabled
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      row.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  {row.enabled ? 'Enabled' : 'Off'}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {row.owner_email ?? 'no owner email'}
                {row.plan_code ? ` · ${row.plan_code}` : ''}
                {row.enabled_at
                  ? ` · since ${new Date(row.enabled_at).toLocaleDateString()}`
                  : ''}
              </div>
            </div>
            <button
              onClick={() => toggle(row)}
              disabled={pending && busyId === row.company_id}
              className={`rounded-full px-4 py-1.5 text-xs whitespace-nowrap transition-shadow disabled:opacity-50 ${
                row.enabled
                  ? 'border border-slate-200 bg-white text-slate-700 hover:shadow-[0_0_8px_rgba(15,23,42,0.08)]'
                  : 'bg-black text-white hover:shadow-[0_0_12px_rgba(0,0,0,0.25)]'
              }`}
            >
              {pending && busyId === row.company_id
                ? 'Saving...'
                : row.enabled
                  ? 'Revoke access'
                  : 'Grant access'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
