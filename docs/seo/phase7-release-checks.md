# Phase 7 - Release Checks

**Date:** 2 August 2026
**Repos:** quotecore-plus (development), quotecore-nz (development)

## Build Status

| Repo | Build | SEO Check |
|------|-------|-----------|
| quotecore-plus | ✅ Compiled successfully | ✅ 2 pre-existing warnings |
| quotecore-nz | ✅ Compiled successfully | ✅ 0 warnings |

### Pre-existing warnings (not from this work)
- Title suffix "QuoteCore+" appears 41 times - consider varying titles
- Server page may be missing H1: free-roofing-takeoff-builder/calculate
- Lint: 3708 pre-existing errors across the whole project (not from SEO phases)

## Canonical Audit

All 22 marketing pages have explicit canonical URLs.
- Global pages canonicalise to `https://quote-core.com/...`
- NZ pages canonicalise to `https://www.quote-core.co.nz/...`
- No page self-canonicalises to the wrong domain.

## Hreflang Audit

11 pages with genuine regional equivalents emit `en`, `en-NZ`, and `x-default` hreflang.
Layout-level hreflang removed in Phase 1 - only page-level where genuine equivalents exist.

## Sitemap Audit

### Global (quote-core.com)
- 41 static URLs + dynamic blog/calculator/doc/slug pages
- Includes: /, /blog, /roofing-quoting-software, /construction-quoting-software, /pricing, /services, /about, /company, /features (hub + 5), /resources (7), /contact, /free-trial, /suppliers, /trust, /customer-stories, /privacy, /cookie-policy, /terms, /docs, /free-tools, /free-calculators, 5 calculators, 3 generators, takeoff builder, roof pricing calculator, API docs
- All new pages from Phases 1-6 are in the sitemap

### NZ (quote-core.co.nz)
- 21 static URLs
- Includes: /, /about, /features (hub + 5), /construction-quoting-software, /roofing-quoting-software, /contact, /free-trial, /free-tools, /free-calculators, 5 calculators, takeoff builder, /pricing, /privacy, /terms, /cookie-policy, /coffee-terms, /services

## Robots.txt Audit

### Global (quote-core.com)
- Production: allows all public marketing pages, free tools, API docs
- Blocks: /api/, /auth/, /onboarding, /2fa, /accept/, /admin, /login, /signup, workspace-scoped authed routes
- **Fixed in Phase 7:** Added /pricing, /trust, /customer-stories, /features/invoicing, /features/supplier-resources to allow list

### NZ (quote-core.co.nz)
- Production: allows all, blocks /api/ only
- Simple allow-all strategy appropriate for the marketing-only NZ site

## Schema Audit

| Schema Type | Pages | Status |
|-------------|-------|--------|
| Organization | All (via marketing layout) | ✅ |
| WebSite | All (via marketing layout) | ✅ |
| SoftwareApplication | Home, roofing/construction landing, free-trial | ✅ |
| BreadcrumbList | All commercial + feature pages | ✅ |
| FAQPage | Pages with FAQs | ✅ |
| VideoObject | Home (5 videos), roofing landing (2), construction landing (2) | ✅ |
| BlogPosting | Blog post pages | ✅ |
| ItemList | Free tools hub | ✅ |
| AggregateRating | None | ✅ (correctly absent) |
| Review | None | ✅ (correctly absent) |

## Lighthouse / Core Web Vitals

**Not run** - requires deployed preview URLs. To run after deployment:
- Homepage, feature page, landing page, pricing page, customer stories, trust page, blog article, calculator page, tool page
- Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1
- Lighthouse Accessibility, Best Practices, SEO at 95+
- Performance at 90+ where realistic

## Analytics Verification (requires Shaun)

Events to verify in GA4:
- [ ] Trial signup
- [ ] Pricing page view
- [ ] Calculator completion
- [ ] Tool-to-trial conversion
- [ ] Feature CTA clicks
- [ ] Country-switch (NZ/global)

## GSC / Bing Properties (requires Shaun)

- [ ] Separate GSC properties for quote-core.com and quote-core.co.nz
- [ ] Separate Bing properties for both domains
- [ ] Sitemaps submitted for both
- [ ] Monitor indexation, canonicals, hreflang, rich results
- [ ] 30/60/90-day review cadence established

## Programme Completion Checklist

| Criterion | Status |
|-----------|--------|
| Both domains self-canonicalise | ✅ |
| NZ pages canonicalise to .co.nz | ✅ |
| Correct reciprocal hreflang | ✅ (11 page pairs) |
| Global pages target international intent | ✅ |
| Major pages have proof, examples, limitations, FAQs, links, CTAs | ✅ |
| Trust/pricing/company/customer/supplier journeys use verified facts | ✅ |
| Schema, sitemap, robots, redirects, navigation validated | ✅ |
| Both builds pass | ✅ |
| Both SEO checks pass | ✅ |
| Reporting separates both domains | ⏳ (requires GSC/GA4 setup) |
| Shaun approves production deployment | ⏳ (pending Shaun review) |

## What Requires Shaun

1. **GSC + Bing setup:** Separate properties for each domain, sitemaps submitted
2. **GA4 event verification:** Confirm tracking fires for trial/signup/calculator/CTA events
3. **Lighthouse on deployed previews:** Run after Vercel preview deployment
4. **Production deployment approval:** All work is on `development` branch. Merge to `main` only when Shaun approves.
5. **30/60/90-day review cadence:** Schedule first review after deployment

## What Requires Ongoing Work

1. **Blog content audit:** Existing posts need examples, screenshots, sources, review dates
2. **NZ local content:** NZ pages need 3+ local elements (NZD, GST, metric examples, NZ suppliers)
3. **Customer stories:** Need real customer permissions, names, logos, screenshots, metrics
4. **Off-site authority:** LinkedIn, YouTube, directory alignment, link building, linkable assets
