import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { SuppressionsTable } from './SuppressionsTable';

export const dynamic = 'force-dynamic';

/**
 * Admin tool for managing the per-company suppression list (Messages
 * Phase 1 spec, 2026-05-12). When a recipient hits "Stop emailing me",
 * we add them here and the send pipeline blocks future sends. Users
 * cannot remove entries themselves; if a customer asks to be re-added
 * after the fact, the user files a support ticket and the admin (you)
 * removes the entry from this page.
 *
 * Why admin-only: this is undoing a legally-protected opt-out. The
 * friction is deliberate; the audit trail is the support ticket.
 */
export default async function SuppressionsPage() {
  await requireAdmin();
  if (false as never) throw new Error('unreachable');

  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from('message_suppressions')
    .select('id, company_id, email, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  // Pull company names so the table reads like "Acme Roofing \u2192 customer@x"
  // rather than just opaque UUIDs. One round trip with IN(...).
  const companyIds = Array.from(new Set((rows ?? []).map((r) => r.company_id)));
  const { data: companies } = companyIds.length
    ? await supabase.from('companies').select('id, name').in('id', companyIds)
    : { data: [] };
  const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  const entries = (rows ?? []).map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: companyNameById.get(r.company_id) ?? '(unknown company)',
    email: r.email,
    reason: r.reason,
    createdAt: r.created_at,
  }));

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Suppressions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Per-company email opt-outs. Remove an entry to allow future messages from that
          company to that address.
        </p>
      </div>

      <SuppressionsTable entries={entries} />
    </section>
  );
}
