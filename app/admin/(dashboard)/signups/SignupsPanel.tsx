'use client';

import { useState } from 'react';
import type { DemoVisitorRow } from '@/app/lib/admin/demo-visitors';
import type { SignupRow } from './actions';

type Tab = 'real' | 'demo';

/**
 * Admin "Signups" tab - split into real app signups and demo visitors.
 * Real tab mirrors the /api/admin/signups agent feed exactly, so the
 * human view and the agent alerts always agree. Demo tab lists the
 * fictional @demo.invalid workspaces provisioned by /demo.
 */
export function SignupsPanel({
  initialSignups,
  initialDemoVisitors,
  initialError,
}: {
  initialSignups: SignupRow[];
  initialDemoVisitors: DemoVisitorRow[];
  initialError: string | null;
}) {
  const [signups] = useState(initialSignups);
  const [demoVisitors] = useState(initialDemoVisitors);
  const [tab, setTab] = useState<Tab>('real');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (...fields: (string | null | undefined)[]) =>
    !q || fields.some(f => (f ?? '').toLowerCase().includes(q));

  const filteredSignups = signups.filter(s => matches(s.companyName, s.ownerEmail, s.ownerName));
  const filteredDemos = demoVisitors.filter(d => matches(d.companyName, d.ownerEmail));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Signups</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real companies match the agent API (<code className="text-xs">/api/admin/signups</code>). Demo visitors are fictional /demo workspaces.
          </p>
        </div>
      </div>

      {initialError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load signups: {initialError}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setTab('real')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
            tab === 'real'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          Real users <span className="ml-1 opacity-70">{signups.length}</span>
        </button>
        <button
          onClick={() => setTab('demo')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
            tab === 'demo'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          Demo users <span className="ml-1 opacity-70">{demoVisitors.length}</span>
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by business, email or name..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="mt-4 w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
      />

      {tab === 'real' ? (
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
      ) : (
        <div className="mt-4 space-y-2">
          {filteredDemos.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
              No demo visitors match.
            </div>
          )}
          {filteredDemos.map(d => {
            const expired = d.expiresAt ? new Date(d.expiresAt).getTime() < Date.now() : false;
            return (
              <div
                key={d.companyId}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900 truncate">{d.companyName}</span>
                    <p className="mt-0.5 text-sm text-slate-500 truncate">{d.ownerEmail || 'No visitor profile'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-slate-700">{fmtDate(d.signedUpAt)}</p>
                    <div className="mt-1 flex items-center gap-1.5 justify-end">
                      {d.sessionStatus === 'active' && !expired ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Active
                        </span>
                      ) : d.sessionStatus === 'provisioning' ? (
                        <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">Provisioning</span>
                      ) : (
                        <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          {d.sessionStatus ?? 'ended'}
                        </span>
                      )}
                      {typeof d.resetCount === 'number' && d.resetCount > 0 && (
                        <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                          {d.resetCount} reset{d.resetCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
