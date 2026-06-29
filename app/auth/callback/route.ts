import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { syncEmailChangeFromAuth } from '@/app/(auth)/[workspaceSlug]/settings/email-change-actions';
import { sendEmail } from '@/app/lib/email/send';
import { renderWelcomeEmail } from '@/app/lib/email/templates/welcome';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Best-effort: if the auth user's email has changed (e.g. just
        // confirmed a secure email change), mirror it into public.users and
        // stamp the cooldown timestamp. Failure here MUST NOT block sign-in.
        try {
          await syncEmailChangeFromAuth();
        } catch (err) {
          console.error('[auth/callback] syncEmailChangeFromAuth failed (non-fatal):', err);
        }

        const { data: profile } = await supabase
          .from('users')
          .select('company_id, full_name')
          .eq('id', user.id)
          .single();

        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('slug')
            .eq('id', profile.company_id)
            .single();

          // Send welcome email on first confirmation. We detect "first"
          // by checking that email_confirmed_at was set within the last 5
          // minutes — if it was confirmed long ago, this is a re-login via
          // a confirmation link (rare) or an email change confirmation,
          // not a signup. Best-effort: never blocks sign-in.
          try {
            const confirmedAt = user.email_confirmed_at
              ? new Date(user.email_confirmed_at).getTime()
              : 0;
            const isRecentConfirmation =
              confirmedAt > 0 && Date.now() - confirmedAt < 5 * 60 * 1000;

            if (isRecentConfirmation && profile.full_name && company?.slug) {
              const { html, text, subject } = renderWelcomeEmail({
                fullName: profile.full_name,
                workspaceSlug: company.slug,
                appUrl: origin,
              });
              await sendEmail({
                to: user.email || '',
                subject,
                html,
                text,
                tags: [{ name: 'type', value: 'welcome' }],
              });
            }
          } catch (err) {
            console.error('[auth/callback] Welcome email failed (non-fatal):', err);
          }

          return NextResponse.redirect(`${origin}/${company?.slug || 'workspace'}`);
        } else {
          // No profile or no company - redirect to onboarding
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
