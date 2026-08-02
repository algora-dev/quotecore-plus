/**
 * Hreflang language alternates for pages with genuine regional equivalents
 * on both quote-core.com (global) and quote-core.co.nz (NZ).
 *
 * ONLY call this for paths that exist on BOTH sites with equivalent purpose/content.
 * Pages without a regional equivalent must NOT emit hreflang at all.
 *
 * Keep the approved page map in docs/DUAL_DOMAIN_PAGE_MAP.md in sync.
 */

const GLOBAL = "https://quote-core.com";
const NZ = "https://www.quote-core.co.nz";

export function hreflangLanguages(path: string): Record<string, string> {
  const cleanPath = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  return {
    en: `${GLOBAL}${cleanPath}`,
    "en-NZ": `${NZ}${cleanPath}`,
    "x-default": `${GLOBAL}${cleanPath}`,
  };
}
