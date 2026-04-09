import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { CompanySettingsForm } from './CompanySettingsForm';
import { notFound } from 'next/navigation';

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
    .from('profiles')
    .select('full_name')
    .eq('id', profile.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
            <p className="text-gray-600 mt-2">
              Configure default preferences for your company
            </p>
          </div>

          {/* Settings Form */}
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
          />
        </div>
      </div>
    </div>
  );
}
