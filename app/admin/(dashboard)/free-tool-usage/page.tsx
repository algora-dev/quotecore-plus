import { requireAdmin } from '@/app/lib/supabase/server';
import { FreeToolUsagePanel } from './FreeToolUsagePanel';

export const dynamic = 'force-dynamic';

export default async function FreeToolUsagePage() {
  await requireAdmin();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Free Tool Usage</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track free-tool usage across anonymous users, free-tool accounts, and app users.
        </p>
      </div>

      <FreeToolUsagePanel />
    </section>
  );
}
