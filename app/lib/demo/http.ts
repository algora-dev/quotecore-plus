import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createDemoRouteClient } from './route-client';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { readActiveDemoContext } from './context';
import { getDemoControl } from './control';
import { DemoError } from './errors';
export const DEMO_NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' };
export function demoJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: DEMO_NO_STORE }); }
export function demoErrorResponse(error: unknown) {
  if (error instanceof DemoError) return demoJson({ error: error.message, code: error.code }, error.status);
  console.error('[demo] operation failed', error instanceof Error ? error.message : 'unknown');
  return demoJson({ error: 'This demo action could not be completed. Please retry.', code: 'demo_unavailable' }, 503);
}
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new DemoError('Open the demo in this browser before continuing.', 403, 'demo_origin');
  }
}
export async function readSmallJson(request: NextRequest, maxBytes = 8192): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new DemoError('JSON is required.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new DemoError('Request body required.');
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new DemoError('Request is too large.', 413); } chunks.push(value); }
    const buffer = Buffer.concat(chunks); return JSON.parse(buffer.toString('utf8')) as unknown;
  } catch (error) { if (error instanceof DemoError) throw error; throw new DemoError('Invalid JSON.'); }
}
export async function requireDemoRequest(request: NextRequest) {
  if (!(await getDemoControl()).demoEnabled) throw new DemoError('The demo is currently unavailable.', 503, 'demo_off');
  const client = await createDemoRouteClient(request.nextUrl.hostname);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.is_anonymous !== true) throw new DemoError('An anonymous demo session is required.', 401, 'demo_auth');
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from('users').select('company_id').eq('id', user.id).maybeSingle();
  if (profileError) throw new DemoError('Session verification unavailable.', 503);
  if (!profile?.company_id) throw new DemoError('Your demo has expired. Start a new demo.', 410, 'demo_expired');
  const context = await readActiveDemoContext(profile.company_id, user.id);
  if (!context) throw new DemoError('Your demo has expired. Start a new demo.', 410, 'demo_expired');
  return { client, admin, user, context };
}
