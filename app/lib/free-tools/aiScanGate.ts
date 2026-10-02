import 'server-only';
import { createHmac, createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
// NOTE: checkRateLimit retained for future use; per-stage admission is now
// handled by p_free_ai_scan_admission for every model call.

/**
 * Free-tool AI scan gate (2026-10-02, Darren).
 *
 * Follows the established free-tools gate pattern (parse-document /
 * check-doc-limit): server-side enforcement only, Postgres-backed counters
 * shared across all Vercel instances, opaque identity keys, fail-closed.
 *
 * Credits: EVERY model call costs one credit (outline scan = 1,
 * component detection = 2, full job = 3). Failed calls are refunded so
 * errors never burn a visitor's credits.
 *
 * Identity: HMAC of the client IP today. When the tool runs hosted inside
 * ChatGPT/Claude, the `x-plugin-client-id` header takes precedence and keys
 * credits to that platform account instead - no CGNAT collisions, no proxy
 * games. No raw PII is ever stored.
 */

export interface FreeAiScanConfig {
  perIdentityCap: number;
  globalDailyCap: number;
  warnPct: number;
  enabled: boolean;
}

export function freeAiScanConfig(): FreeAiScanConfig {
  return {
    perIdentityCap: Number(process.env.FREE_AI_SCAN_PER_IDENTITY) || 9,
    globalDailyCap: Number(process.env.FREE_AI_SCAN_GLOBAL_DAILY) || 75,
    warnPct: Number(process.env.FREE_AI_SCAN_WARN_PCT) || 70,
    enabled: process.env.FREE_AI_SCAN_ENABLED !== 'false',
  };
}

function hmacKey(): string {
  const explicit = process.env.FREE_TOOLS_IP_HMAC_KEY;
  if (explicit) return explicit;
  // Fallback: derive a stable key from the service-role secret so no new env
  // is required. Rotating the service key rotates identity hashes (acceptable:
  // worst case is one day of reset counters).
  return createHash('sha256')
    .update(process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'qc-free-tools-dev-fallback')
    .digest('hex');
}

function hmac(value: string): string {
  return createHmac('sha256', hmacKey()).update(value).digest('hex').slice(0, 32);
}

/** Opaque per-device identity used as the ledger key. */
export function freeAiScanIdentityKey(req: NextRequest): string {
  const pluginClient = req.headers.get('x-plugin-client-id');
  if (pluginClient && pluginClient.length >= 8 && pluginClient.length <= 128) {
    return `plug:${hmac(pluginClient)}`;
  }
  return `ip:${hmac(getClientIP(req.headers))}`;
}

export interface AdmissionResult {
  allowed: boolean;
  reason: 'identity_cap' | 'global_cap' | null;
  identityUsed: number | null;
  identityCap: number;
  globalUsed: number;
  globalCap: number;
  warn: boolean;
}

// Untyped service client on purpose: the tables/RPCs were added by
// 20261002090000_free_ai_scan_gate.sql and are not in the generated
// database.types yet. Results are explicitly narrowed at call sites.
export function getFreeScanServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Consume one scan credit (scan1 only). Returns null on RPC failure -
 * callers should fail closed (500) rather than let an uncounted model call
 * through.
 */
export async function admitFreeAiScan(identityKey: string): Promise<AdmissionResult | null> {
  const cfg = freeAiScanConfig();
  const client = getFreeScanServiceClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('p_free_ai_scan_admission', {
      p_identity_key: identityKey,
      p_per_identity_cap: cfg.perIdentityCap,
      p_global_cap: cfg.globalDailyCap,
    });
    if (error || !data) {
      console.error('[free-ai-scan] admission rpc error:', error?.message);
      return null;
    }
    const row = data as Record<string, unknown>;
    return {
      allowed: row.allowed === true,
      reason: (typeof row.reason === 'string' ? row.reason : null) as AdmissionResult['reason'],
      identityUsed: typeof row.identity_used === 'number' ? row.identity_used : null,
      identityCap: typeof row.identity_cap === 'number' ? row.identity_cap : cfg.perIdentityCap,
      globalUsed: typeof row.global_used === 'number' ? row.global_used : 0,
      globalCap: typeof row.global_cap === 'number' ? row.global_cap : cfg.globalDailyCap,
      warn: row.warn === true,
    };
  } catch (err) {
    console.error('[free-ai-scan] admission threw:', err);
    return null;
  }
}

/** Reverse today's admission after a server-side failure. Best-effort. */
export async function refundFreeAiScan(identityKey: string): Promise<void> {
  const client = getFreeScanServiceClient();
  if (!client) return;
  try {
    await client.rpc('p_free_ai_scan_refund', { p_identity_key: identityKey });
  } catch (err) {
    console.error('[free-ai-scan] refund failed:', err);
  }
}

/**
 * Bound on TOTAL model calls per identity per day. Kept for callers that
 * want a hard per-call limit independent of the credit ledger (currently
 * unused: per-call admission in p_free_ai_scan_admission covers it).
 */
export async function consumeStageAllowance(identityKey: string): Promise<boolean> {
  const cfg = freeAiScanConfig();
  return checkRateLimit(
    `free-ai-scan-stage:${identityKey}`,
    cfg.perIdentityCap,
    24 * 60 * 60 * 1000,
    { failClosed: true },
  );
}
