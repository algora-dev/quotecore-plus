import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const profile = await requireCompanyContext({ skipOnboardingCheck: true });
  const supabase = await createSupabaseServerClient();

  // Load company to check if onboarding is already complete
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, default_currency, default_language, default_measurement_system, onboarding_completed_at')
    .eq('id', profile.company_id)
    .single();

  // If already onboarded, redirect to quotes
  if (company?.onboarding_completed_at) {
    redirect(`/${company.name.toLowerCase().replace(/\s+/g, '-')}/quotes`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Welcome to QuoteCore+</h1>
            <p className="text-slate-600">
              Let's set up your company preferences. You can change these later in settings.
            </p>
          </div>

          {/* Form */}
          <OnboardingForm 
            companyId={company!.id}
            companyName={company!.name}
            currentCurrency={company!.default_currency}
            currentLanguage={company!.default_language}
            currentMeasurement={company!.default_measurement_system}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Need help? Contact support at support@quotecore.com
        </p>
      </div>
    </div>
  );
}
