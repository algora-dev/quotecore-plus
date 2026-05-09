'use server';

/**
 * Email change flow.
 *
 * Defence in depth (every layer must pass for a change to be initiated):
 *   1. Authenticated user (cookie session, RLS-bound).
 *   2. Re-auth: user must re-enter their CURRENT password. Verified via a
 *      throwaway sign-in (does not affect the live session).
 *   3. AAL2 gate: if the user has any verified MFA factor, the current
 *      session must already be at AAL2. The UI is responsible for stepping
 *      the user through MFA verification BEFORE calling this action.
 *   4. Cooldown: 7 days since the last successful email change.
 *   5. Sanity: new email differs from current, and parses as an address.
 *
 * On success, calls supabase.auth.updateUser({ email }) which (with secure
 * email change enabled) fires TWO confirm emails:
 *   - To the OLD email: "Your email is being changed to <new>"
 *   - To the NEW email: "Confirm this is your new QuoteCore+ email"
 * Both must be clicked. Once both are confirmed, the user is redirected
 * through /auth/callback which mirrors the new email into public.users and
 * stamps last_email_change_at.
 */

import { headers } from 'next/headers';
import { createSupabaseServerClient, requireUser } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export type EmailChangeResult =
  | { ok: true }
  | { ok: false; code: 'invalid_input' | 'same_email' | 'wrong_password' | 'requires_aal2' | 'cooldown' | 'rate_limited' | 'oauth_only' | 'unknown'; message: string; cooldownEndsAt?: string };

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

/**
 * Public surface used by the EmailChangeSection UI to determine whether the
 * user is allowed to attempt a change right now (drives button disabled state
 * and surfaces the cooldown countdown).
 */
export async function getEmailChangeStatus(): Promise<{
  canRequest: boolean;
  isOAuthOnly: boolean;
  cooldownEndsAt: string | null;
  requiresAal2: boolean;
}> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // Treat the user as OAuth-only if their first identity is google AND there
  // is no email/password identity. (Supabase models multiple identities per
  // user.) An OAuth-only user can't change their email through us; their
  // address is governed by their identity provider.
  const identities = user.identities ?? [];
  const hasEmailPasswordIdentity = identities.some((i) => i.provider === 'email');
  const isOAuthOnly = identities.length > 0 && !hasEmailPasswordIdentity;

  // Cooldown lookup
  const { data: profile } = await supabase
    .from('users')
    .select('last_email_change_at')
    .eq('id', user.id)
    .single();
  const last = profile?.last_email_change_at ? new Date(profile.last_email_change_at) : null;
  const cooldownEndsAt = last && Date.now() - last.getTime() < COOLDOWN_MS
    ? new Date(last.getTime() + COOLDOWN_MS).toISOString()
    : null;

  // Detect whether MFA is in play (any verified factor) — the UI uses this to
  // know whether to render the TOTP step. Not a security gate by itself; the
  // server action below independently enforces AAL2.
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (factorData?.totp ?? []).some((f) => f.status === 'verified');

  return {
    canRequest: !cooldownEndsAt && !isOAuthOnly,
    isOAuthOnly,
    cooldownEndsAt,
    requiresAal2: hasVerifiedFactor,
  };
}

/**
 * Initiates a secure email change. The response intentionally normalises
 * details so callers can act on the discriminated union without parsing
 * messages.
 */
