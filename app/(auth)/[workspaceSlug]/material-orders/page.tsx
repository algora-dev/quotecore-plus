import Link from 'next/link';
import { loadOrderTemplates } from './template-actions';
import { loadRecentOrders } from './order-list-actions';
import { MaterialOrdersHub } from './orders-hub';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { FEATURE_MIN_PLAN } from '@/app/lib/billing/features';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function MaterialOrdersPage(props: Props) {
  const { workspaceSlug } = await props.params;

  // Hard server-side feature gate. The nav already swaps in an upgrade
  // modal for gated plans, but direct URL access still has to render the
  // upgrade splash rather than the orders hub. We don't redirect because
  // doing so would surprise the user (URL change without context).
  const profile = await requireCompanyContext();
  const ent = await loadCompanyEntitlements(profile.company_id);
  if (!ent.features.material_orders) {
    const requiredPlan = FEATURE_MIN_PLAN.material_orders;
    return (
      <section className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Material Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Available on the {requiredPlan} plan and above.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">Material orders need a higher plan</h2>
              <p className="text-sm text-slate-600 mt-2">
                Send purchase orders straight to your suppliers and track deliveries on the {requiredPlan} plan or above. Upgrade your account to unlock material orders.
              </p>
              <div className="mt-4">
                <Link
                  href={`/${workspaceSlug}/account?tab=billing&plan=${requiredPlan}`}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800"
                >
                  View plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const [templates, recentOrders] = await Promise.all([
    loadOrderTemplates(),
    loadRecentOrders(),
  ]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Material Orders</h1>
        <p className="text-sm text-slate-500 mt-1">Create orders, manage suppliers, and track deliveries.</p>
      </div>

      <MaterialOrdersHub
        workspaceSlug={workspaceSlug}
        initialTemplates={templates}
        recentOrders={recentOrders}
      />
    </section>
  );
}
