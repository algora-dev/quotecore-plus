import { loadCompanyContext } from '@/app/lib/data/company-context';

export default async function AccountPage() {
  const { company, profile } = await loadCompanyContext();

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Account & permissions</h1>
        <p className="text-slate-600">
          Manage company settings, primary contact details, and (soon) invite additional teammates.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Company</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-900">Name</dt>
              <dd>{company.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Slug</dt>
              <dd className="font-mono">{company.slug}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Primary contact</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-900">Name</dt>
              <dd>{profile.full_name ?? 'Owner'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Email</dt>
              <dd>{profile.email}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        Additional permissions, roles, and billing controls will live here in the next iteration.
      </div>
    </section>
  );
}
