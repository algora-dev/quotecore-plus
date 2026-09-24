import Link from 'next/link';
import type { ReactNode } from 'react';
import { QcIcon } from '../ui/v2/QcIcon';
import './qc-home.css';

export interface RecentWorkItem {
  id: string; href: string; title: string; customer: string; quoteNumber: string;
  statusLabel: string; statusTone: 'neutral' | 'success' | 'warning' | 'info'; updatedLabel: string;
}
interface Props {
  workspaceSlug: string; firstName: string; newUser: boolean; notificationCount: number;
  canCreateQuote: boolean; assistantAvailable: boolean; measureAction: ReactNode;
  /** undefined means not loaded, NOT an empty company. No demo rows in application code. */
  recentWork?: RecentWorkItem[];
}
/** T01/C48. Read-only dashboard composition. Data is owned by the existing server page. */
export function HomeDashboard({ workspaceSlug, firstName, newUser, notificationCount,
  canCreateQuote, assistantAvailable, measureAction, recentWork }: Props) {
  const base = `/${workspaceSlug}`;
  return <div className="qc-home" data-qc-ui="v2">
    <header className="qc-home-heading">
      <div><p className="qc-eyebrow">Your workspace</p><h1>Welcome {newUser ? '' : 'back, '}{firstName}</h1>
        <p>Measure with confidence. Price your work. Send a great quote.</p></div>
      <Link href={`${base}/tutorials`} prefetch={false} className="qc-button" data-qc-variant="glass"><QcIcon name="help" /> Tutorials</Link>
    </header>
    <section className="qc-home-start" aria-labelledby="qc-home-start-title">
      <div className="qc-home-start-copy"><span className="qc-eyebrow">Start something new</span>
        <h2 id="qc-home-start-title">What are we pricing today?</h2>
        <p>Already measured the job? Start a quote. Need quantities first? Open your plan in takeoff.</p>
        <div className="qc-home-start-actions">
          <Link href={canCreateQuote ? `${base}/quotes/new` : `${base}/quotes`} prefetch={false}
            className="qc-button" data-qc-variant="primary" data-qc-size="lg">
            <QcIcon name="plus" />{canCreateQuote ? 'New quote' : 'Open quotes'}<QcIcon name="arrow" />
          </Link>
          <div className="qc-home-measure">{measureAction}</div>
        </div>
      </div>
      <div className="qc-home-process" aria-label="Measure, price, quote">
        {(['measure','pricing','quote'] as const).map((name, index) => <div key={name}>
          <span className="qc-home-process-icon"><QcIcon name={name} /></span>
          <strong>{['Measure','Price','Quote'][index]}</strong><span>{['Capture the job','Use your pricing','Make it yours'][index]}</span>
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
        ) : recentWork.length === 0 ? <div className="qc-home-empty"><QcIcon name="quote" /><h3>Your first quote starts here</h3>
          <p>Create a quote and it will appear in your recent work.</p></div> : <div className="qc-recent-list">
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
