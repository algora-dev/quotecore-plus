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
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: ids.length });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
