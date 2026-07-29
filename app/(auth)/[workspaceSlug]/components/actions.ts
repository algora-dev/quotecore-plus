'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext, requireUser } from '@/app/lib/supabase/server';
import { pickFields } from '@/app/lib/security/pickFields';
import type { ComponentLibraryInsert } from '@/app/lib/types';
import {
  requireComponentSlot,
  ComponentLimitReachedError,
  SubscriptionInactiveError,
  isBillingError,
} from '@/app/lib/billing/entitlements';

/**
 * Sentinel id we slot into `copilot_progress.guides_completed[]` once the
 * user has dismissed the first-visit components intro modal. Inline'd here
 * (rather than imported from a sibling) so this 'use server' file only
 * exports async functions, which Next requires for server-action modules.
 */
const COMPONENTS_INTRO_SEEN_KEY = 'components-intro-seen';

/**
 * Returns true if the current user has already dismissed the components
 * intro modal. Used by /components page to decide whether to render it.
 */
export async function hasSeenComponentsIntro(): Promise<boolean> {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('copilot_progress')
      .select('guides_completed')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('[hasSeenComponentsIntro] read failed:', error);
      // Fail-safe: treat as seen so we don't spam the modal on db errors.
      return true;
    }
    const completed = data?.guides_completed ?? [];
    return completed.includes(COMPONENTS_INTRO_SEEN_KEY);
  } catch (err) {
    console.error('[hasSeenComponentsIntro] threw:', err);
    return true;
  }
}

/**
 * Marks the components intro modal as seen for the current user. Upserts
 * a copilot_progress row if none exists yet (e.g. a brand-new signup that
 * hasn't touched copilot state). Idempotent: re-adding the sentinel is a
 * no-op thanks to the de-duped set we write.
 */
export async function markComponentsIntroSeen(): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: readError } = await supabase
      .from('copilot_progress')
      .select('guides_completed')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (readError) {
      console.error('[markComponentsIntroSeen] read failed:', readError);
      return { ok: false, error: readError.message };
    }

    const current = existing?.guides_completed ?? [];
    if (current.includes(COMPONENTS_INTRO_SEEN_KEY)) {
      return { ok: true };
    }
    const nextCompleted = Array.from(new Set([...current, COMPONENTS_INTRO_SEEN_KEY]));

    const { error: upsertError } = await supabase
      .from('copilot_progress')
      .upsert(
        {
          user_id: profile.id,
          company_id: profile.company_id,
          guides_completed: nextCompleted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (upsertError) {
      console.error('[markComponentsIntroSeen] upsert failed:', upsertError);
      return { ok: false, error: upsertError.message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[markComponentsIntroSeen] threw:', message);
    return { ok: false, error: message };
  }
}

export async function loadComponentLibrary(collectionId?: string | null) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please ensure you are logged in and have a company workspace.');
  }
  
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('component_library')
    .select('*')
    .eq('company_id', profile.company_id)
    .eq('is_system', false)
    .order('name');

  // When a specific collection is requested, filter to only that collection's components.
  if (collectionId) {
    query = query.eq('collection_id', collectionId);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Database error loading components:', error);
    throw new Error(`Failed to load components: ${error.message}`);
  }
  
  // Note: After migration 022, database uses 'lineal' (no transform needed)
  return data;
}

/**
 * Result envelope so the client can pattern-match on `code` to render a
 * tier-upgrade modal instead of a generic toast. Keeps the success path
 * unchanged: callers that just need the row still get `data` on success.
 */
export type CreateComponentResult =
  | { ok: true; data: NonNullable<Awaited<ReturnType<typeof loadComponentLibrary>>>[number] }
  | { ok: false; code: 'component_limit_reached'; used: number; limit: number; planCode: string }
  | { ok: false; code: 'subscription_inactive'; status: string }
  | { ok: false; code: 'internal_error'; message: string };

