import { NextResponse, type NextRequest } from 'next/server';
import { createDemoRouteClient } from '@/app/lib/demo/route-client';
import { DemoProvisionError, provisionDemo } from '@/app/lib/demo/provision';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demo/start
 * Body: {} — the anonymous identity must already exist in the demo cookie
 * namespace (the browser signs in anonymously first, then calls this).
 * Provisions (or resumes) the visitor's sandbox and returns its workspace slug.
 */
export async function POST(request: NextRequest) {
  try {
    const demo = await createDemoRouteClient(request.nextUrl.hostname);
    const { data: { user }, error: authError } = await demo.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No demo session. Open /demo and press Start.' }, { status: 401 });
    }
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;
    const { slug } = await provisionDemo(user.id, ip);
    return NextResponse.json({ slug });
  } catch (e) {
    if (e instanceof DemoProvisionError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[demo/start] unexpected', e);
    return NextResponse.json({ error: 'Demo is unavailable right now.' }, { status: 500 });
  }
}
