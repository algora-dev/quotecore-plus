'use client';

// Admin > Tracking: quotes created (date / items / value / email), signups
// captured, and a product leaderboard (times quoted). Reads the tracking
// events the tool logs (adminData.ts, localStorage demo-grade).

import { useEffect, useState } from 'react';
import type { SupplierConfig } from '../supplierConfig';
import { readEvents, type TrackingEvent } from '../adminData';
import { SectionCard } from './AdminPanel';

export function AdminTracking({ cfg, slug }: { cfg: SupplierConfig; slug: string }) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);

  useEffect(() => {
    const load = () => setEvents(readEvents(slug));
    load();
    window.addEventListener('qc-spt-events-changed', load);
    return () => window.removeEventListener('qc-spt-events-changed', load);
  }, [slug]);

  const quotes = events.filter((e): e is Extract<TrackingEvent, { type: 'quote' }> => e.type === 'quote');
  const signups = events.filter((e): e is Extract<TrackingEvent, { type: 'signup' }> => e.type === 'signup');
  const totalValue = quotes.reduce((s, q) => s + q.total, 0);

  // product leaderboard: productId -> quoted count + name lookup
  const byId = new Map(cfg.products.map(p => [p.id, p.name]));
  const counts = new Map<string, number>();
  for (const q of quotes) {
    for (const [pid, qty] of Object.entries(q.productCounts)) {
      counts.set(pid, (counts.get(pid) ?? 0) + (qty > 0 ? 1 : 0));
    }
  }
  const leaderboard = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = leaderboard[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <SectionCard title="Quotes" desc={`${quotes.length} quotes created - combined value ${cfg.currency}${totalValue.toFixed(2)}.`}>
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-3">No quotes yet - complete a pricing to the output in the tool.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Created</th>
                  <th className="py-1.5 pr-2 font-medium">Email</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Items</th>
                  <th className="py-1.5 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-xs text-slate-500">{new Date(q.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{q.email ?? <span className="text-slate-400">anonymous</span>}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-600">{q.itemCount}</td>
                    <td className="py-1.5 text-right font-semibold text-slate-900">{q.currency}{q.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Most quoted products" desc="Every time a product appears in a finished pricing, it counts once here.">
        {leaderboard.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-3">No product data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {leaderboard.map(([pid, count]) => (
              <div key={pid} className="flex items-center gap-3">
                <span className="w-56 truncate text-sm text-slate-700">{byId.get(pid) ?? '(removed product)'}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                </div>
                <span className="w-16 text-right text-xs font-semibold text-slate-600">{count}×</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Signups (${signups.length})`} desc="Emails captured from the call-to-action popup.">
        {signups.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-3">No signups yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Name</th>
                  <th className="py-1.5 pr-2 font-medium">Email</th>
                  <th className="py-1.5 font-medium">Captured</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-900">{s.name || '-'}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{s.email}</td>
                    <td className="py-1.5 text-xs text-slate-400">{new Date(s.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
