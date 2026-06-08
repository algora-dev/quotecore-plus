import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { InboxList } from './InboxList';

export const dynamic = 'force-dynamic';

/**
 * Message Center (v1) — a full inbox of every alert/message across quotes,
 * orders and invoices. The bell dropdown shows only recent items; this page
 * shows everything, with filter / mark-read / delete / open.
 */
export default async function InboxPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, alert_type, title, message, is_read, created_at, quote_id, invoice_id, order_id')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Message Center</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every alert and message from your quotes, orders and invoices in one place.
        </p>
      </div>
      <InboxList initialAlerts={alerts || []} workspaceSlug={workspaceSlug} />
    </div>
  );
}
