import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';

/**
 * Lightweight public usage-logging endpoint for free tools.
 * Logs completed meaningful actions (output generated, result shown, etc.)
 * into free_tool_usage so the admin panel tracks every important tool,
 * not just the 3 AI document parsers.
 *
 * - Tool code allowlist only (no free-form strings from the client).
 * - IP rate limited (60 events/hour) to keep junk out.
 * - Fire-and-forget insert; always returns 204, never leaks errors.
 */

const TOOL_ALLOWLIST: Record<string, string> = {
  'roof-takeoff': 'Free Roof Takeoff',
  'takeoff-builder': 'Free Roofing Takeoff Builder',
  'quote-builder': 'Free Quote Builder',
  'quote-gen': 'Quote Generator',
  'po-gen': 'Purchase Order Generator',
  'invoice-gen': 'Invoice Generator',
  calc: 'Trade Calculators',
};

const ACTIONS = new Set(['output', 'generate', 'result', 'print', 'upload', 'finish']);

let usageClient: ReturnType<typeof createServiceClient<Database>> | null = null;
function getUsageClient() {
  if (usageClient) return usageClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  usageClient = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return usageClient;
}

export async function POST(req: NextRequest) {
  const debug = req.headers.get('x-debug') === '1';
  const stages: string[] = [];
  let toolCode: string | null = null;
  let action = 'output';
  try {
    const body = await req.json() as { toolCode?: string; action?: string };
    toolCode = body.toolCode ?? null;
    action = body.action ?? 'output';
    stages.push('json-ok');
  } catch {
    stages.push('json-fail');
    if (debug) return NextResponse.json({ stages });
  }

  const toolName = toolCode ? TOOL_ALLOWLIST[toolCode] : undefined;
  if (!toolCode || !toolName || !ACTIONS.has(action)) {
    if (debug) return NextResponse.json({ stages: [...stages, `rejected tool=${toolCode} action=${action}`] });
    return new NextResponse(null, { status: 204 });
  }
  stages.push('allowlist-ok');

  const ip = getClientIP(req.headers);
  const allowed = await checkRateLimit(`ft-log:${ip}`, 60, 60 * 60 * 1000);
  stages.push(`ratelimit=${allowed}`);
  if (!allowed) {
    return new NextResponse(null, { status: 429 });
  }

  const client = getUsageClient();
  if (!client) {
    if (debug) return NextResponse.json({ stages: [...stages, 'no-env-client'] });
    return new NextResponse(null, { status: 204 });
  }
  stages.push('client-ok');

  // Await: Vercel suspends the function once the response returns, so a
  // fire-and-forget insert would never run. Insert is a single fast query.
  try {
    const { error } = await client.from('free_tool_usage').insert({
      tool_code: toolCode,
      tool_name: toolName,
      parse_mode: 'none',
      document_type: action,
      tier: 1,
      user_id: null,
      user_email: null,
      ip_address: debug ? 'debug-probe' : ip,
      has_app_account: false,
    });
    stages.push(error ? `insert-error=${error.message}` : 'insert-ok');
  } catch (err) {
    stages.push(`insert-throw=${err instanceof Error ? err.message : String(err)}`);
  }

  if (debug) return NextResponse.json({ stages, toolCode, action });
  return new NextResponse(null, { status: 204 });
}
