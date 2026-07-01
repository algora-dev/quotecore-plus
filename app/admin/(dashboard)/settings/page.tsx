import { getSettingsData } from './actions';
import { SettingsPanel } from './SettingsPanel';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const result = await getSettingsData();

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage plans, cron jobs, and global announcement banner.
        </p>
      </div>
      <SettingsPanel
        plans={result.plans}
        announcement={result.announcement}
        cronStatus={result.cronStatus}
      />
    </div>
  );
}
