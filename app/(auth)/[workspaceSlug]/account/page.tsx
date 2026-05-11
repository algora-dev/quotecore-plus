import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { EmailChangeSection } from '@/app/(auth)/[workspaceSlug]/settings/EmailChangeSection';
import { UserProfileForm } from './UserProfileForm';

/**
 * /account — index page (user profile + email).
 *
 * Default landing for the section. Per Shaun's preference: when the user
 * clicks "Account" in the top nav, they land here (most personal — name,
 * email). Company-level config is one click away under "Company".
 */
export default async function AccountIndexPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Parallelise the two reads. They have no dependency on each other so
  // sequencing was adding a free round-trip to every Account page load.
  const [{ data: user }, { data: { user: authUser } }] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, email')
      .eq('id', profile.id)
      .single(),
    supabase.auth.getUser(),
  ]);

  // authProvider drives the EmailChangeSection's UI — Google-only users see
  // a "manage in Google" message instead of the change form.
  const authProvider = authUser?.app_metadata?.provider || 'email';
  const userEmail = user?.email || authUser?.email || '';

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-500 mt-1">Your personal account details.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <UserProfileForm
          userId={profile.id}
          currentFullName={user?.full_name ?? ''}
          currentEmail={userEmail}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Sign-in email</h3>
          <p className="text-xs text-slate-500 mt-1">Change the email used to sign in. Both your old and new email must confirm the change.</p>
        </div>
        <EmailChangeSection currentEmail={userEmail} authProvider={authProvider} />
      </div>
    </section>
  );
}
