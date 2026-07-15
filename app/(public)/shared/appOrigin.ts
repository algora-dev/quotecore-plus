/**
 * Cross-domain handoff helpers for the free tools (2026-07-15).
 *
 * Free tools are served on the canonical marketing host (quote-core.com);
 * the app lives on app.quote-core.com. Any redirect that moves a user from
 * a free tool into the app (signup, save-to-app import) must be an
 * ABSOLUTE app-domain URL — a relative URL would bounce through the
 * middleware's public-domain 308 and previously dropped state on the way.
 *
 * On non-production hosts (vercel.app previews, localhost) marketing and
 * app are the same origin, so we return '' and relative URLs keep working.
 */
export function getAppOrigin(): string {
  if (typeof window === 'undefined') return '';
  const h = window.location.hostname.toLowerCase();
  if (
    h === 'quote-core.com' ||
    h === 'www.quote-core.com' ||
    h === 'quote-core.co.nz' ||
    h === 'www.quote-core.co.nz'
  ) {
    return 'https://app.quote-core.com';
  }
  return '';
}

/**
 * Set a handoff cookie that is visible on ALL quote-core.com subdomains
 * when on production, host-only elsewhere. Used for draft IDs / signup
 * context that must survive the marketing → app domain hop.
 */
export function setHandoffCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  if (typeof document === 'undefined') return;
  const h = window.location.hostname.toLowerCase();
  const domain =
    h === 'quote-core.com' || h.endsWith('.quote-core.com') ? '; domain=.quote-core.com' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${domain}`;
}

/** Expire a handoff cookie on both host-only and domain-wide scopes. */
export function clearHandoffCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
  const h = window.location.hostname.toLowerCase();
  if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
    document.cookie = `${name}=; path=/; max-age=0; domain=.quote-core.com`;
  }
}
