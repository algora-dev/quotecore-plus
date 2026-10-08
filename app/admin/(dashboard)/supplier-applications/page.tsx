import { createAdminClient } from '@/app/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
] as const;

const STATUS_TONE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

interface Application {
  id: number;
  has_account: boolean;
  account_email: string;
  business_name: string;
  website: string | null;
  contact_person: string;
  contact_email: string;
  location: string;
  message: string | null;
  status: string;
  created_at: string;
}

// Table is new and not yet in generated DB types — use untyped query
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchApplications(status?: string): Promise<{ data: Application[] | null; error: string | null }> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (supabase as any)
    .from('supplier_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  return { data: data as Application[] | null, error: error?.message ?? null };
}

export default async function SupplierApplicationsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const { data: applications, error } = await fetchApplications(status);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Supplier applications</h1>
        <p className="text-sm text-slate-500 mt-1">Review and manage supplier partner applications.</p>
      </header>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((filter) => {
          const active = (status || 'all') === filter.value;
          const href = filter.value === 'all' ? '/admin/supplier-applications' : `/admin/supplier-applications?status=${filter.value}`;
          return (
            <a
              key={filter.value}
              href={href}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
              }`}
            >
              {filter.label}
            </a>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Error loading applications: {error}
        </div>
      )}

      {!error && applications && applications.length === 0 && (
        <div className="rounded-xl border-dashed border-slate-200 border px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No applications found.</p>
        </div>
      )}

      {applications && applications.length > 0 && (
        <div className="space-y-3">
          {applications.map((app) => (
            <details
              key={app.id}
              className="group rounded-xl border border-slate-200 bg-white hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition"
            >
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer select-none">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[app.status] || 'bg-slate-100 text-slate-700'}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    {app.status}
                  </span>
                  <span className="font-semibold text-slate-900 truncate">{app.business_name}</span>
                  <span className="text-sm text-slate-500 truncate hidden sm:inline">{app.contact_person}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">
                    {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <svg className="h-4 w-4 text-slate-400 transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </summary>

              <div className="border-t border-slate-100 px-5 py-4">
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Has QC+ account</dt>
                    <dd className="text-sm text-slate-900 mt-0.5">{app.has_account ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Account / preferred email</dt>
                    <dd className="text-sm text-slate-900 mt-0.5">
                      <a href={`mailto:${app.account_email}`} className="text-[#BD4A1A] hover:underline">{app.account_email}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Business name</dt>
                    <dd className="text-sm text-slate-900 mt-0.5">{app.business_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Website</dt>
                    <dd className="text-sm mt-0.5">
                      <a href={app.website || '#'} target="_blank" rel="noopener noreferrer" className="text-[#BD4A1A] hover:underline inline-flex items-center gap-1">
                        {app.website}
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact person</dt>
                    <dd className="text-sm text-slate-900 mt-0.5">{app.contact_person}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact email</dt>
                    <dd className="text-sm text-slate-900 mt-0.5">
                      <a href={`mailto:${app.contact_email}`} className="text-[#BD4A1A] hover:underline">{app.contact_email}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Location</dt>
                    <dd className="text-sm text-slate-900 mt-0.5">{app.location}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted</dt>
                    <dd className="text-sm text-slate-900 mt-0.5">
                      {new Date(app.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </dd>
                  </div>
                </dl>

                {app.message && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Message</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{app.message}</p>
                  </div>
                )}

                {/* Status update buttons */}
                <div className="mt-4 flex gap-2 flex-wrap">
                  <form action={`/api/supplier-application/${app.id}/status`} method="POST" className="inline">
                    <input type="hidden" name="status" value="reviewed" />
                    <button type="submit" className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                      Mark reviewed
                    </button>
                  </form>
                  <form action={`/api/supplier-application/${app.id}/status`} method="POST" className="inline">
                    <input type="hidden" name="status" value="accepted" />
                    <button type="submit" className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition">
                      Accept
                    </button>
                  </form>
                  <form action={`/api/supplier-application/${app.id}/status`} method="POST" className="inline">
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit" className="rounded-full border border-rose-300 bg-rose-50 px-4 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
