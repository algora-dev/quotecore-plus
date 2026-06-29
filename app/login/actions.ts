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
    // Supabase returns "Email not confirmed" when the user hasn't clicked
    // their confirmation link yet. Instead of throwing (which produces a
    // cryptic "Server Components render error" in production), return a
    // structured result so the client can show a friendly message with a
    // resend-confirmation option.
    if (error.message.toLowerCase().includes('email not confirmed')) {
      throw new Error('EMAIL_NOT_CONFIRMED');
    }
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

/**
 * Resend the email confirmation link for a user who hasn't confirmed yet.
 * Uses Supabase's resend endpoint, which sends a fresh confirmation email
 * with a secure link to /auth/callback.
 */
export async function resendConfirmationAction(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: 'Email is required.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
