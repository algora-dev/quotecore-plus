import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { NotificationsSection } from '@/app/(auth)/[workspaceSlug]/settings/NotificationsSection';
import { CopilotSettings } from '@/app/(auth)/[workspaceSlug]/settings/CopilotSettings';

/**
 * /account/notifications — preferences for app alerts and in-app guidance.
 *
 * Two cards:
 *   - Email me when in-app alerts fire (covers Quote Accepted/Declined,
 *     Re-Quote Requested). Security emails always send regardless and are
 *     surfaced inside the NotificationsSection's helper copy.
 *   - Copilot tutorial visibility + reset progress.
 *
 * Grouped together because both are "what does the app talk to me about"
 * preferences. If either grows past one card we'll split.
 */
export default async function NotificationsPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Parallelise: the two reads are independent.
  const [{ data: user }, { data: { user: authUser } }] = await Promise.all([
    supabase
      .from('users')
      .select('email, email_notifications_enabled')
      .eq('id', profile.id)
      .single(),
    supabase.auth.getUser(),
  ]);

  const userEmail = user?.email || authUser?.email || '';

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-500 mt-1">Decide which app alerts also reach your inbox, and how Copilot guides you.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-notifications">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Email alerts</h3>
        </div>
        <NotificationsSection
          initialEnabled={user?.email_notifications_enabled ?? true}
          userEmail={userEmail}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-copilot">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Copilot</h3>
          <p className="text-sm text-slate-500 mt-1">Interactive tutorials that guide you through each feature.</p>
        </div>
        <CopilotSettings />
      </div>
    </section>
  );
}
