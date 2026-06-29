import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { OnboardingForm } from './OnboardingForm';
import { GoogleOnboardingForm } from './GoogleOnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  // /onboarding is a PUBLIC path in middleware (so brand-new Google users with
  // no profile row can reach it), which means auth is NOT enforced upstream.
  // Therefore this page must handle the no-session case itself: redirect to
  // login rather than throwing (requireUser() throws 'Unauthorized' -> 500).
  // This was the cause of the "This page couldn't load" 500 on /onboarding
  // when the session cookie wasn't yet established after signup/login.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    redirect('/login?redirect=/onboarding');
  }

  // Check if user has a profile in users table
  const { data: profile } = await supabase
    .from('users')
    .select('id, company_id')
    .eq('id', authUser.id)
    .maybeSingle();

  // ── ORPHANED-PROFILE RECOVERY (second line of defense) ────────
  // If the auth user has no profile row but has data (quotes, etc.)
  // belonging to their user ID, they're an existing user whose profile
  // was deleted. Restore the link instead of showing the Google signup
  // form (which would create a new company and orphan their data).
  // This mirrors the recovery in /auth/callback/route.ts.
  if (!profile) {
    const { data: orphanedQuote } = await supabase
      .from('quotes')
      .select('company_id')
      .eq('created_by_user_id', authUser.id)
      .limit(1)
      .maybeSingle();

    if (orphanedQuote?.company_id) {
      const { data: orphanedCompany } = await supabase
        .from('companies')
        .select('slug, onboarding_completed_at')
        .eq('id', orphanedQuote.company_id)
        .maybeSingle();

      if (orphanedCompany) {
        const admin = createAdminClient();
        await admin.from('users').insert({
          id: authUser.id,
          company_id: orphanedQuote.company_id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
          role: 'owner',
        });
        console.error(
          `[onboarding] ORPHAN RECOVERY: restored profile for user ${authUser.id} to company ${orphanedQuote.company_id}`,
        );
        redirect(`/${orphanedCompany.slug || 'workspace'}`);
      }
    }
  }
  // ── END ORPHANED-PROFILE RECOVERY ─────────────────────────────

  // Case 1: No profile at all (Google OAuth new user) - show company setup form
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
            <div className="text-center space-y-2">
              <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block mb-2" />
              <h1 className="text-2xl font-bold text-slate-900">Welcome to QuoteCore+!</h1>
              <p className="text-slate-600 text-sm">
                Just a couple of details to set up your workspace.
              </p>
            </div>
            <GoogleOnboardingForm 
              defaultName={authUser.user_metadata?.full_name || authUser.user_metadata?.name || ''}
              defaultEmail={authUser.email || ''}
            />
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Has profile but no company (shouldn't happen normally)
  if (!profile.company_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">Set Up Your Company</h1>
              <p className="text-slate-600 text-sm">We need a company name to get you started.</p>
            </div>
            <GoogleOnboardingForm defaultName="" defaultEmail={authUser.email || ''} />
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Has profile + company - check if onboarding complete
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, slug, default_currency, default_language, default_measurement_system, onboarding_completed_at')
    .eq('id', profile.company_id)
    .single();

  if (company?.onboarding_completed_at) {
    redirect(`/${company.slug}`);
  }

  // Case 4: Company exists but onboarding not complete - show preferences form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Welcome to QuoteCore+</h1>
            <p className="text-slate-600">
              Let&apos;s set up your company preferences. You can change these later in settings.
            </p>
          </div>
          <OnboardingForm
            companyId={company!.id}
            companyName={company!.name}
            // company.slug is nullable in the schema; in practice it's
            // always set at signup. Coerce to '' so the typed prop holds
            // and the form surfaces an error rather than silently routing
            // to /undefined/.
            companySlug={company!.slug ?? ''}
            currentCurrency={company!.default_currency}
            currentLanguage={company!.default_language}
            currentMeasurement={company!.default_measurement_system}
          />
        </div>
      </div>
    </div>
  );
}
