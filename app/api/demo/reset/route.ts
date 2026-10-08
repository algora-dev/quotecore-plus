import type { NextRequest } from 'next/server';
import { provisionDemo } from '@/app/lib/demo/provision';
import { assertSameOrigin, requireDemoRequest, demoJson, demoErrorResponse, readSmallJson } from '@/app/lib/demo/http';
import { requestIp } from '@/app/lib/demo/identity';
import { DemoError } from '@/app/lib/demo/errors';
import { isRecord } from '@/app/lib/demo/model';
import { createDemoRouteClient } from '@/app/lib/demo/route-client';
import { seedDemoAssistantPermissionsBestEffort } from '@/app/lib/demo/assistant.server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { user, context } = await requireDemoRequest(request);
    const body = await readSmallJson(request);
    if (!isRecord(body) || body.sessionId !== context.sessionId || body.confirm !== 'RESET') {
      throw new DemoError('Confirm the reset for the currently open demo.', 409);
    }
    // Owner 2026-10-05 (pass 6): "Start again" lets the visitor re-pick the
    // measurement system; without one the previous demo's units carry over.
    const system = ['metric', 'imperial_ft', 'imperial_rs'].includes(String(body.system))
      ? String(body.system) as 'metric' | 'imperial_ft' | 'imperial_rs' : undefined;
    const result = await provisionDemo(user.id, requestIp(request.headers), true, system);
    await seedDemoAssistantPermissionsBestEffort(await createDemoRouteClient(request.nextUrl.hostname));
    return demoJson(result);
  } catch (error) { return demoErrorResponse(error); }
}
