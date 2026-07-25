import { requireAdmin } from '@/app/lib/supabase/server';
import { RoofComponentsPanel } from './RoofComponentsPanel';

export const dynamic = 'force-dynamic';

export default async function RoofComponentsPage() {
  await requireAdmin();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Roof Takeoff Components</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage component definitions and pricing for the free Roof Takeoff Builder tool.
          Changes are live - the free tool reads these on every load.
        </p>
      </div>

      <RoofComponentsPanel />
    </section>
  );
}
