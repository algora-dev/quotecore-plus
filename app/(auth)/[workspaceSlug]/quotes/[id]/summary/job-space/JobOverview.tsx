'use client';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { JobCapabilityCard } from './JobCapabilityCard';
import { JobOrderAction } from './JobOrderAction';
import { useJobSpace } from './JobSpaceContext';

export interface JobOverviewModel {
  workspaceSlug: string; quoteId: string; editHref: string; blank: boolean;
  hasCustomerQuote: boolean; hasLaborSheet: boolean; fileCount: number; noteCount: number;
  componentCount: number; areaLabel: string; total: string; materials: string; labour: string; margin: string;
  quoteStatus: string; accepted: boolean; declined: boolean; withdrawn: boolean; revisionCount: number;
  canOrder: boolean; canInvoice: boolean; activityEnabled: boolean;
  events: Array<{ label: string; date: string; tone?: 'success' | 'warning' }>;
}
export interface LinkedJobDocument { id: string; label: string; statusLabel: string }
export interface LinkedJobDocuments { orders: LinkedJobDocument[]; invoices: LinkedJobDocument[] }

/** All money is preformatted from the existing pricing engine. No new calculation.
 * Undefined relatedDocuments means linkage is unavailable, never 'none exist'. */
export function JobOverview({ model: m, relatedDocuments }: { model: JobOverviewModel; relatedDocuments?: LinkedJobDocuments }) {
  const nav = useJobSpace();
  const base = `/${m.workspaceSlug}`;
  const quoteBase = `${base}/quotes/${m.quoteId}`;
  const urgent = m.activityEnabled && m.revisionCount > 0;
  const focus = urgent ? 'Your customer has requested changes' : !m.hasCustomerQuote ? 'Turn your pricing into a customer quote' :
    m.accepted ? 'Your quote has been accepted' : m.declined ? 'Your customer declined this quote' :
    m.withdrawn ? 'The acceptance link is withdrawn' : 'Your customer quote is ready to review';
  const focusCopy = urgent ? 'Read the request and decide what to change. Your internal pricing stays separate from the customer document.' :
    !m.hasCustomerQuote ? 'Choose what your customer sees, customise the layout, then send when you are ready.' :
    m.accepted ? 'Return to your customer quote, order materials or prepare an invoice when you need to. Those next steps are optional.' :
    m.declined || m.withdrawn ? 'Review the history below. Reopening and other quote actions are available in Manage this job.' :
    'Review the customer-facing document before sending. Your pricing and private notes stay here.';
  return <div className="qc-job-overview">
    <section className="qc-job-focus" aria-labelledby="qc-job-focus-heading" data-attention={urgent ? 'true' : undefined}>
      <span className="qc-hub-icon"><QcIcon name={urgent ? 'mail' : m.accepted ? 'check' : 'quote'} /></span>
      <div><p className="qc-eyebrow">{urgent ? 'Needs your attention' : 'A useful next step'}</p><h2 id="qc-job-focus-heading">{focus}</h2><p>{focusCopy}</p></div>
      {urgent ? <QcButton variant="primary" onClick={() => nav?.openSection('activity')}>Review request <QcIcon name="arrow" /></QcButton> :
        !m.hasCustomerQuote ? <Link href={`${quoteBase}/customer-edit`} prefetch={false} className="qc-button" data-qc-variant="primary">Create customer quote <QcIcon name="arrow" /></Link> :
          <QcButton variant="ghost" onClick={() => nav?.openSection('customer')}>View customer quote <QcIcon name="arrow" /></QcButton>}
    </section>
    <section className="qc-job-snapshot" aria-label="Current internal costing snapshot">
      <div className="qc-job-snapshot-total"><span>Current internal total</span><strong>{m.total}</strong><small>Including tax · Internal only</small></div>
      <div><span>Item cost</span><strong>{m.materials}</strong></div><div><span>Labour cost</span><strong>{m.labour}</strong></div>
      <div><span>Added margins</span><strong>{m.margin}</strong><button type="button" onClick={() => nav?.openSection('summary')} className="qc-text-link">View costing <QcIcon name="arrow" /></button></div>
    </section>
    <div className="qc-section-heading qc-job-work-heading"><div><p className="qc-eyebrow">Everything for this job</p><h2>What would you like to work on?</h2></div><span className="qc-job-private"><QcIcon name="lock" />Internal workspace</span></div>
    <div className="qc-job-capabilities">
      <JobCapabilityCard title={m.blank ? 'Line items & pricing' : 'Measurements & pricing'} icon="measure"
        status={<span className="qc-status">{m.blank ? 'Standard quote' : m.areaLabel}</span>}
        description={m.blank ? 'Edit the items and prices in your standard quote.' : `${m.componentCount} component${m.componentCount === 1 ? '' : 's'}, captured measurements, extras and margins.`}>
        <Link href={m.editHref} prefetch={false} className="qc-button" data-qc-variant="ghost">{m.blank ? 'Edit line items' : 'Open quote builder'}<QcIcon name="arrow" /></Link>
        <QcButton onClick={() => nav?.openSection('summary')} className="qc-job-secondary-action">View internal summary</QcButton>
      </JobCapabilityCard>
      <JobCapabilityCard title="Customer quote" icon="quote" status={<span className="qc-status" data-qc-tone={m.hasCustomerQuote ? 'info' : 'neutral'}>{m.hasCustomerQuote ? 'Created' : 'Not created'}</span>}
        description="Choose the items, wording and prices your customer sees.">
        {m.hasCustomerQuote ? <><QcButton onClick={() => nav?.openSection('customer')} variant="ghost">View customer quote<QcIcon name="arrow" /></QcButton>
          <Link href={`${quoteBase}/customer-edit`} prefetch={false} className="qc-text-link">Edit customer quote</Link></> :
          <Link href={`${quoteBase}/customer-edit`} prefetch={false} className="qc-button" data-qc-variant="ghost"><QcIcon name="plus" />Create customer quote</Link>}
      </JobCapabilityCard>
      <JobCapabilityCard title="Labour sheet" icon="labour" status={<span className="qc-status" data-qc-tone={m.hasLaborSheet ? 'info' : 'neutral'}>{m.hasLaborSheet ? 'Created' : 'Optional'}</span>}
        description="A labour-only document for your installer or subcontractor.">
        {m.hasLaborSheet ? <><QcButton onClick={() => nav?.openSection('labor')} variant="ghost">View labour sheet<QcIcon name="arrow" /></QcButton>
          <Link href={`${quoteBase}/labor-sheet`} prefetch={false} className="qc-text-link">Edit labour sheet</Link></> :
          <Link href={`${quoteBase}/labor-sheet`} prefetch={false} className="qc-button" data-qc-variant="ghost"><QcIcon name="plus" />Create labour sheet</Link>}
      </JobCapabilityCard>
      <JobCapabilityCard title="Material orders" icon="orders" status={<span className="qc-status">{!m.canOrder ? 'Higher plan' : relatedDocuments ? `${relatedDocuments.orders.length} linked` : 'Optional'}</span>}
        description={relatedDocuments ? 'Your linked orders and new material requirements.' : 'Choose a layout and order selected components. Check Orders for existing documents.'}>
        {m.canOrder && m.componentCount > 0 ? <JobOrderAction workspaceSlug={m.workspaceSlug} quoteId={m.quoteId} /> :
          <Link href={`${base}/material-orders`} prefetch={false} className="qc-button" data-qc-variant="ghost">{m.canOrder ? 'Create a custom order' : 'View order options'}<QcIcon name="arrow" /></Link>}
        {relatedDocuments?.orders.map(order => <Link key={order.id} href={`${base}/material-orders/create?orderId=${order.id}`} prefetch={false} className="qc-text-link">{order.label} · {order.statusLabel}</Link>)}
        <Link href={`${base}/material-orders`} prefetch={false} className="qc-text-link">View all orders</Link>
      </JobCapabilityCard>
      <JobCapabilityCard title="Invoices" icon="invoice" status={<span className="qc-status">{!m.canInvoice ? 'Higher plan' : relatedDocuments ? `${relatedDocuments.invoices.length} linked` : 'Optional'}</span>}
        description={m.hasCustomerQuote ? 'Choose customer quote lines to prepare an invoice. Check Invoices for existing documents.' : 'Create your customer quote first, then choose its lines for an invoice.'}>
        <Link href={!m.canInvoice ? `${base}/invoices` : m.hasCustomerQuote ? `${base}/invoices/invoice-from-quote/${m.quoteId}` : `${quoteBase}/customer-edit`}
          prefetch={false} className="qc-button" data-qc-variant="ghost"><QcIcon name="plus" />{!m.canInvoice ? 'View invoice options' : m.hasCustomerQuote ? 'Create invoice' : 'Create customer quote'}</Link>
        {relatedDocuments?.invoices.map(invoice => <Link key={invoice.id} href={`${base}/invoices/${invoice.id}`} prefetch={false} className="qc-text-link">{invoice.label} · {invoice.statusLabel}</Link>)}
        <Link href={`${base}/invoices`} prefetch={false} className="qc-text-link">View all invoices</Link>
      </JobCapabilityCard>
      <JobCapabilityCard title="Files & notes" icon="folder" status={<span className="qc-status">{m.fileCount} file{m.fileCount === 1 ? '' : 's'} · {m.noteCount} note{m.noteCount === 1 ? '' : 's'}</span>}
        description="Plans, takeoff exports, supporting files and internal notes. Keep the job context together.">
        <QcButton variant="ghost" onClick={() => nav?.openSection('files', 'qc-job-files')}>View or add files<QcIcon name="arrow" /></QcButton>
        <QcButton className="qc-job-secondary-action" onClick={() => nav?.openSection('files', 'qc-job-notes')}>Read or add notes</QcButton>
      </JobCapabilityCard>
    </div>
    <section className="qc-job-updates qc-hub-surface" aria-label="Recorded job updates"><div><p className="qc-eyebrow">At a glance</p><h2>Recent updates</h2>
      <p>Recorded milestones for this quote. Open communication below for messages and follow-ups.</p></div>
      <ol>{m.events.length ? m.events.map((event, index) => <li key={`${event.label}-${index}`} data-tone={event.tone}>
        <span className="qc-job-event-dot" /><div><strong>{event.label}</strong><span>{event.date}</span></div>
      </li>) : <li><span>No recorded updates are available.</span></li>}</ol>
    </section>
  </div>;
}
