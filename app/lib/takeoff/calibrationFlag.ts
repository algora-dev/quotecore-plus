// Server-side feature flag for AI-assisted calibration (P4).
// Reads the real calibration_feature_flags table (backend migration
// quotecore_v2_patch_046_ai_calibration_p4.sql), mirroring the patch_042
// Smart Assistant pattern: SELECT-only RLS for members (own company),
// service-role writes only, absence of a row = disabled.
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Narrow typed shim: the generated database types do not (yet) include
 * calibration_feature_flags (they regenerate when the P4 migration is
 * applied). String relation name in, ordinary query builder out. No `any`.
 */
function fromByName(
  supabase: SupabaseClient,
  relation: string,
): ReturnType<SupabaseClient['from']> {
  return (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient['from']> }).from(relation);
}

/**
 * True only when the calibration_feature_flags table exists AND the company
 * has an enabled row (RLS read-own: members can only see their own company).
 * Never throws: any error - including the table not existing yet on a
 * pre-migration environment - returns false, so the AI calibration entry
 * point stays hidden until the migration + controlled rollout enable it.
 */
export async function companyHasAiCalibration(companyId: string): Promise<boolean> {
  try {
    if (!companyId) return false;
    const supabase = await createSupabaseServerClient();

    const { data: flagRow, error: flagError } = await fromByName(supabase, 'calibration_feature_flags')
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
