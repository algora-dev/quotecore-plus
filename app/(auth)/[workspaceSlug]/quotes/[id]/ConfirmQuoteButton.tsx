'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmQuote } from '../actions';
import type { QuoteStatus } from '@/app/lib/types';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcNotice } from '@/app/components/ui/v2/QcSurface';
import { prepareReviewCompletion, reviewDestination, type ReviewDestination, type ReviewMarginResult } from '@/app/components/quote-entry/reviewCompletion';
import '@/app/components/quote-entry/review-completion.css';

interface Props {
  quoteId: string;
  workspaceSlug: string;
  quoteStatus: QuoteStatus;
  onBeforeSubmit?: () => Promise<ReviewMarginResult | void>;
  /** Locks the current review inputs/step controls, not any server record. */
  onPendingChange?: (pending: boolean) => void;
  onConfirmed?: () => void;
  onReviewMargins?: () => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'working'; stage: 'saving' | 'confirming' | 'opening'; destination: ReviewDestination }
  | { kind: 'margin-warning'; destination: ReviewDestination; message: string }
  | { kind: 'confirmation-error'; destination: ReviewDestination; margins: ReviewMarginResult }
  | { kind: 'navigation-error'; destination: ReviewDestination };

/** C74. Historical export/selector retained for the existing Builder integration.
 * Both buttons sequence the SAME margin save + draft confirmation. Only their
 * destination differs. Nothing here generates, saves or sends customer lines.
 */
