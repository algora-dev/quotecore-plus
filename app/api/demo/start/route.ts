import type { NextRequest } from 'next/server';
import { createDemoRouteClient } from '@/app/lib/demo/route-client';
import { provisionDemo, probeDemo } from '@/app/lib/demo/provision';
import { assertSameOrigin, demoJson, demoErrorResponse } from '@/app/lib/demo/http';
import { requestIp } from '@/app/lib/demo/identity';
import { DemoError } from '@/app/lib/demo/errors';
import { demoCurrencyFromAcceptLanguage } from '@/app/lib/demo/seed-data';
import { seedDemoAssistantPermissionsBestEffort } from '@/app/lib/demo/assistant.server';
import { readDemoOwner, stampDemoOwner } from '@/app/lib/demo/owner';
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
    // Demo toggle (2026-11-02): attribute the sandbox to the real account that
    // launched it when the normal app session coexists. Best-effort - a stamp
    // failure must never block the walkthrough itself.
    const owner = await readDemoOwner(request.nextUrl.hostname);
    if (body.probe === true) {
      const probe = await probeDemo(user.id);
      if (probe && owner) { try { await stampDemoOwner(probe.sessionId, owner); } catch { /* best-effort */ } }
      return demoJson(probe ?? { needsSetup: true });
    }
    const system = body.system === 'imperial_ft' || body.system === 'imperial_rs' ? body.system : 'metric';
    const currency = demoCurrencyFromAcceptLanguage(request.headers.get('accept-language'));
    const result = await provisionDemo(user.id, requestIp(request.headers), false, system, currency, owner);
    if (owner && result.resumed) { try { await stampDemoOwner(result.sessionId, owner); } catch { /* best-effort */ } }
    await seedDemoAssistantPermissionsBestEffort(client);
    return demoJson(result);
  } catch (error) { return demoErrorResponse(error); }
}
