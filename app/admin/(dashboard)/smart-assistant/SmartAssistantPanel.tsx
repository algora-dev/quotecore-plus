'use client';

import { useState, useTransition } from 'react';
import type { SmartAssistantCompanyRow } from './actions';
import { setSmartAssistantEnabled, clearSmartAssistantOverride } from './actions';

/**
 * Smart Assistant override management (owner 2026-10-17): access follows the
 * subscription by default. Each row can FORCE ON (internal testing override)
 * or FORCE OFF (emergency kill switch); clearing the override returns the
 * company to subscription-driven access.
 */
export function SmartAssistantPanel({ initialRows }: { initialRows: SmartAssistantCompanyRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  function run(
    row: SmartAssistantCompanyRow,
    action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
    patch: Partial<SmartAssistantCompanyRow>,
  ) {
    setBusyId(row.company_id);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.company_id === row.company_id
              ? { ...r, ...patch, enabled_at: patch.override === null ? null : new Date().toISOString() }
              : r,
          ),
        );
        setNotice(result.message);
      } else if ('error' in result) {
        setError(result.error);
      }
      setBusyId(null);
    });
  }

  const forcedOn = rows.filter((r) => r.override === 'force_on').length;
  const forcedOff = rows.filter((r) => r.override === 'force_off').length;

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
          {forcedOn} forced on · {forcedOff} forced off · {rows.length - forcedOn - forcedOff} follow the subscription
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-900 truncate">{row.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    row.override === 'force_on'
                      ? 'bg-emerald-50 text-emerald-700'
                      : row.override === 'force_off'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      row.override === 'force_on'
                        ? 'bg-emerald-500'
                        : row.override === 'force_off'
                          ? 'bg-red-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  {row.override === 'force_on'
                    ? 'Forced on (override)'
                    : row.override === 'force_off'
                      ? 'Forced off (kill switch)'
                      : 'Subscription decides'}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {row.owner_email ?? 'no owner email'}
                {row.billing_model === 'custom_setup' ? ' · Custom plan' : ' · Legacy plan'}
                {row.plan_code ? ` · ${row.plan_code}` : ''}
                {row.override && row.enabled_at
                  ? ` · since ${new Date(row.enabled_at).toLocaleDateString()}`
                  : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {row.override !== 'force_on' && (
                <button
                  onClick={() => run(row, () => setSmartAssistantEnabled(row.company_id, true), { enabled: true, override: 'force_on' })}
                  disabled={pending && busyId === row.company_id}
                  className="rounded-full px-4 py-1.5 text-xs whitespace-nowrap border border-slate-200 bg-white text-slate-700 hover:shadow-[0_0_8px_rgba(15,23,42,0.08)] disabled:opacity-50"
                  title="Internal testing override: force the Assistant on regardless of billing"
                >
                  Force on
                </button>
              )}
              {row.override !== 'force_off' && (
                <button
                  onClick={() => run(row, () => setSmartAssistantEnabled(row.company_id, false), { enabled: false, override: 'force_off' })}
                  disabled={pending && busyId === row.company_id}
                  className="rounded-full px-4 py-1.5 text-xs whitespace-nowrap border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                  title="Emergency kill switch: force the Assistant off regardless of billing"
                >
                  Force off
                </button>
              )}
              {row.override !== null && (
                <button
                  onClick={() => run(row, () => clearSmartAssistantOverride(row.company_id), { enabled: false, override: null })}
                  disabled={pending && busyId === row.company_id}
                  className="rounded-full px-4 py-1.5 text-xs whitespace-nowrap bg-black text-white hover:shadow-[0_0_12px_rgba(0,0,0,0.25)] disabled:opacity-50"
                >
                  Clear override
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
