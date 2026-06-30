'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchUsers, type SearchUserRow } from './actions';

const PLAN_BADGE: Record<string, string> = {
  pro_plus:  'bg-purple-100 text-purple-700',
  pro:       'bg-blue-100 text-blue-700',
  growth:    'bg-sky-100 text-sky-700',
  starter:   'bg-emerald-100 text-emerald-700',
  trial:     'bg-amber-100 text-amber-700',
  free:      'bg-slate-100 text-slate-500',
};

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  trialing:  'bg-amber-100 text-amber-700 border-amber-200',
  past_due:  'bg-orange-100 text-orange-700 border-orange-200',
  grace:     'bg-orange-100 text-orange-700 border-orange-200',
  disputed:  'bg-red-100 text-red-700 border-red-200',
  canceled:  'bg-slate-100 text-slate-400 border-slate-100',
  suspended: 'bg-slate-100 text-slate-400 border-slate-100',
};

function PlanBadge({ code }: { code: string | null }) {
  if (!code || code === 'premium') return null;
  const cls = PLAN_BADGE[code] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {code.replace(/_/g, ' ')}
    </span>
  );
}

export function UsersPanel() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<SearchUserRow[]>([]);
  const [loading, startSearch] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSearch(async () => {
      const res = await searchUsers(search, 50, 0);
      if (res.ok) {
        setUsers(res.users);
        setHasSearched(true);
      } else {
        setError(res.error);
      }
    });
  }

  function loadAll() {
    setError(null);
    startSearch(async () => {
      const res = await searchUsers('', 50, 0);
      if (res.ok) {
        setUsers(res.users);
        setHasSearched(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or company name…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          Show all
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && users.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">Loading…</p>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">
              {hasSearched ? `No users matching "${search}"` : 'Search for a user by email or company name, or click "Show all".'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Plan</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/admin/users/${u.id}`)}
                  className="hover:bg-orange-50/40 hover:border-orange-200 transition cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.fullName ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-slate-700">{u.companyName}</td>
                  <td className="px-4 py-3"><PlanBadge code={u.planCode} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.subscriptionStatus && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${STATUS_BADGE[u.subscriptionStatus] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                          {u.subscriptionStatus}
                        </span>
                      )}
                      {u.adminPaused && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Paused
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <svg className="w-4 h-4 text-slate-400 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {users.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            {users.length} user{users.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
