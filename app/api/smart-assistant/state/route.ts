import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/smart-assistant/state?conversationId=...
 * Reconnect fetch: owner-scoped snapshot (messages + active run status) so the
 * UI can resume after refresh/reconnect without resubmitting anything.
 */
export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('sa_get_state', {
    p_conversation_id: conversationId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = (data as unknown[])[0] as
    | {
        conversation_id: string;
        active_run_id: string | null;
        run_status: string | null;
        messages: unknown;
      }
    | undefined;

  // sa_get_state returns zero rows for not-found / not-owner: same answer either
  // way, so callers learn nothing about other people's conversations.
  if (!row || !row.conversation_id) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  return NextResponse.json({
    conversation_id: row.conversation_id,
    active_run_id: row.active_run_id,
    run_status: row.run_status,
    messages: row.messages ?? [],
  });
}
