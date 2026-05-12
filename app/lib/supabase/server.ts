import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import type { Database } from './database.types';

/**
 * Re-export of the generated `Database` interface so the rest of the app
 * can `import type { Database } from '@/app/lib/supabase/server'` without
 * remembering the deeper path. Regenerate `database.types.ts` whenever the
 * schema changes (`supabase gen types typescript ...`).
 */
export type { Database };

/**
 * Convenience aliases for table Row/Insert/Update types so call sites can
 * write `Tables<'quotes'>` instead of the full conditional indexed type.
 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // ignore in contexts where cookies cannot be mutated
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // ignore in contexts where cookies cannot be mutated
          }
        },
      },
    }
  );
}

// Deduplicated per-request: only calls Supabase auth API once per render
export const requireUser = cache(async () => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
});

// Deduplicated per-request: only queries profile once per render
export const getCurrentProfile = cache(async (existingClient?: SupabaseClient<Database>) => {
  const supabase = existingClient ?? (await createSupabaseServerClient());
  const user = await requireUser();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, company_id, is_admin')
    .eq('id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Profile not found');
  }

  return data;
});

// Deduplicated per-request: only runs company check once per render
export const requireCompanyContext = cache(async (options?: { skipOnboardingCheck?: boolean }) => {
  const profile = await getCurrentProfile();

  if (!profile.company_id) {
    throw new Error('No company context found for user');
  }

  if (!options?.skipOnboardingCheck) {
    const { redirect } = await import('next/navigation');
    const supabase = await createSupabaseServerClient();
    
    const { data: company } = await supabase
      .from('companies')
      .select('onboarding_completed_at')
      .eq('id', profile.company_id)
      .single();
    
    if (!company?.onboarding_completed_at) {
      redirect('/onboarding');
    }
  }

  return profile;
});

/**
 * Gate the /admin surface: ensures the caller is signed in AND has the
 * `is_admin` flag on their users row. Anything else redirects to the
 * admin login page (which carries a `redirect=<pathname>` query so we
 * land them back where they came from after sign-in).
 *
 * Use from the `app/admin/*` server components/actions. The middleware
 * already enforces the sign-in part, but we redo it here so the helper
 * is safe to call from anywhere without depending on middleware
 * ordering. The is_admin lookup runs once per request (React `cache`).
 */
export const requireAdmin = cache(async () => {
  const { redirect } = await import('next/navigation');
  const profile = await getCurrentProfile().catch(() => null);
  if (!profile) {
    redirect('/admin/login');
    // `redirect` throws a control-flow error and never returns; this
    // throw is for the type-checker which can't see through the dynamic
    // `await import('next/navigation')` and otherwise widens `profile`
    // on the next line back to `null`.
    throw new Error('unreachable');
  }
  if (!profile.is_admin) {
    redirect('/admin/login?error=not_admin');
    throw new Error('unreachable');
  }
  return profile;
});
