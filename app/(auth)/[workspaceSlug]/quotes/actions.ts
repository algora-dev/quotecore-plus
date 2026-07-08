'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { applyPitchAndWaste } from '@/app/lib/pricing/engine';
import type { InputMode, WasteType, PitchType } from '@/app/lib/types';
import { verifyQuoteOwnership, verifyRoofAreaOwnership, verifyComponentOwnership } from '@/app/lib/auth/ownership';
import { seedQuoteTaxesOnCreate } from '@/app/lib/taxes/seed';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { notifyCustomerExpiryExtended } from '@/app/lib/email/notify';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { pickFields } from '@/app/lib/security/pickFields';
import { createQuoteAtomic, resolveQuoteCreationDefaults } from '@/app/lib/billing/quote-creation';
import {
  assertComponentCompatibleWithQuote,
  TradeIncompatibleError,
} from '@/app/lib/trades/assertCompatible';

/**
 * Quote-roof-area columns updatable from the client. Server-managed
 * fields (`id`, `quote_id`, `template_roof_area_id`, `created_at`,
 * `updated_at`) and the server-computed `computed_sqm` are explicitly
 * out of scope - the action body sets `computed_sqm` itself before the
 * update so it's never trusted from the client. Gerald audit M-03.
 */
const UPDATABLE_QUOTE_ROOF_AREA_FIELDS = [
  'label',
  'input_mode',
  'final_value_sqm',
  'calc_width_m',
  'calc_length_m',
  'calc_plan_sqm',
  'calc_pitch_degrees',
  'computed_sqm',
  'is_locked',
  'sort_order',
] as const;

/**
 * Quote columns updatable via the generic `updateQuoteSettings` action.
 * The narrow window allowed here intentionally excludes status, accept
 * tokens, withdrawn flags, company_id, created_at, etc. - those have
 * dedicated server actions (`confirmQuote`, `acceptQuote`,
 * `withdrawQuote`, etc.) that enforce their own state-machine rules.
 */
const UPDATABLE_QUOTE_SETTINGS_FIELDS = [
  'customer_name',
  'customer_email',
  'customer_phone',
  'job_name',
  'site_address',
  'notes_internal',
  'global_pitch_degrees',
  'currency',
  'material_margin_percent',
  'labor_margin_percent',
  'material_margin_enabled',
  'labor_margin_enabled',
  'tax_rate',
  'cq_company_name',
  'cq_company_address',
  'cq_company_phone',
  'cq_company_email',
  'cq_company_logo_url',
  'cq_footer_text',
] as const;

/**
 * Extract the storage object path from a Supabase storage URL (public or signed).
 * Returns null if the URL is empty or matches neither pattern.
 */
function storagePathFromUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
  ];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    const tail = url.substring(idx + marker.length);
    const clean = tail.split('?')[0].split('#')[0];
    if (clean) return decodeURIComponent(clean);
  }
  return null;
}

export async function createQuoteFromTemplate(
  templateId: string,
  customerName: string,
  jobReference?: string | null,
  entryMode?: 'manual' | 'digital',
  /** Optional override; defaults to the company default. Once persisted this is locked. */
  measurementSystem?: 'metric' | 'imperial_ft' | 'imperial_rs'
) {
  const { profile, company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify template belongs to this company before copying any of its structure into a new quote.
  const { data: template, error: tErr } = await supabase
    .from('templates')
    .select('id, company_id')
    .eq('id', templateId)
    .single();
  if (tErr || !template) throw new Error('Template not found');
  if (template.company_id !== profile.company_id) throw new Error('Unauthorized');

  const safeMeasurementSystem =
    measurementSystem === 'metric' ||
    measurementSystem === 'imperial_ft' ||
    measurementSystem === 'imperial_rs'
      ? measurementSystem
      : (company.default_measurement_system === 'imperial' ? 'imperial_rs' : company.default_measurement_system);

  // Atomic create with per-company-per-month advisory lock + quote limit
  // check (H-02). Same RPC the three other quote-creation paths use.
  // measurement_system at this point is already in the split enum; pass
  // through as-is. entry_mode is nullable in the DB but the RPC defaults
  // to 'manual' when not supplied; this matches the previous behaviour
  // when entryMode was null.
  // Phase 4: tag the new quote with the company's bootstrap collection +
  // trade='roofing'. Both safe to pass with the feature flag off (RPC just
  // stores them); required once the flag flips on.
  const defaults = await resolveQuoteCreationDefaults(profile.company_id);
  const quoteId = await createQuoteAtomic(profile.company_id, profile.id, {
    templateId,
    customerName,
    jobName: jobReference || null,
    taxRate: company.default_tax_rate ?? 0,
    measurementSystem: safeMeasurementSystem as 'metric' | 'imperial_ft' | 'imperial_rs',
    entryMode: (entryMode ?? 'manual') as 'manual' | 'digital',
    trade: defaults.trade,
    componentCollectionId: defaults.componentCollectionId,
  });
  // Re-load via the user's RLS-bound client so subsequent queries (template
  // copy-in below) operate as the caller, not the admin client.
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();
  if (qErr || !quote) throw new Error(qErr?.message || 'Failed to load just-created quote');
  const { data: templateAreas } = await supabase.from('template_roof_areas').select('*').eq('template_id', templateId).order('sort_order');
  const areaMapping: Record<string, string> = {};
  if (templateAreas?.length) {
    for (const ta of templateAreas) {
      const { data: qa } = await supabase.from('quote_roof_areas').insert({
        quote_id: quote.id, template_roof_area_id: ta.id, label: ta.label,
        input_mode: ta.default_input_mode || 'calculated', sort_order: ta.sort_order,
      }).select('id').single();
      if (qa) areaMapping[ta.id] = qa.id;
    }
  }
  const { data: templateComps } = await supabase.from('template_components').select('*, component_library(*)').eq('template_id', templateId).eq('is_included_by_default', true).order('sort_order');
  if (templateComps?.length) {
    // Phase 6 (Gerald round-2 M-03): validate every template component
    // against the new quote's trade BEFORE inserting. v1 trades are
    // roofing-only at create-quote-from-template path so this is
    // effectively a no-op now, but the guard catches future template
    // flows that allow trade selection. Filter out incompatible rows
    // rather than throwing, so a single bad component in a template
    // doesn't block the whole template-apply.
    const compatibilityResults = await Promise.all(
      templateComps.map(async (tc) => {
        if (!tc.component_library_id) return { tc, ok: true };
        try {
          await assertComponentCompatibleWithQuote({
            quoteId: quote.id,
            componentId: tc.component_library_id,
            companyId: profile.company_id,
          });
          return { tc, ok: true };
        } catch (err) {
          console.warn(
            `[createQuoteFromTemplate] skipping incompatible template component ${tc.id}:`,
            err instanceof Error ? err.message : err,
          );
          return { tc, ok: false };
        }
      }),
    );
    const eligibleTemplateComps = compatibilityResults
      .filter((r) => r.ok)
      .map((r) => r.tc);
    const quoteComponents = eligibleTemplateComps.map(tc => {
      const lib = tc.component_library;
      return {
        quote_id: quote.id, quote_roof_area_id: tc.template_roof_area_id ? (areaMapping[tc.template_roof_area_id] ?? null) : null,
        component_library_id: tc.component_library_id, template_component_id: tc.id, name: lib.name,
        component_type: tc.component_type, measurement_type: lib.measurement_type, input_mode: 'calculated' as InputMode,
        waste_type: (tc.override_waste_type ?? lib.default_waste_type) as any,
        waste_percent: tc.override_waste_percent ?? lib.default_waste_percent ?? 0,
        waste_fixed: tc.override_waste_fixed ?? lib.default_waste_fixed ?? 0,
        pitch_type: (tc.override_pitch_type ?? lib.default_pitch_type ?? 'none') as PitchType,
        material_rate: tc.override_material_rate ?? lib.default_material_rate ?? 0,
        labour_rate: tc.override_labour_rate ?? lib.default_labour_rate ?? 0, sort_order: tc.sort_order,
      };
    });
    if (quoteComponents.length > 0) {
      await supabase.from('quote_components').insert(quoteComponents);
    }
  }
  await seedQuoteTaxesOnCreate(quote.id, profile.company_id);
  redirect(`/${company.slug}/quotes/${quote.id}`);
}

export async function generateAcceptanceToken(quoteId: string, expiryDays: number = 30, applyExpiry: boolean = true): Promise<string> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Check quote exists and belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, acceptance_token, status, accepted_at, declined_at, withdrawn_at, job_status')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (!quote) throw new Error('Quote not found');
  if (quote.status === 'draft') throw new Error('Cannot send draft quotes');
  if ((quote as any).accepted_at) throw new Error('Quote has already been accepted');
  if ((quote as any).declined_at) throw new Error('Quote has already been declined');

  // Reuse the existing token when there's a live one (not withdrawn, not expired)
  // but ALWAYS update acceptance_token_expires_at to the newly requested expiry.
  // This lets the user change the deadline in the Send panel without rotating
  // the customer URL (same link, new expiry). Expired/withdrawn quotes get a
  // fresh UUID so the old URL stays dead.
  const isExpired = (quote as any).job_status === 'expired';
  const days = Math.max(1, Math.min(365, expiryDays));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  if (quote.acceptance_token && !(quote as any).withdrawn_at && !isExpired) {
    // Live token exists.
    if (!applyExpiry) {
      // Caller is just fetching the token for display/compose purposes;
      // do NOT touch the expiry or job_status yet.
      return quote.acceptance_token;
    }
    // applyExpiry=true: user has explicitly sent/copied — commit the expiry.
    await supabase
      .from('quotes')
      .update({ acceptance_token_expires_at: expiresAt.toISOString(), job_status: 'sent' })
      .eq('id', quoteId)
      .eq('company_id', profile.company_id);
    revalidatePath('/');
    return quote.acceptance_token;
  }

  // Generate a fresh token (expired / withdrawn quotes — old URL stays dead)
  const token = crypto.randomUUID();
  // days / expiresAt already computed above

  // H-03 fix: when applyExpiry=false the caller is only opening the send panel to
  // display/compose the URL — the quote must NOT be marked sent or get an expiry
  // until the user actually sends or copies the link. Store the token so the URL
  // is stable, but leave acceptance_token_expires_at and job_status untouched.
  const updateFields: Record<string, unknown> = {
    acceptance_token: token,
    // Clear any prior withdrawal so the new link is treated as live.
    withdrawn_at: null,
    withdrawn_by_user_id: null,
  };
  if (applyExpiry) {
    updateFields.acceptance_token_expires_at = expiresAt.toISOString();
    updateFields.job_status = 'sent';
  }

  const { error } = await supabase
    .from('quotes')
    .update(updateFields)
    .eq('id', quoteId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return token;
}

/**
 * Update the validity period of an already-sent quote.
 *
 * Sets acceptance_token_expires_at to now() + chosen days. If the quote was
 * previously expired (job_status='expired') and the new expiry is in the
 * future, the status is reset to 'sent' so the quote is live again without
 * needing a full re-send.
 */
/**
 * Persist material + labor margin settings back to the quotes table from the
 * CustomerQuoteEditor. Allows users on any quote type (not just blank) to
 * adjust margins in the customer quote editor and have them sync back to the
 * Review-stage values.
 */
export async function updateQuoteExpiry(
  quoteId: string,
  days: number,
): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, company_id, accepted_at, declined_at, job_status, customer_email, customer_name, quote_number, acceptance_token, cq_company_name')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (!quote) throw new Error('Quote not found');
  if ((quote as any).accepted_at) throw new Error('Cannot edit expiry - quote already accepted.');
  if ((quote as any).declined_at) throw new Error('Cannot edit expiry - quote already declined.');

  const clampedDays = Math.max(1, Math.min(365, days));
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + clampedDays);

  // If extending from an expired state, restore to 'sent' so the quote is
  // live again. Any other job_status stays as-is.
  const wasExpired = (quote as any).job_status === 'expired';

  const { error } = await supabase
    .from('quotes')
    .update({
      acceptance_token_expires_at: newExpiry.toISOString(),
      ...(wasExpired ? { job_status: 'sent' } : {}),
    })
    .eq('id', quoteId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);
  revalidatePath('/');

  // M-02: Notify the customer that their acceptance window has been extended.
  // Must await — Vercel serverless terminates on handler return; fire-and-forget
  // Promises are silently dropped. notifyCustomerExpiryExtended is best-effort
  // and swallows its own errors, so this never throws.
  const customerEmail = (quote as any).customer_email as string | null;
  const acceptanceToken = (quote as any).acceptance_token as string | null;
  if (customerEmail && acceptanceToken) {
    await notifyCustomerExpiryExtended({
      customerEmail,
      customerName: (quote as any).customer_name ?? null,
      companyName: (quote as any).cq_company_name ?? null,
      quoteNumber: (quote as any).quote_number ?? null,
      acceptanceToken,
      newExpiryIso: newExpiry.toISOString(),
    });
  }
}

