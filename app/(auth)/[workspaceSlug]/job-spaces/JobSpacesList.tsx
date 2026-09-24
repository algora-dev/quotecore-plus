'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { QcNotice } from '@/app/components/ui/v2/QcSurface';
import { jobSpaceHref, jobStatusDisplay, jobStatusKey, jobTitle, jobUpdatedDetail,
  jobUpdatedLabel, nonDraftJobs, selectJobSpaces, type JobSpaceRow, type JobSpaceSort } from './job-space-list-model';
import './job-spaces.css';

interface Props {
  workspaceSlug: string;
  /** Undefined is a failed/unavailable read, never an authoritative empty collection. */
  quotes?: JobSpaceRow[];
  loadError?: boolean;
  /** Optional authoritative count for detecting a partial server result. See P3-LIST-01. */
  nonDraftCount?: number;
}
const PAGE_SIZE = 30;

/** C51. Read-only non-draft work queue. Quotes retains all mutations and draft tools. */
export function JobSpacesList({ workspaceSlug, quotes, loadError = false, nonDraftCount }: Props) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<JobSpaceSort>('updated');
  const [page, setPage] = useState(1);
  const base = `/${workspaceSlug}`;
  const jobs = nonDraftJobs(quotes ?? []);
  const results = selectJobSpaces(jobs, search, status, sort);
  const statusOptions = [...new Set([...jobs.map(jobStatusKey), ...(status === 'all' ? [] : [status])])].sort((a, b) =>
    jobStatusDisplay(a).label.localeCompare(jobStatusDisplay(b).label, 'en'));
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const visibleJobs = results.slice(start, start + PAGE_SIZE);
  const hasFilter = !!search.trim() || status !== 'all';
  const unavailable = loadError || quotes === undefined;
  function clearFilters() { setSearch(''); setStatus('all'); setPage(1); }

  return <section data-qc-ui="v2" data-qc-component="C51" className="qc-job-index" aria-labelledby={`${id}-title`}>
    <header className="qc-job-index-header">
      <div><p className="qc-job-index-eyebrow">Your work, in one place</p>
        <h1 id={`${id}-title`}>Job Spaces</h1>
        <p>Open a job to see its pricing, documents and updates. Drafts stay in Quotes.</p>
      </div>
      <Link href={`${base}/quotes`} prefetch={false} className="qc-button" data-qc-variant="ghost">
        <QcIcon name="quote" />Quotes &amp; drafts<QcIcon name="arrow" />
      </Link>
    </header>

    {unavailable ? <QcNotice tone="warning" role="status">
      <h2>Job spaces could not be loaded</h2><p>Your quotes have not been changed. Try again or open Quotes.</p>
      <div className="qc-job-index-empty-actions">
        <a href={`${base}/job-spaces`} className="qc-button" data-qc-variant="primary">Try again</a>
        <Link href={`${base}/quotes`} prefetch={false} className="qc-button" data-qc-variant="ghost">Open Quotes</Link>
      </div>
    </QcNotice> : jobs.length === 0 ? <div className="qc-job-index-empty">
      <span className="qc-job-index-empty-icon"><QcIcon name="folder" /></span>
      <h2>Your job spaces will appear here</h2>
      <p>Finish a draft quote to open its job space. You can find existing drafts or start a new quote in Quotes.</p>
      <Link href={`${base}/quotes`} prefetch={false} className="qc-button" data-qc-variant="primary">Open Quotes<QcIcon name="arrow" /></Link>
    </div> : <>
      {nonDraftCount !== undefined && nonDraftCount > jobs.length && <QcNotice tone="warning">
        <strong>Only part of your job list is loaded</strong>
        <p>{jobs.length} of {nonDraftCount} job spaces are available in this view. Search and filters apply to these loaded records.</p>
      </QcNotice>}
      <form className="qc-job-index-filters" role="search" aria-label="Search job spaces" onSubmit={event => event.preventDefault()}>
        <label className="qc-field qc-job-search" htmlFor={`${id}-search`}>
          <span className="qc-label">Find a job</span>
          <input id={`${id}-search`} type="search" className="qc-input" value={search} autoComplete="off"
            placeholder="Job, customer or quote number" onChange={event => { setSearch(event.target.value); setPage(1); }} />
        </label>
        <label className="qc-field" htmlFor={`${id}-status`}><span className="qc-label">Status</span>
          <select id={`${id}-status`} className="qc-select" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">All statuses</option>
            {statusOptions.map(key => <option value={key} key={key}>{jobStatusDisplay(key).label}</option>)}
          </select>
        </label>
        <label className="qc-field" htmlFor={`${id}-sort`}><span className="qc-label">Sort by</span>
          <select id={`${id}-sort`} className="qc-select" value={sort} onChange={event => { setSort(event.target.value as JobSpaceSort); setPage(1); }}>
            <option value="updated">Recently updated</option><option value="oldest">Oldest update</option><option value="name">Job name</option>
          </select>
        </label>
      </form>
      <div className="qc-job-index-result-line">
        <p role="status" aria-live="polite" aria-atomic="true">{results.length} job space{results.length === 1 ? '' : 's'}{hasFilter ? ' matching your filters' : ''}</p>
        {hasFilter && <QcButton size="sm" onClick={clearFilters}>Clear filters</QcButton>}
      </div>
      {results.length === 0 ? <div className="qc-job-index-empty">
        <QcIcon name="folder" /><h2>No matching job spaces</h2><p>Try a different name, quote number or status. Draft quotes are in Quotes.</p>
        <QcButton variant="primary" onClick={clearFilters}>Clear filters</QcButton>
      </div> : <>
        <div className="qc-job-index-columns" aria-hidden="true"><span>Job / customer</span><span>Quote</span><span>Status</span><span>Updated</span><span /></div>
        <ul className="qc-job-index-list" aria-label="Job spaces">
          {visibleJobs.map(job => {
            const key = jobStatusKey(job);
            const badge = jobStatusDisplay(key);
            const viewed = job.viewed_at && ['unsent', 'sent'].includes(key);
            const timestamp = jobUpdatedDetail(job.updated_at);
            return <li key={job.id}>
              <Link href={jobSpaceHref(workspaceSlug, job.id)} prefetch={false} className="qc-job-index-row">
                <span className="qc-job-index-identity"><strong>{jobTitle(job)}</strong>
                  <span>{job.customer_name || 'Customer not named'}</span></span>
                <span className="qc-job-index-number"><span className="qc-job-mobile-label">Quote </span>{job.quote_number == null ? 'Not numbered' : `#${job.quote_number}`}</span>
                <span className="qc-job-index-status"><span className="qc-status" data-qc-component="C13" data-qc-tone={badge.tone}>{badge.label}</span>
                  {job.has_pending_revision ? <span className="qc-job-response" data-response="attention"><QcIcon name="info" />Action required</span>
                    : viewed ? <span className="qc-job-response"><QcIcon name="eye" />Viewed</span> : null}</span>
                <span className="qc-job-index-updated"><span className="qc-job-mobile-label">Updated </span>
                  <time dateTime={timestamp ? job.updated_at : undefined} title={timestamp}>{jobUpdatedLabel(job.updated_at)}</time></span>
                <QcIcon name="chevron" className="qc-job-index-arrow" />
              </Link>
            </li>;
          })}
        </ul>
        <footer className="qc-job-index-footer"><p>Showing {start + 1}-{Math.min(start + PAGE_SIZE, results.length)} of {results.length} loaded job spaces</p>
          {pageCount > 1 && <nav aria-label="Job spaces pages"><QcButton size="sm" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>Previous</QcButton>
            <span aria-live="polite">Page {visiblePage} of {pageCount}</span>
            <QcButton size="sm" disabled={visiblePage === pageCount} onClick={() => setPage(visiblePage + 1)}>Next</QcButton></nav>}
        </footer>
      </>}
    </>}
  </section>;
}
