'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import {
  requireFeature,
  requireCatalogSlot,
  assertCanUseStorage,
  CatalogLimitReachedError,
  FeatureGatedError,
  SubscriptionInactiveError,
  isBillingError,
  loadCompanyEntitlements,
} from '@/app/lib/billing/entitlements';

// database.types.ts is stale; catalog tables don't exist in the generated
// types yet. Using (admin as any).from('catalogs') throughout until a
// `supabase gen types` regen is run after the migration is applied.
// This is the documented interim pattern (see MEMORY.md).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminAny = any;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalogRow {
  id: string;
  name: string;
  original_filename: string | null;
  row_count: number;
  data_bytes: number;
  column_mapping: Record<string, string | null>;
  headers: string[];
  status: 'ready' | 'importing' | 'archived' | 'error';
  created_at: string;
  updated_at: string;
}

export type CatalogActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

// ---------------------------------------------------------------------------
// loadCatalogs — list company catalogs (most recently updated first)
// ---------------------------------------------------------------------------

export async function loadCatalogs(): Promise<CatalogRow[]> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient() as AdminAny;

  const { data, error } = await admin
    .from('catalogs')
    .select('id, name, original_filename, row_count, data_bytes, column_mapping, headers, status, created_at, updated_at')
    .eq('company_id', profile.company_id)
    .order('status', { ascending: true })   // 'archived' sorts last alphabetically
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load catalogs: ${error.message}`);
  return (data ?? []) as CatalogRow[];
}

// ---------------------------------------------------------------------------
// createCatalogMeta — insert a catalog header row (status = importing)
// ---------------------------------------------------------------------------

export async function createCatalogMeta(args: {
  name: string;
  headers: string[];
  columnMapping: Record<string, string | null>;
  originalFilename: string;
  rowCount: number;
  dataBytes: number;
}): Promise<CatalogActionResult<{ catalogId: string }>> {
  try {
    const profile = await requireCompanyContext();

    await requireFeature(profile.company_id, 'catalogs');
    await requireCatalogSlot(profile.company_id);
    // Server-side red-state gate (Gerald H-02-R3): a company that is ALREADY
    // over storage cannot START a new catalog import. The UI modal is not a
    // security boundary, so we enforce it here. assertCanUseStorage(.., 0)
    // throws StorageQuotaExceededError when storageUsedBytes already exceeds
    // the (topup-inclusive) limit.
    //
    // This does NOT contradict Shaun's option-3 policy: an import that is
    // already in flight may still COMPLETE and push the company over (capped
    // at the 10MB/catalog ceiling); authoritative byte accounting + the hard
    // ceiling live in the import_catalog_rows_atomic RPC. We only block
    // STARTING a fresh import while already red.
    await assertCanUseStorage(profile.company_id, 0);

    const admin = createAdminClient() as AdminAny;

    const { data, error } = await admin
      .from('catalogs')
      .insert({
        company_id: profile.company_id,
        name: args.name.trim(),
        original_filename: args.originalFilename,
        row_count: 0,
        // Authoritative size is computed + charged in import-rows as rows
        // land. Start at 0 so storage accounting is never overstated by a
        // browser-supplied estimate and delete reverses the true amount.
        data_bytes: 0,
        column_mapping: args.columnMapping,
        headers: args.headers,
        status: 'importing',
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const catalogId = (data as { id: string }).id;

    // Auto-create the catalog's PRIMARY map from the same mapping, named after
    // the catalog. Every catalog has exactly one primary map (the upload's own
    // mapping); extra maps are added later via createCatalogMap. Best-effort:
    // the backfill migration also covers any catalog missing a primary map.
    try {
      await admin.from('catalog_maps').insert({
        catalog_id: catalogId,
        company_id: profile.company_id,
        name: args.name.trim(),
        column_mapping: args.columnMapping,
        is_primary: true,
      });
    } catch (mapErr) {
      console.error('[createCatalogMeta] primary map insert', mapErr);
    }

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: { catalogId } };
  } catch (err) {
    if (err instanceof FeatureGatedError) {
      return { ok: false, code: 'feature_gated', message: err.message };
    }
    if (err instanceof CatalogLimitReachedError) {
      return { ok: false, code: 'catalog_limit_reached', message: err.message };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, code: 'subscription_inactive', message: err.message };
    }
    if (isBillingError(err)) {
      return { ok: false, code: err.code, message: err.message };
    }
    console.error('[createCatalogMeta]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// (finalizeCatalog REMOVED — Gerald M-01-R.) There must be exactly ONE path
// to status='ready': the import_catalog_rows_atomic RPC on the final batch,
// which also charges storage. A second app-layer flip-to-ready could mark an
// uncharged catalog searchable. Do not reintroduce.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// markCatalogError — flip status to error on import failure (best-effort)
// ---------------------------------------------------------------------------

export async function markCatalogError(catalogId: string): Promise<void> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;
    await admin
      .from('catalogs')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('id', catalogId)
      .eq('company_id', profile.company_id);
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// renameCatalog
// ---------------------------------------------------------------------------

export async function renameCatalog(
  catalogId: string,
  name: string,
): Promise<CatalogActionResult> {
  try {
    const profile = await requireCompanyContext();
    if (!name.trim()) return { ok: false, code: 'validation', message: 'Name cannot be blank.' };

    const admin = createAdminClient() as AdminAny;
    const { error } = await admin
      .from('catalogs')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', catalogId)
      .eq('company_id', profile.company_id);

    if (error) throw new Error(error.message);

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[renameCatalog]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// updateCatalogMapping — remap columns without re-upload
// ---------------------------------------------------------------------------

export async function updateCatalogMapping(
  catalogId: string,
  columnMapping: Record<string, string | null>,
): Promise<CatalogActionResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { error } = await admin
      .from('catalogs')
      .update({ column_mapping: columnMapping, updated_at: new Date().toISOString() })
      .eq('id', catalogId)
      .eq('company_id', profile.company_id);

    if (error) throw new Error(error.message);

    // Keep the catalog's PRIMARY map in sync (it mirrors the catalog's own
    // mapping). Extra maps are independent and untouched.
    try {
      await admin
        .from('catalog_maps')
        .update({ column_mapping: columnMapping, updated_at: new Date().toISOString() })
        .eq('catalog_id', catalogId)
        .eq('company_id', profile.company_id)
        .eq('is_primary', true);
    } catch (mapErr) {
      console.error('[updateCatalogMapping] primary map sync', mapErr);
    }

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[updateCatalogMapping]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// archiveCatalog
// ---------------------------------------------------------------------------

export async function archiveCatalog(catalogId: string): Promise<CatalogActionResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { error } = await admin
      .from('catalogs')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', catalogId)
      .eq('company_id', profile.company_id);

    if (error) throw new Error(error.message);

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[archiveCatalog]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// unarchiveCatalog — reinstate; re-checks slot allowance
// ---------------------------------------------------------------------------

export async function unarchiveCatalog(catalogId: string): Promise<CatalogActionResult> {
  try {
    const profile = await requireCompanyContext();
    await requireCatalogSlot(profile.company_id); // re-check cap

    const admin = createAdminClient() as AdminAny;
    const { error } = await admin
      .from('catalogs')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .eq('status', 'archived');

    if (error) throw new Error(error.message);

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof CatalogLimitReachedError) {
      return { ok: false, code: 'catalog_limit_reached', message: err.message };
    }
    if (err instanceof FeatureGatedError) {
      return { ok: false, code: 'feature_gated', message: err.message };
    }
    console.error('[unarchiveCatalog]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// deleteCatalog — hard removal; frees slot + storage
// ---------------------------------------------------------------------------

export async function deleteCatalog(catalogId: string): Promise<CatalogActionResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    // Fetch data_bytes before delete to reverse the storage charge. Under
    // the atomic-import model storage is charged per-batch as rows land
    // (import_catalog_rows_atomic), so ANY catalog with rows has been
    // charged — regardless of status (importing/error/ready/archived).
    // data_bytes is the authoritative charged total; reverse exactly it.
    const { data: catalogData, error: fetchErr } = await admin
      .from('catalogs')
      .select('data_bytes')
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .single();

    if (fetchErr) throw new Error(fetchErr.message);
    const dataBytes = ((catalogData as { data_bytes: number } | null)?.data_bytes) ?? 0;

    // Delete (catalog_rows cascade via FK)
    const { error } = await admin
      .from('catalogs')
      .delete()
      .eq('id', catalogId)
      .eq('company_id', profile.company_id);

    if (error) throw new Error(error.message);

    // Reverse the charged bytes.
    if (dataBytes > 0) {
      await (createAdminClient() as AdminAny).rpc('adjust_company_storage', {
        p_company_id: profile.company_id,
        p_delta_bytes: -dataBytes,
      });
    }

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[deleteCatalog]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// loadCatalogEntitlements — for page SSR
// ---------------------------------------------------------------------------

export async function loadCatalogEntitlements() {
  const profile = await requireCompanyContext();
  const ent = await loadCompanyEntitlements(profile.company_id);
  return {
    catalogsEnabled: ent.features.catalogs,
    catalogLimit: ent.catalogLimit,
    catalogCount: ent.catalogCount,
    isActive: ent.isActive,
    effectivePlanCode: ent.effectivePlanCode,
    isOverStorage: ent.isOverStorage,
  };
}

// ---------------------------------------------------------------------------
// loadCatalogsForSearch — minimal list for the quote-line search modal
// ---------------------------------------------------------------------------

export interface CatalogSearchMeta {
  /** Map id (selectable option id). */
  id: string;
  /** The catalog whose ROWS this map searches (the rows source). */
  catalogId: string;
  /** Display name of THIS map (primary map = catalog name). */
  name: string;
  /** Parent catalog name, for grouping in the picker. */
  catalogName: string;
  /** Whether this is the catalog's primary (auto-created) map. */
  isPrimary: boolean;
  column_mapping: Record<string, string | null>;
}

/**
 * Returns one entry PER MAP (not per catalog), flattened for the search picker.
 * Multiple maps over the same catalog share `catalogId` (the rows source) but
 * carry their own `column_mapping`. The search RPC keys on `catalogId`; the app
 * applies the chosen map's column_mapping to the results. Ordered so each
 * catalog's primary map leads, with its extra maps grouped under it.
 */
export async function loadCatalogsForSearch(): Promise<CatalogSearchMeta[]> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient() as AdminAny;

  // Only maps belonging to READY catalogs are searchable.
  const { data: catalogs, error: cErr } = await admin
    .from('catalogs')
    .select('id, name')
    .eq('company_id', profile.company_id)
    .eq('status', 'ready')
    .order('name', { ascending: true });

  if (cErr) {
    console.error('[loadCatalogsForSearch] catalogs', cErr);
    return [];
  }
  const readyCatalogs = (catalogs ?? []) as { id: string; name: string }[];
  if (readyCatalogs.length === 0) return [];

  const catalogNameById = new Map(readyCatalogs.map((c) => [c.id, c.name]));
  const readyIds = readyCatalogs.map((c) => c.id);

  const { data: maps, error: mErr } = await admin
    .from('catalog_maps')
    .select('id, catalog_id, name, column_mapping, is_primary')
    .eq('company_id', profile.company_id)
    .in('catalog_id', readyIds)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true });

  if (mErr) {
    console.error('[loadCatalogsForSearch] maps', mErr);
    return [];
  }

  const rows = (maps ?? []) as {
    id: string;
    catalog_id: string;
    name: string;
    column_mapping: Record<string, string | null>;
    is_primary: boolean;
  }[];

  const flat: CatalogSearchMeta[] = rows.map((m) => ({
    id: m.id,
    catalogId: m.catalog_id,
    name: m.name,
    catalogName: catalogNameById.get(m.catalog_id) ?? m.name,
    isPrimary: m.is_primary,
    column_mapping: (m.column_mapping ?? {}) as Record<string, string | null>,
  }));

  // Group by parent catalog (primary first within each group), catalogs A->Z.
  flat.sort((a, b) => {
    if (a.catalogName !== b.catalogName) {
      return a.catalogName.localeCompare(b.catalogName);
    }
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return flat;
}

// ---------------------------------------------------------------------------
// Catalog maps CRUD (multiple column mappings over one uploaded catalog)
// ---------------------------------------------------------------------------

export interface CatalogMapRow {
  id: string;
  catalog_id: string;
  name: string;
  column_mapping: Record<string, string | null>;
  is_primary: boolean;
}

/** List all maps for a catalog (primary first). */
export async function loadCatalogMaps(catalogId: string): Promise<CatalogMapRow[]> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient() as AdminAny;
  const { data, error } = await admin
    .from('catalog_maps')
    .select('id, catalog_id, name, column_mapping, is_primary')
    .eq('company_id', profile.company_id)
    .eq('catalog_id', catalogId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true });
  if (error) {
    console.error('[loadCatalogMaps]', error);
    return [];
  }
  return (data ?? []) as CatalogMapRow[];
}

/** Create an extra (non-primary) map over an existing catalog. */
export async function createCatalogMap(
  catalogId: string,
  name: string,
  columnMapping: Record<string, string | null>,
): Promise<CatalogActionResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { ok: false, code: 'unknown', message: 'Map name is required.' };
    }
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    // Confirm the catalog belongs to this company (FK + RLS-equivalent check).
    const { data: cat, error: cErr } = await admin
      .from('catalogs')
      .select('id')
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cat) return { ok: false, code: 'unknown', message: 'Catalog not found.' };

    const { error } = await admin.from('catalog_maps').insert({
      catalog_id: catalogId,
      company_id: profile.company_id,
      name: trimmed,
      column_mapping: columnMapping,
      is_primary: false,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[createCatalogMap]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

/** Update an existing map's name and/or column mapping. */
export async function updateCatalogMap(
  mapId: string,
  name: string,
  columnMapping: Record<string, string | null>,
): Promise<CatalogActionResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return { ok: false, code: 'unknown', message: 'Map name is required.' };
    }
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;
    const { error } = await admin
      .from('catalog_maps')
      .update({ name: trimmed, column_mapping: columnMapping, updated_at: new Date().toISOString() })
      .eq('id', mapId)
      .eq('company_id', profile.company_id);
    if (error) throw new Error(error.message);
    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[updateCatalogMap]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

/** Delete an EXTRA map. The primary map cannot be deleted (delete the catalog). */
export async function deleteCatalogMap(mapId: string): Promise<CatalogActionResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    // Guard: never delete a primary map.
    const { data: row, error: rErr } = await admin
      .from('catalog_maps')
      .select('id, is_primary')
      .eq('id', mapId)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) return { ok: false, code: 'unknown', message: 'Map not found.' };
    if (row.is_primary) {
      return { ok: false, code: 'unknown', message: 'The primary map cannot be deleted. Delete the catalog instead.' };
    }

    const { error } = await admin
      .from('catalog_maps')
      .delete()
      .eq('id', mapId)
      .eq('company_id', profile.company_id);
    if (error) throw new Error(error.message);
    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[deleteCatalogMap]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}
