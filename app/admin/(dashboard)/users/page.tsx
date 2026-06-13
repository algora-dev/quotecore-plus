import { requireAdmin } from '@/app/lib/supabase/server';
import { DeleteAccountPanel } from './DeleteAccountPanel';

export const dynamic = 'force-dynamic';

/**
 * Admin "Delete Account" tool.
 *
 * Search any user by email, review the matched company + what will be
 * removed, then perform a full irreversible tenant wipe (storage + auth
 * logins + company cascade) so the email can sign up again clean.
 *
 * There is no self-service account deletion in the app; this is the only
 * delete path. Admin-only (requireAdmin).
 */
export default async function AdminUsersPage() {
  await requireAdmin();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Delete account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Search a user by email, then permanently wipe their company tenant —
          all data, files, and login(s). The email becomes free to sign up again.
          This cannot be undone.
        </p>
      </div>

      <DeleteAccountPanel />
    </section>
  );
}
