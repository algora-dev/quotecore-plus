'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  getT1Stats,
  getT2Users,
  type T1ToolStat,
  type T1DailyStat,
  type T2User,
} from './actions';

type Tab = 't1' | 't2';

export function FreeToolUsagePanel() {
  const [tab, setTab] = useState<Tab>('t1');

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('t1')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            tab === 't1'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
 Anonymous (T1)
        </button>
        <button
          onClick={() => setTab('t2')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            tab === 't2'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Free-tool accounts (T2)
        </button>
      </div>

      {tab === 't1' && <T1Tab />}
      {tab === 't2' && <T2Tab />}
    </div>
  );
}

// ── T1: Anonymous aggregate usage ──────────────────────────

function T1Tab() {
  const [toolStats, setToolStats] = useState<T1ToolStat[]>([]);
  const [dailyStats, setDailyStats] = useState<T1DailyStat[]>([]);
  const [totalT1, setTotalT1] = useState(0);
  const [loading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    startLoad(async () => {
      const res = await getT1Stats();
      if (res.ok) {
        setToolStats(res.toolStats);
        setDailyStats(res.dailyStats);
        setTotalT1(res.totalT1);
      } else {
        setError(res.error);
      }
    });
  }

  useEffect(() => { load(); }, []);

  const maxDaily = Math.max(...dailyStats.map((d) => d.totalUses), 1);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total anonymous uses" value={totalT1} />
        <StatCard label="Distinct tools used" value={toolStats.length} />
        <StatCard label="Image scans" value={toolStats.reduce((s, t) => s + t.imageUses, 0)} />
        <StatCard label="Text parses" value={toolStats.reduce((s, t) => s + t.textUses, 0)} />
      </div>

      {/* Tool breakdown table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Tool popularity</h3>
        </div>
        {loading && toolStats.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">Loading...</p>
        ) : toolStats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No anonymous usage recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Tool</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Total uses</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Image</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Text</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Last used</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Popularity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {toolStats.map((t) => {
                const pct = totalT1 > 0 ? (t.totalUses / totalT1) * 100 : 0;
                return (
                  <tr key={t.toolCode} className="hover:bg-orange-50/40 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.toolName}</td>
                    <td className="px-4 py-3 text-slate-700">{t.totalUses}</td>
                    <td className="px-4 py-3 text-slate-500">{t.imageUses}</td>
                    <td className="px-4 py-3 text-slate-500">{t.textUses}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {t.lastUsed ? new Date(t.lastUsed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#FF6B35] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Daily usage sparkline (last 30 days) */}
      {dailyStats.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Usage over time (last 30 days)</h3>
          <div className="flex items-end gap-1 h-32">
            {dailyStats.map((d) => (
              <div
                key={d.date}
                className="flex-1 bg-[#FF6B35] rounded-t-sm min-w-[2px] transition-all hover:opacity-80"
                style={{ height: `${(d.totalUses / maxDaily) * 100}%` }}
                title={`${d.date}: ${d.totalUses} uses`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>{dailyStats[0]?.date}</span>
            <span>{dailyStats[dailyStats.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── T2: Free-tool account users ────────────────────────────

function T2Tab() {
  const [users, setUsers] = useState<T2User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<T2User | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    setError(null);
    startLoad(async () => {
      const res = await getT2Users(50, 0);
      if (res.ok) {
        setUsers(res.users);
        setTotal(res.total);
      } else {
        setError(res.error);
      }
    });
  }

  useEffect(() => { load(); }, []);

  if (selectedUser) {
    return <T2UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
          <StatCard label="Free-tool account users" value={total} />
          <StatCard label="Active in last 7 days" value={users.filter((u) => Date.now() - new Date(u.lastActiveAt).getTime() < 7 * 86400000).length} />
          <StatCard label="Total tools used" value={new Set(users.flatMap((u) => u.toolsUsed.map((t) => t.toolCode))).size} />
        </div>
        {users.length > 0 && (
          <button
            onClick={() => {
              const emails = users.map((u) => u.email).join(', ');
              navigator.clipboard.writeText(emails);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#FF6B35]/40 hover:bg-orange-50/40 transition"
          >
            {copied ? 'Copied!' : 'Copy all emails'}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Free-tool account users (no app workspace)</h3>
          <p className="text-xs text-slate-500 mt-0.5">Signed up via free tools but haven&apos;t created an app account/workspace.</p>
        </div>
        {loading && users.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">Loading...</p>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No free-tool account users yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Signup date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Last active</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Tools used</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Usage count</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr
                  key={u.userId}
                  onClick={() => setSelectedUser(u)}
                  className="hover:bg-orange-50/40 hover:border-orange-200 transition cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.lastActiveAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{u.toolCount}</td>
                  <td className="px-4 py-3 text-slate-700">{u.toolsUsed.reduce((s, t) => s + t.count, 0)}</td>
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
            {users.length} of {total} users
          </div>
        )}
      </div>
    </div>
  );
}

function T2UserDetail({ user, onBack }: { user: T2User; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-slate-500 hover:text-slate-700 transition flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to list
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900">{user.email}</h2>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Signup date</dt>
            <dd className="mt-1 text-slate-900">{new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Last active</dt>
            <dd className="mt-1 text-slate-900">{new Date(user.lastActiveAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Tools used</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Tool</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Usage count</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Last used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {user.toolsUsed.map((t) => (
              <tr key={t.toolCode} className="hover:bg-orange-50/40 transition">
                <td className="px-4 py-3 font-medium text-slate-900">{t.toolName}</td>
                <td className="px-4 py-3 text-slate-700">{t.count}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(t.lastUsed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared ─────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
