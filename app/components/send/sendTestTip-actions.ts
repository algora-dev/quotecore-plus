'use server';

import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

/**
 * Stamp the current user's `send_test_tip_seen_at` so the one-time
 * "test it on yourself first" tip never shows again. Idempotent, best-effort.
 */
export async function dismissSendTestTip(): Promise<{ ok: boolean }> {
  try {
    const profile = await getCurrentProfile();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('users')
      .update({ send_test_tip_seen_at: new Date().toISOString() })
      .eq('id', profile.id)
      .is('send_test_tip_seen_at', null);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
