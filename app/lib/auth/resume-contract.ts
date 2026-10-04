/** Public session-resume contract. Never contains tokens, identities or permissions. */
export const RESUME_BUILD = 'pwa-session-20261004-r1';
export const RESUME_MARKER = '__qcp_resume';
export const RESUME_STORAGE_KEY = 'qcp-login-resume-attempt';
export const RESUME_LOOP_WINDOW_MS = 60_000;
export const SESSION_NO_STORE = 'private, no-store, max-age=0';
const INTERNAL = 'https://internal.invalid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Root-relative only, including encoded/backslash/control-character variants.
 * Returning a path is NOT authorization. Each destination keeps its own gates. */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 2048 || value !== value.trim()) return null;
  let check = value;
  for (let i = 0; i < 4; i++) {
    if (!check.startsWith('/') || check.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(check)) return null;
    try {
      const next = decodeURIComponent(check);
      if (next === check) break;
      check = next;
      if (i === 3) return null; // deeply encoded redirect tricks are not an app destination
    } catch { return null; }
  }
  try {
    const url = new URL(value, INTERNAL);
    if (url.origin !== INTERNAL || url.pathname.startsWith('//')) return null;
    // These are credential/action endpoints, not post-login navigation targets.
    const decodedPath = new URL(check, INTERNAL).pathname;
    if (/^\/(?:login|signup|auth|api|2fa|demo(?:-[^/]+)?)(?:\/|$)/i.test(decodedPath)) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

export function loginReturnPath(search: URLSearchParams): string {
  return safeReturnPath(search.get('redirect')) ?? safeReturnPath(search.get('next')) ?? '/';
}

/** A resume decision can only choose this user's current workspace or the
 * notification resolver, which independently checks delivery/user/tenant IDs. */
export function workspaceResumeDestination(requested: string, slug: string): string | null {
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(slug) || slug.startsWith('demo-')) return null;
  const base = `/${encodeURIComponent(slug)}`;
  const path = safeReturnPath(requested) ?? '/';
  const url = new URL(path, INTERNAL);
  url.searchParams.delete(RESUME_MARKER);
  if (url.pathname === '/pwa/open') {
    const delivery = url.searchParams.get('delivery');
    return delivery && UUID.test(delivery) ? `/pwa/open?delivery=${encodeURIComponent(delivery)}` : base;
  }
  if (url.pathname === '/') return base;
  if (url.pathname === base || url.pathname.startsWith(`${base}/`)) return url.pathname + url.search + url.hash;
  // Owner 2026-10-04: resume lands on the workspace HOME by default; an
  // explicit /assistant request still opens the assistant page.
  if (url.pathname === '/assistant') return `${base}/assistant`;
  return base;
}

export type ResumeResult =
  | { status: 'authenticated' | 'mfa_required' | 'onboarding'; destination: string }
  | { status: 'anonymous'; reason: 'missing' | 'invalid' }
  | { status: 'unavailable' }
  | { status: 'disabled' };

/** Validate again before client navigation. MFA is the sole extra permitted
 * route and its return destination is itself validated. Never follow a URL
 * from a malformed response, proxy/login HTML, or an untrusted provider. */
export function parseResumeResult(value: unknown): ResumeResult | null {
  if (!value || typeof value !== 'object') return null;
  const x = value as Record<string, unknown>;
  if (x.status === 'anonymous' && (x.reason === 'missing' || x.reason === 'invalid')) return { status: x.status, reason: x.reason };
  if (x.status === 'disabled') return { status: 'disabled' };
  if (x.status === 'unavailable') return { status: 'unavailable' };
  if (x.status === 'authenticated' || x.status === 'onboarding') {
    const destination = safeReturnPath(x.destination);
    return destination ? { status: x.status, destination } : null;
  }
  if (x.status === 'mfa_required' && typeof x.destination === 'string') {
    try {
      const url = new URL(x.destination, INTERNAL);
      if (!x.destination.startsWith('/2fa?') || url.origin !== INTERNAL || url.pathname !== '/2fa' ||
          !safeReturnPath(url.searchParams.get('redirect'))) return null;
      return { status: x.status, destination: '/2fa?redirect=' + encodeURIComponent(url.searchParams.get('redirect')!) };
    } catch { return null; }
  }
  return null;
}

export function markResumeDestination(destination: string): string {
  const url = new URL(destination, INTERNAL);
  url.searchParams.set(RESUME_MARKER, '1');
  return url.pathname + url.search + url.hash;
}

/** URL loop marker survives a middleware redirect even if storage is blocked. */
export function hasResumeLoopMarker(search: URLSearchParams): boolean {
  if (search.has(RESUME_MARKER)) return true;
  for (const param of ['redirect', 'next']) {
    const path = search.get(param);
    if (!path) continue;
    try { if (new URL(path, INTERNAL).searchParams.has(RESUME_MARKER)) return true; } catch { /* ignore */ }
  }
  return false;
}

export function suppressAutomaticResume(search: URLSearchParams, hash = ''): boolean {
  return search.has('signedOut') || search.has('error') || search.has('signup') || search.has('token_hash') ||
    search.has('code') || /(?:access_token|refresh_token|error)=/.test(hash) || hasResumeLoopMarker(search);
}
