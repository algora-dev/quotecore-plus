import { NextResponse } from 'next/server';
import { createSessionTrace, sessionNoStore } from '@/app/lib/auth/session-trace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Compatibility sink for old installed bundles. The previous route accepted
 * arbitrary anonymous telemetry into a service-role table. New diagnostics
 * are opt-in console events with cookie NAMES/counts only and never write DB.
 * No existing table or migration is removed. This can be deleted once old
 * bundles are gone; current LoginSessionRecovery uses /api/auth/resume. */
export async function POST(request: Request) {
  const done = () => sessionNoStore(new NextResponse(null, { status: 204 }));
  if (process.env.PWA_SESSION_DIAGNOSTICS_ENABLED !== 'true') return done();
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      request.headers.get('sec-fetch-site') === 'cross-site' ||
      !request.headers.get('content-type')?.startsWith('application/json')) return done();
  const reader = request.body?.getReader();
  if (!reader) return done();
  let size = 0;
  try {
    // Consume a bounded legacy body but do not retain/log any field, especially
    // document.referrer, which may contain private identifiers or auth tokens.
    for (;;) {
      const { value, done: ended } = await reader.read();
      if (ended) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return done(); }
    }
    createSessionTrace(request, 'resume').finish('legacy_login_document', { names: [], deletions: 0 });
  } catch { /* Diagnostic failure never changes sign-in. */ }
  finally { reader.releaseLock(); }
  return done();
}
