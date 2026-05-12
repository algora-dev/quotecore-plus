'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export type RemoveSuppressionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Admin-only action that removes a single row from message_suppressions.
 * Called from the Suppressions admin page (#13 in the 2026-05-12 batch).
 *
 * Gating: `requireAdmin()` checks `users.is_admin`. Service-role client
 * after that so we can write outside the caller's company.
 *
 * Note: there is no audit table for suppressions yet. If we want one
 * later we'd append the removal to `account_recovery_log` or create a
 * dedicated `suppression_audit` table. For now the action just records
 * the removal in the Vercel function logs.
 */
export async function removeSuppression(
  suppressionId: string,
): Promise<RemoveSuppressionResult> {
  const adminProfile = await requireAdmin();
  if (false as never) throw new Error('unreachable');

  const supabase = createAdminClient();
  const { data: row, error: loadErr } = await supabase
    .from('message_suppressions')
    .select('id, company_id, email')
    .eq('id', suppressionId)
    .maybeSingle();
  if (loadErr || !row) {
    return { ok: false, error: 'Suppression not found.' };
  }

  const { error } = await supabase
    .from('message_suppressions')
    .delete()
    .eq('id', suppressionId);
  if (error) {
    return { ok: false, error: error.message };
  }

  // Audit trail via console (admin tool, low volume; not a TODO worth
  // building a table for yet).
  console.log(
    `[admin/suppressions] removed: admin=${adminProfile.id} company=${row.company_id} email=${row.email}`,
  );

  revalidatePath('/admin/suppressions');
  return { ok: true };
}
