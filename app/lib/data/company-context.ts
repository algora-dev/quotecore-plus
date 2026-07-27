import {
  createSupabaseServerClient,
  getCurrentProfile,
  type Tables,
} from '@/app/lib/supabase/server';

/**
 * Subset of the generated `companies` row that the rest of the app uses
 * for context. Picks the columns explicitly so unrelated schema changes
 * to companies don't churn this contract.
 */
type CompanyContextRow = Pick<
  Tables<'companies'>,
  | 'id'
  | 'name'
  | 'slug'
  | 'default_language'
  | 'default_tax_rate'
  | 'default_measurement_system'
  | 'default_currency'
  | 'onboarding_completed_at'
  | 'created_at'
  | 'is_supplier'
>;

export type CompanyContext = {
  profile: Awaited<ReturnType<typeof getCurrentProfile>>;
  company: CompanyContextRow;
};

export async function loadCompanyContext(): Promise<CompanyContext> {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile.company_id) {
    throw new Error('No company context found for user');
  }

  const { data: company, error } = await supabase
    .from('companies')
    .select('id, name, slug, default_language, default_tax_rate, default_measurement_system, default_currency, default_trade, onboarding_completed_at, created_at, is_supplier')
    .eq('id', profile.company_id)
    .limit(1)
    .maybeSingle();

  console.log('[loadCompanyContext] Loaded company:', company?.default_measurement_system);

  if (error || !company) {
    if (error?.message?.includes('default_language') || error?.message?.includes('default_tax_rate') || error?.message?.includes('default_measurement_system')) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('companies')
        .select('id, name, slug, created_at')
        .eq('id', profile.company_id)
        .limit(1)
        .maybeSingle();

      if (fallbackError || !fallback) {
        throw new Error(fallbackError?.message ?? 'Company context not found.');
      }

      console.log('[loadCompanyContext] Using fallback - defaulting to metric');

      // Check supplier access by master_email
      let isSupplier = false;
      if (profile.email) {
        const { data: supplierProfile } = await supabase
          .from('supplier_profiles')
          .select('id')
          .eq('status', 'approved')
          .ilike('master_email', profile.email)
          .limit(1)
          .maybeSingle();
        isSupplier = !!supplierProfile;
      }

      return {
        profile,
        company: {
          ...fallback,
          default_language: 'en',
          default_tax_rate: 0,
          default_measurement_system: 'metric',
          default_currency: 'NZD',
          onboarding_completed_at: null,
          is_supplier: isSupplier,
        } satisfies CompanyContextRow,
      };
    }

    throw new Error(error?.message ?? 'Company context not found.');
  }

  // Check supplier access by master_email (overrides company flag if set)
  if (!company.is_supplier && profile.email) {
    const { data: supplierProfile } = await supabase
      .from('supplier_profiles')
      .select('id')
      .eq('status', 'approved')
      .ilike('master_email', profile.email)
      .limit(1)
      .maybeSingle();
    if (supplierProfile) {
      company.is_supplier = true;
    }
  }

  return { profile, company };
}
