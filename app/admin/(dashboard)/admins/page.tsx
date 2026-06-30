import { requireAdmin } from '@/app/lib/supabase/server';
import { AdminManagerPanel } from './AdminManagerPanel';

export const dynamic = 'force-dynamic';

/**
 * Admin user management page.
 *
 * Lists all admin accounts, lets you create new admin logins,
 * change passwords, and revoke admin access.
 */
export default async function AdminAdminsPage() {
  await requireAdmin();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin accounts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage who can access the admin panel. Create new admin logins,
          change passwords, and revoke access.
        </p>
      </div>

      <AdminManagerPanel />
    </section>
  );
}
