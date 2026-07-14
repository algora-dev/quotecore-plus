import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for the free tools project
 * (quote-core-free-tools, ref: dhpfjjbiobrrbvzdqyur).
 * Separate from the main app's Supabase project.
 *
 * Falls back to placeholder values during build/prerender when env vars
 * aren't injected yet, preventing build failures.
 */
export function createFreeToolsClient() {
  const url = process.env.NEXT_PUBLIC_FREE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_FREE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Build-time fallback so prerender doesn't crash. If this fires in a
    // real browser session it means NEXT_PUBLIC_FREE_SUPABASE_URL /
    // NEXT_PUBLIC_FREE_SUPABASE_ANON_KEY were missing from the Vercel
    // project at BUILD time (they are inlined into the bundle) — auth will
    // not work until they're added and the project is redeployed.
    if (typeof window !== 'undefined') {
      console.error(
        '[free-tools] Supabase env vars missing from build — free tools auth is disabled. ' +
        'Add NEXT_PUBLIC_FREE_SUPABASE_URL + NEXT_PUBLIC_FREE_SUPABASE_ANON_KEY to the Vercel project and redeploy.'
      );
    }
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-anon-key');
  }
  return createBrowserClient(url, key);
}
