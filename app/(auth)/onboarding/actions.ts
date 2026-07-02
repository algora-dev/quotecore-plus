'use server';
import { redirect } from 'next/navigation';
import {  } from 'next/cache';
import { createSupabaseServerClient, requireUser, requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { seedTemplateComponents } from '@/app/lib/seed/seedTemplateComponents';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';

interface OnboardingData {
  currency: string;
  language: string;
  measurement: 'metric' | 'imperial_ft' | 'imperial_rs';
  defaultTrade?: string;
}

export async function completeOnboarding(companyId: string, data: OnboardingData) {
  const profile = await requireCompanyContext({ skipOnboardingCheck: true });
  
  // Security: ensure user owns this company
  if (profile.company_id !== companyId) {
    console.error('[completeOnboarding] Unauthorized:', { profileCompanyId: profile.company_id, requestedCompanyId: companyId });
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();
  
  console.log('[completeOnboarding] Updating company:', {
    companyId,
    currency: data.currency,
    language: data.language,
    measurement: data.measurement,
  });
  
  const { error } = await supabase
    .from('companies')
    .update({
      default_currency: data.currency,
      default_language: data.language,
      default_measurement_system: data.measurement,
      onboarding_completed_at: new Date().toISOString(),
      ...(data.defaultTrade ? { default_trade: data.defaultTrade as any } : {}),
    })
    .eq('id', companyId);

  if (error) {
    console.error('[completeOnboarding] Database error:', error);
    throw new Error(error.message);
  }

  // Seed the starter components for the SELECTED trade now that the trade is
  // known (the standard email signup flow doesn't know the trade at
  // company-creation time, so seeding was deferred to here). Idempotent: only
  // seed if the company has no components yet, so re-running onboarding can't
  // double-seed. Non-fatal: onboarding must still succeed if seeding fails.
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from('component_library')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    if (!count || count === 0) {
      const bootstrapCollectionId = await ensureCompanyHasCollection(companyId, admin).catch(
        (err) => {
          console.error('[completeOnboarding] ensureCompanyHasCollection failed:', err);
          return null;
        },
      );
      const result = await seedTemplateComponents(
        admin,
        companyId,
        data.defaultTrade ?? 'roofing',
        bootstrapCollectionId,
      );
      console.log(
        `[completeOnboarding] seeded ${result.seeded} components (trade=${data.defaultTrade ?? 'roofing'})`,
        result.error ? `error=${result.error}` : '',
      );
    }
  } catch (err) {
    console.error('[completeOnboarding] seeding threw (non-fatal):', err);
  }

  console.log('[completeOnboarding] Success! Onboarding completed.');

  // Don't revalidate here - client handles the copilot intro step transition
  // revalidatePath will cause server to re-render and redirect before copilot step shows
}

export async function completeGoogleOnboarding(formData: FormData) {
  const companyName = String(formData.get('companyName') || '').trim();
  const fullName = String(formData.get('fullName') || '').trim();
  const currency = String(formData.get('currency') || 'NZD').trim();
  const language = String(formData.get('language') || 'en').trim();
  // Validate measurement against the new tri-state. Anything we don't recognise
  // (e.g. an old form posting 'imperial') gets normalised to 'imperial_rs'
  // since that's what the legacy UI produced.
  const rawMeasurement = String(formData.get('measurement') || 'metric').trim();
  const measurement: 'metric' | 'imperial_ft' | 'imperial_rs' =
    rawMeasurement === 'metric' || rawMeasurement === 'imperial_ft' || rawMeasurement === 'imperial_rs'
      ? rawMeasurement
      : 'imperial_rs';
  const defaultTrade = String(formData.get('defaultTrade') || 'roofing').trim();

  if (!companyName || !fullName) {
    throw new Error('Company name and your name are required.');
  }

  const _supabase = await createSupabaseServerClient();
  const authUser = await requireUser();
  const supabaseAdmin = createAdminClient();

  // ── DATA-LOSS GUARD ──────────────────────────────────────────────
  // If the user already has a profile with a company_id, do NOT create a
  // new company. This prevents a catastrophic bug where a returning Google
  // user whose profile was missing (but auth user still existed) would get
  // a brand-new company, orphaning their old company's data forever.
  // Instead, redirect them to their existing company. If the company row
  // itself is gone (hard-deleted), we fall through to company creation —
  // but only as a last resort, and we log it loudly.
  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('id, company_id, full_name')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingProfile?.company_id) {
    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id, slug, onboarding_completed_at')
      .eq('id', existingProfile.company_id)
      .maybeSingle();

    if (existingCompany) {
      // Update name if the user provided a new one, but keep the company.
      if (fullName && fullName !== existingProfile.full_name) {
        await supabaseAdmin
          .from('users')
          .update({ full_name: fullName })
          .eq('id', authUser.id);
      }

      // Skip redirect if requested (client handles navigation)
      const skipRedirect = formData.get('skipRedirect') === 'true';
      if (!skipRedirect) {
        redirect(`/${existingCompany.slug}`);
      }
      return { slug: existingCompany.slug };
    }

    // Company row is gone but profile still points at it — this is a
    // data-integrity issue. Log it, clear the stale reference, and proceed
    // to create a new company as a fallback.
    console.error(
      `[completeGoogleOnboarding] DATA INTEGRITY WARNING: user ${authUser.id} has company_id ${existingProfile.company_id} but company row not found. Creating new company as fallback.`,
    );
    // Clear the stale company_id reference. Cast to any because the generated
    // type for company_id is `string` (not nullable) even though the DB column
    // allows NULL — the type was generated when the column was NOT NULL.
    await supabaseAdmin
      .from('users')
      .update({ company_id: null as any })
      .eq('id', authUser.id);
  }

  // ── ORPHANED-DATA GUARD ─────────────────────────────────────────
  // Even if no profile row exists, check if the auth user has quotes
  // belonging to them. Match by `created_by_email` (durable — survives
  // profile deletion) with a `created_by_user_id` fallback. This is the
  // third line of defense (after /auth/callback and /onboarding page
  // checks) to prevent data orphaning. (Gerald H-01)
  if (!existingProfile) {
    const userEmail = authUser.email?.toLowerCase() || '';
    let orphanedQuote: { company_id: string } | null = null;

    if (userEmail) {
      const { data: emailMatch } = await supabaseAdmin
        .from('quotes')
        .select('company_id')
        .eq('created_by_email', userEmail)
        .limit(1)
        .maybeSingle();
      orphanedQuote = emailMatch;
    }

    if (!orphanedQuote) {
      const { data: idMatch } = await supabaseAdmin
        .from('quotes')
        .select('company_id')
        .eq('created_by_user_id', authUser.id)
        .limit(1)
        .maybeSingle();
      orphanedQuote = idMatch;
    }

    if (orphanedQuote?.company_id) {
      const { data: orphanedCompany } = await supabaseAdmin
        .from('companies')
        .select('id, slug, onboarding_completed_at')
        .eq('id', orphanedQuote.company_id)
        .maybeSingle();

      if (orphanedCompany) {
        // Restore the profile row.
        await supabaseAdmin.from('users').insert({
          id: authUser.id,
          company_id: orphanedQuote.company_id,
          email: authUser.email || '',
          full_name: fullName,
          role: 'owner',
        });
        console.error(
          `[completeGoogleOnboarding] ORPHAN RECOVERY: restored profile for user ${authUser.id} (email: ${userEmail}) to company ${orphanedQuote.company_id}`,
        );
        const skipRedirect = formData.get('skipRedirect') === 'true';
        if (!skipRedirect) {
          redirect(`/${orphanedCompany.slug}`);
        }
        return { slug: orphanedCompany.slug };
      }
    }
  }
  // ── END ORPHANED-DATA GUARD ─────────────────────────────────────
  // ── END DATA-LOSS GUARD ──────────────────────────────────────────

  // Create company
  const slugBase = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

  let companySlug = `${slugBase || 'company'}-${authUser.id.slice(0, 8)}`;

  // Defence-in-depth: ensure the generated slug doesn't collide with a
  // public route prefix (e.g. 'm-xxxxxxxx', 'orders-xxxxxxxx'). Extremely
  // unlikely with the UUID suffix, but if it ever did happen the workspace
  // would be unreachable via middleware. The segment-boundary fix in
  // middleware.ts already prevents the bypass; this is a belt-and-braces check.
  const RESERVED_PREFIXES = ['m', 'orders', 'invoice', 'file', 'accept', 'docs', 'terms', 'privacy', 'cookies', 'admin', 'api', 'login', 'signup', 'auth', 'onboarding', '2fa'];
  const firstSegment = companySlug.split('-')[0];
  if (RESERVED_PREFIXES.includes(firstSegment)) {
    companySlug = `ws-${companySlug}`;
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: companyName,
      slug: companySlug,
      default_currency: currency,
      default_language: language,
      default_measurement_system: measurement,
      default_trade: defaultTrade as any,
      default_tax_rate: 15.0,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message || 'Failed to create company');
  }

  if (existingProfile) {
    await supabaseAdmin
      .from('users')
      .update({ company_id: company.id, full_name: fullName })
      .eq('id', authUser.id);
  } else {
    await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        company_id: company.id,
        email: authUser.email || '',
        full_name: fullName,
        role: 'owner',
      });
  }

  // Phase 3: bootstrap the "My Components" collection before seeding so the
  // seeded components get tagged with the collection id. Same rationale as
  // in signup/actions.ts - service-role RPC, idempotent, non-fatal.
  let bootstrapCollectionId: string | null = null;
  try {
    bootstrapCollectionId = await ensureCompanyHasCollection(
      company.id,
      supabaseAdmin,
    );
  } catch (err) {
    console.error('[completeGoogleOnboarding] ensureCompanyHasCollection failed:', err);
  }

  // Seed canonical starter components into the new company. Non-fatal:
  // onboarding must still succeed if this fails.
  await seedTemplateComponents(supabaseAdmin, company.id, defaultTrade, bootstrapCollectionId);

  // Send welcome email (Google signups don't go through email confirmation,
  // so we send it here after onboarding completes). Best-effort: never blocks.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://quotecore-plus-main.vercel.app';
    const { renderWelcomeEmail } = await import('@/app/lib/email/templates/welcome');
    const { sendEmail } = await import('@/app/lib/email/send');
    const { html, text, subject } = renderWelcomeEmail({
      fullName,
      workspaceSlug: company.slug || 'workspace',
      appUrl,
      isGoogleSignup: true,
    });
    await sendEmail({
      to: authUser.email || '',
      subject,
      html,
      text,
      tags: [{ name: 'type', value: 'welcome' }],
    });
  } catch (err) {
    console.error('[completeGoogleOnboarding] Welcome email failed (non-fatal):', err);
  }

  // Skip redirect if requested (copilot intro step handles navigation)
  const skipRedirect = formData.get('skipRedirect') === 'true';
  if (!skipRedirect) {
    redirect(`/${company.slug}`);
  }
  return { slug: company.slug };
}