export async function createComponent(input: ComponentLibraryInsert): Promise<CreateComponentResult> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createComponent] Failed to get company context:', err);
    return { ok: false, code: 'internal_error', message: 'Account setup incomplete. Please log out and log back in.' };
  }

  // Tier gate: refuse early with a typed error before the INSERT. The SQL
  // helper double-checks under the hood, but this gives us cheaper UX on the
  // happy-path block and a typed payload back to the client.
  try {
    await requireComponentSlot(profile.company_id);
  } catch (err) {
    if (err instanceof ComponentLimitReachedError) {
      return {
        ok: false,
        code: 'component_limit_reached',
        used: err.used,
        limit: err.limit,
        planCode: err.planCode,
      };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, code: 'subscription_inactive', status: err.currentStatus };
    }
    if (isBillingError(err)) {
      return { ok: false, code: 'internal_error', message: err.message };
    }
    throw err;
  }

  // Note: After migration 022, database accepts 'lineal' directly (no transform needed)
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_library')
    .insert({ ...input, company_id: profile.company_id })
    .select()
    .single();

  if (error) {
    console.error('[createComponent] Database error:', error);
    return { ok: false, code: 'internal_error', message: `${error.message} (Code: ${error.code})` };
  }

  // Revalidate all workspace-scoped /components pages (dynamic [workspaceSlug] segment).
  revalidatePath('/[workspaceSlug]/components', 'page');
  return { ok: true, data };
}

/**
 * Columns updatable from the client. Gerald audit M-03: keep `id`,
 * `company_id`, `created_at`, `updated_at` out of the surface. Anything
 * not in this list is silently dropped by `pickFields`, so an attacker
 * can't smuggle in arbitrary column writes through a client form.
 */
const UPDATABLE_COMPONENT_FIELDS = [
  'name',
  'component_type',
  'measurement_type',
  'default_material_rate',
  'default_labour_rate',
  'default_waste_type',
  'default_waste_percent',
  'default_waste_fixed',
  'default_pitch_type',
  'show_price_default',
  'show_dimensions_default',
  'eligible_for_orders',
  'flashing_ids',
  'is_active',
  'sort_order',
  // Phase 2/6 (Generic Trades): new column writes allowed from the
  // component edit UI. company_id, id, timestamps still intentionally
  // excluded - same posture as Gerald audit M-03.
  'collection_id',
  'height_value_mm',
  'depth_value_mm',
  'waste_unit',
  'pricing_strategy',
  'pack_price',
  'pack_size',
  'pack_coverage_m2',
  'notes',
  // Phase: Supplier components - SKU and takeoff slot
  'sku',
  'takeoff_slot',
] as const;

export async function updateComponent(id: string, input: Partial<ComponentLibraryInsert>) {
  const profile = await requireCompanyContext();

  // Whitelist columns before passing to the DB; see pickFields.ts for why.
  const update = pickFields(input as Record<string, unknown>, UPDATABLE_COMPONENT_FIELDS);

  // SKU lock: once a component has a SKU, it cannot be changed.
  // This applies to all components (not just published supplier libraries).
  if ('sku' in update) {
    const supabaseCheck = await createSupabaseServerClient();
    const { data: existing } = await supabaseCheck
      .from('component_library')
      .select('id, sku')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single();
    
    if (existing) {
      const hasExistingSku = !!existing.sku;
      const newSku = (update as Record<string, unknown>).sku as string | null;
      
      if (hasExistingSku && newSku !== existing.sku) {
        throw new Error('SKU cannot be changed once set. Create a new component if you need a different SKU.');
      }
    }
  }

  // Note: After migration 022, database accepts 'lineal' directly (no transform needed)
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_library')
    // Cast safe: `update` is a strict subset of Partial<ComponentLibraryInsert>
    // by construction of UPDATABLE_COMPONENT_FIELDS above.
    .update(update as Partial<ComponentLibraryInsert>)
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  revalidatePath('/[workspaceSlug]/components', 'page');
  return data;
}

