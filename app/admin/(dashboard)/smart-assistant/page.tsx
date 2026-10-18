import { listSmartAssistantCompanies } from './actions';
import { SmartAssistantPanel } from './SmartAssistantPanel';
import { AssistantV2AdminSection } from './AssistantV2AdminSection';

export const dynamic = 'force-dynamic';

export default async function SmartAssistantAdminPage() {
  const result = await listSmartAssistantCompanies();
  const rows = result.ok ? result.rows : [];
  const error = result.ok ? null : result.error;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Smart Assistant</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Access follows the subscription: custom plans that include the
          Assistant product get it automatically; legacy plans do not. Use an
          override to force access on (internal testing) or off (emergency
          kill switch).
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <SmartAssistantPanel initialRows={rows} />
      {!error && <AssistantV2AdminSection companies={rows} />}
    </div>
  );
}
