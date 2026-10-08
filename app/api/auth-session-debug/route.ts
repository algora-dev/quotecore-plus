import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * POST /api/auth-session-debug (patch_055, TEMPORARY debug round).
 *
 * One-row-per-browser-session telemetry from the login page so the iOS PWA
 * "logged out after fully closing the app" issue can be diagnosed from
 * data: which sb-* cookies the browser actually sent (server-side view,
 * including httpOnly cookies the page cannot see), whether the load came
 * from a standalone PWA or a browser tab, and where the /login load
 * originated (middleware redirect vs direct cold start).
 *
 * Deliberately unauthenticated (users on /login have no session by
 * definition). No PII beyond the user agent; payload fields are clamped.
 * Best-effort: always 204, never blocks the page. Remove this route (and
 * the auth_session_debug table + AuthSessionDebugPing component) once the
 * issue is resolved.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const clamp = (value: unknown, max: number) => String(value ?? '').slice(0, max);
    const cookieNames = (request.headers.get('cookie') ?? '')
      .split(';')
      .map(c => c.trim().split('=')[0])
      .filter(name => name.startsWith('sb-'))
      .join(',');
    const admin = createAdminClient();
    await admin.from('auth_session_debug').insert({
      user_agent: clamp(request.headers.get('user-agent'), 300),
      referer: clamp(body.referer, 300),
      display_mode: clamp(body.displayMode, 40),
      cookie_names: cookieNames.slice(0, 300),
      source: clamp(body.source, 40),
    });
  } catch {
    // Best-effort telemetry - never surface an error to the login page.
  }
  return new NextResponse(null, { status: 204 });
}
