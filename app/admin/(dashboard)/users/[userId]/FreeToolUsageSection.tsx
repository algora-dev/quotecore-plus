'use client';

import { useState, useEffect, useTransition } from 'react';
import { getT3UserUsage, type T3UserUsage } from '../../free-tool-usage/actions';

/**
 * T3 free-tool usage section for the admin user profile page.
 * Shows tools used, usage count per tool, and last free-tool activity
 * for an existing app user.
 */
export function FreeToolUsageSection({ userId }: { userId: string }) {
  const [usage, setUsage] = useState<T3UserUsage[]>([]);
  const [totalUses, setTotalUses] = useState(0);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startLoad(async () => {
      const res = await getT3UserUsage(userId);
      if (res.ok) {
        setUsage(res.usage);
        setTotalUses(res.totalUses);
        setLastActivity(res.lastActivity);
      } else {
        setError(res.error);
      }
    });
  }, [userId]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Free Tool Usage</h2>
        {lastActivity && (
          <span className="text-xs text-slate-400">
            Last activity: {new Date(lastActivity).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {loading && usage.length === 0 ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : usage.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-slate-500">
            No free-tool usage recorded for this user.
            <span className="block mt-1 text-xs">Total uses: {totalUses}</span>
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-4 text-sm">
            <span className="text-slate-500">Total uses: <strong className="text-slate-900">{totalUses}</strong></span>
            <span className="text-slate-500">Distinct tools: <strong className="text-slate-900">{usage.length}</strong></span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Tool</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Mode</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Count</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Last used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usage.map((u, i) => (
                <tr key={`${u.toolCode}-${u.parseMode}-${i}`} className="hover:bg-orange-50/40 transition">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.toolName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.parseMode === 'image'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {u.parseMode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{u.count}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.lastUsed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
