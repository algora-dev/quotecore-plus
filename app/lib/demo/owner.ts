import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/app/lib/supabase/server';
import { authCookieOptions } from '@/app/lib/supabase/cookie-config';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Demo/Workspace toggle (2026-11-02): attribution for guided-walkthrough
 * sandboxes. The demo identity lives in its own cookie namespace
 * (sb-qcp-demo-auth), but the visitor's NORMAL session cookie coexists in
 * the same browser by design (Architecture V2 §5). Production scopes the
 * app cookie to .quote-core.com, so the real session is readable from the
 * demo host too. Reading it here attributes the sandbox to the real
 * account without any auth-model change.
 */

export type DemoOwner = { userId: string; email: string };

/** Minimal read-only app-namespace client (normal cookie name). */
async function appSessionClient(hostname: string) {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(hostname),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
}

/** Read the real app session (normal cookie namespace) if present. */
export async function readDemoOwner(hostname: string): Promise<DemoOwner | null> {
  const client = await appSessionClient(hostname);
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return null;
  return { userId: user.id, email: user.email };
}

/**
 * Resolve the real user's workspace slug, used by the demo-mode "My
 * Workspace" link. The whole demo host is demo-namespace on production, so
 * the link must be absolute (app host + slug); on single-host testing a
 * relative /<slug> path switches back to the normal namespace.
 */
export async function readRealWorkspaceSlug(hostname: string): Promise<string | null> {
  const client = await appSessionClient(hostname);
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from('users').select('company_id').eq('id', user.id).maybeSingle();
  if (!profile?.company_id) return null;
  const { data: company } = await admin.from('companies').select('slug').eq('id', profile.company_id).maybeSingle();
  return (company as { slug?: string } | null)?.slug ?? null;
}

/**
 * First-stamp-wins: only fill an unattributed session, never reassign one
 * already linked to a different owner. Analytics stamps must never block the
 * demo itself - callers treat failures as best-effort.
 */
export async function stampDemoOwner(sessionId: string, owner: DemoOwner): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('demo_sessions')
    .update({ owner_user_id: owner.userId, owner_email: owner.email })
    .eq('id', sessionId)
    .is('owner_user_id', null);
  if (error) throw new Error(`demo owner stamp failed: ${error.message}`);
}
