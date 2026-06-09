/**
 * URL helpers for emails.
 *
 * Order of precedence for the canonical site URL:
 *  1. NEXT_PUBLIC_SITE_URL (manually set, highest trust)
 *  2. VERCEL_PROJECT_PRODUCTION_URL (Vercel-injected, prod baseline)
 *  3. VERCEL_URL (current deployment URL)
 *  4. http://localhost:3000 (dev fallback)
 *
 * Always returns a URL without trailing slash.
 */

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodHost) return `https://${prodHost.replace(/\/$/, '')}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

/** Builds a fully qualified URL to a quote summary page. */
export function quoteSummaryUrl(workspaceSlug: string, quoteId: string): string {
  return `${getSiteUrl()}/${encodeURIComponent(workspaceSlug)}/quotes/${encodeURIComponent(quoteId)}/summary`;
}

/** Builds a fully qualified URL to the internal order preview page. */
export function orderPreviewUrl(workspaceSlug: string, orderId: string): string {
  return `${getSiteUrl()}/${encodeURIComponent(workspaceSlug)}/material-orders/${encodeURIComponent(orderId)}/preview`;
}

/** Builds a fully qualified URL to the internal invoice detail page. */
export function invoiceDetailUrl(workspaceSlug: string, invoiceId: string): string {
  return `${getSiteUrl()}/${encodeURIComponent(workspaceSlug)}/invoices/${encodeURIComponent(invoiceId)}`;
}

/** Builds the URL the user clicks from a security email to start a password reset. */
export function passwordResetStartUrl(): string {
  // Send them to login page; they can use "Forgot password?" from there.
  // Direct deep-linking would require a server-issued one-time link - overkill
  // for "secure your account now" CTAs.
  return `${getSiteUrl()}/login`;
}
