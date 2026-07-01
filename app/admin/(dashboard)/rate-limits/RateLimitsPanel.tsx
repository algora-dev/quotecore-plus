'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { listRateLimits, resetRateLimit, resetAllRateLimits } from './actions';
import type { RateLimitRowWithMeta, BucketSeverity } from './helpers';

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

const SEVERITY_STYLES: Record<BucketSeverity, { dot: string; badge: string; bar: string; label: string }> = {
  red: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 border-red-200',
    bar: 'bg-red-500',
    label: 'URGENT',
  },
  yellow: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    label: 'WARNING',
  },
  green: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    label: 'OK',
  },
};

export function RateLimitsPanel({ initialRows }: { initialRows: RateLimitRowWithMeta[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<RateLimitRowWithMeta[]>(initialRows);
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
        setRows((prev) =>
          prev.map((r) =>
            r.bucket_key === bucketKey
              ? { ...r, count: 0, severity: 'green' as const, pct: 0, window_start: new Date().toISOString(), updated_at: new Date().toISOString() }
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

  const redCount = rows.filter(r => r.severity === 'red').length;
  const yellowCount = rows.filter(r => r.severity === 'yellow').length;
  const greenCount = rows.filter(r => r.severity === 'green').length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Urgent</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{redCount}</p>
          <p className="text-xs text-slate-400">≥80% of limit</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Warning</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{yellowCount}</p>
          <p className="text-xs text-slate-400">50-79% of limit</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Healthy</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{greenCount}</p>
          <p className="text-xs text-slate-400">&lt;50% of limit</p>
        </div>
      </div>

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
            placeholder="Filter by bucket key (email, IP, user ID…)"
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
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Bucket</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Usage</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const sty = SEVERITY_STYLES[r.severity];
                return (
                  <tr
                    key={r.bucket_key}
                    className="hover:bg-orange-50/40 hover:border-orange-200 transition"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${sty.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                        {sty.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-900 break-all">{r.bucket_key}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700 tabular-nums">{r.count}/{r.max}</span>
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${sty.bar}`}
                            style={{ width: `${Math.min(100, r.pct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums">{r.pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatTime(r.updated_at)}</td>
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
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            {rows.length} bucket{rows.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
            {' · '}Sorted by urgency (red → yellow → green)
          </div>
        )}
      </div>
    </div>
  );
}
