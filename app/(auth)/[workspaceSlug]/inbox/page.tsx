import Link from 'next/link';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { resolvePrefs } from '@/app/lib/alerts/prefs';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { FEATURE_MIN_PLAN } from '@/app/lib/billing/features';
import { InboxList } from './InboxList';

export const dynamic = 'force-dynamic';

/**
 * Message Center (v2) - an inbox of every alert/message across quotes,
 * orders and invoices, organised into folders (Active / To-Do / Archived).
 * The bell dropdown shows only recent items; this is the full inbox.
 */
export default async function InboxPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();

  // Hard feature gate: the Message Center is plan-gated (off on Free).
  // Render an upgrade splash rather than redirecting so the URL is stable.
  const ent = await loadCompanyEntitlements(profile.company_id);
  if (!ent.features.message_center) {
    const requiredPlan = FEATURE_MIN_PLAN.message_center;
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Message Center</h1>
          <p className="text-sm text-slate-500 mt-1">Available on the Starter plan and above.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">The Message Center needs a higher plan</h2>
              <p className="text-sm text-slate-600 mt-2">
                The full inbox of every alert and message from your quotes, orders and invoices is available on the {requiredPlan} plan or above. You&apos;ll still get accept / decline / change alerts to your bell and email on the free plan.
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
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: alerts }, { data: company }] = await Promise.all([
    supabase
      .from('alerts')
      .select(
        'id, alert_type, title, message, is_read, status, created_at, quote_id, invoice_id, order_id',
      )
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('companies')
      .select('notification_prefs')
      .eq('id', profile.company_id)
      .maybeSingle(),
  ]);

  const notificationPrefs = resolvePrefs(company?.notification_prefs);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Message Center</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every alert and message from your quotes, orders and invoices in one place.
        </p>
      </div>
      <InboxList
        initialAlerts={alerts || []}
        workspaceSlug={workspaceSlug}
        initialNotificationPrefs={notificationPrefs}
      />
    </div>
  );
}
