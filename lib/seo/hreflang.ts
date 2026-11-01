/**
 * Hreflang language alternates.
 *
 * NZ domain consolidation (2026-11-01): quote-core.co.nz is a permanent
 * redirect-only domain pointing at quote-core.com. Every page canonicalizes
 * to the global domain, so the default output declares only generic en +
 * x-default self-alternates.
 *
 * A page with a localized NZ equivalent passes the /nz path as the second
 * argument to add the reciprocal en-NZ alternate on the global domain.
 * The only current pair is the roofing quoting software page:
 *
 *   languages: hreflangLanguages('/roofing-quoting-software', '/nz/roofing-quoting-software')
 *
 * Pages without a regional equivalent must NOT declare an en-NZ alternate.
 */

const GLOBAL = "https://quote-core.com";

export function hreflangLanguages(path: string, nzPath?: string): Record<string, string> {
  const cleanPath = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const languages: Record<string, string> = {
    en: `${GLOBAL}${cleanPath}`,
    "x-default": `${GLOBAL}${cleanPath}`,
  };
  if (nzPath) {
    languages["en-NZ"] = `${GLOBAL}${nzPath.startsWith("/") ? nzPath : `/${nzPath}`}`;
  }
  return languages;
}
