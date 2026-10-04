import { AUTH_COOKIE_NAME, DEMO_COOKIE_NAME } from '@/app/lib/supabase/cookie-config';
import { RESUME_BUILD, SESSION_NO_STORE } from './resume-contract';

export function sessionNoStore<T extends { headers: { set: (name: string, value: string) => unknown } }>(response: T): T {
  response.headers.set('Cache-Control', SESSION_NO_STORE);
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export function entryCategory(path: string): 'assistant_entry' | 'notification_entry' | 'login' | 'mfa' | 'workspace' | 'other' {
  if (path === '/assistant') return 'assistant_entry';
  if (path === '/pwa/open') return 'notification_entry';
  if (path === '/login') return 'login';
  if (path === '/2fa') return 'mfa';
  return /\/assistant$/.test(path) ? 'workspace' : 'other';
}

/** Names only; never retain cookie values, tokens, user IDs, session IDs or
 * arbitrary cookie-name strings supplied by a caller. Inspect the original
 * header so duplicate names aren't hidden by a cookie adapter's Map. */
export function authCookieInventory(header: string) {
  const names = header.split(';').slice(0, 128).map(c => c.trim().split('=', 1)[0]);
  const own = names.filter(n => n === AUTH_COOKIE_NAME || /^sb-qcp-auth\.\d+$/.test(n));
  const chunks = own.filter(n => n !== AUTH_COOKIE_NAME).map(n => Number(n.slice(AUTH_COOKIE_NAME.length + 1))).filter(n => n >= 0 && n < 32);
  const unique = [...new Set(chunks)].sort((a, b) => a - b);
  return {
    normalCount: own.length,
    normalBase: own.includes(AUTH_COOKIE_NAME),
    chunks: unique,
    chunkGap: unique.some((value, i) => value !== i),
    duplicateNames: new Set(own).size !== own.length,
    demoCount: names.filter(n => n === DEMO_COOKIE_NAME || /^sb-qcp-demo-auth\.\d+$/.test(n)).length,
    legacyCount: names.filter(n => /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/.test(n)).length,
  };
}

/** Opt-in structured console telemetry. No service-role DB writes. The only
 * caller-controlled fields logged are clamped enums, never URLs or text. */
export function createSessionTrace(request: Request, stage: 'middleware' | 'resume') {
  const category = entryCategory(new URL(request.url).pathname);
  const enabled = process.env.PWA_SESSION_DIAGNOSTICS_ENABLED === 'true' && (stage === 'resume' || category !== 'other');
  const id = crypto.randomUUID();
  const start = Date.now();
  const received = authCookieInventory(request.headers.get('cookie') ?? '');
  let refreshRequests = 0;
  const refreshStatuses: number[] = [];
  const steps: { stage: string; outcome: string; elapsedMs: number }[] = [];
  return {
    id,
    enabled,
    observe(stage: string, outcome: string) {
      if (enabled && steps.length < 8 && ['auth','profile','mfa','company'].includes(stage) &&
          ['missing','invalid','temporary','unknown','none','verified','unavailable','found','challenge','satisfied','ready','onboarding'].includes(outcome)) {
        steps.push({ stage, outcome, elapsedMs: Date.now() - start });
      }
    },
    fetch: (base: typeof fetch): typeof fetch => !enabled ? base : async (input, init) => {
      let isRefresh = false;
      try {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        isRefresh = url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token';
      } catch { /* no diagnostic URL parsing affects the real request */ }
      if (isRefresh) refreshRequests++;
      try {
        const result = await base(input, init);
        if (isRefresh && refreshStatuses.length < 4) refreshStatuses.push(result.status);
        return result;
      } catch (error) {
        if (isRefresh && refreshStatuses.length < 4) refreshStatuses.push(0);
        throw error;
      }
    },
    finish(outcome: string, changes: { names: string[]; deletions: number }, extra: { destination?: string; authCategory?: string } = {}) {
      if (!enabled) return;
      console.info('qcp_session_trace', {
        build: RESUME_BUILD, id, stage, entry: category, outcome,
        displayMode: request.headers.get('x-qcp-display-mode') === 'standalone' ? 'standalone' : 'unknown_or_browser',
        trigger: ['mount','pageshow','foreground','online','manual'].includes(request.headers.get('x-qcp-resume-trigger') ?? '') ? request.headers.get('x-qcp-resume-trigger') : undefined,
        received,
        emittedCookieNames: changes.names.filter(n => /^sb-qcp-(?:demo-)?auth(?:\.\d+)?$/.test(n)),
        deletions: changes.deletions, refreshRequests, refreshStatuses, steps,
        destinationKind: extra.destination ? entryCategory(new URL(extra.destination, 'https://internal.invalid').pathname) : undefined,
        authCategory: extra.authCategory, elapsedMs: Date.now() - start,
      });
    },
  };
}
