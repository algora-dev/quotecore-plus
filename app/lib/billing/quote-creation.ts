/**
 * Atomic quote creation gateway.
 *
 * This is the ONLY way the app should create rows in the `quotes` table.
 * Wraps the `public.create_quote_atomic(uuid, uuid, jsonb)` RPC, which
 * (under an advisory lock per company-per-month):
 *
 *   1. Verifies the company exists.
 *   2. Verifies the company's effective subscription is active.
 *   3. Verifies the company has quota left this month (monthly_quote_limit
 *      from the effective plan).
 *   4. Inserts the quote with whitelisted columns from the payload.
 *   5. Increments company_quote_usage atomically.
 *
 * All in one transaction. Either the quote exists AND the counter ticked,
 * or neither happened.
 *
 * Why an RPC, not application-layer enforcement: there are four entry points
 * (createQuoteWithDetails, createQuoteFromTemplate, createBlankQuote,
 * cloneQuote). Each previously did its own quotes.insert. A pre-check
 * pattern at the app layer would have been raceable and one missing call
 * site would have become a paid-feature bypass. See subscription-tiers-
 * brief.md \u00a76 for the design rationale (Gerald audit H-02).
 *
 * Clones DO count against the monthly limit per Shaun's call: each clone
 * gets its own quote_number and counts as a new quote operationally.
 */

import 'server-only';

import type { Json } from '@/app/lib/supabase/database.types';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  QuoteLimitReachedError,
  SubscriptionInactiveError,
} from './errors';
import { loadCompanyEntitlements } from './entitlements';

/**
 * Payload accepted by create_quote_atomic. Only these columns are projected
 * server-side into the `quotes` insert; anything else is silently dropped.
 * If you need to set a new column at creation time, also widen the SQL
 * function's VALUES list (see 20260515160000_subscription_tiers_phase1.sql).
 */
export interface CreateQuotePayload {
  templateId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  jobName?: string | null;
  siteAddress?: string | null;
  taxRate?: number;
  notesInternal?: string | null;
  globalPitchDegrees?: number | null;
  measurementSystem?: 'metric' | 'imperial_ft' | 'imperial_rs';
  cqCompanyName?: string | null;
  cqCompanyAddress?: string | null;
  cqCompanyPhone?: string | null;
  cqCompanyEmail?: string | null;
  cqCompanyLogoUrl?: string | null;
  cqFooterText?: string | null;
  currency?: string;
  entryMode?: 'manual' | 'digital' | 'blank';
  materialMarginPercent?: number | null;
  laborMarginPercent?: number | null;
  materialMarginEnabled?: boolean;
  laborMarginEnabled?: boolean;
}

/**
 * Atomically create a quote. Throws QuoteLimitReachedError or
 * SubscriptionInactiveError on policy refusals; throws a generic Error on
 * unexpected DB failures. Returns the new quote id.
 *
 * Callers should generally NOT catch these errors here \u2014 let them bubble
 * to the server action's outer try/catch where they get converted to a
 * structured `{ ok: false, code, ... }` response.
 *
 * Uses the admin client because the RPC is SECURITY DEFINER (so it can
 * touch subscription_plans / company_quote_usage regardless of caller),
 * AND because some callers (template clone, etc.) need to write related
 * rows in the same logical operation under the same security boundary.
 */
export async function createQuoteAtomic(
  companyId: string,
  userId: string,
  payload: CreateQuotePayload,
): Promise<string> {
  // Build the jsonb payload that create_quote_atomic projects from.
  // Field names mirror the column names exactly so the SQL function can
  // pluck them with p_payload->>'<column_name>'.
  // Typed as Json so the supabase-js RPC call accepts it without an `as`.
  const jsonbPayload: { [k: string]: Json } = {
    template_id: payload.templateId ?? null,
    customer_name: payload.customerName,
    customer_email: payload.customerEmail ?? null,
    customer_phone: payload.customerPhone ?? null,
    job_name: payload.jobName ?? null,
    site_address: payload.siteAddress ?? null,
    tax_rate: payload.taxRate ?? 0,
    notes_internal: payload.notesInternal ?? null,
    global_pitch_degrees: payload.globalPitchDegrees ?? null,
    measurement_system: payload.measurementSystem ?? 'metric',
    cq_company_name: payload.cqCompanyName ?? null,
    cq_company_address: payload.cqCompanyAddress ?? null,
    cq_company_phone: payload.cqCompanyPhone ?? null,
    cq_company_email: payload.cqCompanyEmail ?? null,
    cq_company_logo_url: payload.cqCompanyLogoUrl ?? null,
    cq_footer_text: payload.cqFooterText ?? null,
    currency: payload.currency ?? 'NZD',
    entry_mode: payload.entryMode ?? 'manual',
    material_margin_percent: payload.materialMarginPercent ?? null,
    labor_margin_percent: payload.laborMarginPercent ?? null,
    material_margin_enabled: payload.materialMarginEnabled ?? false,
    labor_margin_enabled: payload.laborMarginEnabled ?? false,
  } satisfies { [k: string]: Json };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('create_quote_atomic', {
    p_company_id: companyId,
    p_user_id: userId,
    p_payload: jsonbPayload,
  });

  if (error) {
    // Map Postgres SQLSTATE codes back to typed billing errors. These codes
    // are defined in the RPC body itself (see migration \u00a79).
    //
    // P0001 = subscription_inactive
    // P0002 = quote_limit_reached (with DETAIL: used=N limit=N period_start=Y-m-d plan=...)
    // P0003 = unknown_company  /  plan_not_found
    //
    // PostgREST surfaces these via error.code, error.message, error.details.
    const code = (error as { code?: string }).code;
    if (code === 'P0001') {
      // Look up the current status for the error payload. Cheap; runs only
      // on the refusal path.
      const ent = await loadCompanyEntitlements(companyId).catch(() => null);
      throw new SubscriptionInactiveError(ent?.subscriptionStatus ?? 'unknown');
    }
    if (code === 'P0002') {
      // Parse the DETAIL string for used/limit/period/plan. Format:
      //   "used=N limit=N period_start=Y-m-d plan=<code>"
      const detail = (error as { details?: string }).details ?? '';
      const used = Number(detail.match(/used=(\d+)/)?.[1] ?? 0);
      const limit = Number(detail.match(/limit=(\d+)/)?.[1] ?? 0);
      const periodStart = detail.match(/period_start=(\S+)/)?.[1] ?? '';
      const planCode = detail.match(/plan=(\S+)/)?.[1] ?? 'unknown';
      throw new QuoteLimitReachedError({ used, limit, periodStart, planCode });
    }
    if (code === 'P0003') {
      throw new Error(`Unknown company or plan in create_quote_atomic: ${error.message}`);
    }
    throw new Error(`create_quote_atomic failed: ${error.message}`);
  }

  if (!data) {
    throw new Error('create_quote_atomic returned no quote id');
  }

  return data as string;
}

/**
 * Convenience helper for callers that already have a Supabase server client
 * open and want to refresh their copy of the just-created row. Reads the
 * `quotes` row by id WITH the caller's RLS so ownership is asserted.
 */
export async function refetchQuoteRow(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? `Quote ${quoteId} not found after atomic create.`);
  }
  return data;
}
