import type { ReactNode } from 'react';
import Link from 'next/link';
import { AdminNav } from './AdminNav';
import { requireAdmin } from '@/app/lib/supabase/server';

/**
 * Admin shell. Wraps every `/admin/*` page EXCEPT `/admin/login` (login
 * has its own route segment outside this layout when needed; we keep a
 * special-case here that lets the login page bypass the gate by
 * detecting itself).
 *
 * Gating: `requireAdmin()` redirects to `/admin/login` when the user
 * isn't authenticated or isn't flagged. Page-level guards are belt-and-
 * braces with middleware (which currently allows /admin/login through
 * unauthenticated but enforces auth elsewhere).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <span className="text-sm uppercase tracking-wide text-slate-300">QuoteCore+</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500 text-white">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span>{profile.email}</span>
            <Link
              href="/auth/signout"
              className="px-3 py-1 rounded-full border border-slate-600 hover:border-slate-400 hover:bg-slate-800 transition"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-6 lg:flex lg:gap-6">
        <aside className="lg:w-56 lg:flex-shrink-0 mb-4 lg:mb-0">
          <AdminNav />
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
