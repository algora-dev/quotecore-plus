import { requireAdmin } from '@/app/lib/supabase/server';
import { UsersPanel } from './UsersPanel';

export const dynamic = 'force-dynamic';

/**
 * Admin user management page.
 *
 * Search any user by email or company name, click through to their profile
 * to manage subscription, pause/resume access, send password reset, or
 * delete the account.
 */
export default async function AdminUsersPage() {
  await requireAdmin();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          Search for a user by email or company name to manage their subscription,
          pause access, or delete their account.
        </p>
      </div>

      <UsersPanel />
    </section>
  );
}
