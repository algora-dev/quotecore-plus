/**
 * Domain-aware URL helpers.
 *
 * Production uses two hosts:
 *   - quote-core.com / www.quote-core.com -> marketing site
 *   - app.quote-core.com                   -> app (login, dashboard, etc.)
 *
 * On Vercel preview/dev deployments (*.vercel.app) there is only one host,
 * so both marketing and app content are served from the same origin.
 * These helpers detect the current host and return the correct app URL
 * so links never point to the wrong environment.
 */

const PRODUCTION_MARKETING_HOSTS = new Set([
  'quote-core.com',
  'www.quote-core.com',
  'quote-core.co.nz',
  'www.quote-core.co.nz',
]);

const PRODUCTION_APP_HOST = 'app.quote-core.com';

/**
 * Returns true when the given host is a production marketing domain
 * (quote-core.com, www, .co.nz variants).
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
 * - On *.vercel.app / localhost      -> same origin (so dev stays self-contained)
 */
export function appUrl(host?: string): string {
  if (!host) {
    if (typeof window !== 'undefined') {
      host = window.location.host;
    } else {
      return 'https://app.quote-core.com';
    }
  }

  if (isPreviewHost(host)) {
    return `${window.location.protocol}//${host}`;
  }

  return `https://${PRODUCTION_APP_HOST}`;
}

/**
 * Returns the base URL for the marketing site.
 *
 * - On quote-core.com / .co.nz       -> https://quote-core.com
 * - On app.quote-core.com            -> https://quote-core.com
 * - On *.vercel.app / localhost       -> same origin
 */
export function marketingUrl(host?: string): string {
  if (!host) {
    if (typeof window !== 'undefined') {
      host = window.location.host;
    } else {
      return 'https://quote-core.com';
    }
  }

  if (isPreviewHost(host)) {
    return `${window.location.protocol}//${host}`;
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
