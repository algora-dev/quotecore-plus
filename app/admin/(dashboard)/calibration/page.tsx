import { listCalibrationCompanies } from './actions';
import { CalibrationFlagPanel } from './CalibrationFlagPanel';

export const dynamic = 'force-dynamic';

export default async function CalibrationAdminPage() {
  const result = await listCalibrationCompanies();
  const rows = result.ok ? result.rows : [];
  const error = result.ok ? null : result.error;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Calibration</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Dark-launch access control for AI-assisted calibration. Grant a company
          access before general release. Flag off = completely invisible: no
          chooser entry point, no API access. Manual calibration always stays
          available.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <CalibrationFlagPanel initialRows={rows} />
    </div>
  );
}
