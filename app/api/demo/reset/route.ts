import type { NextRequest } from 'next/server';
import { provisionDemo } from '@/app/lib/demo/provision';
import { assertSameOrigin, requireDemoRequest, demoJson, demoErrorResponse, readSmallJson } from '@/app/lib/demo/http';
import { requestIp } from '@/app/lib/demo/identity';
import { DemoError } from '@/app/lib/demo/errors';
import { isRecord } from '@/app/lib/demo/model';
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
    return demoJson(await provisionDemo(user.id, requestIp(request.headers), true));
  } catch (error) { return demoErrorResponse(error); }
}
