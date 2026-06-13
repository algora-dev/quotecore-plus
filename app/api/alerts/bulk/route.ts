import { NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * Bulk alert operations for the Message Center, company-scoped.
 *
 * Body: { ids: string[], action: 'read' | 'unread' | 'todo' | 'active'
 *         | 'archive' | 'delete' }
 *
 *  - read / unread    -> set is_read
 *  - todo             -> status = 'todo'      (the "do later" cluster)
 *  - active           -> status = 'active'    (back to the main list)
 *  - archive          -> status = 'archived'  ("Done" / soft delete)
 *  - delete           -> HARD delete (only meaningful from the Archived view)
 */
type BulkAction = 'read' | 'unread' | 'todo' | 'active' | 'archive' | 'delete';
const ALLOWED: BulkAction[] = ['read', 'unread', 'todo', 'active', 'archive', 'delete'];

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * When an action-required alert is marked "Done" (archived), resolve the
 * underlying entity's action-required state so the "Action Required" badge on
 * the main list clears.
 *
 * The badge is DERIVED live per entity:
 *   - quote   -> any unresolved row in quote_revision_requests
 *   - order   -> changes_requested_at || info_requested_at on the order
 *   - invoice -> status === 'disputed' || disputed_at on the invoice
 *
 * Resolving = stamp/clear those so the derived badge no longer fires. We scope
 * every write by company_id (defence in depth on top of RLS). The invoice case
 * only touches still-disputed invoices: archiving a dispute alert means the
 * owner has handled it, so we move the invoice back to 'sent' and clear
 * disputed_at (we never silently mark it paid).
 */
async function clearActionRequiredForArchivedAlerts(
  supabase: ServerClient,
  companyId: string,
  alertIds: string[],
): Promise<void> {
  const { data: archived } = await supabase
    .from('alerts')
    .select('alert_type, quote_id, order_id, invoice_id')
    .in('id', alertIds)
    .eq('company_id', companyId);

  if (!archived || archived.length === 0) return;

  // Only act on the alert types that drive an Action-Required badge.
  const ACTION_TYPES = new Set([
    'revision_requested',
    'order_info_requested',
    'order_changes_requested',
    'invoice_disputed',
  ]);

  const quoteIds = new Set<string>();
  const orderIds = new Set<string>();
  const invoiceIds = new Set<string>();

  for (const a of archived) {
    if (!ACTION_TYPES.has(a.alert_type)) continue;
    if (a.quote_id) quoteIds.add(a.quote_id);
    if (a.order_id) orderIds.add(a.order_id);
    if (a.invoice_id) invoiceIds.add(a.invoice_id);
  }

  // Quotes: resolve any still-open revision requests for these quotes.
  if (quoteIds.size > 0) {
    await supabase
      .from('quote_revision_requests')
      .update({ resolved_at: new Date().toISOString() })
      .in('quote_id', Array.from(quoteIds))
      // L-01: explicit company filter for consistency with the order/invoice
      // side-effects below (defence-in-depth on top of the company-prefiltered
      // alert ids + RLS).
      .eq('company_id', companyId)
      .is('resolved_at', null);
  }

  // Orders: clear the change/info-request stamps.
  if (orderIds.size > 0) {
    await supabase
      .from('material_orders')
      .update({ changes_requested_at: null, info_requested_at: null })
      .in('id', Array.from(orderIds))
      .eq('company_id', companyId);
  }

  // Invoices: clear the dispute. Move a still-'disputed' invoice back to
  // 'sent' and null disputed_at; never auto-mark paid.
  if (invoiceIds.size > 0) {
    await supabase
      .from('invoices')
      .update({ disputed_at: null, status: 'sent' })
      .in('id', Array.from(invoiceIds))
      .eq('company_id', companyId)
      .eq('status', 'disputed');
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const bodyJson = (await request.json().catch(() => null)) as
      | { ids?: unknown; action?: unknown }
      | null;
    const ids = Array.isArray(bodyJson?.ids)
      ? bodyJson!.ids.filter((x): x is string => typeof x === 'string')
      : [];
    const action = bodyJson?.action as BulkAction | undefined;

    if (!action || !ALLOWED.includes(action)) {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No alerts selected.' }, { status: 400 });
    }

    const scope = supabase.from('alerts');
    let error: { message: string } | null = null;

    if (action === 'delete') {
      ({ error } = await scope.delete().in('id', ids).eq('company_id', profile.company_id));
    } else if (action === 'read' || action === 'unread') {
      ({ error } = await scope
        .update({ is_read: action === 'read' })
        .in('id', ids)
        .eq('company_id', profile.company_id));
    } else {
      // status moves: todo | active | archive(->archived)
      const status = action === 'archive' ? 'archived' : action;
      ({ error } = await scope
        .update({ status })
        .in('id', ids)
        .eq('company_id', profile.company_id));

      // "Done" (archive) resolves the work. If any archived alert is an
      // action-required alert (dispute / change request / info request), also
      // clear the SOURCE entity's action-required flag so the "Action
      // Required" badge on the Quotes/Orders/Invoices list drops. Without
      // this, marking the alert Done leaves the badge stuck forever
      // (bug 2026-06-10). Best-effort: badge clearing must not fail the
      // archive itself.
      if (!error && action === 'archive') {
        try {
          await clearActionRequiredForArchivedAlerts(supabase, profile.company_id, ids);
        } catch (e) {
          console.error('[alerts/bulk] clear action-required flags failed:', e);
        }
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: ids.length });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
