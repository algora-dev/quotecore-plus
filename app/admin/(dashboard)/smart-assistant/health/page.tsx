import { requireAdmin } from '@/app/lib/supabase/server';
import { AssistantHealthCanary } from '../AssistantHealthCanary';

export const dynamic = 'force-dynamic';

export default async function SmartAssistantHealthPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Smart Assistant health</h1>
        <p className="mt-0.5 text-sm text-slate-500">Provider compatibility canary. This does not use customer data or create a Smart Assistant conversation.</p>
      </div>
      <AssistantHealthCanary />
    </div>
  );
}
