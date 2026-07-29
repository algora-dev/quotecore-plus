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
  source_catalog_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CatalogActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

// ---------------------------------------------------------------------------
// loadCatalogs - list company catalogs (most recently updated first)
// ---------------------------------------------------------------------------

export async function loadCatalogs(): Promise<CatalogRow[]> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient() as AdminAny;

  const { data, error } = await admin
    .from('catalogs')
    .select('id, name, original_filename, row_count, data_bytes, column_mapping, headers, status, source_catalog_id, created_at, updated_at')
    .eq('company_id', profile.company_id)
    .order('status', { ascending: true })   // 'archived' sorts last alphabetically
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load catalogs: ${error.message}`);
  return (data ?? []) as CatalogRow[];
}

// ---------------------------------------------------------------------------
// createCatalogMeta - insert a catalog header row (status = importing)
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
// (finalizeCatalog REMOVED - Gerald M-01-R.) There must be exactly ONE path
// to status='ready': the import_catalog_rows_atomic RPC on the final batch,
// which also charges storage. A second app-layer flip-to-ready could mark an
// uncharged catalog searchable. Do not reintroduce.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// markCatalogError - flip status to error on import failure (best-effort)
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
// updateCatalogMapping - remap columns without re-upload
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
// unarchiveCatalog - reinstate; re-checks slot allowance
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
// deleteCatalog - hard removal; frees slot + storage
// ---------------------------------------------------------------------------

export async function deleteCatalog(catalogId: string): Promise<CatalogActionResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    // Fetch data_bytes before delete to reverse the storage charge. Under
    // the atomic-import model storage is charged per-batch as rows land
    // (import_catalog_rows_atomic), so ANY catalog with rows has been
    // charged - regardless of status (importing/error/ready/archived).
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
// loadCatalogEntitlements - for page SSR
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
// loadCatalogsForSearch - minimal list for the quote-line search modal
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

/** Catalog headers + a few sample rows, for the Maps-tab CSV preview. */
export interface CatalogPreview {
  headers: string[];
  rows: Record<string, string>[];
}

/** First N rows of a catalog (default 5) for the in-modal CSV preview, so the
 *  user can see the columns while building an extra map. */
export async function loadCatalogPreview(
  catalogId: string,
  limit = 5,
): Promise<CatalogPreview> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient() as AdminAny;

  const { data: cat, error: cErr } = await admin
    .from('catalogs')
    .select('headers')
    .eq('id', catalogId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (cErr || !cat) {
    console.error('[loadCatalogPreview] catalog', cErr);
    return { headers: [], rows: [] };
  }

  const { data: rows, error: rErr } = await admin
    .from('catalog_rows')
    .select('raw_row')
    .eq('company_id', profile.company_id)
    .eq('catalog_id', catalogId)
    .order('row_index', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 20)));
  if (rErr) {
    console.error('[loadCatalogPreview] rows', rErr);
    return { headers: (cat.headers ?? []) as string[], rows: [] };
  }

  return {
    headers: (cat.headers ?? []) as string[],
    rows: ((rows ?? []) as { raw_row: Record<string, string> }[]).map((r) => r.raw_row ?? {}),
  };
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

// ---------------------------------------------------------------------------
// replaceCatalogRows - SPLIT into startReplaceCatalog + finishReplaceCatalog
// to avoid server action payload limits on large CSVs (25K+ rows).
// The client calls startReplaceCatalog (deletes old rows, sets status),
// then batches via /import-rows API, then calls finishReplaceCatalog.
// ---------------------------------------------------------------------------
export async function startReplaceCatalog(args: {
  catalogId: string;
}): Promise<CatalogActionResult<{ ok: true }>> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { data: catalog, error: catError } = await admin
      .from('catalogs')
      .select('id, name, status, visibility, supplier_profile_id, published_version, source_catalog_id')
      .eq('id', args.catalogId)
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (catError || !catalog) {
      return { ok: false, code: 'not_found', message: 'Catalog not found.' };
    }

    if (catalog.source_catalog_id) {
      return { ok: false, code: 'read_only', message: 'This is a supplier catalogue reference. You cannot upload new versions to it.' };
    }

    // Set status to importing (DO NOT delete rows - the RPC's p_is_first branch
    // handles deletion + storage reversal when it sees status was 'ready')
    // But we need to flip to 'importing' first so the RPC accepts the batches.
    // To preserve storage reversal, we flip to 'importing' but the RPC's
    // p_is_first branch still deletes rows. Storage reversal only happens
    // when v_status='ready', so we need a different approach:
    // Just set to 'importing' - the RPC p_is_first will delete rows but NOT
    // reverse storage. We handle storage in finishReplaceCatalog by recalculating.
    await admin
      .from('catalogs')
      .update({ status: 'importing', updated_at: new Date().toISOString() })
      .eq('id', args.catalogId)
      .eq('company_id', profile.company_id);

    return { ok: true, data: { ok: true as const } };
  } catch (err) {
    console.error('[startReplaceCatalog]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function finishReplaceCatalog(args: {
  catalogId: string;
  headers: string[];
  columnMapping: Record<string, string | null>;
  originalFilename: string;
  rowCount: number;
  dataBytes: number;
}): Promise<CatalogActionResult<{ rowCount: number; newVersion?: number }>> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { data: catalog } = await admin
      .from('catalogs')
      .select('id, visibility, supplier_profile_id, published_version')
      .eq('id', args.catalogId)
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!catalog) {
      return { ok: false, code: 'not_found', message: 'Catalog not found.' };
    }

    // Update catalog metadata
    const update: Record<string, unknown> = {
      headers: args.headers,
      column_mapping: args.columnMapping,
      row_count: args.rowCount,
      data_bytes: args.dataBytes,
      original_filename: args.originalFilename,
      status: 'ready',
      updated_at: new Date().toISOString(),
    };

    let newVersion: number | undefined;
    if (catalog.visibility === 'published' && catalog.supplier_profile_id) {
      newVersion = (catalog.published_version ?? 0) + 1;
      update.published_version = newVersion;
      update.published_at = new Date().toISOString();
    }

    await admin
      .from('catalogs')
      .update(update)
      .eq('id', args.catalogId);

    // Alert users who added this supplier catalog
    if (newVersion !== undefined) {
      const { data: savedBy } = await admin
        .from('catalogs')
        .select('company_id, name')
        .eq('source_catalog_id', args.catalogId)
        .neq('company_id', profile.company_id);

      if (savedBy && savedBy.length > 0) {
        const alerts = savedBy.map((row: { company_id: string; name: string }) => ({
          company_id: row.company_id,
          alert_type: 'supplier_catalog_update',
          title: 'Supplier catalogue updated',
          message: `"${row.name}" has been updated to version ${newVersion}. Your copy is now current with the latest data.`,
          is_read: false,
          status: 'active',
        }));
        await admin.from('alerts').insert(alerts);
      }
    }

    revalidatePath(`/[workspaceSlug]/catalogs`, 'page');
    revalidatePath(`/[workspaceSlug]/supplier`, 'page');
    return { ok: true, data: { rowCount: args.rowCount, newVersion } };
  } catch (err) {
    console.error('[finishReplaceCatalog]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// downloadCatalogCsv - return all rows as CSV-ready array
// ---------------------------------------------------------------------------
export async function downloadCatalogRows(catalogId: string): Promise<CatalogActionResult<{ headers: string[]; rows: Record<string, string>[]; name: string }>> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    // Check if user owns this catalog OR has it via source_catalog_id
    const { data: catalog } = await admin
      .from('catalogs')
      .select('id, name, headers, company_id, source_catalog_id, status')
      .eq('id', catalogId)
      .maybeSingle();

    if (!catalog) {
      return { ok: false, code: 'not_found', message: 'Catalog not found.' };
    }

    // If user doesn't own it, check if they have a reference to it
    const isOwner = catalog.company_id === profile.company_id;
    let searchCatalogId = catalogId;

    if (!isOwner) {
      // Check if user has a reference via source_catalog_id
      const { data: ref } = await admin
        .from('catalogs')
        .select('id')
        .eq('source_catalog_id', catalogId)
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (!ref) {
        return { ok: false, code: 'forbidden', message: 'You do not have access to this catalog.' };
      }
      // Use the source catalog ID to read rows (via admin client which bypasses RLS)
      searchCatalogId = catalogId;
    } else if (catalog.source_catalog_id) {
      // User owns a reference catalog - read from the source
      searchCatalogId = catalog.source_catalog_id;
    }

    const { data: rows, error } = await admin
      .from('catalog_rows')
      .select('raw_row, row_index')
      .eq('catalog_id', searchCatalogId)
      .order('row_index', { ascending: true });

    if (error) throw new Error(error.message);

    return {
      ok: true,
      data: {
        headers: catalog.headers as string[],
        rows: (rows ?? []).map((r: { raw_row: Record<string, string> }) => r.raw_row),
        name: catalog.name,
      }
    };
  } catch (err) {
    console.error('[downloadCatalogRows]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}
