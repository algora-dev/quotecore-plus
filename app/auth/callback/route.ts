import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { syncEmailChangeFromAuth } from '@/app/(auth)/[workspaceSlug]/settings/email-change-actions';
import { sendEmail } from '@/app/lib/email/send';
import { renderWelcomeEmail } from '@/app/lib/email/templates/welcome';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';

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

        const admin = createAdminClient();

        const { data: profile } = await supabase
          .from('users')
          .select('company_id, full_name, email')
          .eq('id', user.id)
          .maybeSingle();

        // Determine if this is a fresh email confirmation (signup flow).
        const confirmedAt = user.email_confirmed_at
          ? new Date(user.email_confirmed_at).getTime()
          : 0;
        const isRecentConfirmation =
          confirmedAt > 0 && Date.now() - confirmedAt < 5 * 60 * 1000;

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
              await admin.from('users').insert({
                id: user.id,
                company_id: orphanedQuote.company_id,
                email: user.email || '',
                full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                role: 'owner',
              });
              console.error(
                `[auth/callback] ORPHAN RECOVERY: restored profile for user ${user.id} (email: ${userEmail}) to company ${orphanedQuote.company_id}`,
              );
              const draftCookie = request.headers.get('cookie') || '';
              const draftMatch = draftCookie.match(/qcp_doc_draft=([^;]+)/);
              const draftId = draftMatch ? decodeURIComponent(draftMatch[1]) : null;
              const slug = orphanedCompany.slug || 'workspace';
              const dashUrl = draftId
                ? `${origin}/${slug}?restore_doc=${draftId}`
                : `${origin}/${slug}`;
              return NextResponse.redirect(dashUrl);
            }
          }
        }
        // ── END ORPHANED-PROFILE RECOVERY ──────────────────────────

        // ── FIRST-CONFIRMATION WORKSPACE CREATION (Gerald M-01) ────
        // Email/password signup creates ONLY the auth user (with company_name
        // + full_name in user_metadata). When they confirm their email, this
        // is where the company + profile get created — not before.
        if (!profile && isRecentConfirmation && user.user_metadata?.company_name) {
          const companyName = String(user.user_metadata.company_name);
          const fullName = String(user.user_metadata.full_name || user.user_metadata.name || '');

          const slugBase = companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 50);
          const companySlug = `${slugBase || 'company'}-${user.id.slice(0, 8)}`;

          const { data: company, error: companyError } = await admin
            .from('companies')
            .insert({
              name: companyName,
              slug: companySlug,
              default_currency: 'NZD',
              default_tax_rate: 15.0,
            })
            .select('id, slug')
            .single();

          if (!companyError && company) {
            const { error: profileError } = await admin.from('users').insert({
              id: user.id,
              company_id: company.id,
              email: user.email || '',
              full_name: fullName,
              role: 'owner',
            });

            if (!profileError) {
              // Bootstrap the default component collection. Non-fatal.
              try {
                await ensureCompanyHasCollection(company.id, admin);
              } catch (err) {
                console.error('[auth/callback] ensureCompanyHasCollection failed (non-fatal):', err);
              }

              // Send welcome email (single "Confirm Email" CTA).
              try {
                const { html, text, subject } = renderWelcomeEmail({
                  fullName,
                  workspaceSlug: company.slug || 'workspace',
                  appUrl: origin,
                });
                await sendEmail({
                  to: user.email || '',
                  subject,
                  html,
                  text,
                  tags: [{ name: 'type', value: 'welcome' }],
                });
              } catch (err) {
                console.error('[auth/callback] Welcome email failed (non-fatal):', err);
              }

              // Redirect to onboarding so the user sets trade/preferences.
              return NextResponse.redirect(`${origin}/onboarding`);
            } else {
              // Profile insert failed — clean up the company to avoid orphans.
              await admin.from('companies').delete().eq('id', company.id);
              console.error('[auth/callback] Profile creation failed, cleaned up company:', profileError);
            }
          } else if (companyError) {
            console.error('[auth/callback] Company creation failed:', companyError);
          }
        }
        // ── END FIRST-CONFIRMATION WORKSPACE CREATION ──────────────

        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('slug')
            .eq('id', profile.company_id)
            .maybeSingle();

          // Note: welcome email is sent during first-confirmation workspace
          // creation above. We do NOT send it again here — this path is for
          // users who already have a profile (e.g. logins after the initial
          // setup was completed). Sending here would cause duplicate emails.

          // Preserve free-tools draft: if the user was sent through a
          // re-login (e.g. session expired after onboarding), the
          // qcp_doc_draft cookie survives. Pass it through as a URL param
          // so DocDraftRestorer picks it up on the dashboard.
          const draftCookie = request.headers.get('cookie') || '';
          const draftMatch = draftCookie.match(/qcp_doc_draft=([^;]+)/);
          const draftId = draftMatch ? decodeURIComponent(draftMatch[1]) : null;
          const slug = company?.slug || 'workspace';
          const dashUrl = draftId
            ? `${origin}/${slug}?restore_doc=${draftId}`
            : `${origin}/${slug}`;
          return NextResponse.redirect(dashUrl);
        }

        // No profile or no company - redirect to onboarding.
        // CRITICAL: this must stay OUTSIDE the profile?.company_id block.
        // A bad refactor (bc6f9af) left it unreachable inside the block,
        // which sent every brand-new Google user to /login?error=auth_failed
        // instead of onboarding — the "forced to log in again" bug.
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
