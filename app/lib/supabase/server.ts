import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
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

export async function requireUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

export async function getCurrentProfile(existingClient?: SupabaseClient) {
  const supabase = existingClient ?? (await createSupabaseServerClient());
  const user = await requireUser();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, company_id')
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
}

export async function requireCompanyContext() {
  const profile = await getCurrentProfile();

  if (!profile.company_id) {
    throw new Error('No company context found for user');
  }

  return profile;
}