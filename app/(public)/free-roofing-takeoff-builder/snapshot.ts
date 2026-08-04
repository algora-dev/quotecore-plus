import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * G3: Immutable result snapshot management.
 * 
 * When a calculation result is first generated, we store a complete snapshot
 * (including prices, library version, formulas) to the result_snapshots table.
 * On subsequent visits, we read from the snapshot instead of re-fetching live prices.
 * This ensures republishing a catalogue never changes old results.
 */

export interface ResultSnapshotRow {
  id: string;
  token: string;
  result: Record<string, unknown>;
  supplier_id: string | null;
  collection_id: string | null;
  published_version: number | null;
  calculation_version: string;
  created_at: string;
}

/**
 * Store a calculation result snapshot. If one already exists for this token,
 * it is returned as-is (idempotent - deterministic tokens mean same inputs = same snapshot).
 */
export async function storeResultSnapshot(
  token: string,
  result: Record<string, unknown>,
  calculationVersion: string,
  supplierId?: string | null,
  collectionId?: string | null,
  publishedVersion?: number | null,
): Promise<ResultSnapshotRow | null> {
  try {
    const admin = createAdminClient();

    // Check if snapshot already exists (idempotent)
    const { data: existing } = await admin
      .from('result_snapshots')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (existing) return existing as unknown as ResultSnapshotRow;

    // Insert new snapshot
    const { data, error } = await admin
      .from('result_snapshots')
      .insert({
        token,
        result: result as unknown as import('@/app/lib/supabase/database.types').Json,
        calculation_version: calculationVersion,
        supplier_id: supplierId ?? null,
        collection_id: collectionId ?? null,
        published_version: publishedVersion ?? null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to store result snapshot:', error.message);
      return null;
    }

    return data as unknown as ResultSnapshotRow;
  } catch (err) {
    console.error('storeResultSnapshot error:', err);
    return null;
  }
}

/**
 * Retrieve a stored snapshot by token. Returns null if not found.
 */
export async function getResultSnapshot(token: string): Promise<ResultSnapshotRow | null> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('result_snapshots')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) return null;

    return data as unknown as ResultSnapshotRow;
  } catch (err) {
    console.error('getResultSnapshot error:', err);
    return null;
  }
}

/**
 * Check if a newer published version exists for the same collection.
 * Used for stale-version disclosure on result pages.
 */
export async function checkNewerVersion(
  collectionId: string | null,
  currentVersion: number | null,
): Promise<{ hasNewer: boolean; latestVersion: number | null }> {
  if (!collectionId || currentVersion == null) return { hasNewer: false, latestVersion: null };

  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from('component_collections')
      .select('published_version')
      .eq('id', collectionId)
      .maybeSingle();

    const latest = data?.published_version as number | null;
    if (latest != null && latest > currentVersion) {
      return { hasNewer: true, latestVersion: latest };
    }

    return { hasNewer: false, latestVersion: latest ?? null };
  } catch {
    return { hasNewer: false, latestVersion: null };
  }
}
