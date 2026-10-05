"use client";

import { useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { reviewDestination } from './reviewCompletion';
import './review-completion.css';

/** Recovery belongs to the document route, including direct visits/bookmarks.
 * Never infer "saved" from a query flag. No re-creation or save on retry.
 * Retry must re-fetch server data, not merely clear a client error boundary.
 * Older runtimes without a re-fetch callback get an ordinary same-route link.
 */
export function CustomerQuoteRouteState({ failed = false, retry }: { failed?: boolean; retry?: () => void }) {
  const { workspaceSlug, id } = useParams<{ workspaceSlug: string; id: string }>();
  const [retrying, startTransition] = useTransition();
  const jobHref = typeof workspaceSlug === 'string' && typeof id === 'string'
    ? reviewDestination(workspaceSlug, id, 'job-space') : null;
  const documentHref = typeof workspaceSlug === 'string' && typeof id === 'string'
    ? reviewDestination(workspaceSlug, id, 'customer-quote') : null;
  return <section data-qc-ui="v2" className="qrc-route-state qc-surface" aria-labelledby="customer-quote-route-title">
    <p className="qrc-eyebrow">Customer quote</p>
    <h1 id="customer-quote-route-title" className="qrc-route-heading">
      {failed ? 'The customer quote could not be opened' : 'Opening your customer quote…'}
    </h1>
    <p className="qrc-route-copy" role={failed ? 'alert' : 'status'}>
      {failed
        ? 'Try loading it again, or return to Job Space. Retrying does not regenerate or replace any saved customer-quote lines. If you had unsaved edits, check the last saved document before continuing.'
        : 'Loading your saved document, or preparing initial lines from the priced components. Nothing is sent by opening this page.'}
    </p>
    <div className="qrc-result-actions">
      {failed && (retry ? <QcButton variant="primary" pending={retrying} onClick={() => startTransition(retry)}>
        {retrying ? 'Trying again…' : 'Try again'}
      </QcButton> : documentHref && <a href={documentHref} className="qc-button" data-qc-variant="primary">Try again</a>)}
      {jobHref && <Link prefetch={false} href={jobHref} className="qc-button" data-qc-variant="ghost">Go to Job Space</Link>}
    </div>
  </section>;
}
