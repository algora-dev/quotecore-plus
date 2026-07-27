import { requireAdmin } from '@/app/lib/supabase/server';
import { SuppliersPanel } from './SuppliersPanel';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  await requireAdmin();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Suppliers</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          Manage verified supplier profiles. Suppliers can publish component libraries
          searchable by all QuoteCore+ users.
        </p>
      </div>

      <SuppliersPanel />
    </section>
  );
}
