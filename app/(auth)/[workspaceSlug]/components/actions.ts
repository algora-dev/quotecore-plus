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

  revalidatePath('/components');
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
] as const;

export async function updateComponent(id: string, input: Partial<ComponentLibraryInsert>) {
  const profile = await requireCompanyContext();

  // Whitelist columns before passing to the DB; see pickFields.ts for why.
  const update = pickFields(input as Record<string, unknown>, UPDATABLE_COMPONENT_FIELDS);

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
  revalidatePath('/components');
  return data;
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
  revalidatePath('/components');
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
    .select('id, name, is_bootstrap')
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
