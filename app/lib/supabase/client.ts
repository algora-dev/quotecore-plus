import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { authCookieOptionsForLocation, demoAuthCookieOptions, DEMO_COOKIE_NAME } from './cookie-config';
// @supabase/ssr has one default browser singleton, not one per cookie name.
// The demo MUST opt out, then own one separate instance per page context.
let isolatedDemo: ReturnType<typeof createBrowserClient<Database>> | null = null;
export function createIsolatedDemoClient() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : null;
  if (typeof window !== 'undefined' && isolatedDemo) return isolatedDemo;
  const client = createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: demoAuthCookieOptions(hostname), isSingleton: false,
  });
  if (typeof window !== 'undefined') isolatedDemo = client;
  return client;
}
export function createClient() {
  const options = authCookieOptionsForLocation(
    typeof window !== 'undefined' ? window.location.hostname : undefined,
    typeof window !== 'undefined' ? window.location.pathname : undefined,
  );
  if (options.name === DEMO_COOKIE_NAME) return createIsolatedDemoClient();
  // Normal/free-tool shared auth semantics intentionally remain unchanged.
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookieOptions: options });
}
