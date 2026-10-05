'use client';

import { createBrowserClient } from '@supabase/ssr';
import { demoAuthCookieOptions } from '@/app/lib/supabase/cookie-config';

/**
 * Demo-scoped browser client (Architecture V2 §5). Identical to the app client
 * except the cookie name is the demo namespace, so a visitor can be signed
 * into the demo and into their real account in the same browser at the same
 * time with zero interaction between them.
 */
export function createDemoBrowserClient() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: demoAuthCookieOptions(hostname) }
  );
}
