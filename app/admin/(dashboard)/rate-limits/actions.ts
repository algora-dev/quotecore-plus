'use server';

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { writeAudit } from '@/app/lib/admin/audit';

export type RateLimitRow = {
  bucket_key: string;
  count: number;
  window_start: string;
  updated_at: string;
};

export type RateLimitResult =
  | { ok: true; rows: RateLimitRow[] }
  | { ok: false; error: string };

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// listRateLimits
// ---------------------------------------------------------------------------

export async function listRateLimits(filter?: string): Promise<RateLimitResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  let query = admin
    .from('rate_limits')
    .select('bucket_key, count, window_start, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (filter && filter.trim()) {
    query = query.ilike('bucket_key', `%${filter.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, rows: (data ?? []) as RateLimitRow[] };
}

// ---------------------------------------------------------------------------
// resetRateLimit
// ---------------------------------------------------------------------------

export async function resetRateLimit(bucketKey: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from('rate_limits')
    .update({
      count: 0,
      window_start: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('bucket_key', bucketKey);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAudit(
    admin,
    adminProfile,
    'reset_rate_limit',
    null,
    null,
    null,
    null,
    null,
    { bucketKey },
  );

  return { ok: true, message: `Reset "${bucketKey}"` };
}

// ---------------------------------------------------------------------------
// resetAllRateLimits
// ---------------------------------------------------------------------------

export async function resetAllRateLimits(filter?: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  let query = admin
    .from('rate_limits')
    .update({
      count: 0,
      window_start: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (filter && filter.trim()) {
    query = query.ilike('bucket_key', `%${filter.trim()}%`);
  }

  const { count, error } = await query;

  if (error) {
    return { ok: false, error: error.message };
  }

  const resetCount = count ?? 0;

  await writeAudit(
    admin,
    adminProfile,
    'reset_all_rate_limits',
    null,
    null,
    null,
    null,
    null,
    { filter: filter ?? null, count: resetCount },
  );

  return { ok: true, message: `Reset ${resetCount} rate limit${resetCount !== 1 ? 's' : ''}` };
}
