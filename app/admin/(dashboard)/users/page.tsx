import Link from 'next/link';
import { requireAdmin } from '@/app/lib/supabase/server';
import { UsersPanel } from './UsersPanel';
import { getPaymentAttention } from './actions';
import { PaymentAttentionPanel } from './PaymentAttentionPanel';

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
  const attention = await getPaymentAttention();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          Search for a user by email or company name to manage their subscription,
          pause access, or delete their account.
        </p>
        <Link href="/admin/customer-accounts" className="mt-4 inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]">Create customer account</Link>
      </div>

      <PaymentAttentionPanel rows={attention.ok ? attention.rows : []} error={attention.ok ? null : attention.error} />

      <UsersPanel />
    </section>
  );
}
