'use server';

import { getCurrentProfile } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Record the one-time Free Workspace entry-modal choice (owner 2026-11-07).
 * Company-level + first-stamp-wins so the modal shows once per account across
 * devices and users. companies is not user-writable through RLS, so this is a
 * service-role write (same pattern as the last_activity_at bump). Best-effort:
 * a failed stamp just means the modal may reappear next load, which is harmless.
 */
export async function recordFreeEntryChoice(action: 'start_demo' | 'continue'): Promise<{ ok: boolean }> {
  try {
    const profile = await getCurrentProfile();
    // Loose structural cast: the new columns are outside the generated types.
    const admin = createAdminClient() as unknown as {
      from(table: string): {
        update(row: Record<string, unknown>): {
          eq(col: string, val: string): { is(col: string, val: null): Promise<{ error: unknown }> };
        };
      };
    };
    const { error } = await admin
      .from('companies')
      .update({ free_entry_modal_action: action, free_entry_modal_seen_at: new Date().toISOString() })
      .eq('id', profile.company_id)
      .is('free_entry_modal_seen_at', null);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
