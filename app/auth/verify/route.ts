import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { completeSignIn } from '@/app/lib/auth/complete-signin';
import { safeReturnPath } from '@/app/lib/auth/resume-contract';

/**
 * Stateless magic-link / email-token verification (2026-11-01).
 *
 * Auth email links now carry a token_hash straight to this route (see the
 * Supabase email templates): `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=...`
 * where .RedirectTo is the emailRedirectTo our actions pass (origin + this
 * route). verifyOtp exchanges the hash WITHOUT any browser-side PKCE
 * verifier, so links work no matter which browser or device opens them.
 *
 * Used by:
 * - Signup magic links (type=signup -> free workspace provisioning)
 * - Login magic links (type=magiclink -> workspace / provisioning)
 * - Password resets (type=recovery -> /auth/reset-password)
 * - Admin impersonation (type=magiclink + next=/admin/... override)
 *
 * Security: token_hash is single-use and short-lived; `next` is sanitized to
 * path-only via safeReturnPath.
 */
const EMAIL_OTP_TYPES = ['magiclink', 'signup', 'invite', 'recovery', 'email_change'] as const;
type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const typeParam = searchParams.get('type') || 'magiclink';
  const next = safeReturnPath(searchParams.get('next'));

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }
  if (!EMAIL_OTP_TYPES.includes(typeParam as EmailOtpType)) {
    return NextResponse.redirect(`${origin}/login?error=invalid_type`);
  }
  const type = typeParam as EmailOtpType;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.session) {
    console.error('[auth/verify] OTP verification failed:', error?.message);
    return NextResponse.redirect(`${origin}/login?error=verify_failed`);
  }

  // Session is now set in cookies via the Supabase SSR client.

  // Password resets: straight to the reset form (session is set).
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // Explicit destination override (admin impersonation passes next=/admin/...).
  // Path-shaped only: safeReturnPath rejects absolute URLs.
  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=verify_failed`);
  }

  // Same completion as /auth/callback: draft handoff, orphan recovery,
  // workspace routing, free-workspace provisioning for brand-new users.
  const draftCookie = request.headers.get('cookie') || '';
  const draftMatch = draftCookie.match(/qcp_doc_draft=([^;]+)/);
  const draftId = draftMatch ? decodeURIComponent(draftMatch[1]) : null;

  const destination = await completeSignIn({ supabase, user, origin, draftId });
  return NextResponse.redirect(destination);
}
