import { safeReturnPath } from '@/app/lib/auth/resume-contract';
import { sessionNoStore } from '@/app/lib/auth/session-trace';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { syncEmailChangeFromAuth } from '@/app/(auth)/[workspaceSlug]/settings/email-change-actions';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { getStripeMode } from '@/app/lib/billing/stripe';

// Workspace slug prefixes that collide with public route prefixes; a slug
// starting with one of these gets a ws- prefix instead (mirrors the guard
// the old onboarding flow used).
const RESERVED_WORKSPACE_PREFIXES = ['m', 'orders', 'invoice', 'file', 'accept', 'docs', 'terms', 'privacy', 'cookies', 'admin', 'api', 'login', 'signup', 'auth', 'onboarding', '2fa'];

/**
 * FREE-WORKSPACE AUTO-PROVISIONING (owner decision 2026-11-01).
 *
 * Signup is now email-only (magic link) or Google; the old wizard (company
 * form + security questions + Stripe checkout) is retired. When an
 * authenticated user arrives with no usable profile/company, we create
 * their free workspace directly:
 *
 *   company + owner profile + default component collection + a full-access
 *   custom-billing grant (resolver kind custom_admin_granted, subscription
 *   id prefix "admin-free-") so the paywall, Smart Assistant, scans and
 *   offcuts all pass with zero quotas while the funnel is validated.
 * Clamping quotas later is a snapshot edit, no schema change.
 *
 * Returns the dashboard URL to redirect to (with ?welcome=1 for the welcome
 * modal). On a hard failure returns the login error URL instead of looping.
 */
