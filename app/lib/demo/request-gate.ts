import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { demoAuthCookieOptions } from '@/app/lib/supabase/cookie-config';
import { readGuide, isSessionActive } from './model';
import { canEnterChapter } from './guide';
const safeHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
/** All demo navigation and API requests go through this boundary BEFORE the
 * ordinary middleware's /api and preview-host shortcuts. Product actions also
 * recheck ownership. No normal cookie is rewritten or sent as demo auth. */
export async function guardDemoRequest(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  // The public entry and signed customer experience validate in their own handlers.
  if (path === '/demo' || path.startsWith('/demo/quote/') || path.startsWith('/api/demo/')) {
    const res = NextResponse.next({ request }); for (const [k,v] of Object.entries(safeHeaders)) res.headers.set(k,v); return res;
  }
  const changes: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const client = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: demoAuthCookieOptions(request.nextUrl.hostname), cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: batch => { for (const item of batch) { request.cookies.set(item.name, item.value); changes.push(item); } },
    },
  });
  const finish = (response: NextResponse) => {
    for (const { name, value, options } of changes) response.cookies.set({ name, value, ...options });
    for (const [key,value] of Object.entries(safeHeaders)) response.headers.set(key,value);
    return response;
  };
  const deny = (message: string, status = 403) => finish(NextResponse.json({ error: message, code: 'demo_restricted' }, { status }));
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous !== true) {
      return path.startsWith('/api/') || request.method !== 'GET' ? deny('Open /demo to start an anonymous demo.', 401)
        : finish(NextResponse.redirect(new URL('/demo', request.url)));
    }
    const profile = await client.from('users').select('company_id').eq('id', user.id).maybeSingle();
    if (!profile.data) return deny('Demo profile unavailable. Start again at /demo.', 410);
    const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const [session, control] = await Promise.all([
      admin.from('demo_sessions').select('id,status,expires_at,tutorial_state').eq('anon_user_id', user.id)
        .eq('company_id', profile.data.company_id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('demo_control').select('demo_enabled,ai_enabled').eq('id', 1).maybeSingle(),
    ]);
    if (session.error || control.error) return deny('Demo verification is temporarily unavailable.', 503);
    if (process.env.DEMO_V2_TEST_ENABLED !== 'true' || !control.data?.demo_enabled) return deny('The demo is switched off.', 503);
    if (!session.data || !isSessionActive(session.data.status, session.data.expires_at)) {
      return path.startsWith('/api/') || request.method !== 'GET' ? deny('Demo expired. Start again at /demo.', 410)
        : finish(NextResponse.redirect(new URL('/demo?expired=1', request.url)));
    }
    const state = readGuide(session.data.tutorial_state);
    if (path.startsWith('/api/')) {
      // Default deny: adding a new paid/external API does not silently expose it.
      const cheap = /^\/api\/(alerts(?:\/|$)|catalog-rows(?:\/|$)|currency(?:\/|$)|docs(?:\/|$)|build-id$|takeoff-diagnostics(?:\/|$)|invoices\/(catalog-rows|quote-search|templates)(?:\/|$))/;
      if (path.startsWith('/api/smart-assistant/')) {
        const knownAssistantRoutes = new Set(['/api/smart-assistant/state','/api/smart-assistant/turn','/api/smart-assistant/transcribe','/api/smart-assistant/v2/session','/api/smart-assistant/v2/actions','/api/smart-assistant/v2/navigation','/api/smart-assistant/v2/task','/api/smart-assistant/v2/speak']);
        if (!knownAssistantRoutes.has(path)) return deny('This assistant route has not been approved for the demo.');
        if (state.chapter !== 'smart-assistant' && state.chapter !== 'complete') return deny('Start the guided Smart Assistant chapter first.');
        if (/\/(turn|transcribe|speak)$/.test(path) && !control.data.ai_enabled) return deny('Demo AI is currently switched off.');
      } else if (path === '/api/takeoff/ai-scan-v3') {
        if (!canEnterChapter(state, 'takeoff')) return deny('Create and test your component before guided Takeoff.');
      } else if (!cheap.test(path)) return deny('This capability is not available in the demo.');
    } else {
      const parts = path.split('/').filter(Boolean); const section = parts[1];
      const allowed = new Set(['quotes','components','catalogs','drawings','material-orders','invoices','job-spaces','inbox','templates','customer-quote-templates','tutorials','resources','attachments','supplier-directory','demo-guide','assistant']);
      const sa = section === 'account' && parts[2] === 'smart-assistant';
      if (section && !allowed.has(section) && !sa) {
        if (request.method === 'GET') return finish(NextResponse.redirect(new URL(`/${parts[0]}/demo-guide?restricted=1`, request.url)));
        return deny('Account, integration and external actions are unavailable in the demo.');
      }
      if (section === 'supplier-directory' && request.method !== 'GET') return deny('The supplier directory is read-only in the demo.');
      if (sa && request.method !== 'GET') return deny('Assistant settings are read-only in the demo. Use the guided assistant.');
    }
    return finish(NextResponse.next({ request }));
  } catch { return deny('Demo verification is temporarily unavailable.', 503); }
}
