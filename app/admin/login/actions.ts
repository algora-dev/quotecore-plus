'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';

interface AdminLoginResult {
  error?: string;
}

/**
 * Admin sign-in flow. Behaves like the regular `/login` action but adds a
 * mandatory `is_admin` check before considering the sign-in successful;
 * a non-admin account is signed back out immediately so they can't carry
 * a stray admin-area session around.
 *
 * Returns `{ error }` on failure so the client form can render an inline
 * message. The actual redirect happens client-side via `router.push` so
 * the user lands on the admin dashboard with a fresh client cache.
 */
export async function adminLoginAction(formData: FormData): Promise<AdminLoginResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createSupabaseServerClient();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user) {
    // Same generic copy as the customer login flow to avoid enumeration.
    return { error: 'Invalid email or password.' };
  }

  // Verify admin status. We deliberately tear down the session if not
  // admin so a non-admin user can't accidentally hold a cookie that
  // looks like it should work in the admin area.
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', signInData.user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return { error: 'Could not verify admin access. Please try again.' };
  }

  if (!profile?.is_admin) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have admin access." };
  }

  return {};
}