async function provisionFreeWorkspace(
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
  origin: string,
  draftId: string | null,
): Promise<string> {
  const companyName = String(user.user_metadata?.company_name ?? '').trim() || 'My Company';
  const fullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim();

  const slugBase = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
  let companySlug = `${slugBase || 'workspace'}-${user.id.slice(0, 8)}`;
  if (RESERVED_WORKSPACE_PREFIXES.includes(companySlug.split('-')[0])) {
    companySlug = `ws-${companySlug}`;
  }

  const nowIso = new Date().toISOString();
  // billing_model / company_custom_billing are not in the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  const { data: company, error: companyError } = await client
    .from('companies')
    .insert({
      name: companyName,
      slug: companySlug,
      default_currency: 'USD',
      default_measurement_system: 'metric',
      default_tax_rate: 0,
      // Legacy columns kept coherent; entitlements come from the grant row.
      plan_code: 'starter',
      billing_model: 'custom_setup',
      subscription_status: 'active',
      onboarding_completed_at: nowIso,
    })
    .select('id, slug')
    .single();

  if (companyError || !company) {
    console.error('[auth/callback] free workspace: company creation failed:', companyError);
    return `${origin}/login?error=auth_failed`;
  }

  const { data: existingProfile } = await client
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  const profileResult = existingProfile
    ? await client.from('users').update({ company_id: company.id }).eq('id', user.id)
    : await client.from('users').insert({
        id: user.id,
        company_id: company.id,
        email: user.email || '',
        full_name: fullName,
        role: 'owner',
      });

  if (profileResult.error) {
    // Clean up to avoid an orphaned company.
    await client.from('companies').delete().eq('id', company.id);
    console.error('[auth/callback] free workspace: profile write failed:', profileResult.error);
    return `${origin}/login?error=auth_failed`;
  }

  // Default component collection. Non-fatal.
  try {
    await ensureCompanyHasCollection(company.id, admin);
  } catch (err) {
    console.error('[auth/callback] free workspace: ensureCompanyHasCollection failed (non-fatal):', err);
  }

  // Full-access custom grant (admin-granted shape, "admin-free-" marker).
  // Non-fatal: if the price-map binding is missing the workspace still gets
  // created, billing just fails closed at the paywall instead of erroring.
  try {
    const { data: mapRow } = await client
      .from('custom_billing_price_map')
      .select('stripe_account_id')
      .eq('stripe_mode', getStripeMode())
      .limit(1)
      .maybeSingle();

    if (mapRow?.stripe_account_id) {
      const { error: grantError } = await client
        .from('company_custom_billing')
        .upsert({
          company_id: company.id,
          stripe_account_id: mapRow.stripe_account_id,
          stripe_mode: getStripeMode(),
          stripe_customer_id: 'admin-granted',
          stripe_subscription_id: `admin-free-${company.id}`,
          catalog_id: PREVIEW_CATALOG.id,
          catalog_revision: PREVIEW_CATALOG.revision,
          component_codes: ['core_high', 'digital_takeoff', 'scan_high', 'offcuts_high', 'assistant_heavy'],
          purchased_entitlements: {
            capacity: 'high',
            quotes: 100,
            storageBytes: 10_000_000_000,
            digitalTakeoff: true,
            scanTokens: 400,
            offcuts: true,
            assistantTasks: 1500,
          },
          provider_status: 'active',
          currency: PREVIEW_CATALOG.currency.toLowerCase(),
          monthly_cents: 0,
          period_start: nowIso,
          period_end: '2099-12-31T00:00:00.000Z',
          reconciled_at: nowIso,
        }, { onConflict: 'company_id' });
      if (grantError) {
        console.error('[auth/callback] free workspace: grant row failed:', grantError);
      }
    } else {
      console.error('[auth/callback] free workspace: custom_billing_price_map empty, grant skipped');
    }
  } catch (err) {
    console.error('[auth/callback] free workspace: grant row threw (non-fatal):', err);
  }

  const suffix = draftId
    ? `?restore_doc=${encodeURIComponent(draftId)}&welcome=1`
    : '?welcome=1';
  return `${origin}/${company.slug}${suffix}`;
}

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

        const admin = createAdminClient();

        // Shared draft-cookie extraction (free-tools draft handoff).
        const draftCookie = request.headers.get('cookie') || '';
        const draftMatch = draftCookie.match(/qcp_doc_draft=([^;]+)/);
        const draftId = draftMatch ? decodeURIComponent(draftMatch[1]) : null;

        // ── ORPHANED-PROFILE RECOVERY ─────────────────────────────
        // If the auth user has no profile row (e.g. it was manually
        // deleted but the auth.users row survived), check if they have
        // quotes belonging to them. We match by `created_by_email`
        // (durable - survives profile deletion because it's not an FK)
        // instead of `created_by_user_id` (which is `ON DELETE SET NULL`
        // and gets nulled when the profile is deleted - Gerald H-01).
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
              return go(!draftId && requestedDestination ? new URL(requestedDestination, origin).href : dashUrl);
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

          if (!company) {
            // Profile points at a deleted company (the data-integrity edge
            // the old onboarding flow used to repair). Re-provision a fresh
            // workspace and repoint the profile.
            return go(await provisionFreeWorkspace(admin, user, origin, draftId));
          }

          // Preserve free-tools draft: if the user was sent through a
          // re-login (e.g. session expired), the qcp_doc_draft cookie
          // survives. Pass it through as a URL param so DocDraftRestorer
          // picks it up on the dashboard.
          const slug = company.slug || 'workspace';
          const dashUrl = draftId
            ? `${origin}/${slug}?restore_doc=${draftId}`
            : `${origin}/${slug}`;
          return go(!draftId && requestedDestination ? new URL(requestedDestination, origin).href : dashUrl);
        }

        // No profile at all (fresh magic-link confirmation or first Google
        // sign-in; orphan recovery above has already handled users whose
        // quotes belong to an existing company): auto-provision the free
        // workspace and land them in the app with the welcome modal.
        return go(await provisionFreeWorkspace(admin, user, origin, draftId));
      }
    }
  }

  return go(`${origin}/login?error=auth_failed`);
}
