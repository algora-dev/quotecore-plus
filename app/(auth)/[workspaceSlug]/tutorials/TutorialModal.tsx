'use client';

import { useCallback, useEffect, useState } from 'react';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import './tutorials.css';
import { useRouter } from 'next/navigation';
import { startGuide } from '@/app/components/assistant/startGuide';
import type { Tutorial } from './tutorials.data';

interface Props {
  tutorial: Tutorial | null;
  /** Workspace base path, e.g. "/acme". */
  base: string;
  /** Whether the Q assistant is enabled for this workspace (gates the Q CTA). */
  assistantEnabled: boolean;
  onClose: () => void;
}

/**
 * Tutorial modal - pages through a tutorial's content and offers two CTAs:
 *   - "Go to <feature>"        (accent) → router.push(ctaHref)
 *   - "Walk me through with Q" (black)  → navigate to start URL + launch guide
 *
 * The Q button is hidden when there's no workflowId or the assistant is off.
 * Reuses the native shared dialog, with a scrollable body and reachable footer.
 * The feature owns paging and the existing assistant launch callbacks.
 */
export function TutorialModal({ tutorial, base, assistantEnabled, onClose }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(0);

  // Reset to first page whenever a different tutorial opens.
  useEffect(() => {
    setPage(0);
  }, [tutorial?.id]);

  const goToFeature = useCallback(() => {
    if (!tutorial) return;
    onClose();
    router.push(tutorial.ctaHref(base));
  }, [tutorial, base, router, onClose]);

  // "Walk me through with Q": start the guide from right here, WITHOUT
  // pre-navigating. The guide engine's own nav-hop logic highlights the correct
  // top-nav button and walks the user to the start page - identical to the
  // normal "ask Q" Guide-Me flow (which works with a single click). Previously
  // we router.push()'d to the page first, but applying the nav highlight mid-
  // navigation swallowed the user's first nav click (the "nav 100% blocked"
  // bug). Letting the engine drive the navigation is the reliable path.
  const walkThrough = useCallback(() => {
    if (!tutorial || !tutorial.workflowId) return;
    const workflowId = tutorial.workflowId;
    onClose();
    // Small defer so the modal has unmounted (and its overlay/focus trap is
    // gone) before the assistant opens and the first highlight paints.
    setTimeout(() => startGuide(workflowId), 80);
  }, [tutorial, onClose]);

  if (!tutorial) return null;

  const pages = tutorial.pages;
  const multiPage = pages.length > 1;
  const current = pages[Math.min(page, pages.length - 1)];
  const isLast = page >= pages.length - 1;
  const showQ = assistantEnabled && !!tutorial.workflowId;

  return (
    <QcDialog open title={tutorial.title} description={tutorial.tagline} size="md"
      onRequestClose={onClose} className="qc-tutorial-dialog"
      footer={<div className="qc-tutorial-footer">
        {multiPage && <nav className="qc-tutorial-pager" aria-label="Tutorial pages">
          <QcButton onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Back</QcButton>
          <span role="status" aria-live="polite">{Math.min(page + 1, pages.length)} of {pages.length}</span>
          <QcButton onClick={() => setPage(p => Math.min(pages.length - 1, p + 1))} disabled={isLast}>Next</QcButton>
        </nav>}
        <div className="qc-tutorial-actions">
          <QcButton onClick={onClose}>Close</QcButton>
          {showQ && <QcButton variant="secondary" onClick={walkThrough}>Walk me through with Q</QcButton>}
          <QcButton variant="primary" onClick={goToFeature}>{tutorial.ctaLabel}</QcButton>
        </div>
      </div>}>
      <div className="qc-tutorial-content" key={`${tutorial.id}-${page}`}>
        {multiPage && current?.heading && <h3>{current.heading}</h3>}
        {current?.body.map((line, index) => <p key={index}>{line}</p>)}
      </div>
    </QcDialog>
  );
}
