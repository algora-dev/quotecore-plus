'use client';

/**
 * Quota wall banners (owner spec 2026-11-03): when a Free Workspace (or a
 * paid capacity tier) hits a hard allowance, a slim banner names the exact
 * limit reached and offers the owner's two CTAs:
 *   1. "Configure my price" -> the in-account pricing tool (build-setup).
 *   2. "Need a hand? Book a free call" -> the done-for-you marketing page,
 *      framed as booking a chat, never a payment commitment.
 *
 * Walls arrive two ways: initial load via /api/quota-walls (walls already
 * hit) and live via the `qc-quota-wall` window event, fired by action error
 * handlers with signalQuotaWall() when something is refused mid-session.
 */
import { useEffect, useState } from 'react';

export type QuotaWallKind = 'quotes' | 'sends' | 'scans' | 'assistant' | 'offcuts' | 'components' | 'storage';
export interface QuotaWall { kind: QuotaWallKind; used: number; limit: number }

const COPY: Record<QuotaWallKind, (limit: number) => { title: string; body: string }> = {
  quotes: l => ({ title: 'You\u2019ve reached your quote limit', body: `Free Workspace holds ${l} quotes at a time. Delete a quote to free a slot \u2014 or upgrade for unlimited quote creation.` }),
  sends: l => ({ title: 'You\u2019ve reached your sending limit', body: `Your plan sends up to ${l} quotes per month (email or customer link). Upgrade your capacity for more sends.` }),
  scans: l => ({ title: 'You\u2019ve reached your scan limit', body: `Free Workspace includes ${l} scan tokens per month. Paid builds start at 50 tokens.` }),
  assistant: l => ({ title: 'You\u2019ve reached your Smart Assistant limit', body: `Free Workspace includes ${l} Assistant tasks per month. Paid builds start at 200.` }),
  offcuts: l => ({ title: 'You\u2019ve reached your Offcuts limit', body: `The Offcuts planner runs ${l} times per month on Free Workspace. Paid builds have no per-use charge.` }),
  components: l => ({ title: 'You\u2019ve reached your component limit', body: `Your plan holds ${l} smart components in total. Upgrade your setup for a bigger library.` }),
  storage: l => ({ title: 'You\u2019ve reached your storage limit', body: `Free Workspace includes ${l >= 1e9 ? `${l / 1e9} GB` : `${Math.round(l / 1e6)} MB`} of storage. Paid builds start at 1 GB.` }),
};

/** Fire from any client error handler when a quota refusal lands. */
export function signalQuotaWall(wall: QuotaWall) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<QuotaWall>('qc-quota-wall', { detail: wall }));
}

export function QuotaBanner({ workspaceSlug }: { workspaceSlug: string }) {
  const [walls, setWalls] = useState<QuotaWall[]>([]);
  const [dismissed, setDismissed] = useState<Set<QuotaWallKind>>(() => new Set());

  useEffect(() => {
    let alive = true;
    fetch('/api/quota-walls', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { walls: [] }))
      .then((d: { walls?: QuotaWall[] }) => { if (alive && Array.isArray(d.walls)) setWalls(d.walls); })
      .catch(() => { /* banner simply doesn't render */ });
    const onWall = (e: Event) => {
      const wall = (e as CustomEvent<QuotaWall>).detail;
      if (!wall?.kind) return;
      setWalls(prev => (prev.some(w => w.kind === wall.kind) ? prev : [...prev, wall]));
      setDismissed(prev => { const n = new Set(prev); n.delete(wall.kind); return n; });
    };
    window.addEventListener('qc-quota-wall', onWall);
    return () => { alive = false; window.removeEventListener('qc-quota-wall', onWall); };
  }, []);

  const visible = walls.filter(w => !dismissed.has(w.kind));
  if (visible.length === 0) return null;

  return (
    <div role="status" aria-live="polite">
      {visible.map(w => {
        const copy = COPY[w.kind]?.(w.limit) ?? { title: 'Plan limit reached', body: 'Review your allowances in Billing & Pricing.' };
        return (
          <div key={w.kind} data-qc-ui="v2" data-quota-kind={w.kind}
            className="flex flex-wrap items-center gap-3 border border-orange-200 bg-orange-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.title}</p>
              <p className="text-xs text-slate-600">{copy.body}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/${workspaceSlug}/account/billing/build-setup`}
                className="inline-flex min-h-11 items-center rounded-[12px] bg-[linear-gradient(135deg,#FF641F_0%,#FF8A3D_55%,#FFB36B_100%)] px-4 py-2.5 text-sm font-semibold text-[#191B20]">
                Configure my price
              </a>
              <a href="/done-for-you-setup" target="_blank" rel="noopener"
                className="inline-flex min-h-11 items-center rounded-[12px] bg-[#191F27] px-4 py-2.5 text-sm font-semibold text-white">
                Need a hand? Book a free call
              </a>
              <button type="button" aria-label="Dismiss this notice"
                onClick={() => setDismissed(prev => { const n = new Set(prev); n.add(w.kind); return n; })}
                className="inline-flex h-11 w-9 items-center justify-center rounded-[12px] text-slate-400 hover:text-slate-700">
                &times;
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
