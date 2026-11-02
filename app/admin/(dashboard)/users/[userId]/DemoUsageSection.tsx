'use client';

import { useEffect, useState, useTransition } from 'react';
import { getUserDemoUsage, type DemoUsageSession } from './actions';

/**
 * Guided Walkthrough (demo) section for the admin user profile page.
 * Shows first tried / last used / furthest stage / completed steps for every
 * sandbox this account launched (owner-linked since 2026-11-02).
 */

const CHAPTER_LABELS: Record<string, string> = {
  pricing: '1 · Pricing',
  takeoff: '2 · Takeoff',
  'customer-quote': '3 · Customer quote',
  'smart-assistant': '4 · Smart Assistant',
  complete: 'All chapters complete',
};

const EVENT_LABELS: Record<string, string> = {
  'component.viewed': 'Viewed a component',
  'component.created': 'Created pricing component',
  'component.tested': 'Tested a component',
  'component.edited': 'Edited a component',
  'scan.loaded': 'Loaded the takeoff plan',
  'takeoff.saved': 'Saved takeoff measurements',
  'quote.template': 'Applied quote template',
  'quote.presentation': 'Prepared the customer quote',
  'quote.edited': 'Edited quote lines',
  'quote.previewed': 'Previewed the customer quote',
  'email.sent': 'Sent the guided email',
  'assistant.created': 'Created a quote via Smart Assistant',
  'assistant.edited': 'Edited via Smart Assistant',
  'assistant.found': 'Checked Assistant results',
};

const CHAPTER_ORDER = ['pricing', 'takeoff', 'customer-quote', 'smart-assistant', 'complete'];

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${active
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active sandbox' : status}
    </span>
  );
}

function furthestChapter(sessions: DemoUsageSession[]): string | null {
  let best: string | null = null;
  for (const s of sessions) {
    const rank = CHAPTER_ORDER.indexOf(s.furthestChapter);
    if (rank >= 0 && (best === null || rank > CHAPTER_ORDER.indexOf(best))) best = s.furthestChapter;
  }
  return best;
}

export function DemoUsageSection({ userId }: { userId: string }) {
  const [data, setData] = useState<Extract<Awaited<ReturnType<typeof getUserDemoUsage>>, { ok: true }> | null>(null);
  const [, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startLoad(async () => {
      const res = await getUserDemoUsage(userId);
      if (res.ok) setData(res);
      else setError(res.error);
    });
  }, [userId]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Guided Walkthrough (Demo)</h2>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !data ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : data.sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-slate-500">This user has not used the guided walkthrough.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">First tried</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{fmtDate(data.firstTriedAt)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Last used</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{fmtDateTime(data.lastUsedAt)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Furthest stage</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{CHAPTER_LABELS[furthestChapter(data.sessions) ?? ''] ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Sessions</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{data.sessions.length}{data.sessions.reduce((a, s) => a + s.resetCount, 0) > 0 ? ` · ${data.sessions.reduce((a, s) => a + s.resetCount, 0)} resets` : ''}</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.sessions.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 transition-colors p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.status} />
                    <span className="text-sm text-slate-700">
                      {i === 0 ? 'Latest' : fmtDate(s.createdAt)} · reached {CHAPTER_LABELS[s.furthestChapter] ?? s.furthestChapter}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Started {fmtDate(s.createdAt)} · Last active {fmtDateTime(s.lastSeenAt)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {s.events.length === 0 ? (
                    <span className="text-xs text-slate-400">No steps completed</span>
                  ) : s.events.map(e => (
                    <span key={e} className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700">
                      {EVENT_LABELS[e] ?? e}
                    </span>
                  ))}
                  {s.completedAt && (
                    <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-xs text-orange-700 font-medium">
                      Completed {fmtDate(s.completedAt)}
                    </span>
                  )}
                  {s.demoSlug && (
                    <a className="inline-flex items-center rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50" href={`/${s.demoSlug}`} target="_blank" rel="noreferrer">
                      Open sandbox ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
