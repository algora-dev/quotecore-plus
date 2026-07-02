'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export type LoginResult =
  | { ok: true }
  | { ok: false; code: 'EMAIL_NOT_CONFIRMED'; email: string }
  | { ok: false; code: 'INVALID_CREDENTIALS'; message: string }
  | { ok: false; code: 'RATE_LIMITED'; message: string }
  | { ok: false; code: 'OTHER'; message: string };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { ok: false, code: 'OTHER', message: 'Email and password are required.' };
  }

  // Rate limit: 10 attempts per IP per 15 minutes, 5 per email per 15 minutes.
  const h = await headers();
  const ip = getClientIP(h);
  const ipAllowed = await checkRateLimit(`login-ip:${ip}`, 10, 15 * 60 * 1000);
  if (!ipAllowed) {
    return { ok: false, code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again in a few minutes.' };
  }
  const emailAllowed = await checkRateLimit(`login-email:${email}`, 5, 15 * 60 * 1000);
  if (!emailAllowed) {
    return { ok: false, code: 'RATE_LIMITED', message: 'Too many login attempts for this email. Please try again in a few minutes.' };
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
    const msg = error.message.toLowerCase();
    // Supabase returns "Email not confirmed" when the user hasn't clicked
    // their confirmation link yet. Return a structured result so the client
    // can show a friendly message with a resend-confirmation option.
    // IMPORTANT: we must RETURN this, not throw it. Thrown errors from
    // server actions are sanitized by Next.js in production builds and the
    // client sees a generic "Server Components render error" instead of
    // our sentinel value.
    if (msg.includes('email not confirmed')) {
      return { ok: false, code: 'EMAIL_NOT_CONFIRMED', email };
    }
    // Invalid credentials and other auth errors.
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' };
    }
    return { ok: false, code: 'OTHER', message: error.message };
  }

  const userId = authData.user.id;

  // Use the same authenticated supabase instance (has the session in memory).
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle();

  // F-14: Surface DB errors instead of silently redirecting to onboarding.
  if (profileError) {
    console.error('[login] profile query error:', profileError.message);
    return { ok: false, code: 'OTHER', message: 'Something went wrong. Please try again.' };
  }

  if (!profile?.company_id) {
    redirect('/onboarding');
  }

  // Check onboarding completion and get workspace slug in one query.
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('slug, onboarding_completed_at')
    .eq('id', profile.company_id)
    .maybeSingle();

  if (companyError) {
    console.error('[login] company query error:', companyError.message);
    return { ok: false, code: 'OTHER', message: 'Something went wrong. Please try again.' };
  }

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

  // Rate limit: 3 per email per hour, failClosed to prevent email-bombing.
  const h = await headers();
  const ip = getClientIP(h);
  const ipAllowed = await checkRateLimit(`resend-ip:${ip}`, 5, 60 * 60 * 1000, { failClosed: true });
  if (!ipAllowed) {
    return { ok: false, error: 'Too many requests. Please try again later.' };
  }
  const emailAllowed = await checkRateLimit(`resend-email:${normalizedEmail}`, 3, 60 * 60 * 1000, { failClosed: true });
  if (!emailAllowed) {
    return { ok: false, error: 'Too many confirmation emails sent. Please try again in an hour.' };
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
