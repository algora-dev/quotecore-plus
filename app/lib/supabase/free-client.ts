import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for the free tools project
 * (quote-core-free-tools, ref: dhpfjjbiobrrbvzdqyur).
 * Separate from the main app's Supabase project.
 */
export function createFreeToolsClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_FREE_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_FREE_SUPABASE_ANON_KEY!,
  );
}
