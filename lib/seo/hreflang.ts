/**
 * Hreflang language alternates for pages with genuine regional equivalents
 * on both quote-core.com (global) and quote-core.co.nz (NZ).
 *
 * ONLY call this for paths that exist on BOTH sites with equivalent purpose/content.
 * Pages without a regional equivalent must NOT emit hreflang at all.
 *
 * Shared equivalent paths (kept in sync with quotecore-nz/lib/hreflang.ts):
 * /, /about, /contact, /services, /roofing-quoting-software,
 * /construction-quoting-software, /free-trial, /coffee-terms,
 * /cookie-policy, /privacy, /terms
 */

const GLOBAL = "https://quote-core.com";
const NZ = "https://www.quote-core.co.nz";

export function hreflangLanguages(path: string): Record<string, string> {
  const cleanPath = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  return {
    "en-US": `${GLOBAL}${cleanPath}`,
    "en-GB": `${GLOBAL}${cleanPath}`,
    "en-NZ": `${NZ}${cleanPath}`,
    "x-default": `${GLOBAL}${cleanPath}`,
  };
}
