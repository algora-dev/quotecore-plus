/** Namespace selection is NOT authorization. The selected credential is always
 * verified server-side. Cookie presence alone must never switch a normal tab. */
export const DEMO_HOST = 'demo.quote-core.com';
export const DEMO_NAMESPACE_HEADER = 'x-qcp-auth-namespace';
export function isDemoLocation(hostname: string | null | undefined, pathname = ''): boolean {
  const host = (hostname ?? '').toLowerCase().split(':')[0];
  return host === DEMO_HOST || pathname === '/demo' || pathname.startsWith('/demo/')
    || pathname.startsWith('/api/demo/') || /^\/demo-[a-z0-9-]+(?:\/|$)/i.test(pathname);
}
export function isDemoRequest(host: string, path: string, origin: string, referer: string | null): boolean {
  if (isDemoLocation(host, path)) return true;
  if (!path.startsWith('/api/') || !referer) return false;
  try { const ref = new URL(referer); return ref.origin === origin && isDemoLocation(ref.hostname, ref.pathname); }
  catch { return false; }
}
export function normalAccountHref(hostname: string, path = '/signup'): string {
  return hostname.endsWith('.vercel.app') || hostname === 'localhost' || hostname === '127.0.0.1'
    ? path : `https://app.quote-core.com${path}`;
}
export function demoFreeTakeoffHref(hostname: string): string {
  return hostname === DEMO_HOST ? 'https://quote-core.com/free-roof-takeoff' : '/free-roof-takeoff';
}
