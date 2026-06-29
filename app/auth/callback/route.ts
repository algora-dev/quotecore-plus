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
          .select('company_id, full_name, email')
          .eq('id', user.id)
          .maybeSingle();

        // ── ORPHANED-PROFILE RECOVERY ─────────────────────────────
        // If the auth user has no profile row (e.g. it was manually
        // deleted but the auth.users row survived), check if they have
        // quotes belonging to them. We match by `created_by_email`
        // (durable — survives profile deletion because it's not an FK)
        // instead of `created_by_user_id` (which is `ON DELETE SET NULL`
        // and gets nulled when the profile is deleted — Gerald H-01).
        if (!profile) {
          const userEmail = user.email?.toLowerCase() || '';
          let orphanedQuote: { company_id: string } | null = null;

          if (userEmail) {
            const { data: emailMatch } = await supabase
              .from('quotes')
              .select('company_id')
              .eq('created_by_email', userEmail)
              .limit(1)
              .maybeSingle();
            orphanedQuote = emailMatch;
          }

          // Fallback: legacy created_by_user_id (works for profiles
          // deleted via a path that didn't null the FK, or pre-migration
          // rows where created_by_email was never populated).
          if (!orphanedQuote) {
            const { data: idMatch } = await supabase
              .from('quotes')
              .select('company_id')
              .eq('created_by_user_id', user.id)
              .limit(1)
              .maybeSingle();
            orphanedQuote = idMatch;
          }

          if (orphanedQuote?.company_id) {
            const { data: orphanedCompany } = await supabase
              .from('companies')
              .select('slug')
              .eq('id', orphanedQuote.company_id)
              .maybeSingle();

            if (orphanedCompany) {
              // Restore the profile row so future logins go straight through.
              const adminClient = (await import('@/app/lib/supabase/admin')).createAdminClient();
              await adminClient.from('users').insert({
                id: user.id,
                company_id: orphanedQuote.company_id,
                email: user.email || '',
                full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                role: 'owner',
              });
              console.error(
                `[auth/callback] ORPHAN RECOVERY: restored profile for user ${user.id} (email: ${userEmail}) to company ${orphanedQuote.company_id}`,
              );
              return NextResponse.redirect(`${origin}/${orphanedCompany.slug || 'workspace'}`);
            }
          }
        }
        // ── END ORPHANED-PROFILE RECOVERY ──────────────────────────

        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('slug')
            .eq('id', profile.company_id)
            .maybeSingle();

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
