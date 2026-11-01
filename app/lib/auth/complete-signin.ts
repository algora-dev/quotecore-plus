import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { getStripeMode } from '@/app/lib/billing/stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

/**
 * Shared post-authentication completion (extracted from /auth/callback
 * 2026-11-01 so /auth/verify can run the exact same logic).
 *
 * Given an authenticated user, decide where they should land:
 *   1. Orphaned-profile recovery: auth user with no profile row but quotes
 *      matching their email/id -> restore the profile, go to that company.
 *   2. Existing profile + company -> workspace dashboard (preserving the
 *      free-tools draft cookie as ?restore_doc).
 *   3. Profile pointing at a deleted company (data-integrity edge) ->
 *      re-provision a fresh workspace and repoint the profile.
 *   4. No profile at all (fresh magic-link confirmation or first Google
 *      sign-in) -> provision the FREE workspace (owner decision 2026-11-01)
 *      and land with ?welcome=1 for the welcome modal.
 */

// Workspace slug prefixes that collide with public route prefixes; a slug
// starting with one of these gets a ws- prefix instead.
const RESERVED_WORKSPACE_PREFIXES = ['m', 'orders', 'invoice', 'file', 'accept', 'docs', 'terms', 'privacy', 'cookies', 'admin', 'api', 'login', 'signup', 'auth', 'onboarding', '2fa'];

export type SignInUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * FREE-WORKSPACE AUTO-PROVISIONING (owner decision 2026-11-01).
 *
 * Signup is email-only (magic link) or Google; the old wizard is retired.
 * Creates company + owner profile + default component collection + a
 * full-access custom-billing grant (resolver kind custom_admin_granted,
 * subscription id prefix "admin-free-") so the paywall, Smart Assistant,
 * scans and offcuts all pass with zero quotas while the funnel is
 * validated. Clamping quotas later is a snapshot edit, no schema change.
 *
 * Returns the dashboard URL (with ?welcome=1). On a hard failure returns
 * the login error URL instead of looping.
 */
async function provisionFreeWorkspace(
  admin: SupabaseClient<Database>,
  user: SignInUser,
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
    console.error('[complete-signin] free workspace: company creation failed:', companyError);
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
    console.error('[complete-signin] free workspace: profile write failed:', profileResult.error);
    return `${origin}/login?error=auth_failed`;
  }

  // Default component collection. Non-fatal.
  try {
    await ensureCompanyHasCollection(company.id, admin);
  } catch (err) {
    console.error('[complete-signin] free workspace: ensureCompanyHasCollection failed (non-fatal):', err);
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
        console.error('[complete-signin] free workspace: grant row failed:', grantError);
      }
    } else {
      console.error('[complete-signin] free workspace: custom_billing_price_map empty, grant skipped');
    }
  } catch (err) {
    console.error('[complete-signin] free workspace: grant row threw (non-fatal):', err);
  }

  const suffix = draftId
    ? `?restore_doc=${encodeURIComponent(draftId)}&welcome=1`
    : '?welcome=1';
  return `${origin}/${company.slug}${suffix}`;
}

export async function completeSignIn(opts: {
  supabase: SupabaseClient<Database>;
  user: SignInUser;
  origin: string;
  draftId: string | null;
}): Promise<string> {
  const { supabase, user, origin, draftId } = opts;
  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  // ORPHANED-PROFILE RECOVERY: auth user with no profile row but quotes
  // belonging to them (matched by the durable created_by_email, with a
  // created_by_user_id fallback - Gerald H-01). Restore the profile so the
  // user keeps their data.
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('users').insert({
          id: user.id,
          company_id: orphanedQuote.company_id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          role: 'owner',
        });
        console.error(
          `[complete-signin] ORPHAN RECOVERY: restored profile for user ${user.id} (email: ${userEmail}) to company ${orphanedQuote.company_id}`,
        );
        const slug = orphanedCompany.slug || 'workspace';
        return draftId
          ? `${origin}/${slug}?restore_doc=${draftId}`
          : `${origin}/${slug}`;
      }
    }
  }

  if (profile?.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('slug')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (!company) {
      // Profile points at a deleted company. Re-provision a fresh
      // workspace and repoint the profile.
      return provisionFreeWorkspace(admin, user, origin, draftId);
    }

    const slug = company.slug || 'workspace';
    return draftId
      ? `${origin}/${slug}?restore_doc=${draftId}`
      : `${origin}/${slug}`;
  }

  // No profile at all: auto-provision the free workspace and land in the
  // app with the welcome modal.
  return provisionFreeWorkspace(admin, user, origin, draftId);
}
