'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { dismissWelcomeModal } from './welcome-actions';
import '@/app/components/pricing/pricing-activation.css';

interface Props { base: string; firstName: string; pricingFirst?: boolean; hasDemoSession?: boolean; }
/** Kept under the existing export for compatibility. An inline, optional welcome
 *  replaces the blocking tutorial modal. The existing personal dismissal action
 *  is unchanged; it never means that company prices have been checked.
 *  Owner 2026-11-07: brand-new users get a guided-demo-first push instead of
 *  the old pricing-first push. Once the user has a demo session (or on return
 *  visits) the banner falls back to the standard explore copy. */
export function WelcomeModal({ base, firstName, pricingFirst = false, hasDemoSession = false }: Props) {
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function dismiss() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const result = await dismissWelcomeModal();
      if (result.ok) setOpen(false);
      else setError('Could not remember your preference. Retry or hide this for this visit.');
    } catch { setError('Could not remember your preference. Retry or hide this for this visit.'); }
    finally { setPending(false); }
  }
  if (!open) return null;
  const demoFirst = pricingFirst && !hasDemoSession;
  return <aside className="qc-pricing-welcome" data-qc-ui="v2" aria-label="Getting started help">
    <QcIcon name="help" /><div><strong>{demoFirst ? (firstName ? `New here, ${firstName}? Try the guided demo first.` : 'New here? Try the guided demo first.') : (firstName ? `Welcome, ${firstName}. Your workspace is ready to explore.` : 'Welcome. Your workspace is ready to explore.')}</strong>
      <p>{demoFirst ? 'See a shortened flow with a prepared roofing business in about 5–10 minutes, then come back and build your own pricing.' : 'Check your company’s Pricing Library, continue a job, or use Tutorials whenever you need help.'}</p>
      <div>
        {demoFirst && <a href="/demo" target="_blank" rel="noopener noreferrer" className="qc-text-link">Start guided demo</a>}
        <Link prefetch={false} href={`${base}/components?learn=1`} className="qc-text-link">Pricing guide</Link>
        <Link prefetch={false} href={`${base}/tutorials`} className="qc-text-link">Tutorials</Link>
      </div>
      {error && <p role="status">{error} <QcButton size="sm" onClick={() => setOpen(false)}>Hide for now</QcButton></p>}
    </div><QcButton pending={pending} aria-label="Dismiss getting started help" onClick={() => { void dismiss(); }}><QcIcon name="close" /></QcButton>
  </aside>;
}