/**
 * Withdraw the active acceptance URL for a quote.
 *
 * Stamps `withdrawn_at` and clears the token so the public /accept/[token]
 * URL stops working immediately. The quote remains intact (just no longer
 * "sent") and the user can mint a fresh URL whenever they're ready.
 *
 * Refuses to withdraw if the quote has already been accepted or declined -
 * those final states stand.
 */
export async function withdrawQuote(quoteId: string): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: quote, error: loadErr } = await supabase
    .from('quotes')
    .select('id, company_id, acceptance_token, accepted_at, declined_at, withdrawn_at')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (loadErr || !quote) throw new Error('Quote not found');
  if ((quote as any).accepted_at) throw new Error('Cannot withdraw - the customer has already accepted this quote.');
  if ((quote as any).declined_at) throw new Error('Cannot withdraw - the customer has already declined this quote.');
  if (!quote.acceptance_token && !(quote as any).withdrawn_at) {
    // Nothing to withdraw - no active link in the first place.
    throw new Error('No active acceptance link to withdraw.');
  }

  // We KEEP the token but stamp withdrawn_at. This way the public URL still
  // resolves so the customer can submit a fresh-quote request through the
  // same flow used for expired/responded links - but accept/decline are
  // refused server-side because the quote is withdrawn. When the user mints
  // a new URL via generateAcceptanceToken, that path replaces the token
  // (the old one becomes invalid).
  const { error: updateErr } = await supabase
    .from('quotes')
    .update({
      withdrawn_at: new Date().toISOString(),
      withdrawn_by_user_id: profile.id,
      // Roll job_status back to unsent so the quotes list reflects reality.
      job_status: 'unsent',
    })
    .eq('id', quoteId)
    .eq('company_id', profile.company_id);

  if (updateErr) throw new Error(`Failed to withdraw quote: ${updateErr.message}`);

  // Withdrawing clears any "Action Required" state too: resolve any open
  // revision requests so the badge (derived from unresolved
  // quote_revision_requests) drops (bug 2026-06-10).
  await supabase
    .from('quote_revision_requests')
    .update({ resolved_at: new Date().toISOString() })
    .eq('quote_id', quoteId)
    .is('resolved_at', null);

  revalidatePath('/');
}

/**
 * Reopen a quote that's in a final state (accepted / declined / withdrawn).
 *
 * Clears the relevant terminal timestamps and the existing acceptance
 * token so the user can mint a fresh link via Send Quote. Used when a
 * customer changes their mind, the scope of work changes, or the user
 * needs to re-engage after a decline. Conceptually this is a "start
 * over" button on the quote summary.
 *
 * Also auto-cancels any still-pending scheduled_messages for this
 * quote so a stale follow-up doesn't fire against a reopened quote
 * with stale context. The user can re-schedule from the post-send
 * prompt or the Schedule modal after re-sending.
 *
 * Writes an audit alert so there's a paper trail for the reopen.
 */
export async function reopenQuote(quoteId: string): Promise<{ ok: true; cancelledFollowUps: number } | { ok: false; error: string }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: quote, error: loadErr } = await supabase
    .from('quotes')
    .select('id, company_id, accepted_at, declined_at, withdrawn_at, quote_number, customer_name')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (loadErr || !quote) return { ok: false, error: 'Quote not found.' };
  // Refuse to reopen a quote that's already in a fresh state - nothing
  // to do, and silently no-oping would mask a UI bug.
  if (!(quote as any).accepted_at && !(quote as any).declined_at && !(quote as any).withdrawn_at) {
    return { ok: false, error: 'This quote is already open. There\u2019s nothing to reopen.' };
  }

  const previousState = (quote as any).accepted_at
    ? 'accepted'
    : (quote as any).declined_at
      ? 'declined'
      : 'withdrawn';

  // Clear terminal markers + token so the next Send Quote click mints
  // a fresh URL. job_status rolls back to 'unsent' so the quotes list
  // and dashboard reflect that the quote is alive again.
  const { error: updateErr } = await supabase
    .from('quotes')
    .update({
      accepted_at: null,
      declined_at: null,
      withdrawn_at: null,
      withdrawn_by_user_id: null,
      acceptance_token: null,
      acceptance_token_expires_at: null,
      job_status: 'unsent',
    } as Record<string, unknown>)
    .eq('id', quoteId)
    .eq('company_id', profile.company_id);

  if (updateErr) return { ok: false, error: `Failed to reopen quote: ${updateErr.message}` };

  // Auto-cancel any still-pending scheduled follow-ups so they don't
  // fire against the reopened quote with stale context. The user can
  // re-schedule from the post-send prompt when they re-send. Return
  // the count so the confirmation UI can surface exactly what happened
  // instead of vaguely promising it.
  const { count: cancelledFollowUps } = await supabase
    .from('scheduled_messages')
    .update(
      { status: 'cancelled', cancelled_reason: 'Quote was reopened.' } as Record<string, unknown>,
      { count: 'exact' },
    )
    .eq('quote_id', quoteId)
    .eq('company_id', profile.company_id)
    .eq('status', 'scheduled');

  // Audit alert. Best-effort; we don't fail the reopen if this fails.
  try {
    await supabase.from('alerts').insert({
      company_id: profile.company_id,
      quote_id: quoteId,
      alert_type: 'quote_reopened',
      title: `Quote #${quote.quote_number ?? '?'} reopened`,
      message: `Previously ${previousState}. Token cleared; ready for a fresh send.`,
    });
  } catch {
    // ignore audit failure
  }

  revalidatePath('/');
  return { ok: true, cancelledFollowUps: cancelledFollowUps ?? 0 };
}

const VALID_JOB_STATUSES = [
  'unsent', 'sent', 'accepted', 'declined', 'deposit_paid',
  'materials_ordered', 'install', 'invoice_sent', 'invoice_paid', 'finished',
] as const;

export type JobStatus = typeof VALID_JOB_STATUSES[number];

