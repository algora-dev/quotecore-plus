import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { authCookieOptions } from './cookie-config';

/**
 * Browser-side Supabase client, typed with the generated `Database`
 * interface so client components get the same type-safety as server code.
 *
 * IMPORTANT: all browser-side Supabase clients MUST be created through
 * this function (or `createFreeToolsClient`). createBrowserClient caches
 * a singleton — the first creation's options win — so a raw
 * createBrowserClient call without our shared cookieOptions would break
 * the cross-subdomain session (see cookie-config.ts).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(
        typeof window !== 'undefined' ? window.location.hostname : undefined,
      ),
    }
  );
}
