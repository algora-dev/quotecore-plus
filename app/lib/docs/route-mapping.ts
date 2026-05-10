/**
 * Map an in-app pathname to the most relevant docs slug. The drawer opens
 * to the matched slug; if nothing matches we fall back to the docs index.
 *
 * The order matters - first match wins. We strip the workspace slug
 * (`/[ws]/...`) before matching so we don't have to enumerate every
 * possible slug.
 */
export function pathnameToDocSlug(pathname: string | null | undefined): string {
  if (!pathname) return '';

  // Strip leading slash and the workspace slug (first segment).
  const parts = pathname.replace(/^\//, '').split('/');
  // Strip workspace if present. Heuristic: if first segment doesn't match a
  // known top-level public route, treat it as the workspace slug.
  const PUBLIC_TOP = new Set(['docs', 'login', 'signup', 'privacy', 'terms', 'cookies', 'accept', 'auth', '2fa', 'onboarding']);
  if (parts.length > 0 && !PUBLIC_TOP.has(parts[0])) parts.shift();
  const inner = parts.join('/');

  const rules: { match: RegExp; slug: string }[] = [
    // Quotes - more specific first
    { match: /^quotes\/new(\/|$)/,                         slug: 'building-a-quote/manual-quote' },
    { match: /^quotes\/[^/]+\/takeoff(\/|$)/,              slug: 'building-a-quote/digital-takeoff' },
    { match: /^quotes\/[^/]+\/build(\/|$)/,                slug: 'building-a-quote/quote-builder' },
    { match: /^quotes\/[^/]+\/summary(\/|$)/,              slug: 'building-a-quote/quote-summary' },
    { match: /^quotes\/[^/]+\/customer-edit(\/|$)/,        slug: 'customer-facing/customer-quote-editor' },
    { match: /^quotes\/[^/]+\/customer(\/|$)/,             slug: 'customer-facing/customer-quote-editor' },
    { match: /^quotes\/[^/]+\/labor(\/|$)/,                slug: 'labor-and-installers/labor-sheet-editor' },
    { match: /^quotes\/[^/]+\/labor-sheet(\/|$)/,          slug: 'labor-and-installers/labor-sheet-editor' },
    { match: /^quotes(\/|$)/,                              slug: 'building-a-quote/quote-summary' },

    { match: /^components\/new(\/|$)/,                     slug: 'components/creating-a-component' },
    { match: /^components(\/|$)/,                          slug: 'components/overview' },

    { match: /^templates(\/|$)/,                           slug: 'templates/quote-templates' },
    { match: /^customer-quote-templates(\/|$)/,            slug: 'templates/customer-quote-templates' },

    { match: /^flashings(\/|$)/,                           slug: 'flashings/drawing-flashings' },
    { match: /^material-orders(\/|$)/,                     slug: 'material-orders/overview' },

    { match: /^account\/company(\/|$)/,                    slug: 'account-and-billing/company-settings' },
    { match: /^account\/security(\/|$)/,                   slug: 'account-and-billing/security-and-2fa' },
    { match: /^account\/notifications(\/|$)/,              slug: 'account-and-billing/notifications' },
    { match: /^account\/billing(\/|$)/,                    slug: 'account-and-billing/billing-and-subscriptions' },
    { match: /^account(\/|$)/,                             slug: 'account-and-billing/account-details' },
    { match: /^settings(\/|$)/,                            slug: 'account-and-billing/company-settings' },
  ];

  for (const r of rules) {
    if (r.match.test(inner)) return r.slug;
  }
  return '';
}
