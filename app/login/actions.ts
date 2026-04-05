'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Get company context (will redirect to /onboarding if needed)
  const profile = await requireCompanyContext();
  
  // Load company to get workspace slug
  const { data: company } = await supabase
    .from('companies')
    .select('slug')
    .eq('id', profile.company_id)
    .single();
  
  const workspaceSlug = company?.slug || 'workspace';
  
  redirect(`/${workspaceSlug}`);
}