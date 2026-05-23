'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const supabase = await createSupabaseServerClient();

  // signInWithPassword sets session cookies AND returns the authed user.
  // We use the same client instance for all subsequent queries so we rely
  // on the in-memory session, not the just-set response cookies (which a
  // freshly constructed client in the same request cannot read back yet).
  const { error, data: authData } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const userId = authData.user.id;

  // Use the same authenticated supabase instance (has the session in memory).
  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (!profile?.company_id) {
    redirect('/onboarding');
  }

  // Check onboarding completion and get workspace slug in one query.
  const { data: company } = await supabase
    .from('companies')
    .select('slug, onboarding_completed_at')
    .eq('id', profile.company_id)
    .single();

  if (!company?.onboarding_completed_at) {
    redirect('/onboarding');
  }

  redirect(`/${company?.slug || 'workspace'}`);
}