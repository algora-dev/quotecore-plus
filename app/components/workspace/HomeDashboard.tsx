import Link from 'next/link';
import type { ReactNode } from 'react';
import { QcIcon } from '../ui/v2/QcIcon';
import './qc-home.css';

export interface RecentWorkItem {
  id: string; href: string; title: string; customer: string; quoteNumber: string;
  statusLabel: string; statusTone: 'neutral' | 'success' | 'warning' | 'info'; updatedLabel: string;
}
interface Props {
  workspaceSlug: string; firstName: string; newUser: boolean; notificationCount: number; isDemo?: boolean;
  canCreateQuote: boolean; assistantAvailable: boolean; measureAction: ReactNode;
  /** undefined means not loaded, NOT an empty company. No demo rows in application code. */
  recentWork?: RecentWorkItem[];
  /** Suppressed for supplier workspaces and resumed signup drafts. This is guidance,
   *  not a claim that company prices are unverified. */
  allowPricingInvitation?: boolean;
}
/** T01/C48. Read-only dashboard composition. Data is owned by the existing server page. */
export function HomeDashboard({ workspaceSlug, firstName, newUser, notificationCount, isDemo = false,
  canCreateQuote, assistantAvailable, measureAction, recentWork, allowPricingInvitation = true }: Props) {
  const base = `/${workspaceSlug}`;
  // Only a successful, empty recent-work read can select the getting-started
  // state. Unknown data and an existing company's jobs never become "new".
  const pricingFirst = allowPricingInvitation && recentWork !== undefined && recentWork.length === 0;
  const resume = recentWork?.[0];
  return <div className="qc-home" data-qc-ui="v2">
    <header className="qc-home-heading">
      <div><p className="qc-eyebrow">{isDemo ? 'Your demo' : 'Your workspace'}</p><h1>{isDemo ? 'Welcome to your demo workspace' : <>Welcome {newUser ? '' : 'back, '}{firstName}</>}</h1>
        <p>Measure with confidence. Price your work. Send a great quote.</p></div>
      <Link href={`${base}/tutorials`} prefetch={false} className="qc-button" data-qc-variant="glass"><QcIcon name="help" /> Tutorials</Link>
    </header>
    <section className="qc-home-start" aria-labelledby="qc-home-start-title">
      <div className="qc-home-start-copy"><span className="qc-eyebrow">{pricingFirst ? 'Build your pricing system' : resume ? 'Pick up where you left off' : 'Start something new'}</span>
        <h2 id="qc-home-start-title">{pricingFirst ? 'Make QuoteCore use your prices' : resume ? 'Continue your work' : 'What are we pricing today?'}</h2>
        <p>{pricingFirst
          ? 'Open a familiar Smart Component, test a measurement, then enter your own costs. Set up once and reuse your pricing on every job.'
          : resume ? `Return to ${resume.title}. Your other jobs and starting options are below.`
          : 'Already measured the job? Start a quote. Need quantities first? Open your plan in takeoff.'}</p>
        <div className="qc-home-start-actions">
          <Link href={pricingFirst ? `${base}/components?learn=1` : resume ? resume.href : canCreateQuote ? `${base}/quotes/new` : `${base}/quotes`} prefetch={false}
            className="qc-button" data-qc-variant="primary" data-qc-size="lg">
            <QcIcon name={pricingFirst ? 'pricing' : resume ? 'quote' : 'plus'} />
            {pricingFirst ? 'Set up your pricing' : resume ? 'Continue this job' : canCreateQuote ? 'New quote' : 'Open quotes'}<QcIcon name="arrow" />
          </Link>
          {(pricingFirst || resume) && <Link href={canCreateQuote ? `${base}/quotes/new` : `${base}/quotes`} prefetch={false} className="qc-button" data-qc-variant="ghost">
            {canCreateQuote ? 'Start a new job' : 'Open quotes'}
          </Link>}
          <div className="qc-home-measure">{measureAction}</div>
        </div>
        {pricingFirst && <p className="qc-home-pricing-note">Starter rates are examples, not recommended prices. Already using your company&apos;s pricing? Go straight to a job.</p>}
      </div>
      <div className="qc-home-process" aria-label={pricingFirst ? 'Check a component, make your own, price a job' : 'Measure, price, quote'}>
        {(pricingFirst ? (['pricing','library','quote'] as const) : (['measure','pricing','quote'] as const)).map((name, index) => <div key={name}>
          <span className="qc-home-process-icon"><QcIcon name={name} /></span>
          <strong>{(pricingFirst ? ['Try one','Make your own','Price a job'] : ['Measure','Price','Quote'])[index]}</strong>
          <span>{(pricingFirst ? ['Test a familiar item','Use your costs','Apply measurements'] : ['Capture the job','Use your pricing','Make it yours'])[index]}</span>
        </div>)}
      </div>
    </section>
    <div className="qc-home-grid">
      <section className="qc-home-work qc-hub-surface" aria-labelledby="qc-recent-title">
        <div className="qc-section-heading"><div><p className="qc-eyebrow">Pick up where you left off</p><h2 id="qc-recent-title">Continue your work</h2></div>
          <Link href={`${base}/quotes`} prefetch={false} className="qc-text-link">All quotes <QcIcon name="arrow" /></Link></div>
        {recentWork === undefined ? (
          <Link href={`${base}/quotes`} prefetch={false} className="qc-home-resume">
            <span className="qc-hub-icon"><QcIcon name="quote" /></span><span><strong>Find a job or quote</strong>
              <span>Open your quotes to continue pricing, review a draft or check a customer response.</span></span><QcIcon name="arrow" />
          </Link>
        ) : recentWork.length === 0 ? <div className="qc-home-empty"><QcIcon name="quote" /><h3>Your work will appear here</h3>
          <p>Check your pricing, then start a real job. You can return here to continue it.</p></div> : <div className="qc-recent-list">
          {recentWork.map(work => <Link key={work.id} href={work.href} prefetch={false} className="qc-recent-row">
            <span><strong>{work.title}</strong><small>{work.customer} · {work.quoteNumber}</small></span>
            <span className="qc-status" data-qc-tone={work.statusTone}>{work.statusLabel}</span><small>{work.updatedLabel}</small><QcIcon name="chevron" />
          </Link>)}
        </div>}
        <div className="qc-home-queues">
          <Link href={`${base}/material-orders`} prefetch={false}><QcIcon name="orders" /><span><strong>Orders</strong><small>Materials and suppliers</small></span><QcIcon name="chevron" /></Link>
          <Link href={`${base}/invoices`} prefetch={false}><QcIcon name="invoice" /><span><strong>Invoices</strong><small>Customer invoices and payments</small></span><QcIcon name="chevron" /></Link>
        </div>
      </section>
      <aside className="qc-home-side">
        <section className="qc-hub-surface"><div className="qc-section-heading"><span className="qc-hub-icon"><QcIcon name="mail" /></span>
          <span className="qc-status">{notificationCount} notification{notificationCount === 1 ? '' : 's'}</span></div>
          <h2>Keep up with customers</h2><p>Use the bell for recent alerts, or open Message Center for your conversations.</p>
          <Link href={`${base}/inbox`} prefetch={false} className="qc-text-link">Open Message Center <QcIcon name="arrow" /></Link>
        </section>
        <section className="qc-hub-surface"><span className="qc-eyebrow">Set up once. Reuse every time.</span>
          <h2>Your pricing library</h2><p>Smart Components keep your material costs, labour rates and pricing rules ready for the next job.</p>
          <Link href={`${base}/components`} prefetch={false} className="qc-button" data-qc-variant="ghost">Open Pricing Library <QcIcon name="arrow" /></Link>
        </section>
      </aside>
    </div>
    <section className="qc-home-bottom" aria-label="Resources and support">
      <Link href={`${base}/resources`} prefetch={false}><QcIcon name="library" /><span><strong>Resources & templates</strong><small>Your catalogues, reusable files and document templates</small></span><QcIcon name="arrow" /></Link>
      {assistantAvailable && <Link href={`${base}/assistant`} prefetch={false}><QcIcon name="assistant" /><span><strong>Ask Smart Assistant</strong><small>Get help with quotes, pricing and your workspace</small></span><QcIcon name="arrow" /></Link>}
    </section>
    <p className="qc-home-roadmap">Job Manager is coming later. For now, each quote has its own job space.</p>
  </div>;
}