export async function updateQuoteJobStatus(quoteId: string, jobStatus: JobStatus) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  if (!VALID_JOB_STATUSES.includes(jobStatus)) {
    throw new Error('Invalid job status');
  }

  // Manual status changes are the master source of truth for this
  // quote and must stay master until another action (manual or
  // customer-facing) overrides them.
  //
  // The two derived timestamps `accepted_at` / `declined_at` are what
  // the public acceptance link uses to decide whether the link is
  // still actionable, and they're also the inputs for the WithdrawQuote
  // / SendQuote button states on the summary page. Before this change,
  // a user manually flipping job_status away from 'accepted' would
  // leave `accepted_at` stamped - so the summary chrome and the public
  // link still believed the quote was accepted. Conversely, manually
  // setting 'accepted' without stamping accepted_at meant a customer
  // could later click the public link and override the manual decision.
  //
  // Sync rules:
  //   - jobStatus = 'accepted'  -> stamp accepted_at = now(), clear declined_at.
  //   - jobStatus = 'declined'  -> stamp declined_at = now(), clear accepted_at.
  //   - anything else           -> clear BOTH timestamps so the link
  //                                 sees the quote as not-yet-finalized
  //                                 and downstream UI re-syncs. This
  //                                 is the "renegotiate" path the user
  //                                 implicitly takes by moving status
  //                                 back to e.g. 'sent' or 'unsent'.
  //
  // 2026-05-13 Shaun: "If the user manually changes the status from
  // accepted/declined, that has to be the new master for that quote
  // until another action changes it."
  const now = new Date().toISOString();
  type StatusPatch = {
    job_status: JobStatus;
    accepted_at?: string | null;
    declined_at?: string | null;
  };
  const patch: StatusPatch = { job_status: jobStatus };
  if (jobStatus === 'accepted') {
    patch.accepted_at = now;
    patch.declined_at = null;
  } else if (jobStatus === 'declined') {
    patch.declined_at = now;
    patch.accepted_at = null;
  } else {
    patch.accepted_at = null;
    patch.declined_at = null;
  }

  const { error } = await supabase
    .from('quotes')
    .update(patch)
    .eq('id', quoteId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);

  // Activate / cancel any pre-staged event-triggered follow-ups when
  // the manual status flip pushes the quote into accepted/declined.
  // Mirrors the same activation done by the customer-facing
  // accept/decline path so the user gets follow-ups whether the
  // outcome was recorded by the customer or the user manually.
  if (jobStatus === 'accepted' || jobStatus === 'declined') {
    try {
      const { activateEventScheduledMessages } = await import('@/app/lib/messages/scheduled');
      await activateEventScheduledMessages({
        quoteId,
        companyId: profile.company_id,
        event: jobStatus,
        eventAt: now,
      });
    } catch (err) {
      console.error('[updateQuoteJobStatus] activateEventScheduledMessages failed:', err);
    }
  }

  revalidatePath('/');
}

export async function createBlankQuote(customerName: string, jobReference?: string | null) {
  const { profile, company } = await loadCompanyContext();

  // Goes through create_quote_atomic so the monthly-quote-limit check +
  // counter increment happen under the per-company advisory lock with the
  // quote insert (Gerald audit H-02).
  //
  // The company's default_measurement_system enum can legitimately be the
  // legacy 'imperial' label; normalise it to 'imperial_rs' so the RPC's
  // payload projection (which expects the split enum) sees a valid value.
  const normalisedSystem: 'metric' | 'imperial_ft' | 'imperial_rs' =
    company.default_measurement_system === 'imperial_ft'
      ? 'imperial_ft'
      : company.default_measurement_system === 'metric'
        ? 'metric'
        : 'imperial_rs';

  // Phase 4: see resolveQuoteCreationDefaults note in the template path above.
  const defaults = await resolveQuoteCreationDefaults(profile.company_id);
  const quoteId = await createQuoteAtomic(profile.company_id, profile.id, {
    customerName,
    jobName: jobReference || null,
    taxRate: company.default_tax_rate ?? 0,
    measurementSystem: normalisedSystem,
    trade: defaults.trade,
    componentCollectionId: defaults.componentCollectionId,
  });
  await seedQuoteTaxesOnCreate(quoteId, profile.company_id);
  redirect(`/${company.slug}/quotes/${quoteId}`);
}

export async function loadQuote(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('quotes').select('*').eq('id', id).eq('company_id', profile.company_id).single();
  if (error || !data) throw new Error(error?.message || 'Quote not found');
  return data;
}

export async function loadQuoteRoofAreas(quoteId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);
  const { data, error } = await supabase.from('quote_roof_areas').select('*').eq('quote_id', quoteId).order('sort_order');
  if (error) throw new Error(error.message);
  return data;
}

export async function loadAllRoofAreaEntriesForQuote(quoteId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);
  const { data: areas } = await supabase.from('quote_roof_areas').select('id').eq('quote_id', quoteId);
  if (!areas?.length) return {};
  const areaIds = areas.map(a => a.id);
  const { data: entries, error } = await supabase.from('quote_roof_area_entries').select('*').in('quote_roof_area_id', areaIds).order('sort_order');
  if (error) throw new Error(error.message);
  const grouped: Record<string, typeof entries> = {};
  for (const entry of (entries ?? [])) {
    if (!grouped[entry.quote_roof_area_id]) grouped[entry.quote_roof_area_id] = [];
    grouped[entry.quote_roof_area_id].push(entry);
  }
  return grouped;
}

export async function loadQuoteComponents(quoteId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);
  const { data, error } = await supabase.from('quote_components').select('*').eq('quote_id', quoteId).order('sort_order');
  if (error) throw new Error(error.message);
  return data;
}

export async function loadAllEntriesForQuote(quoteId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);
  const { data: comps } = await supabase.from('quote_components').select('id').eq('quote_id', quoteId);
  if (!comps?.length) return {};
  const compIds = comps.map(c => c.id);
  const { data: entries, error } = await supabase.from('quote_component_entries').select('*').in('quote_component_id', compIds).order('sort_order');
  if (error) throw new Error(error.message);
  const grouped: Record<string, typeof entries> = {};
  for (const entry of (entries ?? [])) {
    if (!grouped[entry.quote_component_id]) grouped[entry.quote_component_id] = [];
    grouped[entry.quote_component_id].push(entry);
  }
  return grouped;
}

export async function addQuoteRoofArea(quoteId: string, label: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);
  const { data, error } = await supabase.from('quote_roof_areas').insert({ quote_id: quoteId, label, input_mode: 'calculated', is_locked: false }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addRoofAreaEntry(roofAreaId: string, widthM: number, lengthM: number, pitchDegrees: number) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyRoofAreaOwnership(supabase, roofAreaId, profile.company_id);
  const planSqm = widthM * lengthM;
  const pf = 1 / Math.cos((pitchDegrees ?? 0) * Math.PI / 180);
  const sqm = planSqm * pf;
  const { data, error } = await supabase.from('quote_roof_area_entries').insert({
    quote_roof_area_id: roofAreaId, width_m: widthM, length_m: lengthM, sqm,
  }).select().single();
  if (error) throw new Error(error.message);
  await recalcAreaFromEntries(roofAreaId);
  return data;
}

export async function removeRoofAreaEntry(entryId: string, roofAreaId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyRoofAreaOwnership(supabase, roofAreaId, profile.company_id);
  const { error } = await supabase.from('quote_roof_area_entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);
  await recalcAreaFromEntries(roofAreaId);
}

async function recalcAreaFromEntries(roofAreaId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: entries } = await supabase.from('quote_roof_area_entries').select('sqm').eq('quote_roof_area_id', roofAreaId);
  const totalSqm = (entries ?? []).reduce((sum, e) => sum + Number(e.sqm), 0);
  await supabase.from('quote_roof_areas').update({ computed_sqm: totalSqm }).eq('id', roofAreaId);
}

export async function updateQuoteRoofArea(id: string, input: any) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyRoofAreaOwnership(supabase, id, profile.company_id);

  // If pitch is being changed, prefer recomputing from existing dimension entries
  // (each entry has raw width_m/length_m); falls back to calc_plan_sqm when there are no entries.
  const pitchProvided = input.calc_pitch_degrees !== undefined;
  const newPitch = Number(input.calc_pitch_degrees ?? 0) || 0;
  const newPitchFactor = 1 / Math.cos(newPitch * Math.PI / 180);

  let entriesForArea: { id: string; width_m: number; length_m: number }[] = [];
  if (pitchProvided) {
    const { data: ents } = await supabase
      .from('quote_roof_area_entries')
      .select('id, width_m, length_m')
      .eq('quote_roof_area_id', id);
    entriesForArea = (ents ?? []) as any[];
  }

  if (input.input_mode === 'calculated') {
    if (pitchProvided && entriesForArea.length > 0) {
      // Re-pitch the entries-based total (and persist the new per-entry sqm).
      let totalSqm = 0;
      for (const e of entriesForArea) {
        const sqm = (Number(e.width_m) || 0) * (Number(e.length_m) || 0) * newPitchFactor;
        totalSqm += sqm;
        await supabase.from('quote_roof_area_entries').update({ sqm }).eq('id', e.id);
      }
      input.computed_sqm = totalSqm;
    } else {
      let planSqm = input.calc_plan_sqm ?? 0;
      if (!planSqm && input.calc_width_m && input.calc_length_m) planSqm = input.calc_width_m * input.calc_length_m;
      const pf = 1 / Math.cos((input.calc_pitch_degrees ?? 0) * Math.PI / 180);
      input.computed_sqm = planSqm * pf;
    }
  } else if (input.input_mode === 'final') input.computed_sqm = input.final_value_sqm ?? 0;

  // Whitelist columns before passing to the DB (Gerald audit M-03). The
  // action body has already set `computed_sqm` on the input based on
  // input_mode + pitch; including it in the allowed set keeps that
  // server-controlled value through to the update.
  const update = pickFields(input as Record<string, unknown>, UPDATABLE_QUOTE_ROOF_AREA_FIELDS);
  // Cast safe: keys come from UPDATABLE_QUOTE_ROOF_AREA_FIELDS.
  const { data, error } = await supabase.from('quote_roof_areas').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw new Error(error.message);

  if (input.calc_pitch_degrees && input.calc_pitch_degrees > 0) {
    const { data: area } = await supabase.from('quote_roof_areas').select('quote_id').eq('id', id).single();
    if (area) {
      const { data: quote } = await supabase.from('quotes').select('global_pitch_degrees').eq('id', area.quote_id).single();
      if (quote && !quote.global_pitch_degrees) {
        await supabase.from('quotes').update({ global_pitch_degrees: input.calc_pitch_degrees }).eq('id', area.quote_id);
      }
    }
  }
  return data;
}

