import { cleanupUnregisteredCustomObject } from '@/app/lib/billing/custom/usage/storage';
import { isCustomUsageCompany } from '@/app/lib/billing/custom/usage/store';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { BUCKETS } from '@/app/lib/storage/buckets';

export const runtime = 'nodejs';
// Vercel Cron invocations are async fire-from-platform; force this route
// to render at request time even if Next would otherwise optimise it.
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron handler that reclaims orphan objects from the QUOTE-DOCUMENTS
 * bucket. An "orphan" is a storage object that has no matching row in
 * public.quote_files \u2014 i.e. bytes that are being billed against Supabase
 * but aren't tracked in our metadata, and therefore aren't charged against
 * the company's storage quota.
 *
 * How orphans appear:
 *   - process crashes between supabase.storage.upload() and the quote_files
 *     insert (e.g. Vercel function timeout, OOM, Supabase API error on the
 *     metadata call),
 *   - upload-finaliser delete-on-overage fails to remove the over-quota
 *     object (logged + caught; storage RPC error),
 *   - manual cleanup misses (admin dropped a quote_files row but not the
 *     storage object).
 *
 * Why a sweep instead of relying on the inline finaliser only:
 *   - the finaliser CAN fail to delete (network blip, storage 500). We
 *     refuse to swallow the billing error to ensure the user sees it, but
 *     that leaves the orphan behind. The sweep is the recoverer.
 *
 * Safety:
 *   - Only sweeps objects older than 24 hours. Younger objects could be
 *     "in flight" between upload and metadata insert.
 *   - Only sweeps QUOTE-DOCUMENTS. company-logos is public and follows a
 *     different lifecycle (logos linked from quote_files and from
 *     companies.logo_url; phase 2 will widen this).
 *   - Hard cap at 500 deletions per run so a worst-case sweep can't run
 *     for hours and exceed the Vercel function timeout.
 *   - Logs every deletion so we have an audit trail.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/sweep-orphan-objects] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const bucket = BUCKETS.QUOTE_DOCUMENTS;

  // Cutoff: only consider objects older than this. 24 hours is generous
  // enough that any legitimate in-flight upload has long since either
  // succeeded or failed.
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const HARD_CAP = 500;
  const cutoff = Date.now() - MAX_AGE_MS;

  // We enumerate top-level "folders" in the bucket. Every path under
  // QUOTE-DOCUMENTS starts with a companyId/, so the root listing gives
  // us one entry per company that has ever uploaded.
  const { data: companies, error: rootErr } = await admin.storage.from(bucket).list('', {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (rootErr) {
    console.error('[cron/sweep-orphan-objects] root list failed:', rootErr.message);
    return NextResponse.json({ error: 'storage_list_failed', message: rootErr.message }, { status: 500 });
  }

  let scanned = 0;
  let deleted = 0;
  const pathsToDelete: string[] = [];
  const models = new Map<string, boolean>();
  let cleanupPending = 0;
  const custom = async (companyId: string): Promise<boolean> => {
    if (!models.has(companyId)) models.set(companyId, await isCustomUsageCompany(companyId));
    return models.get(companyId)!;
  };

  // An object already deleted from Storage will no longer appear in list().
  // Reconcile old holds as well, so a missed inline acknowledgement does not
  // leave capacity stuck forever. Never sweep logos with this document cron.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: holds, error: holdError } = await (admin as any).from('qcp_storage_holds')
    .select('company_id,storage_path,bucket_id,file_kind').in('state', ['held', 'delete_pending'])
    .lt('updated_at', new Date(cutoff).toISOString()).order('updated_at').limit(HARD_CAP);
  if (holdError) {
    console.error('[cron/sweep-orphan-objects] custom hold lookup failed:', holdError.code);
    cleanupPending++;
  } else {
    for (const hold of (holds ?? []) as Array<{company_id: string; storage_path: string; bucket_id: string | null; file_kind: string}>) {
      if (hold.file_kind !== 'document' || (hold.bucket_id !== null && hold.bucket_id !== bucket)) continue;
      try {
        await cleanupUnregisteredCustomObject({ companyId: hold.company_id, bucket, path: hold.storage_path });
      } catch { cleanupPending++; }
    }
  }

  for (const co of companies ?? []) {
    if (!co.name) continue;
    // Each company folder contains either:
    //   <companyId>/_pending/<file>  (pre-quote temp uploads)
    //   <companyId>/<quoteId>/<file>
    // We need to walk one more level deep. Supabase Storage list() only
    // returns immediate children; recurse into each top-level entry.
    const { data: children, error: childErr } = await admin.storage
      .from(bucket)
      .list(co.name, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (childErr) {
      console.error(`[cron/sweep-orphan-objects] list(${co.name}) failed:`, childErr.message);
      continue;
    }

    for (const sub of children ?? []) {
      if (!sub.name) continue;
      const subPath = `${co.name}/${sub.name}`;

      // If this is a file (not a folder), it's a direct child of the
      // companyId folder \u2014 unusual but possible. Treat as a leaf.
      if (sub.metadata && typeof (sub.metadata as { size?: number }).size === 'number') {
        scanned += await considerLeaf(subPath, sub, cutoff, pathsToDelete);
        if (pathsToDelete.length >= HARD_CAP) break;
        continue;
      }

      // Otherwise descend into the quoteId / _pending folder.
      const { data: leaves, error: leafErr } = await admin.storage
        .from(bucket)
        .list(subPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (leafErr) {
        console.error(`[cron/sweep-orphan-objects] list(${subPath}) failed:`, leafErr.message);
        continue;
      }
      for (const leaf of leaves ?? []) {
        if (!leaf.name) continue;
        const leafPath = `${subPath}/${leaf.name}`;
        scanned += await considerLeaf(leafPath, leaf, cutoff, pathsToDelete);
        if (pathsToDelete.length >= HARD_CAP) break;
      }
      if (pathsToDelete.length >= HARD_CAP) break;
    }
    if (pathsToDelete.length >= HARD_CAP) break;
  }

  // Filter to actual orphans: not present in quote_files.
  if (pathsToDelete.length > 0) {
    const { data: tracked, error: trackedErr } = await admin
      .from('quote_files')
      .select('storage_path')
      .in('storage_path', pathsToDelete);
    if (trackedErr) {
      console.error('[cron/sweep-orphan-objects] quote_files lookup failed:', trackedErr.message);
      return NextResponse.json({ error: 'metadata_lookup_failed', message: trackedErr.message }, { status: 500 });
    }
    const trackedSet = new Set((tracked ?? []).map((r) => r.storage_path));
    const orphans = pathsToDelete.filter((p) => !trackedSet.has(p));

    if (orphans.length > 0) {
      const legacyOrphans: string[] = [];
      for (const path of orphans) {
        const companyId = path.split('/')[0];
        if (!/^[a-f0-9-]{36}$/i.test(companyId)) { cleanupPending++; continue; }
        try {
          if (await custom(companyId)) {
            // Claim under the company lock before deleting. A racing finalizer
            // either finishes first (we refuse removal) or sees the tombstone.
            if (await cleanupUnregisteredCustomObject({ companyId, bucket, path })) deleted++;
          } else { legacyOrphans.push(path); }
        } catch { cleanupPending++; }
      }
      if (legacyOrphans.length) {
        const { error: rmErr } = await admin.storage.from(bucket).remove(legacyOrphans);
        if (rmErr) {
          console.error('[cron/sweep-orphan-objects] legacy remove failed:', rmErr.message);
          return NextResponse.json({ error: 'remove_failed' }, { status: 500 });
        }
        deleted += legacyOrphans.length;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scanned,
    candidates: pathsToDelete.length,
    deleted,
    cleanupPending,
    capped: pathsToDelete.length >= HARD_CAP,
  });
}

/**
 * Helper: decide whether a storage leaf is old enough to consider for
 * orphan-sweep. Pushes the path onto the queue if so. Returns 1 if the
 * leaf was scanned, 0 otherwise (e.g. missing metadata).
 */
async function considerLeaf(
  path: string,
  leaf: { name: string; created_at?: string | null; metadata?: { size?: number } | null },
  cutoffMs: number,
  out: string[],
): Promise<number> {
  const created = leaf.created_at ? new Date(leaf.created_at).getTime() : Number.NaN;
  if (!Number.isFinite(created)) return 0;
  if (created > cutoffMs) return 1; // too young, skip
  out.push(path);
  return 1;
}
