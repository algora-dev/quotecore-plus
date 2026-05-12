import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Service role (admin) client - bypasses RLS policies.
 * Use ONLY in server actions where security is enforced separately.
 *
 * Typed with the generated `Database` interface, so every `.from(table)`,
 * `.select(columns)`, `.rpc(fn, args)` call is checked against the live
 * schema. Regenerate `database.types.ts` whenever the schema changes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials. Check environment variables.');
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
