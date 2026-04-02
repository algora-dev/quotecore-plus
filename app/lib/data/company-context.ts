import {
  createSupabaseServerClient,
  getCurrentProfile,
} from '@/app/lib/supabase/server';

export type CompanyContext = {
  profile: Awaited<ReturnType<typeof getCurrentProfile>>;
  company: {
    id: string;
    name: string | null;
    slug: string;
    default_language: string | null;
    default_tax_rate: number;
    default_measurement_system: 'metric' | 'imperial';
    created_at: string;
  };
};

export async function loadCompanyContext(): Promise<CompanyContext> {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile.company_id) {
    throw new Error('No company context found for user');
  }

  const { data: company, error } = await supabase
    .from('companies')
    .select('id, name, slug, default_language, default_tax_rate, default_measurement_system, created_at')
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

      return {
        profile,
        company: { 
          ...fallback, 
          default_language: null, 
          default_tax_rate: 0,
          default_measurement_system: 'metric' as const
        },
      };
    }

    throw new Error(error?.message ?? 'Company context not found.');
  }

  return { profile, company };
}
