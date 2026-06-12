'use server';

import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

/**
 * Stamp the current user's `tutorials_seen_at` so the first-login Welcome modal
 * never shows again. Idempotent; best-effort (a failure just means the modal may
 * reappear next load, which is harmless).
 */
export async function dismissWelcomeModal(): Promise<{ ok: boolean }> {
  try {
    const profile = await getCurrentProfile();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('users')
      .update({ tutorials_seen_at: new Date().toISOString() })
      .eq('id', profile.id)
      .is('tutorials_seen_at', null);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
