import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireUser } from '@/app/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';
import { GoogleOnboardingForm } from './GoogleOnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireUser();

  // Check if user has a profile in users table
  const { data: profile } = await supabase
    .from('users')
    .select('id, company_id')
    .eq('id', authUser.id)
    .single();

  // Case 1: No profile at all (Google OAuth new user) — show company setup form
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

  // Case 3: Has profile + company — check if onboarding complete
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, slug, default_currency, default_language, default_measurement_system, onboarding_completed_at')
    .eq('id', profile.company_id)
    .single();

  if (company?.onboarding_completed_at) {
    redirect(`/${company.slug}`);
  }

  // Case 4: Company exists but onboarding not complete — show preferences form
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
            currentCurrency={company!.default_currency}
            currentLanguage={company!.default_language}
            currentMeasurement={company!.default_measurement_system}
          />
        </div>
      </div>
    </div>
  );
}
