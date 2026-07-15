import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/free-tools/drafts/[id] — fetch a persisted free-tools draft.
 *
 * Requires an authenticated app session (the dashboard / components page
 * calls this after signup). The unguessable UUID is the capability; the
 * session requirement stops anonymous bulk scraping on top of that.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('free_document_drafts')
    .select('id, draft_type, payload, email, created_at')
    .eq('id', id)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('[free-tools/drafts] fetch failed:', error);
    return NextResponse.json({ error: 'Could not load draft' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    draftType: data.draft_type,
    payload: data.payload,
    email: data.email,
    createdAt: data.created_at,
  });
}

/**
 * DELETE /api/free-tools/drafts/[id] — mark a draft consumed after it has
 * been successfully imported/restored. Idempotent.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin
    .from('free_document_drafts')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .is('consumed_at', null);

  return NextResponse.json({ ok: true });
}