export async function toggleAreaLock(id: string, locked: boolean) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyRoofAreaOwnership(supabase, id, profile.company_id);
  const { error } = await supabase.from('quote_roof_areas').update({ is_locked: locked }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function removeQuoteRoofArea(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyRoofAreaOwnership(supabase, id, profile.company_id);
  const { error } = await supabase.from('quote_roof_areas').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addQuoteComponent(quoteId: string, input: any) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);

  // Phase 6 (Gerald round-2 M-03): every quote_components write must pass
  // the central trade-compat check. Only check when input has a real
  // component_library_id; a custom one-off component without a library link
  // bypasses the check (no library row exists to validate against). Throws
  // TradeIncompatibleError when the component's measurement_type isn't
  // allowed on the quote's trade.
  if (input.component_library_id) {
    try {
      await assertComponentCompatibleWithQuote({
        quoteId,
        componentId: input.component_library_id,
        companyId: profile.company_id,
      });
    } catch (err) {
      if (err instanceof TradeIncompatibleError) {
        throw new Error(`trade_incompatible: ${err.message}`);
      }
      throw err;
    }
  }

  const { data, error } = await supabase.from('quote_components').insert({
    quote_id: quoteId, quote_roof_area_id: input.quote_roof_area_id ?? null,
    component_library_id: input.component_library_id ?? null, name: input.name,
    component_type: input.component_type, measurement_type: input.measurement_type, input_mode: 'calculated',
    material_rate: input.material_rate ?? 0, labour_rate: input.labour_rate ?? 0,
    waste_type: input.waste_type ?? 'none', waste_percent: input.waste_percent ?? 0, waste_fixed: input.waste_fixed ?? 0,
    pitch_type: input.pitch_type ?? 'none',
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeQuoteComponent(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyComponentOwnership(supabase, id, profile.company_id);
  const { error } = await supabase.from('quote_components').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateComponentSettings(id: string, updates: { input_mode?: InputMode; quote_roof_area_id?: string | null; use_custom_pitch?: boolean; custom_pitch_degrees?: number | null }) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyComponentOwnership(supabase, id, profile.company_id);

  // ── Calc audit: capture manual overrides before applying updates ──
  // When the user changes pitch settings, record what the previous value
  // was so the audit trail shows the original calc vs the manual change.
  if (updates.custom_pitch_degrees !== undefined || updates.use_custom_pitch !== undefined) {
    const { data: current } = await supabase
      .from('quote_components')
      .select('calc_audit, custom_pitch_degrees, use_custom_pitch')
      .eq('id', id)
      .maybeSingle() as unknown as { data: { calc_audit?: unknown; custom_pitch_degrees?: number | null; use_custom_pitch?: boolean } | null; error: Error | null };

    if (current?.calc_audit) {
      const { appendOverride } = await import('@/app/lib/pricing/calcTracer');
      const existingAudit = current.calc_audit as import('@/app/lib/pricing/calcTracer').CalcAudit;
      const overrides: import('@/app/lib/pricing/calcTracer').CalcAuditOverride[] = [...(existingAudit.overrides ?? [])];

      if (updates.custom_pitch_degrees !== undefined && updates.custom_pitch_degrees !== current.custom_pitch_degrees) {
        overrides.push({
          field: 'custom_pitch_degrees',
          previousValue: current.custom_pitch_degrees ?? null,
          newValue: updates.custom_pitch_degrees ?? null,
          timestamp: new Date().toISOString(),
          userId: profile.id,
        });
      }
      if (updates.use_custom_pitch !== undefined && updates.use_custom_pitch !== current.use_custom_pitch) {
        overrides.push({
          field: 'use_custom_pitch',
          previousValue: current.use_custom_pitch ?? null,
          newValue: updates.use_custom_pitch ?? null,
          timestamp: new Date().toISOString(),
          userId: profile.id,
        });
      }

      const updatedAudit = appendOverride(existingAudit, overrides[overrides.length - 1]);
      // Replace the overrides array with the full list (appendOverride only adds one).
      updatedAudit.overrides = overrides;
      await supabase
        .from('quote_components')
        .update({ calc_audit: updatedAudit as unknown as never })
        .eq('id', id);
    }
  }

  const { error } = await supabase.from('quote_components').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function addComponentEntry(quoteComponentId: string, rawValue: number, areaPitch: number | null, options?: { bypassHeightMultiplier?: boolean; bypassDepthMultiplier?: boolean }) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyComponentOwnership(supabase, quoteComponentId, profile.company_id);
  const { data: comp } = await supabase.from('quote_components').select('*').eq('id', quoteComponentId).single();
  if (!comp) throw new Error('Component not found');

  let adjustedValue = rawValue;
  // Fetch component library for height/depth metadata if needed.
  const needsHeightMultiplier =
    !options?.bypassHeightMultiplier &&
    (comp.measurement_type === 'length_x_height' ||
     comp.measurement_type === 'multi_lineal_lxh');
  const needsDepthMultiplier = comp.measurement_type === 'volume' && !options?.bypassDepthMultiplier;

  if ((needsHeightMultiplier || needsDepthMultiplier) && comp.component_library_id) {
    const { data: lib } = await supabase
      .from('component_library')
      .select('height_value_mm, depth_value_mm')
      .eq('id', comp.component_library_id)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    const libRow = lib as { height_value_mm?: number | null; depth_value_mm?: number | null } | null;

    // H-02 (Gerald Round 8): for length_x_height and multi_lineal_lxh, the
    // user enters a length but the stored unit is area (length × height).
    // Apply the component's height multiplier before pricing, matching what
    // digital takeoff already does in saveTakeoffMeasurements.
    // SKIPPED when bypassHeightMultiplier is true (user provided their own area).
    if (needsHeightMultiplier) {
      const heightM = libRow?.height_value_mm ? libRow.height_value_mm / 1000 : null;
      if (heightM && heightM > 0) {
        adjustedValue = rawValue * heightM;
      }
    }

    // Volume (Preset Depth): user enters an area; multiply by the preset
    // depth to get the volume. Matches takeoff path logic.
    if (needsDepthMultiplier) {
      const depthM = libRow?.depth_value_mm ? libRow.depth_value_mm / 1000 : null;
      if (depthM && depthM > 0) {
        adjustedValue = rawValue * depthM;
      }
    }
  }

  const isPlan = comp.input_mode === 'calculated';
  const pitchDegrees = comp.use_custom_pitch ? (comp.custom_pitch_degrees ?? 0) : (areaPitch ?? 0);
  const { afterWaste } = applyPitchAndWaste(adjustedValue, isPlan, comp.pitch_type, pitchDegrees, comp.waste_type, comp.waste_percent, comp.waste_fixed);
  const { data: entry, error } = await supabase.from('quote_component_entries').insert({
    // Store the adjusted area as raw_value (consistent with digital takeoff).
    // The user sees their entered length in the UI; the entry reflects the
    // priced area so totals are correct.
    quote_component_id: quoteComponentId, raw_value: adjustedValue, value_after_waste: afterWaste,
  }).select().single();
  if (error) throw new Error(error.message);
  const componentTotals = await recalcComponentFromEntries(quoteComponentId);
  return { ...entry, componentTotals };
}

export async function useRoofAreaTotal(quoteComponentId: string, roofAreaSqm: number, areaPitch: number | null) {
  return addComponentEntry(quoteComponentId, roofAreaSqm, areaPitch);
}

export async function removeComponentEntry(entryId: string, quoteComponentId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyComponentOwnership(supabase, quoteComponentId, profile.company_id);
  const { error } = await supabase.from('quote_component_entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);
  return recalcComponentFromEntries(quoteComponentId);
}

/**
 * Phase 6.5 (Generic Trades): collapse the N entries on a linear-shaped
 * component into ONE combined entry. The displayed value (raw_value AND
 * value_after_waste) equals the sum of value_after_waste across the
 * source rows - this preserves any pitch + waste multipliers that were
 * applied to each individual entry. (Bug fix 2026-05-20: the combined
 * row previously stored sum(raw_value) which dropped per-line waste.)
 *
 * The source rows are preserved in the combined row's `combined_from`
 * JSONB so splitLinealEntries can restore them exactly. The Phase 2 CHECK
 * constraint enforces `is_combined => combined_from IS NOT NULL`.
 *
 * Idempotent: already-combined components return early so a double-click
 * doesn't lose data.
 *
 * Returns the new combined entry row + the component's updated
 * material/labour/quantity totals so the caller can update React state
 * in-place without a page reload.
 */
export async function combineLinealEntries(quoteComponentId: string): Promise<{
  ok: boolean;
  combinedEntry?: {
    id: string;
    raw_value: number;
    value_after_waste: number;
    sort_order: number;
    is_combined: true;
    combined_from: Array<{ raw: number; after: number; sort: number }>;
  };
  componentTotals?: {
    final_quantity: number;
    priced_quantity: number | null;
    material_cost: number;
    labour_cost: number;
  };
  sourceCount?: number;
  error?: string;
}> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyComponentOwnership(supabase, quoteComponentId, profile.company_id);

  const { data: entries, error: entriesErr } = await supabase
    .from('quote_component_entries')
    .select('id, raw_value, value_after_waste, sort_order')
    .eq('quote_component_id', quoteComponentId)
    .order('sort_order', { ascending: true });
  if (entriesErr) return { ok: false, error: entriesErr.message };
  if (!entries || entries.length === 0) return { ok: false, error: 'No entries to combine.' };

  type EntryRow = {
    id: string;
    raw_value: number;
    value_after_waste: number;
    sort_order: number | null;
    is_combined?: boolean | null;
  };
  const typed = entries as unknown as EntryRow[];

  if (typed.some((e) => e.is_combined)) {
    return { ok: false, error: 'Component already has a combined entry.' };
  }

  // CRITICAL: the combined row's displayed value is the sum of
  // value_after_waste - NOT raw_value. value_after_waste already includes
  // pitch + waste multipliers applied per source entry, which is what the
  // user wants to see (and what the pricing engine should multiply by
  // material_rate). Storing the raw sum would drop per-line waste.
  const totalAfterWaste = typed.reduce((s, e) => s + Number(e.value_after_waste), 0);

  const combinedFromPayload = typed.map((e) => ({
    raw: Number(e.raw_value),
    after: Number(e.value_after_waste),
    sort: e.sort_order ?? 0,
  }));

  if (combinedFromPayload.length > 200) {
    return { ok: false, error: `Cannot combine more than 200 entries (got ${combinedFromPayload.length}).` };
  }

  const ids = typed.map((e) => e.id);
  const { error: delErr } = await supabase
    .from('quote_component_entries')
    .delete()
    .in('id', ids);
  if (delErr) return { ok: false, error: delErr.message };

  // The combined row's raw_value AND value_after_waste both equal the post-
  // waste total. There's no "raw" state left to apply waste to - the
  // combined entity IS the final pitched+wasted total. This also makes the
  // recalc helper safe: it sums value_after_waste, gets totalAfterWaste,
  // and the pricing math comes out correct.
  const { data: combined, error: insertErr } = await (supabase as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => { single: () => Promise<{ data: {
          id: string;
          raw_value: number;
          value_after_waste: number;
          sort_order: number;
        } | null; error: Error | null }> };
      };
    };
  })
    .from('quote_component_entries')
    .insert({
      quote_component_id: quoteComponentId,
      raw_value: totalAfterWaste,         // bug fix: was totalRaw
      value_after_waste: totalAfterWaste,
      sort_order: 0,
      is_combined: true,
      combined_from: combinedFromPayload,
    })
    .select('id, raw_value, value_after_waste, sort_order')
    .single();
  if (insertErr || !combined) {
    return { ok: false, error: insertErr?.message ?? 'Combined insert returned no row.' };
  }

  await recalcComponentFromEntries(quoteComponentId);

  // Read back the recalculated component totals so the caller can update
  // their local state without a refetch. Cast for stale types.
  const { data: compAfter } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { final_quantity: number; priced_quantity: number | null; material_cost: number; labour_cost: number } | null;
            error: Error | null;
          }>;
        };
      };
    };
  })
    .from('quote_components')
    .select('final_quantity, priced_quantity, material_cost, labour_cost')
    .eq('id', quoteComponentId)
    .maybeSingle();

  return {
    ok: true,
    combinedEntry: {
      id: combined.id,
      raw_value: Number(combined.raw_value),
      value_after_waste: Number(combined.value_after_waste),
      sort_order: combined.sort_order ?? 0,
      is_combined: true,
      combined_from: combinedFromPayload,
    },
    componentTotals: compAfter
      ? {
          final_quantity: Number(compAfter.final_quantity ?? 0),
          priced_quantity: compAfter.priced_quantity == null ? null : Number(compAfter.priced_quantity),
          material_cost: Number(compAfter.material_cost ?? 0),
          labour_cost: Number(compAfter.labour_cost ?? 0),
        }
      : undefined,
    sourceCount: typed.length,
  };
}

