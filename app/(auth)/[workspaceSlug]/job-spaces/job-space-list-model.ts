/** Read-only index projection. Never converts a quote into another entity. */
export interface JobSpaceRow {
  id: string;
  customer_name: string;
  job_name: string | null;
  status: string;
  quote_number: number | string | null;
  created_at: string;
  updated_at: string;
  job_status: string | null;
  viewed_at: string | null;
  has_pending_revision: boolean;
}
export type JobSpaceSort = 'updated' | 'oldest' | 'name';
type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

/** Same job-status labels as QuotesList. These are display values, not transitions. */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  unsent: { label: 'Unsent', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  deposit_paid: { label: 'Deposit Paid', tone: 'success' },
  materials_ordered: { label: 'Materials Ordered', tone: 'info' },
  install: { label: 'Install', tone: 'info' },
  invoice_sent: { label: 'Invoice Sent', tone: 'warning' },
  invoice_paid: { label: 'Invoice Paid', tone: 'success' },
  finished: { label: 'Finished', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
};
export function jobStatusKey(row: JobSpaceRow) { return row.job_status || 'unsent'; }
export function jobStatusDisplay(key: string) {
  return STATUS[key] ?? { label: key.replace(/_/g, ' '), tone: 'neutral' as const };
}
export function jobTitle(row: JobSpaceRow) {
  return row.job_name?.trim() || row.customer_name?.trim() || 'Untitled job';
}
export function nonDraftJobs(rows: readonly JobSpaceRow[]) {
  return rows.filter(row => row.status !== 'draft');
}
function timestamp(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}
export function selectJobSpaces(rows: readonly JobSpaceRow[], search: string, status: string, sort: JobSpaceSort) {
  const needle = search.trim().toLowerCase();
  return nonDraftJobs(rows).filter(row => {
    const haystack = `${row.job_name ?? ''} ${row.customer_name ?? ''} #${row.quote_number ?? ''}`.toLowerCase();
    return (!needle || haystack.includes(needle)) && (status === 'all' || jobStatusKey(row) === status);
  }).sort((a, b) => {
    const difference = sort === 'name'
      ? jobTitle(a).localeCompare(jobTitle(b), 'en')
      : sort === 'oldest' ? timestamp(a.updated_at) - timestamp(b.updated_at)
      : timestamp(b.updated_at) - timestamp(a.updated_at);
    return difference || a.id.localeCompare(b.id, 'en');
  });
}
export function jobUpdatedLabel(value: string) {
  if (!Number.isFinite(Date.parse(value))) return 'Update time unavailable';
  // Fixed zone prevents SSR/client hydration drift; exact time is available in title.
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}
export function jobUpdatedDetail(value: string) {
  if (!Number.isFinite(Date.parse(value))) return undefined;
  return `${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(value))} UTC`;
}
export function jobSpaceHref(slug: string, id: string) {
  return `/${encodeURIComponent(slug)}/quotes/${encodeURIComponent(id)}/summary?from=job-spaces`;
}
