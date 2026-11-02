'use server';

/**
 * Free-workspace signup (owner decision 2026-11-01): the ONLY signup path is
 * email -> magic link (or Google). The old password + company wizard is gone.
 *
 * This action sends a sign-in link that ALSO creates the auth account when
 * the email is new (shouldCreateUser: true). The link lands on /auth/callback,
 * which auto-provisions the free workspace (company + profile + full-access
 * custom grant) and drops the user straight into the app.
 *
 * Rate limiting mirrors sendLoginLinkAction (login/actions.ts): 5 per IP per
 * hour and 3 per email per hour, fail-closed to prevent email bombing.
 */

import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export type SignupLinkResult = { ok: true } | { ok: false; error: string };

export async function sendSignupLinkAction(email: string): Promise<SignupLinkResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  // Rate limit: failClosed so email bombing can never slip through.
  // (Bumped 2026-11-01: 3/h per email blocked the owner's own testing loops.)
  const h = await headers();
  const ip = getClientIP(h);
  const ipAllowed = await checkRateLimit(`signuplink-ip:${ip}`, 10, 60 * 60 * 1000, { failClosed: true });
  if (!ipAllowed) {
    return { ok: false, error: 'Too many requests. Please try again later.' };
  }
  const emailAllowed = await checkRateLimit(`signuplink-email:${normalizedEmail}`, 5, 60 * 60 * 1000, { failClosed: true });
  if (!emailAllowed) {
    return { ok: false, error: 'Too many signup links sent to this email. Please try again in an hour.' };
  }

  const supabase = await createSupabaseServerClient();

  // Links go to /auth/verify with a stateless token_hash (works from any
  // browser/device). The domain stays where the user started (testing alias
  // vs app.quote-core.com); all our hosts are allowlisted.
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';
  const emailRedirectTo = host ? `${proto}://${host}/auth/verify` : undefined;

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate') || msg.includes('over_email_send_rate_limit')) {
      return { ok: false, error: 'Too many requests. Please try again in a few minutes.' };
    }
    return { ok: false, error: error.message };
  }

  // Generic success either way: never leak whether the email already exists.
  // Existing emails simply receive a sign-in link.
  return { ok: true };
}
