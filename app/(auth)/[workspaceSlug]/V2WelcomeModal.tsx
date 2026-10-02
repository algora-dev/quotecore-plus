'use client';
import { useState } from 'react';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { dismissV2Welcome } from './v2-welcome-actions';

/**
 * One-time V2 welcome, shown to every account (new and existing) on their
 * first sign-in after the V2 rollout. Dismissal stamps `v2_welcome_seen_at`
 * on the user row so it never repeats. Best-effort like the tutorials modal:
 * a failed stamp just means the modal may reappear next load.
 */
export function V2WelcomeModal() {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const dismiss = () => {
    if (busy) return;
    setBusy(true);
    void dismissV2Welcome()
      .catch(() => undefined)
      .finally(() => setDismissed(true));
  };

  const getInTouch = () => {
    // Must be synchronous within the click gesture so popup blockers allow it.
    window.open('/contact', '_blank', 'noopener,noreferrer');
    dismiss();
  };

  return (
    <QcDialog
      open={!dismissed}
      pending={busy}
      title="Welcome to version 2"
      description="The layout has changed and a lot of flows are simpler. We rebuilt them around feedback and one goal: the easiest to use measurement, pricing and quoting app on the market."
      onRequestClose={dismiss}
      footer={
        <>
          <QcButton onClick={dismiss} disabled={busy}>Have a look around</QcButton>
          <QcButton variant="primary" pending={busy} onClick={getInTouch}>Get in touch</QcButton>
        </>
      }
    >
      <p>Have a look around. Hopefully you like what you see.</p>
      <p>If you still need help, get in touch. We build QuoteCore+ with real businesses, and we want to work with you to make the whole experience easier and faster for the way you work.</p>
      <p className="text-xs text-slate-500">QuoteCore+ helps businesses cut the time and effort of quoting and win more work with accurate, professional quotes.</p>
    </QcDialog>
  );
}
