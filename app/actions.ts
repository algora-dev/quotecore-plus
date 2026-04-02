
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { normalizeLanguage } from '@/app/lib/i18n/languages';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function updateCompanyLanguage(language: string) {
  const normalized = normalizeLanguage(language);
  const { profile, company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('companies')
    .update({ default_language: normalized })
    .eq('id', profile.company_id);

  if (error) {
    if (error.message.includes('default_language')) {
      return {
        success: false,
        message: 'Language persistence is not enabled on this environment yet.',
      } as const;
    }

    return { success: false, message: error.message } as const;
  }

  revalidatePath(`/${company.slug}`);
  revalidatePath(`/${company.slug}/templates`);
  revalidatePath(`/${company.slug}/quotes`);
  revalidatePath('/', 'layout');

  return { success: true } as const;
}
