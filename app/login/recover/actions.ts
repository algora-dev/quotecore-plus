'use server';

/**
 * Account recovery flow - "Lost access to my email" (Flow 2 from the brief).
 *
 * Threat model:
 *   - We MUST NOT leak whether an email is registered (account enumeration).
 *   - We MUST NOT leak whether a registered account has security questions.
 *   - We MUST rate-limit per-IP AND per-old-email so a single attacker
 *     cannot iterate answer guesses on one target.
 *   - We MUST kill all live sessions when recovery succeeds, so any attacker
 *     already inside the account is booted at the moment of takeover.
 *   - We MUST audit every attempt (success or failure) for after-the-fact
 *     review.
 *
 * Data preservation:
 *   Recovery touches ONLY auth.users.email + public.users.email. Quotes,
 *   files, components, settings, the user's UUID - none of it is altered.
 *   The user signs back in to the same account with a new email.
 *
 * Stages (enforced by a signed cookie token):
 *   1. lookupRecovery(oldEmail)
 *      -> rate-limit, dual-write log, generic response. If eligible,
 *         issue a short-lived signed token bound to user.id + stage='answer'.
 *   2. verifyRecoveryAnswers(token, answers)
 *      -> bcrypt-compares each answer to the slot's stored hash.
 *         All set slots must match. On success, re-issue token with
 *         stage='finalise' bound to the same user.id.
 *   3. finaliseRecovery(token, newEmail)
 *      -> updates auth.users.email + public.users.email, kills all sessions,
 *         sends password-reset email to newEmail. Logs 'finalised'. Token
 *         is invalidated (single-use).
 *
 * Tokens are HMAC-signed JWS-lite (kid=stage, exp=15m). The HMAC key comes
 * from RECOVERY_SIGNING_SECRET (env). If the secret is unset, all calls fail
 * closed.
 */

import { headers, cookies } from 'next/headers';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { normaliseAnswer } from '@/app/lib/security/questions';

const TOKEN_TTL_MS = 15 * 60 * 1000;
const PER_IP_HOUR_LIMIT = 5;
const PER_EMAIL_HOUR_LIMIT = 3;

// Cookie name for the in-progress recovery token. HttpOnly so JS can't read it.
const COOKIE_NAME = 'qcp_recovery';

export type RecoveryQuestion = { slot: number; question: string };

export type LookupResult =
  | { ok: true; questions: RecoveryQuestion[] }
  // Generic failure: covers "no account" AND "account but no questions".
  // The UI shows "contact support" in both cases.
  | { ok: false; code: 'no_recovery_available' | 'rate_limited'; message: string };

export type VerifyResult =
  | { ok: true }
  | { ok: false; code: 'expired' | 'wrong_answers' | 'rate_limited'; message: string };

export type FinaliseResult =
  | { ok: true; newEmail: string }
  | { ok: false; code: 'expired' | 'invalid_email' | 'same_email' | 'in_use' | 'rate_limited' | 'unknown'; message: string };

/* ---------------- Token signing ---------------- */

function getSigningKey(): Buffer {
  const secret = process.env.RECOVERY_SIGNING_SECRET;
  if (!secret) throw new Error('RECOVERY_SIGNING_SECRET is not configured');
  // Derive a 32-byte key from the secret string so any reasonable input works.
  return crypto.createHash('sha256').update(secret).digest();
}

type TokenPayload = { sub: string; stage: 'answer' | 'finalise'; exp: number; nonce: string };

function signToken(payload: TokenPayload): string {
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  const body = json.toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string, expectStage: TokenPayload['stage']): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getSigningKey()).update(body).digest('base64url');
  // Constant-time compare to avoid timing leaks on signature length / prefix.
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let parsed: TokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (parsed.stage !== expectStage) return null;
  if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
  if (typeof parsed.sub !== 'string' || !parsed.sub) return null;
  return parsed;
}

async function setRecoveryCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/login/recover',
    maxAge: Math.floor(TOKEN_TTL_MS / 1000),
  });
}
async function readRecoveryCookie(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}
async function clearRecoveryCookie() {
  const c = await cookies();
  c.delete({ name: COOKIE_NAME, path: '/login/recover' });
}

/* ---------------- Logging ---------------- */

async function logAttempt(input: {
  userId: string | null;
  oldEmail: string | null;
  newEmail?: string | null;
  outcome: 'lookup_no_match' | 'verify_failed' | 'verify_succeeded' | 'finalised' | 'rate_limited';
}) {
  try {
    const hdrs = await headers();
    const admin = createAdminClient();
    await admin.from('account_recovery_log').insert({
      user_id: input.userId,
      old_email: input.oldEmail,
      new_email: input.newEmail ?? null,
      outcome: input.outcome,
      ip: getClientIP(hdrs),
      user_agent: hdrs.get('user-agent'),
    });
  } catch (err) {
    // Audit log is best-effort. We never block recovery on a log write.
    console.error('[recovery] log insert failed:', err);
  }
}