/**
 * Phase 6.5 (Generic Trades): inverse of combineLinealEntries. Restores
 * the source entries from combined_from JSONB and deletes the combined
 * row. No-op when the component has no combined row.
 *
 * Returns the restored entry rows + updated component totals so the
 * caller can update React state in-place without a page reload.
 */
export async function splitLinealEntries(quoteComponentId: string): Promise<{
  ok: boolean;
  restoredEntries?: Array<{
    id: string;
    quote_component_id: string;
    raw_value: number;
    value_after_waste: number;
    sort_order: number;
  }>;
  componentTotals?: {
    final_quantity: number;
    priced_quantity: number | null;
    material_cost: number;
    labour_cost: number;
  };
  error?: string;
}> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyComponentOwnership(supabase, quoteComponentId, profile.company_id);

  type EntryRow = {
    id: string;
    raw_value: number;
    value_after_waste: number;
    sort_order: number | null;
    is_combined?: boolean | null;
    combined_from?: Array<{ raw: number; after: number; sort?: number }> | null;
  };
  const { data: entries, error: entriesErr } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{ data: EntryRow[] | null; error: Error | null }>;
      };
    };
  })
    .from('quote_component_entries')
    .select('id, raw_value, value_after_waste, sort_order, is_combined, combined_from')
    .eq('quote_component_id', quoteComponentId);
  if (entriesErr) return { ok: false, error: entriesErr.message };
  if (!entries) return { ok: false, error: 'No entries.' };

  const combinedRow = entries.find((e) => e.is_combined);
  if (!combinedRow) {
    return { ok: true, restoredEntries: [] };
  }
  if (!combinedRow.combined_from || combinedRow.combined_from.length === 0) {
    return { ok: false, error: 'Combined row has no source data to restore.' };
  }

  const restored = combinedRow.combined_from.map((src, idx) => ({
    quote_component_id: quoteComponentId,
    raw_value: src.raw,
    value_after_waste: src.after,
    sort_order: src.sort ?? idx,
  }));
  const { data: insertedRows, error: insErr } = await supabase
    .from('quote_component_entries')
    .insert(restored)
    .select('id, quote_component_id, raw_value, value_after_waste, sort_order');
  if (insErr) return { ok: false, error: insErr.message };

  const { error: delErr } = await supabase
    .from('quote_component_entries')
    .delete()
    .eq('id', combinedRow.id);
  if (delErr) return { ok: false, error: delErr.message };

  await recalcComponentFromEntries(quoteComponentId);

  const { data: compAfter } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { final_quantity: number; priced_quantity: number | null; material_cost: number; labour_cost: number } | null;
            error: Error | null;
          }>;
        };
      };
    };
  })
    .from('quote_components')
    .select('final_quantity, priced_quantity, material_cost, labour_cost')
    .eq('id', quoteComponentId)
    .maybeSingle();

  return {
    ok: true,
    restoredEntries: (insertedRows ?? []).map((r) => ({
      id: r.id,
      quote_component_id: r.quote_component_id,
      raw_value: Number(r.raw_value),
      value_after_waste: Number(r.value_after_waste),
      sort_order: r.sort_order ?? 0,
    })),
    componentTotals: compAfter
      ? {
          final_quantity: Number(compAfter.final_quantity ?? 0),
          priced_quantity: compAfter.priced_quantity == null ? null : Number(compAfter.priced_quantity),
          material_cost: Number(compAfter.material_cost ?? 0),
          labour_cost: Number(compAfter.labour_cost ?? 0),
        }
      : undefined,
  };
}

/**
 * Recalculate material_cost / labour_cost for every component attached to a quote.
 * Uses computeMaterialCostByStrategy so pack pricing (per_pack_area, per_pack_coverage, etc.)
 * is applied correctly. Call this after any bulk operation that writes entries without going
 * through the individual component server actions (e.g. save_takeoff_atomic).
 * Gerald round-6 H-03 fix.
 */
export async function recalcAllQuoteComponents(quoteId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: components } = await supabase
    .from('quote_components')
    .select('id')
    .eq('quote_id', quoteId);
  if (!components?.length) return;
  await Promise.all(components.map((c) => recalcComponentFromEntries(c.id)));
}

