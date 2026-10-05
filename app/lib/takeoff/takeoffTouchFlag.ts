// Server-side feature flag for the mobile takeoff touch workspace (M2).
// Follows the calibrationFlag.ts (patch_046) pattern exactly: real
// takeoff_touch_feature_flags table (backend migration
// quotecore_v2_patch_051_takeoff_touch_flag.sql), SELECT-only RLS for members
// (own company), service-role writes only, absence of a row = disabled.
// Flag off = the desktop takeoff experience renders bit-for-bit; no new
// client code paths execute.
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Narrow typed shim: the generated database types do not (yet) include
 * takeoff_touch_feature_flags (they regenerate when patch_051 is applied).
 * String relation name in, ordinary query builder out. No `any`.
 */
function fromByName(
  supabase: SupabaseClient,
  relation: string,
): ReturnType<SupabaseClient['from']> {
  return (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient['from']> }).from(relation);
}

/**
 * True only when the takeoff_touch_feature_flags table exists AND the company
 * has an enabled row. Never throws: any error - including the table not
 * existing yet on a pre-migration environment - returns false, so the touch
 * workspace stays hidden until the migration + controlled rollout enable it.
 */
export async function companyHasTakeoffTouch(companyId: string): Promise<boolean> {
  try {
    if (!companyId) return false;
    const supabase = await createSupabaseServerClient();

    const { data: flagRow, error: flagError } = await fromByName(supabase, 'takeoff_touch_feature_flags')
      .select('enabled')
      .eq('company_id', companyId)
      .maybeSingle();
    // Pre-migration (table missing) or any other error = disabled.
    if (flagError || !flagRow) return false;
    return (flagRow as { enabled: boolean }).enabled === true;
  } catch {
    return false;
  }
}
