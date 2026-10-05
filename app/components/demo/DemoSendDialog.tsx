'use client';
import { useEffect, useState } from 'react';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton, QcLinkButton } from '@/app/components/ui/v2/QcButton';
import { demoRequest } from '@/app/lib/demo/client-request';
import type { DemoGuideState } from '@/app/lib/demo/model';
import { DemoSelfSend } from './DemoSelfSend';

type Snapshot = { tutorialState: DemoGuideState; selfSendEnabled: boolean; allowance?: { sendsRemaining: number }; slug: string };
export function DemoSendDialog({ quoteId, workspaceSlug, onClose }: { quoteId: string; workspaceSlug: string; onClose: () => void }) {
  const [pending, setPending] = useState(false); const [state, setState] = useState<Snapshot | null>(null); const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void demoRequest<Snapshot>('/api/demo/state', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setState(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not check demo sending.'); });
    return () => controller.abort();
  }, [attempt]);
  const correctQuote = state?.tutorialState.seed.guided_roof_job === quoteId;
  const available = correctQuote && state?.selfSendEnabled && !!state.tutorialState.acknowledgements['takeoff.saved'] && (state.allowance?.sendsRemaining ?? 0) > 0;
  return <QcDialog open pending={pending} onRequestClose={onClose} title="Email the demo quote to yourself" description="See what your customer would receive. This email and quote are clearly marked as fictional demo material."
    footer={<QcButton variant="ghost" disabled={pending} onClick={onClose}>Close</QcButton>}>
    {error ? <div className="qc-demo-send-result"><p role="alert">{error}</p><QcButton variant="secondary" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Check again</QcButton></div>
      : !state ? <p role="status">Checking the guided quote and email allowance…</p>
      : available ? <DemoSelfSend quoteId={quoteId} onPendingChange={setPending} onClose={onClose} />
      : <div className="qc-demo-send-result"><p>{!correctQuote ? 'Only the prepared quote from your guided demo can be emailed. This job has not been sent.'
        : !state.selfSendEnabled ? 'Email sending is switched off on this deployment. You can skip this optional lesson and continue.'
        : !state.tutorialState.acknowledgements['takeoff.saved'] ? 'Save the guided Takeoff and prepare its customer quote first.'
        : 'Your demo email allowance is used. Resetting does not renew it; the rest of the demo still works.'}</p>
        <QcLinkButton variant="secondary" href={`/${workspaceSlug}/demo-guide`}>Return to the guide</QcLinkButton></div>}
  </QcDialog>;
}
