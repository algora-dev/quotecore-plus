import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import type { Json } from '@/app/lib/supabase/database.types';

export const runtime = 'nodejs';

/**
 * POST /api/free-tools/drafts — persist a free-tools draft server-side.
 *
 * WHY: free tools (quote-core.com) and the app (app.quote-core.com) are
 * different origins; localStorage does not cross them. Drafts created on
 * the marketing domain were invisible to the dashboard after signup. The
 * payload now lives in Postgres keyed by an unguessable UUID; only the
 * UUID travels through the signup/onboarding redirect chain (URL param +
 * cookie), and the dashboard fetches the payload back by ID.
 *
 * Anonymous-callable by design (T1 users aren't signed in yet), so it's
 * rate-limited per IP and payload-size capped. Reads (GET .../[id])
 * require an authenticated app session.
 */

const MAX_PAYLOAD_BYTES = 300_000; // generous: covers logo data-URIs
const CREATES_PER_DAY = 40;

export async function POST(req: NextRequest) {
  const ip = getClientIP(req.headers);
  const allowed = await checkRateLimit(
    `free-drafts-create:${ip}`,
    CREATES_PER_DAY,
    24 * 60 * 60 * 1000,
  );
  if (!allowed) {
    return NextResponse.json({ error: 'Too many drafts today. Try again later.' }, { status: 429 });
  }

  let body: { draftType?: string; payload?: unknown; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const draftType = body.draftType === 'smart_component' ? 'smart_component' : 'document';
  if (!body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(body.payload);
  } catch {
    return NextResponse.json({ error: 'Payload not serialisable' }, { status: 400 });
  }
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Draft too large' }, { status: 413 });
  }

  const email =
    typeof body.email === 'string' && body.email.length <= 320 ? body.email : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('free_document_drafts')
    .insert({ draft_type: draftType, payload: body.payload as Json, email })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[free-tools/drafts] insert failed:', error);
    return NextResponse.json({ error: 'Could not save draft' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
