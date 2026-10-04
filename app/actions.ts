
'use server';

import { cookies } from 'next/headers';
import { PUSH_DEVICE_COOKIE, UUID } from '@/app/lib/pwa/push-contracts';
import { pushDatabase } from '@/app/lib/pwa/push-database';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { normalizeLanguage } from '@/app/lib/i18n/languages';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  // Best effort before sign-out. A failed network request must never prevent logout.
  const cookieStore = await cookies();
  const device = cookieStore.get(PUSH_DEVICE_COOKIE)?.value;
  if (device && UUID.test(device)) {
    try { await pushDatabase(supabase).rpc('pwa_push_manage', { p_operation: 'disable', p_subscription_id: device }).abortSignal(AbortSignal.timeout(3000)); } catch { /* The queue also checks membership, revocation and staleness. */ }
  }
  cookieStore.delete(PUSH_DEVICE_COOKIE);
  await supabase.auth.signOut();
  redirect('/login?signedOut=1');
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
  revalidatePath(`/${company.slug}/resources`);
  revalidatePath(`/${company.slug}/quotes`);
  revalidatePath('/', 'layout');

  return { success: true } as const;
}
