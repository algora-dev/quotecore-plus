import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { notFound } from 'next/navigation';
import { CompanySettingsForm } from '@/app/(auth)/[workspaceSlug]/settings/CompanySettingsForm';
import { loadCompanyTaxes } from '@/app/lib/taxes/actions';

/**
 * /account/company — workspace-level configuration.
 *
 * Bundles all the things that are scoped to the company / workspace:
 * company name, logo, default currency, language, measurement system,
 * default profit margins, and the per-company tax list.
 *
 * The form itself is the existing CompanySettingsForm from the legacy
 * /settings tree. We did NOT move that file as part of this restructure —
 * see the brief in the parent commit message — so the import path still
 * reaches into /settings. Once team multi-tenant work lands and we have a
 * clearer separation between user-level and company-level identity, the
 * form can be split.
 */
export default async function CompanyPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // All four reads are independent (logo lookup uses company_id which we
  // already have from the profile), so fire them in parallel. The previous
  // sequential await chain added three avoidable round-trips to every load
  // of /account/company.
  const [companyRes, userRes, logoFileRes, taxes] = await Promise.all([
    supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single(),
    supabase
      .from('users')
      .select('full_name')
      .eq('id', profile.id)
      .single(),
    supabase
      .from('quote_files')
      .select('storage_path')
      .eq('company_id', profile.company_id)
      .eq('file_type', 'logo')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadCompanyTaxes(),
  ]);

  const company = companyRes.data;
  if (companyRes.error || !company) notFound();
  const user = userRes.data;
  const logoFile = logoFileRes.data;

  let logoUrl: string | null = null;
  if (logoFile) {
    const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(logoFile.storage_path);
    logoUrl = urlData.publicUrl;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Company</h2>
        <p className="text-sm text-slate-500 mt-1">Settings that apply to your whole workspace.</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-copilot="account-company">
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
    </section>
  );
}