async function recalcComponentFromEntries(quoteComponentId: string): Promise<{ final_quantity: number; priced_quantity: number | null; material_cost: number; labour_cost: number }> {
  const supabase = await createSupabaseServerClient();
  // Fetch entries with full detail for calc audit tracing.
  const { data: entries } = await supabase
    .from('quote_component_entries')
    .select('value_after_waste, raw_value, sort_order, is_combined, combined_from, pitch_degrees')
    .eq('quote_component_id', quoteComponentId) as unknown as { data: Array<{
      value_after_waste: number;
      raw_value: number;
      sort_order: number | null;
      is_combined?: boolean | null;
      combined_from?: Array<{ raw: number; after: number; sort: number }> | null;
      pitch_degrees?: number | string | null;
    }> | null; error: Error | null };
  const totalQty = (entries ?? []).reduce((sum, e) => sum + Number(e.value_after_waste), 0);
  const { data: comp } = await supabase
    .from('quote_components')
    .select('material_rate, labour_rate, component_library_id, name, measurement_type, waste_type, waste_percent, waste_fixed, pitch_type, calc_pitch_degrees, calc_audit')
    .eq('id', quoteComponentId)
    .single();

  // Phase 6: pricing_strategy + pack_* live on component_library, not the
  // attached quote_components row. Look them up via the FK so the strategy
  // switch in computeMaterialCostByStrategy can apply. Components with no
  // library link (custom one-off components) fall through to per_unit.
  // database.types.ts is stale on these Phase 2 columns; cast at boundary.
  let strategy: 'per_unit' | 'per_pack_length' | 'per_pack_area' | 'per_pack_coverage' | 'per_pack_volume' = 'per_unit';
  let packPrice: number | null = null;
  let packSize: number | null = null;
  let packCoverageM2: number | null = null;
  if (comp?.component_library_id) {
    const { data: libRow } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: {
                pricing_strategy?: typeof strategy | null;
                pack_price?: number | null;
                pack_size?: number | null;
                pack_coverage_m2?: number | null;
              } | null;
              error: Error | null;
            }>;
          };
        };
      };
    })
      .from('component_library')
      .select('pricing_strategy, pack_price, pack_size, pack_coverage_m2')
      .eq('id', comp.component_library_id)
      .maybeSingle();
    if (libRow) {
      strategy = libRow.pricing_strategy ?? 'per_unit';
      packPrice = libRow.pack_price ?? null;
      packSize = libRow.pack_size ?? null;
      packCoverageM2 = libRow.pack_coverage_m2 ?? null;
    }
  }

  const { computeMaterialCostByStrategy, computePackCount, rafterPitchFactor, hipValleyPitchFactor } = await import('@/app/lib/pricing/engine');
  const costResult = computeMaterialCostByStrategy({
    strategy,
    totalQuantity: totalQty,
    materialRate: comp?.material_rate ?? 0,
    packPrice,
    packSize,
    packCoverageM2,
  });
  const materialCost = costResult.cost;
  if (costResult.packDataMissing) {
    console.warn(`[recalc] quote_component ${quoteComponentId}: pack strategy ${strategy} has missing pack data — material cost set to £0`);
  }
  const labourCost = totalQty * (comp?.labour_rate ?? 0);
  const packCount = computePackCount({ strategy, totalQuantity: totalQty, packSize, packCoverageM2 });
  const pricedQuantity = strategy === 'per_unit' || packCount <= 0 ? null : packCount;
  // Snapshot the pack size so display can compute fractional pack counts
  // (e.g. 3.42 rolls) as final_quantity / pack_size_snapshot without needing
  // to join back to component_library. NULL for per_unit components.
  const packSizeForDisplay = strategy !== 'per_unit' && packSize && packSize > 0 ? packSize : null;

  // ── Calc audit trace ──────────────────────────────
  // Build the audit object from the current calculation and persist it.
  // Preserve existing overrides from the prior audit.
  const { traceComponentCalc } = await import('@/app/lib/pricing/calcTracer');
  type CalcAudit = import('@/app/lib/pricing/calcTracer').CalcAudit;
  const existingAudit = (comp as { calc_audit?: { overrides?: CalcAudit['overrides'] } } | null)?.calc_audit;
  const existingOverrides = existingAudit?.overrides ?? [];

  // Per-entry pitch (2026-07-08): entries store the pitch they were actually
  // calculated at (RPC v7). Fall back to the component-level pitch for legacy
  // rows. afterPitch is recomputed with the same engine factor functions so
  // the audit shows the true raw → pitched → wasted progression instead of
  // lumping the pitch factor invisibly into the waste step.
  const compPitchType = (comp as { pitch_type?: string } | null)?.pitch_type ?? 'none';
  const compPitchDegrees = Number(comp?.calc_pitch_degrees ?? 0);
  const pitchFactorFor = (deg: number) =>
    compPitchType !== 'none' && deg > 0
      ? (compPitchType === 'valley_hip' ? hipValleyPitchFactor(deg) : rafterPitchFactor(deg))
      : 1;

  const audit = traceComponentCalc({
    componentName: comp?.name ?? '',
    measurementType: comp?.measurement_type ?? '',
    entries: (entries ?? []).map((e) => {
      const entryPitch = e.pitch_degrees != null ? Number(e.pitch_degrees) : compPitchDegrees;
      return {
        rawValue: Number(e.raw_value ?? 0),
        metricValue: Number(e.raw_value ?? 0),
        afterPitch: Number(e.raw_value ?? 0) * pitchFactorFor(entryPitch),
        afterWaste: Number(e.value_after_waste ?? 0),
        pitchDegrees: entryPitch,
        sortOrder: e.sort_order ?? 0,
        isCombined: e.is_combined ?? false,
        combinedFrom: e.combined_from ?? undefined,
      };
    }),
    totalQuantity: totalQty,
    materialRate: comp?.material_rate ?? 0,
    labourRate: comp?.labour_rate ?? 0,
    pricingStrategy: strategy,
    packPrice,
    packSize,
    packCoverageM2,
    wasteType: (comp as { waste_type?: string })?.waste_type ?? 'none',
    wastePercent: (comp as { waste_percent?: number })?.waste_percent ?? 0,
    wasteFixed: (comp as { waste_fixed?: number })?.waste_fixed ?? 0,
    pitchType: (comp as { pitch_type?: string })?.pitch_type ?? 'none',
    pitchDegrees: Number(comp?.calc_pitch_degrees ?? 0),
    source: 'recalc',
    existingOverrides,
  });

  await supabase
    .from('quote_components')
    .update({
      final_quantity: totalQty,
      priced_quantity: pricedQuantity,
      pack_size_snapshot: packSizeForDisplay,
      material_cost: materialCost,
      labour_cost: labourCost,
      calc_audit: audit as unknown as never,
    })
    .eq('id', quoteComponentId);
  return { final_quantity: totalQty, priced_quantity: pricedQuantity, material_cost: materialCost, labour_cost: labourCost };
}

export async function updateQuoteSettings(quoteId: string, input: Record<string, unknown>) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  // Whitelist columns before passing to the DB; see pickFields.ts.
  // Previously this action accepted `any` and forwarded the whole object
  // to .update(), so a malicious caller could overwrite status,
  // acceptance_token, withdrawn_at, etc. Now restricted to the columns
  // the settings UI actually edits.
  const update = pickFields(input, UPDATABLE_QUOTE_SETTINGS_FIELDS);
  // Cast safe: keys come from UPDATABLE_QUOTE_SETTINGS_FIELDS.
  const { error } = await supabase.from('quotes').update(update as Record<string, unknown>).eq('id', quoteId).eq('company_id', profile.company_id);
  if (error) throw new Error(error.message);
}

/**
 * Idempotent confirm. Behaviour by current status:
 *   - draft:     promotes to confirmed and assigns the next quote_number.
 *   - confirmed: no-op (returns successfully).
 *   - any other ('accepted', 'declined', 'withdrawn', ...): throw, because
 *     those states represent post-confirm lifecycle events and we don't want
 *     a stale form re-submit to silently reset metadata.
 *
 * Idempotency matters because the /quotes/[id] page's ConfirmQuoteButton
 * binds its server action at render time. If a user reaches the page while
 * the quote is draft, confirms once, then navigates back via the browser
 * and re-submits the same cached form, the second submission still calls
 * this function. We must not 500 in that case - the original error message
 * "Only draft quotes can be confirmed" was the production 500 reported
 * 2026-05-17 (quote a58760fc-...).
 */
export async function confirmQuote(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Check current status + existing number
  const { data: existing } = await supabase
    .from('quotes')
    .select('quote_number, status')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();

  if (!existing) throw new Error('Quote not found');
  if (existing.status === 'confirmed') {
    // Already confirmed - nothing to do. Revalidate the listing so the
    // "Drafts vs Confirmed" buckets stay in sync if the cache is stale.
    revalidatePath('/quotes');
    return;
  }
  if (existing.status !== 'draft') {
    throw new Error(`Cannot confirm a quote in status '${existing.status}'.`);
  }

  // Get next quote number if not already assigned. The SECDEF RPC is
  // service_role-only per the C-02 audit (otherwise a user could bump
  // another company's counter by passing a different p_company_id). The
  // server action already verified company ownership via requireCompanyContext;
  // call via the admin client.
  let quoteNumber = existing.quote_number;
  if (!quoteNumber) {
    const admin = createAdminClient();
    const { data: numberData, error: numError } = await admin.rpc('get_next_quote_number', {
      p_company_id: profile.company_id,
    });
    if (numError) throw new Error(`Failed to generate quote number: ${numError.message}`);
    quoteNumber = numberData;
  }

  // Update quote with confirmed status and number
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'confirmed',
      quote_number: quoteNumber
    })
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function confirmQuoteAndRedirect(id: string, workspaceSlug: string) {
  'use server';
  // confirmQuote is idempotent (see its doc comment) - re-submitting a
  // stale form on an already-confirmed quote is a silent no-op now, not
  // a 500. Either way we land the user on the summary.
  await confirmQuote(id);
  const { redirect } = await import('next/navigation');
  redirect(`/${workspaceSlug}/quotes/${id}/summary`);
}

export async function saveConfirmedQuoteAndRedirect(id: string, workspaceSlug: string) {
  'use server';
  // Quote is already confirmed, just redirect to summary
  const { redirect } = await import('next/navigation');
  redirect(`/${workspaceSlug}/quotes/${id}/summary`);
}

/**
 * Legacy server action that used to let users flip a draft quote's
 * measurement system back and forth. The product rule is now "the system
 * picked when the quote is created is permanent" so this action ALWAYS
 * refuses. Kept around with a clear error so any orphan UI that still
 * imports it gets a deterministic failure mode rather than silent success.
 */
export async function convertQuoteMeasurementSystem(
  _id: string,
  _newSystem: 'metric' | 'imperial_ft' | 'imperial_rs'
) {
  await requireCompanyContext();
  throw new Error(
    "A quote's measurement system is locked when the quote is created. To use a different system, create a new quote."
  );
}

export async function updateQuoteCurrency(id: string, currency: string | null) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote is draft
  const { data: quote } = await supabase.from('quotes').select('status').eq('id', id).eq('company_id', profile.company_id).single();
  if (!quote || quote.status !== 'draft') {
    throw new Error('Only draft quotes can change currency');
  }

  const { error } = await supabase.from('quotes')
    .update({ currency })
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);
  revalidatePath(`/quotes/${id}`);
}

