'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { markComponentsIntroSeen } from '@/app/(auth)/[workspaceSlug]/components/actions';
import './pricing-activation.css';

/** Personal guidance preference only. Never a business-price verification flag. */
export function PricingIntroduction({ open, onOpen, onDismiss, hasComponents, tested, created, ownTested, workspaceSlug, onCreate, onChoose, onTestCreated }: {
  open: boolean; onOpen: () => void; onDismiss: () => void; hasComponents: boolean;
  tested: boolean; created: boolean; ownTested: boolean; workspaceSlug: string;
  onCreate: () => void; onChoose: () => void; onTestCreated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const oldValue = document.body.dataset.copilotSuppress;
    document.body.dataset.copilotSuppress = '1';
    return () => {
      if (oldValue === undefined) delete document.body.dataset.copilotSuppress;
      else document.body.dataset.copilotSuppress = oldValue;
    };
  }, [open]);
  async function dismiss() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const result = await markComponentsIntroSeen();
      if (result.ok) onDismiss();
      else setError('Could not remember your preference. You can retry or hide this for this visit.');
    } catch { setError('Could not remember your preference. You can retry or hide this for this visit.'); }
    finally { setPending(false); }
  }
  if (!open) return <div className="qc-pricing-help-row"><QcButton size="sm" onClick={onOpen}><QcIcon name="help" /> How Smart Components work</QcButton></div>;
  return <section className="qc-pricing-intro" aria-labelledby="qc-pricing-intro-title" data-qc-component="C71">
    <header className="qc-pricing-heading"><div><span className="qc-eyebrow">Set up once. Reuse on every job.</span><h2 id="qc-pricing-intro-title">Make QuoteCore use your prices</h2></div>
      <QcButton pending={pending} onClick={() => { void dismiss(); }} aria-label="Hide pricing introduction">Hide guide</QcButton></header>
    <p>A Smart Component can be any product or service you provide, it could be a specific hourly rate, product, install cost. If you already use spreadsheets for pricing, think of each Smart Component like a reusable spreadsheet row: a name, material and labour costs, plus rules for measurement, purchasing and waste. You just tell the Smart Component what it is, and it calculates the rest automatically.</p>
    <div className="qc-pricing-learning-steps">
      <section><span className="qc-pricing-step-number">{tested ? <QcIcon name="check" /> : '1'}</span><h3>{hasComponents ? 'Test something familiar' : 'Start with one useful item'}</h3>
        <p>{hasComponents ? 'Open a component below, choose Test component and enter a length, area or quantity. Change a setting to see its effect.' : 'Your library is empty. Create a product or service you know, enter its costs and test a measurement.'}</p>
        <QcButton variant={tested ? 'ghost' : 'secondary'} onClick={hasComponents ? onChoose : onCreate}>{hasComponents ? 'Choose a component' : 'Create a component'}<QcIcon name="arrow" /></QcButton>
      </section>
      <section><span className="qc-pricing-step-number">{created && ownTested ? <QcIcon name="check" /> : '2'}</span><h3>Make your own, then test it</h3>
        <p>Use your business costs. Start from scratch or use an open component&apos;s settings as a starting point. Test, check and save.</p>
        <QcButton variant={tested && !created ? 'secondary' : 'ghost'} onClick={created ? onTestCreated : onCreate}>{created ? 'Test your saved component' : 'Create your own'}<QcIcon name="arrow" /></QcButton>
      </section>
    </div>
    <p className="qc-pricing-example-warning"><QcIcon name="info" /><span><strong>Starter settings are examples, not recommended prices.</strong> Replace their costs and check every applicable rule before using them in a real quote. Components already configured by your company may be ready to use.</span></p>
    {created && ownTested && <div className="qc-pricing-next"><span>You&apos;ve created and tested a component in this visit. Add the others you need for a real job.</span><Link prefetch={false} href={`/${workspaceSlug}/quotes/new`} className="qc-button" data-qc-variant="primary">Price a job<QcIcon name="arrow" /></Link></div>}
    <p className="qc-pricing-muted">These checkmarks describe this visit, not a verification of your prices. Catalogue import is available below when you have a price list.</p>
    {error && <p className="qc-pricing-error" role="status">{error} <QcButton size="sm" onClick={onDismiss}>Hide for now</QcButton></p>}
  </section>;
}
