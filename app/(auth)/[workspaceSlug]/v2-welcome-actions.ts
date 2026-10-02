'use server';

import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

/**
 * Stamp the current user's `v2_welcome_seen_at` so the one-time V2 welcome
 * never shows again. Idempotent; best-effort (a failure just means the modal
 * may reappear next load, which is harmless).
 */
export async function dismissV2Welcome(): Promise<{ ok: boolean }> {
  try {
    const profile = await getCurrentProfile();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('users')
      .update({ v2_welcome_seen_at: new Date().toISOString() })
      .eq('id', profile.id)
      .is('v2_welcome_seen_at', null);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