/**
 * Returns true if the current user has dismissed the component edit
 * warning modal ("edited changes only affect new entries").
 */
export async function hasDismissedComponentEditWarning(): Promise<boolean> {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('copilot_progress')
      .select('dismiss_component_edit_warning')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('[hasDismissedComponentEditWarning] read failed:', error);
      return false;
    }
    return data?.dismiss_component_edit_warning === true;
  } catch (err) {
    console.error('[hasDismissedComponentEditWarning] threw:', err);
    return false;
  }
}

/**
 * Persist the user's choice to never show the component edit warning again.
 */
export async function dismissComponentEditWarning(): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();
    const { error: upsertError } = await supabase
      .from('copilot_progress')
      .upsert(
        {
          user_id: profile.id,
          company_id: profile.company_id,
          dismiss_component_edit_warning: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (upsertError) {
      console.error('[dismissComponentEditWarning] upsert failed:', upsertError);
      return { ok: false, error: upsertError.message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dismissComponentEditWarning] threw:', message);
    return { ok: false, error: message };
  }
}

export async function deleteComponent(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('component_library')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);
  if (error) throw new Error(error.message);
  revalidatePath('/[workspaceSlug]/components', 'page');
}

/**
 * Load all component collections for the current company.
 * Returns id + name + is_bootstrap, ordered bootstrap-first then alphabetically.
 */
export async function loadComponentCollections() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_collections')
    .select('id, name, is_bootstrap, visibility, publication_status, published_at, public_title, public_description, roofing_types, product_categories, brands, keywords')
    .eq('company_id', profile.company_id)
    .order('is_bootstrap', { ascending: false })
    .order('name');
  if (error) throw new Error(`Failed to load component collections: ${error.message}`);
  return data ?? [];
}

/**
 * Create a new (non-bootstrap) component collection for the current company.
 * Name must be non-empty and unique within the company.
 */
export async function createComponentCollection(
  name: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: 'Library name cannot be empty.' };
  if (trimmed.length > 80) return { ok: false, message: 'Library name must be 80 characters or fewer.' };

  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('component_collections')
      .insert({ company_id: profile.company_id, name: trimmed, is_bootstrap: false })
      .select('id, name')
      .single();
    if (error) {
      // Unique constraint on (company_id, name)
      if (error.code === '23505') return { ok: false, message: 'A library with that name already exists.' };
      return { ok: false, message: error.message };
    }
    revalidatePath('/components');
    return { ok: true, id: data.id, name: data.name };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Rename an existing component collection. Bootstrap collections can be
 * renamed (they just lose the default name label in the UI).
 */
