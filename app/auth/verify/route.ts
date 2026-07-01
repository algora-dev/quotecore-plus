import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Magic-link verification route.
 *
 * Used by:
 * - Impersonation flow: admin is redirected here with a hashed_token from
 *   `supabase.auth.admin.generateLink({ type: 'magiclink' })`. The token
 *   exchanges for a real Supabase auth session for the target user.
 *
 * After session exchange, redirects to the `next` param (defaults to `/`).
 *
 * Security: the hashed_token is single-use and expires quickly. It's
 * generated server-side via the service-role client and never exposed
 * to the browser — the admin is redirected directly through this route.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') || 'magiclink';
  const next = searchParams.get('next') || '/';

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'magiclink',
  });

  if (error || !data.session) {
    console.error('[auth/verify] OTP verification failed:', error?.message);
    return NextResponse.redirect(`${origin}/login?error=verify_failed`);
  }

  // Session is now set in cookies via the Supabase SSR client.
  // Fetch the user's profile to find their workspace slug for redirect.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.company_id) {
      const { data: company } = await admin
        .from('companies')
        .select('slug')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (company?.slug) {
        return NextResponse.redirect(`${origin}/${company.slug}${next === '/' ? '' : next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
