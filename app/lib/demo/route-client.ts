import 'server-only';
import type { Database } from '@/app/lib/supabase/database.types';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { demoAuthCookieOptions } from '@/app/lib/supabase/cookie-config';

/**
 * Demo-scoped server client for route handlers (Architecture V2 §5).
 * Reads/writes ONLY the demo cookie namespace (sb-qcp-demo-auth), so the
 * visitor's normal session cookie is never touched by demo flows.
 */
export async function createDemoRouteClient(hostname: string | null) {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: demoAuthCookieOptions(hostname),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set({ name, value, ...options });
            }
          } catch {
            // Called from a Server Component - cookies can't be set; the
            // browser client refreshes the demo session on its side.
          }
        },
      },
    }
  );
}
