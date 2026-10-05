'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { dismissWelcomeModal } from './welcome-actions';
import '@/app/components/pricing/pricing-activation.css';

interface Props { base: string; firstName: string; pricingFirst?: boolean; }
/** Kept under the existing export for compatibility. An inline, optional welcome
 *  replaces the blocking tutorial modal. The existing personal dismissal action
 *  is unchanged; it never means that company prices have been checked. */
export function WelcomeModal({ base, firstName, pricingFirst = false }: Props) {
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
  return <aside className="qc-pricing-welcome" data-qc-ui="v2" aria-label="Getting started help">
    <QcIcon name="help" /><div><strong>{pricingFirst ? `New here, ${firstName}? Start with a component you know.` : `Welcome, ${firstName}. Your workspace is ready to explore.`}</strong>
      <p>{pricingFirst ? 'The pricing guide shows you how to test an example and create your own.' : 'Check your company’s Pricing Library, continue a job, or use Tutorials whenever you need help.'}</p>
      <div><Link prefetch={false} href={`${base}/components?learn=1`} className="qc-text-link">Pricing guide</Link><Link prefetch={false} href={`${base}/tutorials`} className="qc-text-link">Tutorials</Link></div>
      {error && <p role="status">{error} <QcButton size="sm" onClick={() => setOpen(false)}>Hide for now</QcButton></p>}
    </div><QcButton pending={pending} aria-label="Dismiss getting started help" onClick={() => { void dismiss(); }}><QcIcon name="close" /></QcButton>
  </aside>;
}
