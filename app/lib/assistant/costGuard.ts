/**
 * AI Assistant — Cost / Token-Budget Guard (Phase 0A interface)
 * ==============================================================
 *
 * Enforces per-user and per-company token ceilings (config.ts COST_LIMITS) so
 * the assistant can never run away with spend (Gerald review H-02). This file
 * defines the CONTRACT and a fail-closed default in Phase 0A.
 *
 * The persistent token-accounting store is the `assistant_token_usage` table
 * (Phase 0B migration `20260603100000`). It is service-role only. This module
 * reads/writes it via a service client. If accounting is structurally
 * unavailable (e.g. missing service env) we fail CLOSED — refuse rather than
 * spend blind. When the assistant flag is OFF, the endpoint never reaches here.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { COST_LIMITS } from './config';

let cachedClient: ReturnType<typeof createServiceClient<Database>> | null = null;
function getClient() {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // accounting unavailable -> callers fail closed
  cachedClient = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
}

export interface CostGuardInput {
  userId: string;
  companyId: string;
}

export interface CostGuardResult {
  allowed: boolean;
  /** Which ceiling was hit, if any. */
  exceeded?: 'dailyUser' | 'dailyCompany' | 'monthlyCompany';
  /** True when accounting is unavailable and we failed closed. */
  failedClosed?: boolean;
}

/**
 * Check whether the caller is under all token ceilings BEFORE running a turn.
 * Pre-turn check uses already-recorded usage; the turn's own tokens are
 * recorded afterward via {@link recordTokenUsage}.
 */
export async function checkCostBudget(
  input: CostGuardInput
): Promise<CostGuardResult> {
  let usage: UsageSnapshot;
  try {
    const snapshot = await queryUsage(input);
    if (!snapshot) return { allowed: false, failedClosed: true };
    usage = snapshot;
  } catch {
    // Cannot prove we're under budget -> refuse.
    return { allowed: false, failedClosed: true };
  }

  if (usage.dailyUserTokens >= COST_LIMITS.dailyTokensPerUser) {
    return { allowed: false, exceeded: 'dailyUser' };
  }
  if (usage.dailyCompanyTokens >= COST_LIMITS.dailyTokensPerCompany) {
    return { allowed: false, exceeded: 'dailyCompany' };
  }

  // Per-plan monthly token budget (Pricing Tier v2). Reads the effective
  // plan's `monthly_ai_tokens`. NULL = unlimited (premium); a missing
  // lookup falls back to the flat COST_LIMITS ceiling so a DB blip never
  // grants unlimited spend. Free 600k / Trial 1M / Starter 1.5M / Pro 3M.
  const monthlyCap = await resolveMonthlyTokenCap(input.companyId);
  if (monthlyCap !== null && usage.monthlyCompanyTokens >= monthlyCap) {
    return { allowed: false, exceeded: 'monthlyCompany' };
  }

  return { allowed: true };
}

/**
 * Resolve the company's effective per-plan monthly AI-token cap.
 *   - Returns the plan's `monthly_ai_tokens` when set.
 *   - Returns `null` (= unlimited) when the plan column is NULL (premium).
 *   - Falls back to the flat `COST_LIMITS.monthlyTokensPerCompany` when the
 *     lookup is unavailable, so we never accidentally grant unlimited spend.
 */
async function resolveMonthlyTokenCap(companyId: string): Promise<number | null> {
  const supabase = getClient();
  if (!supabase) return COST_LIMITS.monthlyTokensPerCompany;
  try {
    const { data: code, error: codeErr } = await supabase.rpc(
      'company_effective_plan_code',
      { p_company_id: companyId },
    );
    if (codeErr || !code) return COST_LIMITS.monthlyTokensPerCompany;

    const { data: plan, error: planErr } = await supabase
      .from('subscription_plans')
      .select('monthly_ai_tokens')
      .eq('code', code as string)
      .maybeSingle();
    if (planErr || !plan) return COST_LIMITS.monthlyTokensPerCompany;

    // Column NULL => unlimited.
    const cap = (plan as { monthly_ai_tokens: number | null }).monthly_ai_tokens;
    return cap === null ? null : cap;
  } catch {
    return COST_LIMITS.monthlyTokensPerCompany;
  }
}

interface UsageSnapshot {
  dailyUserTokens: number;
  dailyCompanyTokens: number;
  monthlyCompanyTokens: number;
}

/**
 * Read current token usage from `assistant_token_usage`. Returns null when the
 * service client is unavailable (caller then fails closed).
 */
async function queryUsage(
  input: CostGuardInput
): Promise<UsageSnapshot | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const today = utcDay();
  const month = monthKey();

  // Today's per-user + per-company rows.
  const { data: dayRows, error: dayErr } = await supabase
    .from('assistant_token_usage')
    .select('user_id, total_tokens')
    .eq('company_id', input.companyId)
    .eq('usage_date', today);
  if (dayErr) throw dayErr;

  // Month-to-date company total.
  const { data: monthRows, error: monthErr } = await supabase
    .from('assistant_token_usage')
    .select('total_tokens')
    .eq('company_id', input.companyId)
    .eq('month_key', month);
  if (monthErr) throw monthErr;

  const dailyUserTokens = (dayRows ?? [])
    .filter((r) => r.user_id === input.userId)
    .reduce((sum, r) => sum + Number(r.total_tokens ?? 0), 0);
  const dailyCompanyTokens = (dayRows ?? []).reduce(
    (sum, r) => sum + Number(r.total_tokens ?? 0),
    0
  );
  const monthlyCompanyTokens = (monthRows ?? []).reduce(
    (sum, r) => sum + Number(r.total_tokens ?? 0),
    0
  );

  return { dailyUserTokens, dailyCompanyTokens, monthlyCompanyTokens };
}

/**
 * Record the tokens a completed turn consumed. Upserts the (company,user,day)
 * row, incrementing total_tokens. Best-effort: logs and swallows errors so a
 * recording blip never breaks the user's turn (the pre-turn check is the gate).
 */
export async function recordTokenUsage(
  input: CostGuardInput & { totalTokens: number }
): Promise<void> {
  const supabase = getClient();
  if (!supabase || input.totalTokens <= 0) return;

  const today = utcDay();
  const month = monthKey();

  try {
    const { data: existing } = await supabase
      .from('assistant_token_usage')
      .select('id, total_tokens')
      .eq('company_id', input.companyId)
      .eq('user_id', input.userId)
      .eq('usage_date', today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('assistant_token_usage')
        .update({
          total_tokens: Number(existing.total_tokens ?? 0) + input.totalTokens,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('assistant_token_usage').insert({
        company_id: input.companyId,
        user_id: input.userId,
        usage_date: today,
        month_key: month,
        total_tokens: input.totalTokens,
      });
    }
  } catch (err) {
    console.warn('[assistant.costGuard] recordTokenUsage failed:', err);
  }
}
