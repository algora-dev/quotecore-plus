'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { QcButton } from './QcButton';
import { QcNotice } from './QcSurface';
import './qc-feedback.css';

export type QcActionResult = {
  title: string;
  description: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  /** For per-record failures. Rendered as text, never HTML, never truncated. */
  details?: readonly string[];
  /** Opt in for a user-initiated batch result, not background updates. */
  focus?: boolean;
};

/** C66 composes C30/C01. A persistent, local result, not a toast or request owner.
 * The feature supplies the real outcome. Dismiss never retries a mutation.
 * Mount outside completed dialogs; blocking form errors stay inside their form.
 */
export function QcActionNotice({ result, onDismiss }: {
  result: QcActionResult | null; onDismiss: () => void;
}) {
  const headingId = useId();
  const regionRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!result?.focus) return;
    // Let native dialog cleanup restore its trigger first, then expose the result.
    const frame = requestAnimationFrame(() => {
      if (document.activeElement instanceof HTMLElement && !regionRef.current?.contains(document.activeElement)) {
        triggerRef.current = document.activeElement;
      }
      regionRef.current?.focus({ preventScroll: true });
      regionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [result]);

  function dismiss() {
    const region = regionRef.current;
    // Do not strand keyboard focus on a button that is about to disappear.
    if (region?.contains(document.activeElement)) {
      const trigger = triggerRef.current;
      const fallback = Array.from(region.closest('main')?.querySelectorAll<HTMLElement>('h1, button:not(:disabled), a[href]') ?? [])
        .find(element => !region.contains(element));
      const target = trigger?.isConnected && trigger !== document.body && !region.contains(trigger) && !trigger.matches(':disabled')
        ? trigger : fallback;
      if (target) {
        const needsTabIndex = !target.hasAttribute('tabindex') && target.tagName === 'H1';
        if (needsTabIndex) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        if (needsTabIndex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
    }
    onDismiss();
  }

  return <div data-qc-ui="v2" data-qc-component="C66" className="qc-action-feedback">
    {/* Keep the announcement region mounted so repeated action outcomes announce. */}
    <div aria-live={result?.tone === 'danger' ? 'assertive' : 'polite'} aria-atomic="true">
      {result && <div ref={regionRef} tabIndex={-1} role="region" aria-labelledby={headingId}
        className="qc-action-result">
        <QcNotice tone={result.tone ?? 'info'}>
          <div className="qc-action-result-heading">
            <h2 id={headingId}>{result.title}</h2>
            <QcButton size="sm" onClick={dismiss} aria-label="Dismiss result">Dismiss</QcButton>
          </div>
          <p className="qc-action-result-description">{result.description}</p>
          {!!result.details?.length && <details className="qc-action-result-details">
            <summary>View details ({result.details.length})</summary>
            <ul tabIndex={0} aria-label="Operation details">{result.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
          </details>}
        </QcNotice>
      </div>}
    </div>
  </div>;
}

/** Local state only; no timers, provider assumptions, fetching, refresh or mutation. */
export function useQcActionNotice() {
  const [result, setResult] = useState<QcActionResult | null>(null);
  const showNotice = useCallback((next: QcActionResult) => setResult(next), []);
  const clearNotice = useCallback(() => setResult(null), []);
  return { showNotice, clearNotice,
    notice: <QcActionNotice result={result} onDismiss={clearNotice} /> };
}
