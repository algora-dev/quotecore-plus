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

  // Check if this is an impersonation session (admin viewing user's account)
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('qcp_impersonation')?.value;
    if (sessionId) {
      const { createAdminClient } = await import('./admin');
      const admin = createAdminClient();
      const { data: session } = await admin
        .from('admin_impersonation_sessions')
        .select('admin_user_id')
        .eq('id', sessionId)
        .is('ended_at', null)
        .gt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .maybeSingle();

      if (session) {
        const s = session as { admin_user_id: string };
        // Fetch admin email for banner
        const { data: adminUser } = await admin
          .from('users')
          .select('email')
          .eq('id', s.admin_user_id)
          .maybeSingle();

        return {
          ...data,
          isImpersonating: true as const,
          impersonationAdminUserId: s.admin_user_id,
          impersonationAdminEmail: (adminUser as { email: string })?.email ?? null,
        };
      }
    }
  } catch {
    // ignore — if cookie check fails, just return normal profile
  }

  // Check if this user's account is currently being impersonated by an admin
  // (user-facing banner). Only check for non-admin users.
  if (!data.is_admin) {
    try {
      const { createAdminClient } = await import('./admin');
      const admin = createAdminClient();
      const { data: activeSession } = await admin
        .from('admin_impersonation_sessions')
        .select('admin_user_id, started_at')
        .eq('target_user_id', user.id)
        .is('ended_at', null)
        .gt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSession) {
        const s = activeSession as { admin_user_id: string; started_at: string };
        return {
          ...data,
          isBeingImpersonated: true as const,
          impersonationStartedAt: s.started_at,
        };
      }
    } catch {
      // ignore — if check fails, just return normal profile
    }
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
