import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { CompanySettingsForm } from './CompanySettingsForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/app/components/BackButton';
import { PasswordSection } from './PasswordSection';
import { CopilotSettings } from './CopilotSettings';
import { MfaSection } from './MfaSection';
import { listMfaFactors } from './mfa-actions';
import { loadCompanyTaxes } from '@/app/lib/taxes/actions';

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load company settings
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', profile.company_id)
    .single();

  if (error || !company) {
    notFound();
  }

  // Load user profile
  const { data: user } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', profile.id)
    .single();

  // Load auth user for provider info
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const authProvider = authUser?.app_metadata?.provider || 'email';

  // Load most recent company logo (if any) for the inline LogoUploader
  const { data: logoFile } = await supabase
    .from('quote_files')
    .select('storage_path')
    .eq('company_id', company.id)
    .eq('file_type', 'logo')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (logoFile) {
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(logoFile.storage_path);
    logoUrl = urlData.publicUrl;
  }

  const taxes = await loadCompanyTaxes();
  const mfa = await listMfaFactors();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Account Settings</h1>
            <p className="text-slate-500 mt-1">Manage your company, preferences, and security</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full">
              {authProvider === 'google' ? (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </>
              ) : (
                <>Email</>
              )}
            </span>
            <span className="text-slate-400">{user?.email}</span>
          </div>
        </div>

        {/* Company & Preferences */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8" data-copilot="settings-company">
          <CompanySettingsForm
            companyId={company.id}
            userId={profile.id}
            currentCompanyName={company.name}
            currentUserName={user?.full_name || ''}
            currentCurrency={company.default_currency}
            currentLanguage={company.default_language}
            currentMeasurement={company.default_measurement_system}
            currentMaterialMargin={company.default_material_margin_percent || 0}
            currentLaborMargin={company.default_labor_margin_percent || 0}
            currentLogoUrl={logoUrl}
            currentTaxes={taxes.map((t) => ({
              id: t.id,
              dbId: t.id,
              name: t.name,
              rate_percent: Number(t.rate_percent),
            }))}
          />
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-copilot="settings-security">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Security</h2>
              <p className="text-sm text-slate-500 mt-1">Protect your account with additional security</p>
            </div>
          </div>
          <div className="space-y-4">
            <PasswordSection authProvider={authProvider} userEmail={user?.email || authUser?.email || ''} />
            <MfaSection initialFactors={mfa.factors} currentAal={mfa.currentAal} />
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-copilot="settings-billing">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Billing & Subscription</h2>
              <p className="text-sm text-slate-500 mt-1">Manage your plan and payment details</p>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center">
            <p className="text-sm text-slate-600 mb-2">
              You&apos;re currently on the <strong>Free Beta</strong> plan
            </p>
            <p className="text-xs text-slate-400">
              Subscription plans and billing will be available soon
            </p>
          </div>
        </div>

        {/* Copilot */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-copilot="settings-copilot">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Copilot</h2>
              <p className="text-sm text-slate-500 mt-1">Interactive tutorials that guide you through each feature</p>
            </div>
          </div>
          <CopilotSettings />
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-copilot="settings-links">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href={`/${workspaceSlug}/templates?tab=email`}
              className="px-4 py-2.5 text-sm font-medium text-center rounded-full border border-slate-300 hover:border-orange-300 hover:bg-orange-50 transition"
            >
              Email Templates
            </Link>
            <Link
              href={`/${workspaceSlug}/templates`}
              className="px-4 py-2.5 text-sm font-medium text-center rounded-full border border-slate-300 hover:border-orange-300 hover:bg-orange-50 transition"
            >
              Quote Templates
            </Link>
            <Link
              href={`/${workspaceSlug}/flashings`}
              className="px-4 py-2.5 text-sm font-medium text-center rounded-full border border-slate-300 hover:border-orange-300 hover:bg-orange-50 transition"
            >
              Flashings
            </Link>
            <Link
              href={`/${workspaceSlug}/components`}
              className="px-4 py-2.5 text-sm font-medium text-center rounded-full border border-slate-300 hover:border-orange-300 hover:bg-orange-50 transition"
            >
              Components
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
