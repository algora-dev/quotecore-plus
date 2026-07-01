'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { listRateLimits, resetRateLimit, resetAllRateLimits, type RateLimitRow } from './actions';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function RateLimitsPanel({ initialRows }: { initialRows: RateLimitRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<RateLimitRow[]>(initialRows);
  const [search, setSearch] = useState('');
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await listRateLimits(search);
      if (res.ok) {
        setRows(res.rows);
      } else {
        setError(res.error);
      }
    });
  }

  function onReset(bucketKey: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await resetRateLimit(bucketKey);
      if (res.ok) {
        setNotice(res.message);
        // Update local state
        setRows((prev) =>
          prev.map((r) =>
            r.bucket_key === bucketKey
              ? { ...r, count: 0, window_start: new Date().toISOString(), updated_at: new Date().toISOString() }
              : r,
          ),
        );
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onResetAll() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await resetAllRateLimits(search);
      if (res.ok) {
        setNotice(res.message);
        // Refresh from server
        const listRes = await listRateLimits(search);
        if (listRes.ok) {
          setRows(listRes.rows);
        }
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Search + actions */}
      <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by bucket key…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50"
        >
          {loading ? 'Filtering…' : 'Filter'}
        </button>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={onResetAll}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-full border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
          >
            Reset all{search ? ' (filtered)' : ''}
          </button>
        )}
      </form>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">
              No rate-limit buckets{search ? ` matching "${search}"` : ''}.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Bucket Key</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Count</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Window Start</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Last Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr
                  key={r.bucket_key}
                  className="hover:bg-orange-50/40 hover:border-orange-200 transition"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 break-all">{r.bucket_key}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                      r.count > 0
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${r.count > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {r.count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatTime(r.window_start)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatTime(r.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onReset(r.bucket_key)}
                      disabled={loading || r.count === 0}
                      className="text-xs font-medium text-slate-600 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            {rows.length} bucket{rows.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