export function ConfirmQuoteButton({ quoteId, workspaceSlug, quoteStatus, onBeforeSubmit, onPendingChange, onConfirmed, onReviewMargins }: Props) {
  const router = useRouter();
  const headingId = useId();
  const noticeId = useId();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const pendingCallback = useRef(onPendingChange);
  // Latest-ref sync (house pattern): assign inside an effect, never during render.
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  const inFlight = useRef(false); // synchronous gate: also covers rapid mixed-button clicks
  const mounted = useRef(true);
  const confirmedHere = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const focusFrame = useRef<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingCallback.current?.(false);
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, []);
  useEffect(() => {
    if (state.kind !== 'margin-warning' && state.kind !== 'confirmation-error' && state.kind !== 'navigation-error') return;
    const frame = requestAnimationFrame(() => {
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [state]);

  function unlock() {
    inFlight.current = false;
    onPendingChange?.(false);
  }

  function openDestination(destination: ReviewDestination) {
    if (!mounted.current) return;
    inFlight.current = true;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    onPendingChange?.(true);
    setState({ kind: 'working', stage: 'opening', destination });
    try {
      // router.push is not a promise. Destination load/render failures are
      // handled by customer-edit/error.tsx, not a fictitious creation catch.
      router.push(reviewDestination(workspaceSlug, quoteId, destination));
      // Stay locked until navigation unmounts this control. No polling/refresh.
    } catch {
      // Only synchronous navigation failures reach here. Preparation succeeded;
      // retrying this branch must NOT repeat the save or confirmation.
      setState({ kind: 'navigation-error', destination });
      inFlight.current = false; // Keep reviewed settings locked until an explicit return to editing.
    }
  }

  async function complete(destination: ReviewDestination) {
    if (inFlight.current) return;
    inFlight.current = true;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    onPendingChange?.(true);
    setState({ kind: 'working', stage: 'saving', destination });
    const needsConfirmation = quoteStatus === 'draft' && !confirmedHere.current;
    const outcome = await prepareReviewCompletion({
      saveMargins: onBeforeSubmit,
      confirmDraft: () => confirmQuote(quoteId),
      needsConfirmation,
      shouldContinue: () => mounted.current,
      onStage: stage => { if (mounted.current) setState({ kind: 'working', stage, destination }); },
    });
    if (!mounted.current || outcome.status === 'abandoned') return;
    if (outcome.status === 'confirmation-failed') {
      setState({ kind: 'confirmation-error', destination, margins: outcome.margins });
      unlock();
      return;
    }
    if (needsConfirmation) {
      confirmedHere.current = true;
      onConfirmed?.();
    }
    if (outcome.margins.status === 'not-saved') {
      // Existing non-blocking contract retained, but no silent continuation.
      // The user may keep previously saved margins instead of fixing them now.
      setState({ kind: 'margin-warning', destination, message: outcome.margins.message });
      // Keep the review snapshot locked while the user chooses its next action.
      inFlight.current = false;
      return;
    }
    openDestination(destination);
  }

  function reviewMargins() {
    setState({ kind: 'idle' });
    unlock();
    focusFrame.current = requestAnimationFrame(() => {
      if (!mounted.current) return;
      if (onReviewMargins) onReviewMargins();
      else primaryRef.current?.focus();
    });
  }

  const working = state.kind === 'working';
  const normalActions = state.kind === 'idle' || working;
  const workingText = state.kind === 'working'
    ? state.stage === 'opening'
      ? state.destination === 'customer-quote' ? 'Opening customer quote…' : 'Opening Job Space…'
      : 'Saving pricing…'
    : '';

  return <section data-qc-ui="v2" data-qc-component="C74" data-completion-state={state.kind} className="qrc-completion qc-surface" aria-labelledby={headingId}>
    <div className="qrc-intro">
      <p className="qrc-eyebrow">Next step</p>
      <h3 id={headingId}>Ready to prepare the customer quote?</h3>
      <p>Save this pricing, then open the document your customer will see. Or return to Job Space to continue later.</p>
      <p className="qrc-reassurance">Neither option sends anything to your customer.</p>
    </div>
    {normalActions && <div className="qrc-actions" aria-label="Finish pricing">
      <QcButton ref={primaryRef} size="lg" variant="primary" data-copilot="quote-confirm"
        disabled={working} pending={working && state.destination === 'customer-quote'}
        onClick={() => void complete('customer-quote')}>
        {working && state.destination === 'customer-quote' ? 'Preparing customer quote…' : 'Continue to customer quote'}
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" /></svg>
      </QcButton>
      <QcButton size="lg" variant="ghost" data-copilot="quote-save-job-space"
        disabled={working} pending={working && state.destination === 'job-space'}
        onClick={() => void complete('job-space')}>
        {working && state.destination === 'job-space' ? 'Saving for Job Space…' : 'Save & go to Job Space'}
      </QcButton>
    </div>}
    <p className="qrc-progress" role="status" aria-live="polite" aria-atomic="true">{workingText}</p>
    {state.kind === 'margin-warning' && <div className="qrc-result" ref={resultRef} tabIndex={-1} role="region" aria-labelledby={noticeId}>
      <QcNotice tone="warning">
        <h4 id={noticeId}>Your margin changes were not saved</h4>
        <p>{state.message} The last saved margins will be used. You can check them here or adjust them in the customer quote editor.</p>
        <p>Your quote is available. Continuing does not send it.</p>
        <div className="qrc-result-actions">
          <QcButton variant="primary" onClick={reviewMargins}>Review margins</QcButton>
          <QcButton variant="ghost" onClick={() => { if (!inFlight.current) openDestination(state.destination); }}>
            {state.destination === 'customer-quote' ? 'Continue with saved margins' : 'Go to Job Space with saved margins'}
          </QcButton>
        </div>
      </QcNotice>
    </div>}
    {state.kind === 'confirmation-error' && <div className="qrc-result" ref={resultRef} tabIndex={-1} role="region" aria-labelledby={noticeId}>
      <QcNotice tone="danger">
        <h4 id={noticeId}>We could not confirm the quote</h4>
        <p>{state.margins.status === 'saved' ? 'Your margin settings were saved, but quote confirmation could not be verified.' : 'Quote confirmation could not be verified. Check your margin settings before continuing.'} Your current review is still here. Nothing has been sent.</p>
        <div className="qrc-result-actions">
          <QcButton variant="primary" onClick={() => void complete(state.destination)}>Try again</QcButton>
          <QcButton variant="ghost" onClick={reviewMargins}>Review pricing</QcButton>
        </div>
      </QcNotice>
    </div>}
    {state.kind === 'navigation-error' && <div className="qrc-result" ref={resultRef} tabIndex={-1} role="region" aria-labelledby={noticeId}>
      <QcNotice tone="warning">
        <h4 id={noticeId}>Your quote is ready, but the next page could not open</h4>
        <p>Try opening it again or go to Job Space. This will not replace your saved customer document.</p>
        <div className="qrc-result-actions">
          <QcButton variant="primary" onClick={() => { if (!inFlight.current) openDestination(state.destination); }}>Try opening again</QcButton>
          <a className="qc-button" data-qc-variant="ghost" href={reviewDestination(workspaceSlug, quoteId, 'job-space')}>Go to Job Space</a>
          <QcButton variant="ghost" onClick={reviewMargins}>Review pricing</QcButton>
        </div>
      </QcNotice>
    </div>}
  </section>;
}
