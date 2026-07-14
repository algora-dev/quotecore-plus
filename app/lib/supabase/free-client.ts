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
    // Build-time fallback — real values are injected at runtime
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-anon-key');
  }
  return createBrowserClient(url, key);
}
