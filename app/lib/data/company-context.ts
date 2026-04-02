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
    .select('id, name, slug, default_language, default_tax_rate, created_at')
    .eq('id', profile.company_id)
    .limit(1)
    .maybeSingle();

  if (error || !company) {
    if (error?.message?.includes('default_language') || error?.message?.includes('default_tax_rate')) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('companies')
        .select('id, name, slug, created_at')
        .eq('id', profile.company_id)
        .limit(1)
        .maybeSingle();

      if (fallbackError || !fallback) {
        throw new Error(fallbackError?.message ?? 'Company context not found.');
      }

      return {
        profile,
        company: { ...fallback, default_language: null, default_tax_rate: 0 },
      };
    }

    throw new Error(error?.message ?? 'Company context not found.');
  }

  return { profile, company };
}
