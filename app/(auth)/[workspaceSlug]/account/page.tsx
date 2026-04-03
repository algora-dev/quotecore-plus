import { loadCompanyContext } from '@/app/lib/data/company-context';
import { MeasurementSystemSelector } from './MeasurementSystemSelector';
import { AccountSettings } from './AccountSettings';

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

      <AccountSettings company={company} profile={profile} />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <MeasurementSystemSelector currentSystem={company.default_measurement_system} />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Coming soon:</strong> Invite teammates, manage permissions, and customize company branding.
        </p>
      </div>
    </section>
  );
}
