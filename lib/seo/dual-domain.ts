/**
 * Domain-aware SEO helpers for dual-domain setup (quote-core.com + quote-core.co.nz).
 *
 * Free tools render on BOTH domains. When on .co.nz, we serve NZ-targeted
 * metadata (lang, title, description, canonical) so Google indexes it as
 * a distinct NZ-focused page.
 */

const NZ_HOSTS = new Set([
  'quote-core.co.nz',
  'www.quote-core.co.nz',
]);

const GLOBAL_HOST = 'quote-core.com';

/**
 * Returns true when the given host is a NZ marketing domain.
 */
export function isNzHost(host: string): boolean {
  return NZ_HOSTS.has(host);
}

/**
 * Returns the canonical origin for the current host.
 * - .co.nz hosts -> https://www.quote-core.co.nz
 * - everything else -> https://quote-core.com
 */
export function canonicalOrigin(host: string): string {
  return isNzHost(host) ? `https://www.quote-core.co.nz` : `https://${GLOBAL_HOST}`;
}

/**
 * Returns the html lang attribute for the current host.
 * - .co.nz -> "en-NZ"
 * - everything else -> "en"
 */
export function htmlLang(host: string): string {
  return isNzHost(host) ? 'en-NZ' : 'en';
}

/**
 * Returns hreflang alternates for a given path, pointing to both domains.
 * Only call for paths that exist on BOTH domains (i.e. free tools).
 */
export function dualDomainHreflang(path: string): Record<string, string> {
  const cleanPath = path === '' ? '/' : path.startsWith('/') ? path : `/${path}`;
  return {
    'en': `https://${GLOBAL_HOST}${cleanPath}`,
    'en-NZ': `https://www.quote-core.co.nz${cleanPath}`,
    'x-default': `https://${GLOBAL_HOST}${cleanPath}`,
  };
}
