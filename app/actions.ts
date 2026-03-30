
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