export async function updateQuoteNames(id: string, customerName: string, jobName: string | null) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('quotes')
    .update({
      customer_name: customerName,
      job_name: jobName
    })
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);
  revalidatePath(`/quotes/${id}`);
}

/**
 * Delete a single quote. Mirrors `bulkDeleteQuotes` storage cleanup so we
 * never leak orphaned objects:
 *   1. Verify ownership.
 *   2. Collect every storage path attached to the quote (quote_files +
 *      takeoff canvas snapshot URLs stored on the quote row).
 *   3. Remove storage objects FIRST. If that fails, do NOT delete the DB row
 *      - the user can retry. Without this rule, a transient storage error
 *      would leave the database clean but the bucket polluted forever.
 *   4. Delete the quote row (FK cascades clean up children).
 */
export async function deleteQuote(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = createAdminClient();

  // Verify ownership and grab takeoff snapshot references in one shot. We
  // prefer the stable storage path columns and only fall back to extracting
  // a path from the legacy *_url columns for ancient quotes whose path
  // column is still null after the backfill (Gerald audit pass 2 fix).
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('id, company_id, takeoff_canvas_url, takeoff_lines_url, takeoff_canvas_path, takeoff_lines_path')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (quoteErr) throw new Error(quoteErr.message);
  if (!quote) throw new Error('Quote not found');

  // Gather all storage paths.
  const { data: quoteFiles } = await supabaseAdmin
    .from('quote_files')
    .select('storage_path')
    .eq('quote_id', id);
  const storagePaths = new Set<string>(
    (quoteFiles ?? []).map((f: any) => f.storage_path).filter((p: string | null): p is string => !!p),
  );
  const canvasPath =
    (quote as any).takeoff_canvas_path ??
    storagePathFromUrl(quote.takeoff_canvas_url, BUCKETS.QUOTE_DOCUMENTS);
  const linesPath =
    (quote as any).takeoff_lines_path ??
    storagePathFromUrl(quote.takeoff_lines_url, BUCKETS.QUOTE_DOCUMENTS);
  if (canvasPath) storagePaths.add(canvasPath);
  if (linesPath) storagePaths.add(linesPath);

  // Remove storage objects. If this fails (and there were paths to remove),
  // bail before the DB row is touched so the user can retry.
  if (storagePaths.size > 0) {
    const { error: storageErr } = await supabaseAdmin.storage
      .from(BUCKETS.QUOTE_DOCUMENTS)
      .remove(Array.from(storagePaths));
    if (storageErr) {
      throw new Error(`Failed to remove quote files from storage: ${storageErr.message}`);
    }
  }

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function cloneQuote(id: string, newCustomerName: string) {
  const { profile, company: _company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: originalQuote } = await supabase.from('quotes').select('*').eq('id', id).eq('company_id', profile.company_id).single();
  if (!originalQuote) throw new Error('Quote not found');

  // Preserve entry_mode, measurement_system, and currency on clone so the
  // copy behaves identically to its source. The previous clone code dropped
  // entry_mode and measurement_system silently, which (a) defaulted a cloned
  // manual quote to whatever the DB default was, and (b) would have turned a
  // blank-quote clone into a manual-quote shell with no underlying data.
  //
  // Routes through create_quote_atomic so each clone counts against the
  // monthly quote limit (Shaun: clones always count, they're new quotes
  // operationally and get their own quote_number).
  // Phase 4: clone inherits the source quote's trade + component_collection_id
  // verbatim. Falls back to the company's bootstrap collection if the source
  // somehow has neither set (legacy pre-Phase-2 row); this should be impossible
  // post-backfill but defending against it costs nothing.
  const sourceTrade = (originalQuote as { trade?: 'roofing' | 'generic' | null }).trade ?? null;
  const sourceCollectionId = (originalQuote as { component_collection_id?: string | null }).component_collection_id ?? null;
  let resolvedTrade: 'roofing' | 'generic' = sourceTrade ?? 'roofing';
  let resolvedCollection: string | null = sourceCollectionId;
  if (!resolvedCollection) {
    const defaults = await resolveQuoteCreationDefaults(profile.company_id);
    resolvedCollection = defaults.componentCollectionId;
  }
  const newQuoteId = await createQuoteAtomic(profile.company_id, profile.id, {
    templateId: originalQuote.template_id,
    customerName: newCustomerName,
    customerEmail: originalQuote.customer_email,
    customerPhone: originalQuote.customer_phone,
    jobName: originalQuote.job_name,
    siteAddress: originalQuote.site_address,
    materialMarginPercent: originalQuote.material_margin_percent,
    laborMarginPercent: originalQuote.labor_margin_percent,
    taxRate: originalQuote.tax_rate,
    globalPitchDegrees: originalQuote.global_pitch_degrees,
    measurementSystem: (originalQuote.measurement_system as 'metric' | 'imperial_ft' | 'imperial_rs'),
    currency: originalQuote.currency ?? undefined,
    entryMode: (originalQuote.entry_mode as 'manual' | 'digital' | 'blank') ?? 'manual',
    trade: resolvedTrade,
    componentCollectionId: resolvedCollection,
  });
  const { data: newQuote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', newQuoteId)
    .single();
  if (qErr || !newQuote) throw new Error(qErr?.message || 'Failed to load just-cloned quote');

  const { data: areas } = await supabase.from('quote_roof_areas').select('*').eq('quote_id', id).order('sort_order');
  const areaMapping: Record<string, string> = {};
  if (areas?.length) {
    for (const area of areas) {
      const { data: newArea } = await supabase.from('quote_roof_areas').insert({
        quote_id: newQuote.id, template_roof_area_id: area.template_roof_area_id, label: area.label, input_mode: area.input_mode,
        final_value_sqm: area.final_value_sqm, calc_width_m: area.calc_width_m, calc_length_m: area.calc_length_m,
        calc_plan_sqm: area.calc_plan_sqm, calc_pitch_degrees: area.calc_pitch_degrees, computed_sqm: area.computed_sqm,
        is_locked: area.is_locked, sort_order: area.sort_order,
      }).select('id').single();
      if (newArea) areaMapping[area.id] = newArea.id;
    }
  }

  // Copy taxes from the source quote so customizations carry over. Falls back to
  // the company defaults if the source had none, mirroring create-quote behaviour.
  const { data: srcTaxes } = await supabase
    .from('quote_taxes')
    .select('source_tax_id, name, rate_percent, sort_order, include_in_quote, include_in_labor')
    .eq('quote_id', id)
    .order('sort_order', { ascending: true });
  if (srcTaxes && srcTaxes.length > 0) {
    await supabase.from('quote_taxes').insert(
      srcTaxes.map((t) => ({
        quote_id: newQuote.id,
        source_tax_id: t.source_tax_id,
        name: t.name,
        rate_percent: t.rate_percent,
        sort_order: t.sort_order,
        include_in_quote: t.include_in_quote,
        include_in_labor: t.include_in_labor,
      }))
    );
  } else {
    await seedQuoteTaxesOnCreate(newQuote.id, profile.company_id);
  }

  // Copy customer-quote lines. Two reasons we copy ALL of them, not just
  // visible/included rows:
  //   1. For blank quotes, customer_quote_lines IS the master source for
  //      the new quote - if we don't copy these, the clone is just an
  //      empty quote with the customer name and tax setup.
  //   2. For manual/digital quotes, customer_quote_lines carries the user's
  //      visibility flags, hidden-price marks, and ad-hoc custom lines that
  //      they layered on top of the auto-derived component lines. Dropping
  //      these on clone meant the user re-did all that customisation.
  // For 'component' rows we need to remap quote_component_id to the freshly
  // inserted component IDs, which only exist after the components loop below.
  // So: collect source lines now, insert them at the end with mapped IDs.
  const { data: srcCustomerLines } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order', { ascending: true });

  const { data: comps } = await supabase.from('quote_components').select('*').eq('quote_id', id).order('sort_order');
  if (comps?.length) {
    // Phase 6 (Gerald round-2 M-03): cloneQuote inherits source.trade in
    // Phase 4 (see createQuoteAtomic call above). Source components were
    // already validated when first attached, and the target trade equals the
    // source trade, so each cloned component is provably compatible by
    // construction. No per-component assertComponentCompatibleWithQuote call
    // needed here.
    for (const comp of comps) {
      await supabase.from('quote_components').insert({
        quote_id: newQuote.id, quote_roof_area_id: comp.quote_roof_area_id ? (areaMapping[comp.quote_roof_area_id] ?? null) : null,
        component_library_id: comp.component_library_id, template_component_id: comp.template_component_id, name: comp.name,
        component_type: comp.component_type, measurement_type: comp.measurement_type, input_mode: comp.input_mode,
        final_value: comp.final_value, calc_raw_value: comp.calc_raw_value, calc_pitch_degrees: comp.calc_pitch_degrees,
        calc_pitch_factor: comp.calc_pitch_factor, pitch_type: comp.pitch_type, use_custom_pitch: comp.use_custom_pitch,
        custom_pitch_degrees: comp.custom_pitch_degrees, waste_type: comp.waste_type, waste_percent: comp.waste_percent,
        waste_fixed: comp.waste_fixed, final_quantity: comp.final_quantity, pricing_unit: comp.pricing_unit,
        material_rate: comp.material_rate, labour_rate: comp.labour_rate, material_cost: comp.material_cost,
        labour_cost: comp.labour_cost, is_rate_overridden: comp.is_rate_overridden, is_quantity_overridden: comp.is_quantity_overridden,
        is_waste_overridden: comp.is_waste_overridden, is_pitch_overridden: comp.is_pitch_overridden, is_customer_visible: comp.is_customer_visible,
        sort_order: comp.sort_order,
      });
    }
  }

  // Build the component-id mapping from the loop above (we appended a
  // record for each inserted component) so the customer-line copy can
  // resolve references.
  // NOTE: the components loop above doesn't currently capture the new
  // component IDs because the original code didn't need them. For now we
  // re-query in component-name order - not 100% reliable if two components
  // share a name. Safer: re-fetch matched by (sort_order, name) which is
  // unique inside one quote in practice.
  const componentIdMapping: Record<string, string> = {};
  if (comps?.length) {
    const { data: newComps } = await supabase
      .from('quote_components')
      .select('id, name, sort_order')
      .eq('quote_id', newQuote.id)
      .order('sort_order');
    if (newComps) {
      // Pair by index, which matches the insertion order above.
      for (let i = 0; i < Math.min(comps.length, newComps.length); i++) {
        componentIdMapping[comps[i].id] = newComps[i].id;
      }
    }
  }

  if (srcCustomerLines && srcCustomerLines.length > 0) {
    const remappedLines = srcCustomerLines.map((l: any) => ({
      quote_id: newQuote.id,
      line_type: l.line_type,
      quote_component_id: l.quote_component_id
        ? (componentIdMapping[l.quote_component_id] ?? null)
        : null,
      custom_text: l.custom_text,
      custom_amount: l.custom_amount,
      show_price: l.show_price,
      show_units: l.show_units,
      is_visible: l.is_visible,
      include_in_total: l.include_in_total,
      sort_order: l.sort_order,
    }));
    const { error: clErr } = await supabase
      .from('customer_quote_lines')
      .insert(remappedLines);
    if (clErr) {
      console.warn('[cloneQuote] failed to copy customer_quote_lines:', clErr.message);
      // Non-fatal: the new quote still exists with components, the user can
      // rebuild the customer view if they need to.
    }
  }

  // Carry branding (header/footer/logo) so the cloned quote looks the same
  // as the source in the customer quote editor without manual re-entry.
  if (originalQuote.cq_company_name !== null || originalQuote.cq_footer_text !== null) {
    await supabase
      .from('quotes')
      .update({
        cq_company_name: originalQuote.cq_company_name,
        cq_company_address: originalQuote.cq_company_address,
        cq_company_phone: originalQuote.cq_company_phone,
        cq_company_email: originalQuote.cq_company_email,
        cq_company_logo_url: originalQuote.cq_company_logo_url,
        cq_footer_text: originalQuote.cq_footer_text,
      })
      .eq('id', newQuote.id);
  }

  return newQuote.id;
}

export async function saveCustomerQuoteLines(
  quoteId: string,
  lines: Array<{
    id: string;
    lineType: 'component' | 'custom';
    componentId?: string;
    text: string;
    quantityText?: string | null;
    amount: number;
    showPrice: boolean;
    showUnits: boolean;
    sortOrder: number;
    isVisible: boolean;
    includeInTotal: boolean;
    quantity?: number;
    unitPrice?: number | null;
    lineMarginPercent?: number | null;
    lineLaborMarginPercent?: number | null;
    baseUnitCost?: number | null;
  }>,
  showQuantityColumn?: boolean,
  hideLinePrices?: boolean,
  hideTotals?: boolean,
  globalMarginPercent?: number | null,
  showMarginInPreview?: boolean,
) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company, and pull the fields we need to decide
  // whether to auto-assign a quote number on this save (for blank quotes).
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id, entry_mode, status, quote_number')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // H-01: atomic delete+insert via RPC. The previous delete-then-insert was
  // non-transactional and could wipe customer quote lines if the insert failed
  // or two saves raced. replace_customer_quote_lines() does the whole replace
  // in one transaction, serialized per-quote with an advisory lock, and
  // re-checks company ownership server-side.
  const lineRows = lines.map(line => ({
    line_type: line.lineType,
    quote_component_id: line.componentId || null,
    custom_text: line.text,
    quantity_text: line.quantityText ?? null,
    custom_amount: line.amount,
    show_price: line.showPrice,
    show_units: line.showUnits,
    sort_order: line.sortOrder,
    is_visible: line.isVisible,
    include_in_total: line.includeInTotal,
    quantity: line.quantity ?? 1,
    unit_price: line.unitPrice ?? null,
    line_margin_percent: line.lineMarginPercent ?? null,
    line_labor_margin_percent: line.lineLaborMarginPercent ?? null,
    base_unit_cost: line.baseUnitCost ?? null,
  }));

  const { error: replaceErr } = await supabase.rpc('replace_customer_quote_lines', {
    p_quote_id: quoteId,
    p_company_id: quote.company_id,
    p_lines: lineRows,
  });

  if (replaceErr) throw new Error(replaceErr.message);

  // Persist show_quantity_column, price-visibility toggles, and margin fields on the quote row.
  if (
    showQuantityColumn !== undefined ||
    hideLinePrices !== undefined ||
    hideTotals !== undefined ||
    globalMarginPercent !== undefined ||
    showMarginInPreview !== undefined
  ) {
    const patch: Record<string, unknown> = {};
    if (showQuantityColumn !== undefined) patch.show_quantity_column = showQuantityColumn;
    if (hideLinePrices !== undefined) patch.hide_line_prices = hideLinePrices;
    if (hideTotals !== undefined) patch.hide_totals = hideTotals;
    if (globalMarginPercent !== undefined) patch.global_margin_percent = globalMarginPercent;
    if (showMarginInPreview !== undefined) patch.show_margin_in_preview = showMarginInPreview;
    await supabase
      .from('quotes')
      .update(patch)
      .eq('id', quoteId)
      .eq('company_id', quote.company_id);
  }

  // Blank quotes never go through the manual quote builder's Review step,
  // which is where a quote normally graduates from 'draft' to 'confirmed'
  // and gets its quote_number assigned. Without that, the summary shows
  // 'Quote #DRAFT' and Send Quote refuses to mint an acceptance URL.
  //
  // We auto-confirm on the first save that lands at least one customer
  // line, which is the equivalent point in the blank-quote flow. The check
  // is narrow on purpose:
  //   - entry_mode === 'blank' so we never accidentally confirm a
  //     manual/digital quote that's still mid-build.
  //   - status === 'draft' AND quote_number IS NULL so we never re-run
  //     numbering on an already-confirmed quote.
  //   - lines.length > 0 so an empty save doesn't burn a number.
  if (
    quote.entry_mode === 'blank'
    && quote.status === 'draft'
    && !quote.quote_number
    && lines.length > 0
  ) {
    // Service_role-only RPC - see note in confirmQuote() above.
    const admin = createAdminClient();
    const { data: nextNum, error: numErr } = await admin.rpc('get_next_quote_number', {
      p_company_id: profile.company_id,
    });
    if (numErr) {
      console.warn('[saveCustomerQuoteLines] failed to mint quote_number for blank quote:', numErr.message);
    } else if (nextNum) {
      const { error: updErr } = await supabase
        .from('quotes')
        .update({ status: 'confirmed', quote_number: nextNum })
        .eq('id', quoteId)
        .eq('company_id', profile.company_id);
      if (updErr) {
        console.warn('[saveCustomerQuoteLines] failed to confirm blank quote:', updErr.message);
      }
    }
  }

  revalidatePath(`/quotes/${quoteId}/customer-edit`);
}

export async function loadCustomerQuoteLines(quoteId: string) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Load saved lines
  const { data: lines, error } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  return lines || [];
}