export async function deleteComponentCollection(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // Refuse to delete bootstrap (default) libraries.
    const { data: col, error: fetchErr } = await supabase
      .from('component_collections')
      .select('id, is_bootstrap')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single();
    if (fetchErr || !col) return { ok: false, message: 'Library not found.' };
    if (col.is_bootstrap) return { ok: false, message: 'The default library cannot be deleted.' };

    // Delete all components in this library first.
    const { error: compErr } = await supabase
      .from('component_library')
      .delete()
      .eq('collection_id', id)
      .eq('company_id', profile.company_id);
    if (compErr) return { ok: false, message: compErr.message };

    // Then delete the library itself.
    const { error: colErr } = await supabase
      .from('component_collections')
      .delete()
      .eq('id', id)
      .eq('company_id', profile.company_id);
    if (colErr) return { ok: false, message: colErr.message };

    revalidatePath('/components');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function renameComponentCollection(
  id: string,
  name: string,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: 'Library name cannot be empty.' };
  if (trimmed.length > 80) return { ok: false, message: 'Library name must be 80 characters or fewer.' };

  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('component_collections')
      .update({ name: trimmed })
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .select('name')
      .single();
    if (error) {
      if (error.code === '23505') return { ok: false, message: 'A library with that name already exists.' };
      return { ok: false, message: error.message };
    }
    revalidatePath('/components');
    return { ok: true, name: data.name };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Update library visibility/publication settings (supplier-only).
 */
export async function updateLibraryVisibility(
  id: string,
  input: Partial<{
    visibility: 'private' | 'unlisted' | 'published';
    public_title: string | null;
    public_description: string | null;
    roofing_types: string[];
    product_categories: string[];
    brands: string[];
    keywords: string[];
  }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // Verify this company is a supplier
    const { data: company } = await supabase
      .from('companies')
      .select('is_supplier')
      .eq('id', profile.company_id)
      .single();

    if (!company?.is_supplier) {
      return { ok: false, message: 'Only approved suppliers can publish libraries.' };
    }

    // Get supplier_profile_id and current published_version
    const { data: supplierProfile } = await supabase
      .from('supplier_profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('status', 'approved')
      .single();

    // Fetch current published_version to detect first-time publish
    const { data: currentLib } = await supabase
      .from('component_collections')
      .select('published_version')
      .eq('id', id)
      .single();

    const isFirstPublish = input.visibility === 'published' &&
      (!currentLib?.published_version || currentLib.published_version === 0);

    // Enforce SKU requirement: all components must have a SKU before publishing
    if (isFirstPublish) {
      const { count: missingSkuCount } = await supabase
        .from('component_library')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', id)
        .eq('is_active', true)
        .or('sku.is.null,sku.eq.');
      if (missingSkuCount && missingSkuCount > 0) {
        return { ok: false, message: `Cannot publish: ${missingSkuCount} component(s) are missing a SKU / Product Code. Add SKUs to all components before publishing.` };
      }
    }

    const update: Record<string, unknown> = {};
    if (input.visibility !== undefined) {
      update.visibility = input.visibility;
      if (input.visibility === 'published') {
        update.publication_status = 'published';
        update.published_at = new Date().toISOString();
        if (supplierProfile) update.supplier_profile_id = supplierProfile.id;
      } else if (input.visibility === 'private') {
        update.publication_status = 'draft';
      }
    }
    if (input.public_title !== undefined) update.public_title = input.public_title;
    if (input.public_description !== undefined) update.public_description = input.public_description;
    if (input.roofing_types !== undefined) update.roofing_types = input.roofing_types;
    if (input.product_categories !== undefined) update.product_categories = input.product_categories;
    if (input.brands !== undefined) update.brands = input.brands;
    if (input.keywords !== undefined) update.keywords = input.keywords;

    const { error } = await supabase
      .from('component_collections')
      .update(update)
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (error) return { ok: false, message: error.message };

    // First-time publish: create baseline snapshot via RPC so future edits can be diffed
    if (isFirstPublish) {
      const { buildSnapshotArray } = await import('@/app/lib/supabase/sync-fields');
      const { data: currentComponents } = await supabase
        .from('component_library')
        .select(`
          id, name, component_type, measurement_type, sku, takeoff_slot, notes,
          default_material_rate, default_labour_rate,
          default_waste_type, default_waste_percent, default_waste_fixed,
          default_pitch_type, waste_unit,
          pack_price, pack_size, pack_coverage_m2,
          pricing_strategy, show_price_default, show_dimensions_default,
          eligible_for_orders, height_value_mm, depth_value_mm
        `)
        .eq('collection_id', id)
        .eq('is_active', true)
        .order('name');

      const snapshot = buildSnapshotArray(currentComponents ?? []);

      const { error: rpcError } = await supabase
        .rpc('supplier_publish_update', {
          p_library_id: id,
          p_snapshot: snapshot as unknown as import('@/app/lib/supabase/database.types').Json,
          p_publishing_user: profile.id,
        });

      if (rpcError) {
        console.error('[updateLibraryVisibility] Baseline snapshot RPC error:', rpcError);
        // Don't fail the whole operation - visibility was already updated successfully
      }
    }

    revalidatePath('/components');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
