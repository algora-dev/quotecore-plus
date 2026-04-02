import { loadCompanyContext } from '@/app/lib/data/company-context';
import { MeasurementSystemSelector } from './MeasurementSystemSelector';

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

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Company Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Company Name</dt>
              <dd className="font-medium text-slate-900">{company.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Default Tax Rate</dt>
              <dd className="font-medium text-slate-900">{company.default_tax_rate}%</dd>
            </div>
          </dl>
        </div>

        <div className="border-t pt-6">
          <MeasurementSystemSelector currentSystem={company.default_measurement_system} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold mb-4">Primary Contact</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900">{profile.full_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{profile.email}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Coming soon:</strong> Invite teammates, manage permissions, and customize company branding.
        </p>
      </div>
    </section>
  );
}
