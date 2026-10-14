import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { CustomerAccountForm } from './CustomerAccountForm';
export const dynamic = 'force-dynamic';
export default async function CustomerAccountsPage() {
  await requireAdmin(); const admin = createAdminClient();
  const { data: plans } = await admin.from('subscription_plans').select('code, display_name').order('sort_order', { ascending: true });
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold text-slate-900">Create customer account</h1><p className="mt-1 text-sm text-slate-500">Create a ready-to-use customer workspace and hand over the temporary login.</p></div><CustomerAccountForm plans={(plans ?? []).map((plan) => ({ code: plan.code, name: plan.display_name }))} /></section>;
}
