'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { JobSpaceContext, isJobSection, type JobSection } from './job-space/JobSpaceContext';
import { CustomerQuotePreview, LaborSheetPreview, DownloadTabPDF } from './job-space/SummaryDocumentPreviews';
import type { SummaryTabsProps } from './job-space/summary-types';
import './job-space/job-space.css';

/** Existing public name and required props retained. C11 job navigation owns only
 * local view state; history.replaceState never requests or refreshes server data.
 */
export function SummaryTabs({ workspaceSlug, quoteId, customerLines, hasCustomerQuote, quote,
  effectiveCurrency, hasLaborSheet, laborLines, children, summaryActions, summaryHeaderSlot,
  overview, filesPanel, activityPanel, managementActions, initialSection }: SummaryTabsProps) {
  const defaultSection: JobSection = initialSection ?? (overview ? 'overview' : 'summary');
  const [activeTab, setActiveTab] = useState<JobSection>(defaultSection);
  const tabRef = useRef<HTMLDivElement>(null);
  const tabs: { id: JobSection; label: string }[] = [
    ...(overview ? [{ id: 'overview' as const, label: 'Overview' }] : []),
    { id: 'summary', label: 'Costing summary' }, { id: 'customer', label: 'Customer quote' },
    { id: 'labor', label: 'Labour sheet' },
    ...(filesPanel ? [{ id: 'files' as const, label: 'Files & notes' }] : []),
    ...(activityPanel ? [{ id: 'activity' as const, label: 'Communication' }] : []),
  ];
  const openSection = useCallback((section: JobSection, anchor?: string) => {
    setActiveTab(section);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', section);
    window.history.replaceState(window.history.state, '', url);
    requestAnimationFrame(() => {
      const target = anchor ? document.getElementById(anchor) : document.getElementById(`qc-job-panel-${section}`);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  }, []);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('tab');
      setActiveTab(isJobSection(requested) ? requested : params.get('view') === 'original' ? 'summary' : defaultSection);
    };
    restore();
    const onCustomer = () => openSection('customer');
    window.addEventListener('popstate', restore);
    window.addEventListener('switch-to-customer-tab', onCustomer);
    return () => {
      window.removeEventListener('popstate', restore);
      window.removeEventListener('switch-to-customer-tab', onCustomer);
    };
    // Intentionally tied to record identity, never refreshed props/array identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, openSection]);
  const context = useMemo(() => ({ active: activeTab, openSection }), [activeTab, openSection]);
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : direction ? (index + direction + tabs.length) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault();
    tabRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    // Manual activation: Enter/Space opens the focused tab. Arrow keys never
    // navigate away from a user's edit-in-progress in a nested panel.
  }
  const fileStem = quote.customer_name.replace(/[^a-z0-9]/gi, '_');
  return <JobSpaceContext.Provider value={context}>
    <div className="qc-job-tabs" role="tablist" aria-label="Job space sections" data-copilot="summary-tabs" ref={tabRef}>
      {tabs.map((tab, index) => <button key={tab.id} id={`qc-job-tab-${tab.id}`} type="button" role="tab"
        aria-selected={activeTab === tab.id} aria-controls={`qc-job-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1}
        data-copilot={`tab-${tab.id}`} data-tab-active={activeTab === tab.id ? 'true' : undefined}
        onKeyDown={event => moveTab(event,index)} onClick={() => openSection(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="qc-job-panels">
      {/* Stable mounts: tab changes never throw away notes, uploads or message state. */}
      {overview && <section id="qc-job-panel-overview" role="tabpanel" tabIndex={-1} aria-labelledby="qc-job-tab-overview" hidden={activeTab !== 'overview'}>{overview}</section>}
      <section id="qc-job-panel-summary" role="tabpanel" tabIndex={-1} aria-labelledby="qc-job-tab-summary" hidden={activeTab !== 'summary'}>
        <div className="qc-job-panel-heading"><div><h2>Internal costing summary</h2><p>Your business view. This is separate from the customer quote.</p></div><div className="qc-job-document-actions">{summaryActions}</div></div>
        <div className="qc-job-snapshot-switch">{summaryHeaderSlot}</div>
        <div className="qc-job-document-scroll">{children}</div>
      </section>
      <section id="qc-job-panel-customer" role="tabpanel" tabIndex={-1} aria-labelledby="qc-job-tab-customer" hidden={activeTab !== 'customer'}>
        <div className="qc-job-panel-heading"><div><h2>Customer quote</h2><p>Review what your customer will receive. Use the editor to change visibility and pricing.</p></div>
          {hasCustomerQuote && <div className="qc-job-document-actions"><Link href={`/${workspaceSlug}/quotes/${quoteId}/customer-edit`} prefetch={false} data-copilot="edit-customer-icon" className="qc-button" data-qc-variant="ghost"><QcIcon name="edit" />Edit quote</Link>
            <DownloadTabPDF selector="[data-pdf-customer]" filename={`Customer-Quote-${quote.quote_number || 'DRAFT'}-${fileStem}.pdf`} title="Download customer quote PDF" /></div>}</div>
        <div className="qc-job-document-scroll"><CustomerQuotePreview workspaceSlug={workspaceSlug} quoteId={quoteId} hasCustomerQuote={hasCustomerQuote}
          customerLines={customerLines} quote={quote} effectiveCurrency={effectiveCurrency} /></div>
      </section>
      <section id="qc-job-panel-labor" role="tabpanel" tabIndex={-1} aria-labelledby="qc-job-tab-labor" hidden={activeTab !== 'labor'}>
        <div className="qc-job-panel-heading"><div><h2>Labour sheet</h2><p>A separate document for your installer or subcontractor.</p></div>
          {hasLaborSheet && <div className="qc-job-document-actions"><Link href={`/${workspaceSlug}/quotes/${quoteId}/labor-sheet`} prefetch={false} data-copilot="edit-labor-icon" className="qc-button" data-qc-variant="ghost"><QcIcon name="edit" />Edit labour sheet</Link>
            <DownloadTabPDF selector="[data-pdf-labor]" filename={`Labor-Sheet-${quote.quote_number || 'DRAFT'}-${fileStem}.pdf`} title="Download labour sheet PDF" /></div>}</div>
        <div className="qc-job-document-scroll"><LaborSheetPreview workspaceSlug={workspaceSlug} quoteId={quoteId} hasLaborSheet={hasLaborSheet}
          laborLines={laborLines} quote={quote} effectiveCurrency={effectiveCurrency} /></div>
      </section>
      {filesPanel && <section id="qc-job-panel-files" role="tabpanel" tabIndex={-1} aria-labelledby="qc-job-tab-files" hidden={activeTab !== 'files'}>{filesPanel}</section>}
      {activityPanel && <section id="qc-job-panel-activity" role={activeTab === 'activity' ? 'tabpanel' : undefined} tabIndex={-1}
        aria-labelledby={activeTab === 'activity' ? 'qc-job-tab-activity' : undefined} aria-label={activeTab !== 'activity' ? 'Job communication' : undefined}
        hidden={activeTab !== 'overview' && activeTab !== 'activity'}>{activityPanel}</section>}
      {managementActions && <section className="qc-job-management qc-hub-surface" hidden={activeTab !== 'overview'} aria-labelledby="qc-job-management-title">
        <div><h2 id="qc-job-management-title">Manage this job</h2><p>Export to accounting, duplicate the quote or manage its acceptance link.</p></div><div className="qc-job-management-actions">{managementActions}</div>
      </section>}
    </div>
  </JobSpaceContext.Provider>;
}
