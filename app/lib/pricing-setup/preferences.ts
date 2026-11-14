import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentProfile } from '@/app/lib/supabase/server';

export async function readPricingSetupPreference() {
  const profile = await getCurrentProfile();
  const db = createAdminClient();
  // New additive tables are not yet in the deliberately pinned generated types.
  const { data, error } = await (db as unknown as SupabaseClient).from('pricing_setup_preferences')
    .select('always_open_library,seen_at').eq('user_id', profile.id).maybeSingle();
  if (error) throw new Error('Pricing setup preferences are unavailable. Apply the pricing setup migration.');
  return { alwaysOpenLibrary: data?.always_open_library === true, seen: !!data?.seen_at };
}

export async function writePricingSetupPreference(alwaysOpenLibrary?: boolean) {
  const profile = await getCurrentProfile();
  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: existing, error: readError } = await db.from('pricing_setup_preferences')
    .select('always_open_library,seen_at').eq('user_id', profile.id).maybeSingle();
  if (readError) throw new Error('Unable to access pricing setup preferences.');
  const { error } = await db.from('pricing_setup_preferences').upsert({
    user_id: profile.id,
    always_open_library: alwaysOpenLibrary ?? existing?.always_open_library ?? false,
    seen_at: existing?.seen_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error('Unable to remember your preference.');
}
