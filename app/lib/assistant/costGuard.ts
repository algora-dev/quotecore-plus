/**
 * AI Assistant — Cost / Token-Budget Guard (Phase 0A interface)
 * ==============================================================
 *
 * Enforces per-user and per-company token ceilings (config.ts COST_LIMITS) so
 * the assistant can never run away with spend (Gerald review H-02). This file
 * defines the CONTRACT and a fail-closed default in Phase 0A.
 *
 * The persistent token-accounting store (an `assistant_token_usage` table /
 * RPC, akin to the rate-limit pattern) is created in Phase 0B's migrations.
 * Until that exists, {@link checkCostBudget} fails CLOSED when accounting is
 * unavailable AND the feature flag is on — we would rather refuse than spend
 * blind. When the assistant flag is OFF, the endpoint never reaches here.
 *
 * Phase 1 wires `recordTokenUsage` to the real store and flips
 * `ACCOUNTING_READY` on once the migration lands.
 */

import { COST_LIMITS } from './config';

/**
 * Set to `true` in Phase 0B once `assistant_token_usage` + its RPC exist and
 * {@link queryUsage} / {@link recordTokenUsage} are implemented against them.
 * Kept as an explicit constant so the fail-closed behaviour below is obvious
 * and intentional rather than an accident of an unimplemented function.
 */
const ACCOUNTING_READY = false;

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
  if (!ACCOUNTING_READY) {
    // No durable accounting yet → cannot prove we're under budget → refuse.
    return { allowed: false, failedClosed: true };
  }

  const usage = await queryUsage(input);

  if (usage.dailyUserTokens >= COST_LIMITS.dailyTokensPerUser) {
    return { allowed: false, exceeded: 'dailyUser' };
  }
  if (usage.dailyCompanyTokens >= COST_LIMITS.dailyTokensPerCompany) {
    return { allowed: false, exceeded: 'dailyCompany' };
  }
  if (usage.monthlyCompanyTokens >= COST_LIMITS.monthlyTokensPerCompany) {
    return { allowed: false, exceeded: 'monthlyCompany' };
  }

  return { allowed: true };
}

interface UsageSnapshot {
  dailyUserTokens: number;
  dailyCompanyTokens: number;
  monthlyCompanyTokens: number;
}

/**
 * Read current token usage. Implemented in Phase 0B/1 against
 * `assistant_token_usage`. Throws until then; callers never reach it while
 * {@link ACCOUNTING_READY} is false.
 */
async function queryUsage(_input: CostGuardInput): Promise<UsageSnapshot> {
  throw new Error(
    'costGuard.queryUsage: token accounting store not implemented yet (Phase 0B)'
  );
}

/**
 * Record the tokens a completed turn consumed. Implemented in Phase 0B/1.
 * No-op until accounting is ready so Phase 0A callers can wire the call site
 * without crashing.
 */
export async function recordTokenUsage(
  _input: CostGuardInput & { totalTokens: number }
): Promise<void> {
  if (!ACCOUNTING_READY) return;
  // Phase 0B: upsert into assistant_token_usage (day + month buckets).
}
