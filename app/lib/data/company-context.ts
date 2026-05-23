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
  | 'default_trade'
  | 'onboarding_completed_at'
  | 'created_at'
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
    .select('id, name, slug, default_language, default_tax_rate, default_measurement_system, default_currency, default_trade, onboarding_completed_at, created_at')
    .eq('id', profile.company_id)
    .limit(1)
    .maybeSingle();

  console.log('[loadCompanyContext] Loaded company:', company?.default_measurement_system);

  if (error || !company) {
    if (error?.message?.includes('default_language') || error?.message?.includes('default_tax_rate') || error?.message?.includes('default_measurement_system') || error?.message?.includes('default_trade')) {
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

      // Match the DB NOT NULL defaults rather than nulling these out —
      // companies.default_currency and companies.default_language are NOT
      // NULL with defaults of 'NZD' and 'en' respectively; the previous
      // null fallback was a typing lie that the generated types now catch.
      return {
        profile,
        company: {
          ...fallback,
          default_language: 'en',
          default_tax_rate: 0,
          default_measurement_system: 'metric',
          default_currency: 'NZD',
          onboarding_completed_at: null,
        default_trade: 'roofing' as const,
        } satisfies CompanyContextRow,
      };
    }

    throw new Error(error?.message ?? 'Company context not found.');
  }

  return { profile, company };
}
