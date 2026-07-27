/**
 * Domain-aware URL helpers.
 *
 * Production uses two hosts:
 *   - quote-core.com / www.quote-core.com -> marketing site
 *   - app.quote-core.com                   -> app (login, dashboard, etc.)
 *
 * On Vercel preview/dev deployments (*.vercel.app) there is only one host,
 * so both marketing and app content are served from the same origin.
 * These helpers return the correct app URL so links never point to the
 * wrong environment.
 *
 * IMPORTANT: During static prerender (build time), window is unavailable.
 * On preview hosts we return empty string (relative URL) so links resolve
 * to the same origin. On production we return the absolute app URL.
 */

const PRODUCTION_MARKETING_HOSTS = new Set([
  'quote-core.com',
  'www.quote-core.com',
  'quote-core.co.nz',
  'www.quote-core.co.nz',
]);

const PRODUCTION_APP_HOST = 'app.quote-core.com';

/**
 * Returns true when the given host is a production marketing domain.
 */
export function isProductionMarketingHost(host: string): boolean {
  return PRODUCTION_MARKETING_HOSTS.has(host);
}

/**
 * Returns true when the given host is a Vercel preview/dev domain
 * (*.vercel.app) or localhost.
 */
export function isPreviewHost(host: string): boolean {
  return (
    host.endsWith('.vercel.app') ||
    host === 'localhost' ||
    host.startsWith('127.0.0.1')
  );
}

/**
 * Returns the base URL for the app.
 *
 * - On production marketing domains -> https://app.quote-core.com
 * - On app.quote-core.com itself     -> https://app.quote-core.com
 * - On *.vercel.app / localhost      -> '' (empty string, so links are relative)
 *
 * Use as: href={`${appUrl()}/login`} or href={appUrl() || '/'}
 */
export function appUrl(host?: string): string {
  // Client-side: use window
  if (typeof window !== 'undefined') {
    host = host || window.location.host;
    if (isPreviewHost(host)) {
      return ''; // relative - same origin
    }
    return `https://${PRODUCTION_APP_HOST}`;
  }

  // Server-side / prerender: use provided host or fall back to production
  if (host) {
    if (isPreviewHost(host)) {
      return ''; // relative - will resolve correctly at runtime
    }
    return `https://${PRODUCTION_APP_HOST}`;
  }

  // No host info available (static prerender without context)
  return `https://${PRODUCTION_APP_HOST}`;
}

/**
 * Returns the base URL for the marketing site.
 *
 * - On quote-core.com / .co.nz       -> https://quote-core.com
 * - On app.quote-core.com            -> https://quote-core.com
 * - On *.vercel.app / localhost      -> '' (empty string, relative)
 */
export function marketingUrl(host?: string): string {
  if (typeof window !== 'undefined') {
    host = host || window.location.host;
    if (isPreviewHost(host)) {
      return '';
    }
    return 'https://quote-core.com';
  }

  if (host) {
    if (isPreviewHost(host)) {
      return '';
    }
    return 'https://quote-core.com';
  }

  return 'https://quote-core.com';
}

/**
 * Returns true if the given host should render the marketing homepage
 * (as opposed to the app landing page).
 *
 * - Production marketing domains -> true
 * - *.vercel.app / localhost      -> true (dev shows marketing, same as prod)
 * - app.quote-core.com            -> false
 */
export function shouldRenderMarketing(host: string): boolean {
  if (isProductionMarketingHost(host)) return true;
  if (isPreviewHost(host)) return true;
  return false;
}