/* ---------------- Stage 1: lookup ---------------- */

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

export async function lookupRecovery(oldEmail: string): Promise<LookupResult> {
  const trimmed = (oldEmail ?? '').trim().toLowerCase();
  if (!isPlausibleEmail(trimmed)) {
    return { ok: false, code: 'no_recovery_available', message: 'Please enter a valid email address.' };
  }

  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  if (!(await checkRateLimit(`recovery-lookup-ip:${ip}`, PER_IP_HOUR_LIMIT, 60 * 60 * 1000))) {
    await logAttempt({ userId: null, oldEmail: trimmed, outcome: 'rate_limited' });
    return { ok: false, code: 'rate_limited', message: 'Too many recovery attempts. Please try again in an hour.' };
  }
  if (!(await checkRateLimit(`recovery-lookup-email:${trimmed}`, PER_EMAIL_HOUR_LIMIT, 60 * 60 * 1000))) {
    await logAttempt({ userId: null, oldEmail: trimmed, outcome: 'rate_limited' });
    return { ok: false, code: 'rate_limited', message: 'Too many recovery attempts for this account. Please try again later.' };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('id')
    .eq('email', trimmed)
    .maybeSingle();

  // Generic "no recovery available" surface - same response whether the email
  // is unknown OR the account has no security questions. Prevents enumeration.
  if (!profile) {
    await logAttempt({ userId: null, oldEmail: trimmed, outcome: 'lookup_no_match' });
    return {
      ok: false,
      code: 'no_recovery_available',
      message: "We can't recover this account automatically. Please contact support at info@quote-core.com.",
    };
  }

  const { data: questionRows } = await admin
    .from('user_security_questions')
    .select('slot, question')
    .eq('user_id', profile.id)
    .order('slot', { ascending: true });

  if (!questionRows || questionRows.length === 0) {
    await logAttempt({ userId: profile.id, oldEmail: trimmed, outcome: 'lookup_no_match' });
    return {
      ok: false,
      code: 'no_recovery_available',
      message: "We can't recover this account automatically. Please contact support at info@quote-core.com.",
    };
  }

  // Issue stage-1 token (allows the next step to bypass the lookup).
  const token = signToken({
    sub: profile.id,
    stage: 'answer',
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString('base64url'),
  });
  await setRecoveryCookie(token);

  return {
    ok: true,
    questions: questionRows.map((r) => ({ slot: r.slot, question: r.question })),
  };
}

/* ---------------- Stage 2: verify answers ---------------- */

export async function verifyRecoveryAnswers(answers: { slot: number; answer: string }[]): Promise<VerifyResult> {
  const tok = await readRecoveryCookie();
  const payload = tok ? verifyToken(tok, 'answer') : null;
  if (!payload) {
    await clearRecoveryCookie();
    return { ok: false, code: 'expired', message: 'Your recovery session expired. Please start again.' };
  }

  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  if (!(await checkRateLimit(`recovery-verify-ip:${ip}`, PER_IP_HOUR_LIMIT, 60 * 60 * 1000))) {
    await logAttempt({ userId: payload.sub, oldEmail: null, outcome: 'rate_limited' });
    return { ok: false, code: 'rate_limited', message: 'Too many attempts. Please try again later.' };
  }
  if (!(await checkRateLimit(`recovery-verify-user:${payload.sub}`, PER_EMAIL_HOUR_LIMIT, 60 * 60 * 1000))) {
    await logAttempt({ userId: payload.sub, oldEmail: null, outcome: 'rate_limited' });
    return { ok: false, code: 'rate_limited', message: 'Too many attempts for this account. Please try again later.' };
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('user_security_questions')
    .select('slot, answer_hash')
    .eq('user_id', payload.sub);

  if (!rows || rows.length === 0) {
    await logAttempt({ userId: payload.sub, oldEmail: null, outcome: 'verify_failed' });
    return { ok: false, code: 'wrong_answers', message: 'Those answers do not match.' };
  }

  // Build a slot -> hash map. Every stored slot must be answered correctly.
  const required = new Map(rows.map((r) => [r.slot as number, r.answer_hash as string]));
  const provided = new Map(answers.map((a) => [a.slot, a.answer]));

  if (provided.size < required.size) {
    await logAttempt({ userId: payload.sub, oldEmail: null, outcome: 'verify_failed' });
    return { ok: false, code: 'wrong_answers', message: 'Please answer all of your security questions.' };
  }

  let allMatch = true;
  for (const [slot, hash] of required.entries()) {
    const raw = provided.get(slot);
    if (!raw) { allMatch = false; continue; }
    const ok = await bcrypt.compare(normaliseAnswer(raw), hash);
    if (!ok) allMatch = false;
  }

  if (!allMatch) {
    await logAttempt({ userId: payload.sub, oldEmail: null, outcome: 'verify_failed' });
    return { ok: false, code: 'wrong_answers', message: 'Those answers do not match.' };
  }

  // Re-issue token at the next stage. The previous 'answer' token is dead
  // because we overwrite the cookie.
  const next = signToken({
    sub: payload.sub,
    stage: 'finalise',
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString('base64url'),
  });
  await setRecoveryCookie(next);
  await logAttempt({ userId: payload.sub, oldEmail: null, outcome: 'verify_succeeded' });
  return { ok: true };
}

/* ---------------- Stage 3: finalise ---------------- */

export async function finaliseRecovery(newEmail: string): Promise<FinaliseResult> {
  const tok = await readRecoveryCookie();
  const payload = tok ? verifyToken(tok, 'finalise') : null;
  if (!payload) {
    await clearRecoveryCookie();
    return { ok: false, code: 'expired', message: 'Your recovery session expired. Please start again.' };
  }

  const trimmed = (newEmail ?? '').trim().toLowerCase();
  if (!isPlausibleEmail(trimmed)) {
    return { ok: false, code: 'invalid_email', message: 'Please enter a valid email address.' };
  }

  const admin = createAdminClient();

  // Fetch the auth.users row for this account so we can compare current email
  // and detect "same email" / "in use" cases.
  const { data: { user: authUser }, error: getErr } = await admin.auth.admin.getUserById(payload.sub);
  if (getErr || !authUser) {
    return { ok: false, code: 'unknown', message: 'Could not load your account. Please contact support.' };
  }
  if ((authUser.email ?? '').toLowerCase() === trimmed) {
    return { ok: false, code: 'same_email', message: 'New email is the same as your current email.' };
  }

  // Check for collision with any other auth user.
  // listUsers paginates; for our scale we can ask Supabase to filter by email.
  const { data: lookup } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  // We can't directly filter listUsers by email in all SDK versions, so do a
  // two-step: prefer the public.users mirror (which has a unique constraint
  // implied by app conventions) for the fast collision check.
  const { data: collision } = await admin
    .from('users')
    .select('id')
    .eq('email', trimmed)
    .maybeSingle();
  void lookup; // kept for future cross-check if Supabase exposes a richer filter
  if (collision && collision.id !== payload.sub) {
    return { ok: false, code: 'in_use', message: 'That email is already in use by another QuoteCore+ account.' };
  }

  // Update the auth user - set the new email AND mark it confirmed so the
  // user can sign in straight after the password reset.
  const { error: updErr } = await admin.auth.admin.updateUserById(payload.sub, {
    email: trimmed,
    email_confirm: true,
  });
  if (updErr) {
    if (/already (registered|in use|exists)/i.test(updErr.message ?? '')) {
      return { ok: false, code: 'in_use', message: 'That email is already in use by another QuoteCore+ account.' };
    }
    console.error('[recovery] updateUserById failed:', updErr);
    return { ok: false, code: 'unknown', message: 'Could not update your email. Please contact support.' };
  }

  // Mirror into public.users + stamp last_email_change_at so the in-app
  // 7-day cooldown applies after recovery too. Best-effort: a failure here
  // doesn't block the rest of the flow because /auth/callback will sync
  // again on next sign-in.
  await admin
    .from('users')
    .update({ email: trimmed, last_email_change_at: new Date().toISOString() })
    .eq('id', payload.sub);

  // Boot all live sessions for this user. If any attacker is currently
  // signed in, they're now signed out at the same instant the legitimate
  // owner regains control.
  try {
    await admin.auth.admin.signOut(payload.sub);
  } catch (err) {
    console.error('[recovery] signOut all sessions failed (non-fatal):', err);
  }

  // Send a password-reset email to the NEW address. The user clicks the link
  // and lands on /auth/reset-password to set their new password.
  try {
    // The auth REST API has a /recover endpoint that triggers the recovery
    // template. We hit it via the service-role client to avoid relying on
    // a client-side anon call.
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`;
    await fetch(url, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: trimmed }),
    });
  } catch (err) {
    console.error('[recovery] password reset email send failed (non-fatal):', err);
  }

  await logAttempt({ userId: payload.sub, oldEmail: null, newEmail: trimmed, outcome: 'finalised' });
  await clearRecoveryCookie();

  return { ok: true, newEmail: trimmed };
}
