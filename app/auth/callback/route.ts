import { safeReturnPath } from '@/app/lib/auth/resume-contract';
import { sessionNoStore } from '@/app/lib/auth/session-trace';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { syncEmailChangeFromAuth } from '@/app/(auth)/[workspaceSlug]/settings/email-change-actions';
import { completeSignIn } from '@/app/lib/auth/complete-signin';

/**
 * OAuth / PKCE code callback (Google sign-in and Supabase-hosted verify
 * redirects). Exchanges the code for a session, then hands off to
 * complete-signin for routing (existing workspace, orphan recovery, or free
 * workspace provisioning).
 *
 * Email magic links do NOT land here anymore (2026-11-01): they now carry a
 * stateless token_hash straight to /auth/verify, which works regardless of
 * which browser/device opens the link. PKSE code links failed whenever the
 * requesting browser's verifier cookie was absent at click time.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const requestedDestination = safeReturnPath(searchParams.get('redirect'));
  const go = (destination: string) => sessionNoStore(NextResponse.redirect(destination));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Best-effort: if the auth user's email has changed (e.g. just
        // confirmed a secure email change), mirror it into public.users.
        // Failure here MUST NOT block sign-in.
        try {
          await syncEmailChangeFromAuth();
        } catch (err) {
          console.error('[auth/callback] syncEmailChangeFromAuth failed (non-fatal):', err);
        }

        const draftCookie = request.headers.get('cookie') || '';
        const draftMatch = draftCookie.match(/qcp_doc_draft=([^;]+)/);
        const draftId = draftMatch ? decodeURIComponent(draftMatch[1]) : null;

        const destination = await completeSignIn({ supabase, user, origin, draftId });

        // An explicit ?redirect= wins when no draft needs restoring.
        if (!draftId && requestedDestination) {
          return go(new URL(requestedDestination, origin).href);
        }
        return go(destination);
      }
    }
  }

  return go(`${origin}/login?error=auth_failed`);
}
