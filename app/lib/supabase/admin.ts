import { createClient } from '@supabase/supabase-js';

/**
 * Service role (admin) client - bypasses RLS policies.
 * Use ONLY in server actions where security is enforced separately.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials. Check environment variables.');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