export async function requestEmailChange(
  newEmail: string,
  currentPassword: string
): Promise<EmailChangeResult> {
  // Rate limit: 3 attempts per IP per hour. Catches credential-stuffing the
  // password verifier and basic abuse without blocking legitimate retries.
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  if (!checkRateLimit(`email-change:${ip}`, 3, 60 * 60 * 1000)) {
    return { ok: false, code: 'rate_limited', message: 'Too many attempts. Please try again in an hour.' };
  }

  const trimmed = (newEmail ?? '').trim().toLowerCase();
  if (!trimmed || !isPlausibleEmail(trimmed)) {
    return { ok: false, code: 'invalid_input', message: 'Please enter a valid email address.' };
  }
  if (!currentPassword) {
    return { ok: false, code: 'invalid_input', message: 'Please enter your current password.' };
  }

  const user = await requireUser();
  if (!user.email) {
    return { ok: false, code: 'unknown', message: 'Your account has no email on record.' };
  }

  const currentEmail = user.email.toLowerCase();
  if (trimmed === currentEmail) {
    return { ok: false, code: 'same_email', message: 'New email is the same as your current email.' };
  }

  // Block OAuth-only users — their email is governed by their IdP.
  const identities = user.identities ?? [];
  const hasEmailPasswordIdentity = identities.some((i) => i.provider === 'email');
  if (identities.length > 0 && !hasEmailPasswordIdentity) {
    return {
      ok: false,
      code: 'oauth_only',
      message: 'Your email is managed by your identity provider (e.g. Google). Change it there, not in QuoteCore+.',
    };
  }

  const supabase = await createSupabaseServerClient();

  // AAL2 gate (if the user has a verified factor, they MUST be at aal2).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (factorData?.totp ?? []).some((f) => f.status === 'verified');
  if (hasVerifiedFactor && aal?.currentLevel !== 'aal2') {
    return {
      ok: false,
      code: 'requires_aal2',
      message: 'You must verify your 2FA code in this session before changing your email.',
    };
  }

  // Cooldown check
  const { data: profile } = await supabase
    .from('users')
    .select('last_email_change_at')
    .eq('id', user.id)
    .single();
  const last = profile?.last_email_change_at ? new Date(profile.last_email_change_at) : null;
  if (last && Date.now() - last.getTime() < COOLDOWN_MS) {
    const cooldownEndsAt = new Date(last.getTime() + COOLDOWN_MS).toISOString();
    return {
      ok: false,
      code: 'cooldown',
      message: `You can change your email again on ${new Date(cooldownEndsAt).toLocaleDateString()}.`,
      cooldownEndsAt,
    };
  }

  // Re-auth: verify the current password by signing in via a SEPARATE Supabase
  // client that doesn't write cookies. We create a no-op cookie store so the
  // "ephemeral" client never touches the live session — even if the password
  // is correct, we don't want to roll the access token here. signInWithPassword
  // returns an error on bad password without affecting the existing session.
  const ephemeral = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() { /* intentionally a no-op — never persist this session */ },
      },
    }
  );
  const { error: signInErr } = await ephemeral.auth.signInWithPassword({
    email: currentEmail,
    password: currentPassword,
  });
  if (signInErr) {
    return { ok: false, code: 'wrong_password', message: 'That password is incorrect.' };
  }
  // Best-effort: sign the ephemeral client out so its access token is invalidated.
  void ephemeral.auth.signOut().catch(() => undefined);

  // All gates passed — initiate the email change. Supabase will send the two
  // confirmation emails; we don't write to public.users.email here. That sync
  // happens in /auth/callback once both confirmations are clicked.
  const { error: updateErr } = await supabase.auth.updateUser(
    { email: trimmed },
    { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback` }
  );

  if (updateErr) {
    // Likely "Email rate limit exceeded" or "User already registered".
    const msg = updateErr.message || '';
    if (/already registered|already in use|exists/i.test(msg)) {
      return { ok: false, code: 'invalid_input', message: 'That email is already in use by another QuoteCore+ account.' };
    }
    if (/rate/i.test(msg)) {
      return { ok: false, code: 'rate_limited', message: 'Too many email change attempts. Please try again later.' };
    }
    console.error('[email-change] updateUser failed:', updateErr);
    return { ok: false, code: 'unknown', message: 'Could not start the email change. Please try again.' };
  }

  return { ok: true };
}

/**
 * Called by /auth/callback after Supabase finalises a secure email change.
 *
 * On a detected email change we:
 *   1. Mirror auth.users.email -> public.users.email
 *   2. Stamp the cooldown (last_email_change_at)
 *   3. Boot ALL existing sessions for this user
 *   4. Send a password-reset link to the new address
 *
 * Steps 3 + 4 implement the "force a fresh password after every email
 * change" policy. Rationale: if the user has lost a device or had their
 * password silently leaked, an email change is the right moment to require
 * a fresh credential. Same posture as Flow 2 (lost-email recovery).
 *
 * Idempotent: safe to call on every callback hit; if nothing has changed, the
 * UPDATE is a no-op and steps 3 + 4 are skipped.
 */
export async function syncEmailChangeFromAuth(): Promise<void> {
  const user = await requireUser();
  if (!user.email) return;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('id, email')
    .eq('id', user.id)
    .single();
  if (!profile) return;

  const newEmail = user.email;
  const currentMirrorEmail = (profile.email ?? '').toLowerCase();
  if (currentMirrorEmail === newEmail.toLowerCase()) {
    // No change to react to. Bail out before the destructive steps.
    return;
  }

  // 1 + 2: mirror + cooldown stamp.
  await admin
    .from('users')
    .update({
      email: newEmail,
      last_email_change_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // 3: kill ALL sessions for this user. We do this BEFORE sending the reset
  // email so any device / browser that still holds a live token loses it
  // immediately. The user keeps their current session in this request because
  // the cookie was already exchanged for a new access token by
  // exchangeCodeForSession; the next request will re-validate against
  // auth.users, see the email matches, and continue.
  try {
    await admin.auth.admin.signOut(user.id);
  } catch (err) {
    console.error('[email-change] signOut all sessions failed (non-fatal):', err);
  }

  // 4: send a password-reset link to the new address. The user clicks the
  // link, lands on /auth/reset-password, sets a new password and continues.
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`;
    await fetch(url, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: newEmail }),
    });
  } catch (err) {
    console.error('[email-change] forced password reset email failed (non-fatal):', err);
  }
}
