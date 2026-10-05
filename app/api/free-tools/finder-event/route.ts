import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { TOOL_REGISTRY, normaliseQuery } from '@/app/(public)/free-tools/tool-registry';

export const runtime = 'nodejs';

/**
 * Smart Tool Finder query intelligence (append-only event stream).
 *
 * One row per query event, one row per click event; joined via
 * session_id + timestamp window. Writes only happen here with the
 * service role - the table has no client access (RLS on, no policies).
 *
 * Sanitisation: emails + phone-like runs stripped, 300-char cap, empty
 * rows dropped. Responds 204 always (fire-and-forget sendBeacon/keepalive).
 */

const REGISTRY_IDS = new Set(TOOL_REGISTRY.filter(t => t.showInFinder !== false).map(t => t.id));
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

function sanitise(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(EMAIL_RE, ' ').replace(PHONE_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

let eventsClient: ReturnType<typeof createServiceClient<Database>> | null = null;
function getClient() {
  if (eventsClient) return eventsClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  eventsClient = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return eventsClient;
}

interface FinderEventBody {
  sessionId?: unknown;
  query?: unknown;
  queryCategory?: unknown;
  matchMethod?: unknown;
  confidenceScore?: unknown;
  recommendedToolIds?: unknown;
  noMatch?: unknown;
  clickedToolId?: unknown;
  clickedPosition?: unknown;
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req.headers);
  const allowed = await checkRateLimit(`ft-finder-evt:${ip}`, 30, 60 * 1000);
  if (!allowed) return new NextResponse(null, { status: 429 });

  let body: FinderEventBody;
  try {
    body = await req.json() as FinderEventBody;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim().slice(0, 100) : '';
  if (!sessionId) return new NextResponse(null, { status: 204 });

  const client = getClient();
  if (!client) return new NextResponse(null, { status: 204 });

  // Click event: minimal payload, validate the tool id against the registry
  if (typeof body.clickedToolId === 'string') {
    const clickedToolId = body.clickedToolId;
    if (!REGISTRY_IDS.has(clickedToolId)) return new NextResponse(null, { status: 204 });
    const position = Number(body.clickedPosition);
    await client.from('free_tool_finder_events').insert({
      event_type: 'click',
      session_id: sessionId,
      clicked_tool_id: clickedToolId,
      clicked_position: Number.isInteger(position) && position >= 1 && position <= 3 ? position : null,
    }).then(() => undefined, () => undefined);
    return new NextResponse(null, { status: 204 });
  }

  // Query event: sanitise the raw text, drop the row if nothing survives
  const sanitised = sanitise(body.query);
  if (!sanitised) return new NextResponse(null, { status: 204 });

  const matchMethod = body.matchMethod === 'ai' ? 'ai' : 'deterministic';
  const confidence = Number(body.confidenceScore);
  const recommended = Array.isArray(body.recommendedToolIds)
    ? body.recommendedToolIds
        .filter((id): id is string => typeof id === 'string' && REGISTRY_IDS.has(id))
        .slice(0, 3)
    : [];

  await client.from('free_tool_finder_events').insert({
    event_type: 'query',
    session_id: sessionId,
    raw_query_sanitised: sanitised,
    normalised_query: normaliseQuery(sanitised) || null,
    query_category: typeof body.queryCategory === 'string' ? body.queryCategory.slice(0, 50) : null,
    match_method: matchMethod,
    confidence_score: Number.isFinite(confidence) ? Math.trunc(confidence) : null,
    recommended_tool_ids: recommended.length > 0 ? recommended : null,
    no_match: body.noMatch === true,
  }).then(() => undefined, () => undefined);

  return new NextResponse(null, { status: 204 });
}
