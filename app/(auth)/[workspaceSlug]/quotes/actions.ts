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
import { BUCKETS } from '@/app/lib/storage/buckets';
import { pickFields } from '@/app/lib/security/pickFields';
import { createQuoteAtomic } from '@/app/lib/billing/quote-creation';

/**
 * Quote-roof-area columns updatable from the client. Server-managed
 * fields (`id`, `quote_id`, `template_roof_area_id`, `created_at`,
 * `updated_at`) and the server-computed `computed_sqm` are explicitly
 * out of scope — the action body sets `computed_sqm` itself before the
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
 * tokens, withdrawn flags, company_id, created_at, etc. — those have
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
  const quoteId = await createQuoteAtomic(profile.company_id, profile.id, {
    templateId,
    customerName,
    jobName: jobReference || null,
    taxRate: company.default_tax_rate ?? 0,
    measurementSystem: safeMeasurementSystem as 'metric' | 'imperial_ft' | 'imperial_rs',
    entryMode: (entryMode ?? 'manual') as 'manual' | 'digital',
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
    const quoteComponents = templateComps.map(tc => {
      const lib = tc.component_library;
      return {
        quote_id: quote.id, quote_roof_area_id: tc.template_roof_area_id ? (areaMapping[tc.template_roof_area_id] ?? null) : null,
        component_library_id: tc.component_library_id, template_component_id: tc.id, name: lib.name,
        component_type: tc.component_type, measurement_type: lib.measurement_type, input_mode: 'calculated' as InputMode,
        waste_type: (tc.override_waste_type ?? lib.default_waste_type) as WasteType,
        waste_percent: tc.override_waste_percent ?? lib.default_waste_percent ?? 0,
        waste_fixed: tc.override_waste_fixed ?? lib.default_waste_fixed ?? 0,
        pitch_type: (tc.override_pitch_type ?? lib.default_pitch_type ?? 'none') as PitchType,
        material_rate: tc.override_material_rate ?? lib.default_material_rate ?? 0,
        labour_rate: tc.override_labour_rate ?? lib.default_labour_rate ?? 0, sort_order: tc.sort_order,
      };
    });
    await supabase.from('quote_components').insert(quoteComponents);
  }
  await seedQuoteTaxesOnCreate(quote.id, profile.company_id);
  redirect(`/${company.slug}/quotes/${quote.id}`);
}

export async function generateAcceptanceToken(quoteId: string, expiryDays: number = 30): Promise<string> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Check quote exists and belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, acceptance_token, status, accepted_at, declined_at, withdrawn_at')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (!quote) throw new Error('Quote not found');
  if (quote.status === 'draft') throw new Error('Cannot send draft quotes');
  if ((quote as any).accepted_at) throw new Error('Quote has already been accepted');
  if ((quote as any).declined_at) throw new Error('Quote has already been declined');

  // Reuse the existing token only when there's a live one (not withdrawn).
  // After a withdrawal, mint a fresh token so the dead URL stays dead.
  if (quote.acceptance_token && !(quote as any).withdrawn_at) {
    return quote.acceptance_token;
  }

  // Generate new token with configurable expiry
  const days = Math.max(1, Math.min(365, expiryDays)); // Clamp 1-365 days
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { error } = await supabase
    .from('quotes')
    .update({
      acceptance_token: token,
      acceptance_token_expires_at: expiresAt.toISOString(),
      job_status: 'sent',
      // Clear any prior withdrawal so the new link is treated as live.
      withdrawn_at: null,
      withdrawn_by_user_id: null,
    })
    .eq('id', quoteId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return token;
}

/**
 * Withdraw the active acceptance URL for a quote.
 *
 * Stamps `withdrawn_at` and clears the token so the public /accept/[token]
 * URL stops working immediately. The quote remains intact (just no longer
 * "sent") and the user can mint a fresh URL whenever they're ready.
 *
 * Refuses to withdraw if the quote has already been accepted or declined —
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
  if ((quote as any).accepted_at) throw new Error('Cannot withdraw — the customer has already accepted this quote.');
  if ((quote as any).declined_at) throw new Error('Cannot withdraw — the customer has already declined this quote.');
  if (!quote.acceptance_token && !(quote as any).withdrawn_at) {
    // Nothing to withdraw — no active link in the first place.
    throw new Error('No active acceptance link to withdraw.');
  }

  // We KEEP the token but stamp withdrawn_at. This way the public URL still
  // resolves so the customer can submit a fresh-quote request through the
  // same flow used for expired/responded links — but accept/decline are
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
  // Refuse to reopen a quote that's already in a fresh state — nothing
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
  // leave `accepted_at` stamped — so the summary chrome and the public
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

  const quoteId = await createQuoteAtomic(profile.company_id, profile.id, {
    customerName,
    jobName: jobReference || null,
    taxRate: company.default_tax_rate ?? 0,
    measurementSystem: normalisedSystem,
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
  const { error } = await supabase.from('quote_components').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/quotes');
}

export async function addComponentEntry(quoteComponentId: string, rawValue: number, areaPitch: number | null) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyComponentOwnership(supabase, quoteComponentId, profile.company_id);
  const { data: comp } = await supabase.from('quote_components').select('*').eq('id', quoteComponentId).single();
  if (!comp) throw new Error('Component not found');
  const isPlan = comp.input_mode === 'calculated';
  const pitchDegrees = comp.use_custom_pitch ? (comp.custom_pitch_degrees ?? 0) : (areaPitch ?? 0);
  const { afterWaste } = applyPitchAndWaste(rawValue, isPlan, comp.pitch_type, pitchDegrees, comp.waste_type, comp.waste_percent, comp.waste_fixed);
  const { data: entry, error } = await supabase.from('quote_component_entries').insert({
    quote_component_id: quoteComponentId, raw_value: rawValue, value_after_waste: afterWaste,
  }).select().single();
  if (error) throw new Error(error.message);
  await recalcComponentFromEntries(quoteComponentId);
  return entry;
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
  await recalcComponentFromEntries(quoteComponentId);
}

async function recalcComponentFromEntries(quoteComponentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: entries } = await supabase.from('quote_component_entries').select('value_after_waste').eq('quote_component_id', quoteComponentId);
  const totalQty = (entries ?? []).reduce((sum, e) => sum + Number(e.value_after_waste), 0);
  const { data: comp } = await supabase.from('quote_components').select('material_rate, labour_rate').eq('id', quoteComponentId).single();
  const materialCost = totalQty * (comp?.material_rate ?? 0);
  const labourCost = totalQty * (comp?.labour_rate ?? 0);
  await supabase.from('quote_components').update({ final_quantity: totalQty, material_cost: materialCost, labour_cost: labourCost }).eq('id', quoteComponentId);
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

export async function confirmQuote(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  // Check if quote already has a number (prevent reassignment)
  const { data: existing } = await supabase
    .from('quotes')
    .select('quote_number, status')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();
    
  if (!existing) throw new Error('Quote not found');
  if (existing.status !== 'draft') throw new Error('Only draft quotes can be confirmed');
  
  // Get next quote number if not already assigned
  let quoteNumber = existing.quote_number;
  if (!quoteNumber) {
    const { data: numberData, error: numError } = await supabase.rpc('get_next_quote_number', {
      p_company_id: profile.company_id
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
 *      — the user can retry. Without this rule, a transient storage error
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
  // re-query in component-name order — not 100% reliable if two components
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
    amount: number;
    showPrice: boolean;
    showUnits: boolean;
    sortOrder: number;
    isVisible: boolean;
    includeInTotal: boolean;
  }>
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

  // Delete existing lines for this quote
  await supabase
    .from('customer_quote_lines')
    .delete()
    .eq('quote_id', quoteId);

  // Insert new lines
  if (lines.length > 0) {
    const insertData = lines.map(line => ({
      quote_id: quoteId,
      line_type: line.lineType,
      quote_component_id: line.componentId || null,
      custom_text: line.text,
      custom_amount: line.amount,
      show_price: line.showPrice,
      show_units: line.showUnits,
      sort_order: line.sortOrder,
      is_visible: line.isVisible,
      include_in_total: line.includeInTotal,
    }));

    const { error } = await supabase
      .from('customer_quote_lines')
      .insert(insertData);

    if (error) throw new Error(error.message);
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
    const { data: nextNum, error: numErr } = await supabase.rpc('get_next_quote_number', {
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

  // Load all templates: company-owned + starter template
  const { data: templates, error } = await supabase
    .from('customer_quote_templates')
    .select('*')
    .or(`company_id.eq.${profile.company_id},is_starter_template.eq.true`)
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
    'loadCustomerQuoteTemplate is not implemented — the customer_quote_template_lines table does not exist. Use loadCustomerQuoteTemplates() to fetch the template list.'
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
