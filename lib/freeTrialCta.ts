/**
 * Reroute free-workspace signup CTAs to the /free-trial "See how it works"
 * page (owner reroute 2026-11-19, pairs with commit dbead92a). Keeps any
 * ?ref tag from the original signup href so attribution and per-tool
 * welcome flows survive the extra hop.
 */

/** Convert a /signup href (relative or absolute) into the /free-trial href, preserving ?ref. */
export function toFreeTrialHref(signupHref: string): string {
  let ref: string | null = null;
  try {
    ref = new URL(signupHref, 'https://quote-core.com').searchParams.get('ref');
  } catch {
    ref = null;
  }
  return ref ? `/free-trial?ref=${encodeURIComponent(ref)}` : '/free-trial';
}
