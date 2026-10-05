import type { NextRequest } from 'next/server';
import { createDemoRouteClient } from '@/app/lib/demo/route-client';
import { provisionDemo, probeDemo } from '@/app/lib/demo/provision';
import { assertSameOrigin, demoJson, demoErrorResponse } from '@/app/lib/demo/http';
import { requestIp } from '@/app/lib/demo/identity';
import { DemoError } from '@/app/lib/demo/errors';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const client = await createDemoRouteClient(request.nextUrl.hostname);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || user?.is_anonymous !== true) throw new DemoError('Open /demo to establish an anonymous demo session.', 401);
    const body = await request.json().catch(() => ({})) as { probe?: boolean; system?: string };
    if (body.probe === true) return demoJson(await probeDemo(user.id) ?? { needsSetup: true });
    const system = body.system === 'imperial_ft' || body.system === 'imperial_rs' ? body.system : 'metric';
    return demoJson(await provisionDemo(user.id, requestIp(request.headers), false, system));
  } catch (error) { return demoErrorResponse(error); }
}
