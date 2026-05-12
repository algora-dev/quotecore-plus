import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { AdminLoginForm } from './AdminLoginForm';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

/**
 * Admin sign-in. Lives OUTSIDE the gated `(dashboard)` route group so
 * unauthenticated users can reach it without bouncing in a redirect
 * loop.
 *
 * If the caller is already signed in AND flagged as admin, jump straight
 * to /admin. If they're signed in but NOT admin, keep them here with a
 * not-admin notice so they can sign out and try a different account.
 */
export default async function AdminLoginPage({ searchParams }: Props) {
  const { error, redirect: redirectTo } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_admin) {
      redirect(redirectTo || '/admin');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <span>QuoteCore+</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white">Admin</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Admin sign-in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Internal operations console. Use your QuoteCore+ account credentials.
          </p>
        </div>

        {error === 'not_admin' ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">This account doesn&apos;t have admin access.</p>
            <p className="mt-1">
              Sign in with an admin account, or contact whoever set up your access if
              you think this is wrong.
            </p>
          </div>
        ) : null}

        <AdminLoginForm redirectTo={redirectTo || '/admin'} />

        <p className="mt-6 text-center text-xs text-slate-500">
          Not an admin? Use the{' '}
          <Link href="/login" className="text-slate-700 underline hover:text-slate-900">
            customer sign-in
          </Link>{' '}
          instead.
        </p>
      </div>
    </div>
  );
}
