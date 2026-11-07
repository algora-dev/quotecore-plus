'use client';

import { useState } from 'react';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { recordFreeEntryChoice } from './free-entry-actions';

const CAN_DO = [
  'Build real quotes – up to 10 in your workspace at once',
  '20 Smart Assistant tasks a month (voice notes or typed)',
  '12 AI scan tokens a month (a simple roof scan uses 2)',
  '5 quote sends a month – email or custom link (Read/Accepted/Declined tracking included)',
  'Build your pricing library – up to 15 saved components',
];

const LIMITS = [
  'Quotes you send carry a small "Made with QuoteCore+" watermark',
  'Storage capped at 100MB · offcut planner 2 runs a month',
  "The 15-component cap is lifetime, it doesn't reset monthly",
  'Monthly caps refresh on your reset date; paid plans lift them (Account → Billing → Change my plan)',
];

/**
 * One-time Free Workspace entry modal (owner 2026-11-07): states plainly what
 * the free account includes and where the limits sit, then recommends the
 * guided demo as the starting path. Shown once per account (company-level
 * stamp, first choice wins); either CTA records it. Best-effort like the other
 * one-time modals: a failed stamp just means it may reappear next load.
 */
export function FreeEntryModal() {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const choose = (action: 'start_demo' | 'continue') => {
    if (busy) return;
    setBusy(true);
    void recordFreeEntryChoice(action)
      .catch(() => undefined)
      .finally(() => setDismissed(true));
  };

  const startDemo = () => {
    // Synchronous within the click gesture so popup blockers allow it
    // (same rule as the V2 welcome modal).
    window.open('/demo', '_blank', 'noopener,noreferrer');
    choose('start_demo');
  };

  return (
    <QcDialog
      open={!dismissed}
      pending={busy}
      size="md"
      title="Welcome to your free workspace"
      description="Here's what your free account includes, and where the limits sit."
      onRequestClose={() => choose('continue')}
      footer={
        <>
          <QcButton onClick={() => choose('continue')} disabled={busy}>Continue with my workspace</QcButton>
          <QcButton variant="primary" pending={busy} onClick={startDemo}>Start guided demo</QcButton>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">What you can do (free)</h3>
          <ul className="space-y-1.5">
            {CAN_DO.map(item => (
              <li key={item} className="flex items-start gap-2">
                <QcIcon name="check" width={16} height={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Where the limits sit</h3>
          <ul className="space-y-1.5">
            {LIMITS.map(item => (
              <li key={item} className="flex items-start gap-2">
                <QcIcon name="minus" width={16} height={16} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-orange-300 bg-orange-50/60 p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">⚡ Recommended: start with the guided demo</h3>
          <p>Learn the basics – Add/Edit pricing → measure → edit quote → send – with a prepared roofing business, in about 5–10 minutes. You'll understand more of the process before touching your own numbers. Your workspace will be waiting whenever you want.</p>
        </section>
        <p className="text-xs text-slate-500">You can reopen the guided demo anytime, top-right toggle.</p>
      </div>
    </QcDialog>
  );
}
