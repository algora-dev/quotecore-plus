'use client';

import { useState } from 'react';
import type { SignupRow } from './actions';

/**
 * Admin "Signups" tab - real app signups (demo-visitor tracking moved to the
 * per-user Guided Walkthrough section, owner 2026-11-02).
 */
export function SignupsPanel({
  initialSignups,
  initialError,
}: {
  initialSignups: SignupRow[];
  initialError: string | null;
}) {
  const [signups] = useState(initialSignups);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (...fields: (string | null | undefined)[]) =>
    !q || fields.some(f => (f ?? '').toLowerCase().includes(q));

  const filteredSignups = signups.filter(s => matches(s.companyName, s.ownerEmail, s.ownerName));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Signups</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real companies match the agent API (<code className="text-xs">/api/admin/signups</code>). Guided walkthrough usage now lives on each user in App Users.
          </p>
        </div>
      </div>

      {initialError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load signups: {initialError}
        </div>
      )}

      <input
        type="text"
        placeholder="Search by business, email or name..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="mt-4 w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
      />

      <div className="mt-4 space-y-2">
          {filteredSignups.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
              No real signups match.
            </div>
          )}
          {filteredSignups.map(s => (
            <div
              key={s.companyId}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{s.companyName}</span>
                    {s.adminPaused && (
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200">Paused</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500 truncate">
                    {s.ownerName ? `${s.ownerName} · ` : ''}{s.ownerEmail}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-slate-700">{fmtDate(s.signedUpAt)}</p>
                  <div className="mt-1 flex items-center gap-1.5 justify-end">
                    <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">{s.planCode ?? 'free'}</span>
                    {s.trialEndsAt && (
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                        trial → {new Date(s.trialEndsAt).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