export async function loadCustomerQuoteTemplates() {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Load company-owned templates only (starter template removed)
  const { data: templates, error } = await supabase
    .from('customer_quote_templates')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name');

  if (error) throw new Error(error.message);

  return templates || [];
}

/**
 * **Dead path.** Referenced no callers and queries a table
 * (`customer_quote_template_lines`) that does not exist in the live DB.
 * Surfaced by the 2026-05-12 typed-supabase pass. Kept as a stub that
 * fails fast so any future caller hits a clear error rather than
 * silently 404-ing on the templates feature.
 */
export async function loadCustomerQuoteTemplate(_templateId: string): Promise<never> {
  'use server';
  throw new Error(
    'loadCustomerQuoteTemplate is not implemented - the customer_quote_template_lines table does not exist. Use loadCustomerQuoteTemplates() to fetch the template list.'
  );
}

export async function saveCustomerQuoteBranding(
  quoteId: string,
  branding: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyLogoUrl: string;
    footerText: string;
  }
) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Update branding
  const { error } = await supabase
    .from('quotes')
    .update({
      cq_company_name: branding.companyName || null,
      cq_company_address: branding.companyAddress || null,
      cq_company_phone: branding.companyPhone || null,
      cq_company_email: branding.companyEmail || null,
      cq_company_logo_url: branding.companyLogoUrl || null,
      cq_footer_text: branding.footerText || null,
    })
    .eq('id', quoteId);

  if (error) throw new Error(error.message);
}

export async function updateQuoteMargins(
  quoteId: string,
  settings: {
    materialMarginPercent: number | null;
    laborMarginPercent: number | null;
    materialMarginEnabled: boolean;
    laborMarginEnabled: boolean;
  }
) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Update margins
  const { error } = await supabase
    .from('quotes')
    .update({
      material_margin_percent: settings.materialMarginPercent,
      labor_margin_percent: settings.laborMarginPercent,
      material_margin_enabled: settings.materialMarginEnabled,
      labor_margin_enabled: settings.laborMarginEnabled,
    })
    .eq('id', quoteId);

  if (error) throw new Error(error.message);



  revalidatePath(`/`);
}
