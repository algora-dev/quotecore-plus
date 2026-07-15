# Technical SEO Audit — QuoteCore+

**Date:** 2026-07-15  
**Auditor:** Gavin (AI agent)  
**Scope:** Public-facing SEO across two deployed sites and the app subdomain  
**Status:** Baseline audit — technical implementation review (pre-deploy verification)

---

## 1. Domain Configuration

| Domain | Purpose | Repo | Hosting |
|--------|---------|------|---------|
| `quote-core.com` | Global marketing site + free tools + docs + blog | `quotecore-plus` | Vercel |
| `www.quote-core.com` | WWW variant of global site | — | Vercel redirect |
| `app.quote-core.com` | Authenticated SaaS application | `quotecore-plus` (same repo, middleware-gated) | Vercel |
| `quote-core.co.nz` | NZ marketing site (apex) | `quotecore-nz` | Vercel |
| `www.quote-core.co.nz` | NZ marketing site (canonical host) | `quotecore-nz` | Vercel |

### Redirect Chain Summary

| From | To | Type | Notes |
|------|----|------|-------|
| `www.quote-core.com` | `quote-core.com` | 308 Permanent | Vercel domain redirect |
| `quote-core.co.nz` | `www.quote-core.co.nz` | 308 Permanent | Vercel domain redirect |
| Free tool URLs on non-global hosts | `quote-core.com` equivalent | 308 Permanent | Slug-level redirects configured |

**Verdict:** Redirects are permanent (308), which passes full link equity. No redirect chains longer than one hop identified.

---

## 2. robots.txt

Both sites implement `robots.ts` (Next.js Metadata API) with production/preview awareness.

### Global (`quote-core.com/robots.txt`)

- **Production:** Allows all public paths (`/`, `/blog`, `/docs`, `/free-calculators`, `/free-*`, `/roofing-quoting-software`, `/construction-quoting-software`, `/services`, `/about`, `/contact`, `/free-trial`, `/privacy`, `/cookies`, `/terms`). Disallows `/api/`, `/auth/`, `/onboarding`, `/2fa`, `/accept/`, `/admin`, `/login`, `/signup`, and workspace-scoped authed routes (`/*/quotes`, `/*/customers`, etc.).
- **Preview/staging:** `User-agent: * Disallow: /` (full block).
- **Sitemap:** Declared as `https://quote-core.com/sitemap.xml`.
- **Host directive:** `quote-core.com`.

### NZ (`www.quote-core.co.nz/robots.txt`)

- **Production:** Allow `/`, disallow `/api/`.
- **Preview/staging:** Full block.
- **Sitemap:** `https://www.quote-core.co.nz/sitemap.xml`.
- **Host directive:** `www.quote-core.co.nz`.

**Verdict:** robots.txt is correctly configured on both sites. Preview environments are fully blocked. Private/app routes are disallowed on the global site.

---

## 3. Sitemaps

### Global Sitemap (`quote-core.com/sitemap.xml`)

Generated dynamically by `app/sitemap.ts`. URL breakdown:

| Category | Count | Source |
|----------|-------|--------|
| Static pages (home, blog index, product, services, about, contact, free-trial, legal) | 22 | Hardcoded in `sitemap.ts` |
| Blog posts | 8 | `BLOG_POSTS` array in `sitemap.ts` |
| SEO slug pages (roofing + concrete + construction + slope) | 37 | Imported from slug registry configs |
| Documentation pages | ~99 | `getAllSlugs()` from docs tree (100 MDX files, root filtered out) |
| **Total** | **~166** | |

All URLs use `https://quote-core.com` as the base. Change frequencies and priorities are set per category.

**Note:** The `BLOG_POSTS` array in `sitemap.ts` must be manually kept in sync with the `posts` object in `app/(marketing)/blog/[slug]/page.tsx`. Currently in sync (8 posts in both).

### NZ Sitemap (`www.quote-core.co.nz/sitemap.xml`)

Generated dynamically by `app/sitemap.ts` in the `quotecore-nz` repo. Contains 12 static routes:

`/`, `/about`, `/construction-quoting-software`, `/contact`, `/free-trial`, `/pricing`, `/privacy`, `/roofing-quoting-software`, `/services`, `/terms`, `/cookie-policy`, `/coffee-terms`

**Verdict:** Sitemaps are comprehensive and dynamically generated. Doc pages are automatically included. Blog posts require manual sync.

---

## 4. Canonical URLs

| Page Type | Canonical Implementation | Status |
|-----------|-------------------------|--------|
| Homepage / marketing layout | `alternates.canonical: "https://quote-core.com/"` in `(marketing)/layout.tsx` | ✅ Set |
| About page | `canonicalUrl('/about')` in `page.tsx` metadata | ✅ Set |
| Services page | `canonicalUrl('/services')` in `page.tsx` metadata | ✅ Set |
| Contact page | `alternates.canonical` in `contact/layout.tsx` | ✅ Set |
| Free trial page | `canonicalUrl('/free-trial')` in `page.tsx` metadata | ✅ Set |
| Blog index (`/blog`) | `buildPageMetadata({ path: '/blog' })` in `blog/page.tsx` | ✅ Set |
| Blog posts (`/blog/[slug]`) | `buildPageMetadata({ path: '/blog/${slug}' })` via `generateMetadata` | ✅ Set |
| Free tools hub (`/free-calculators`) | `alternates.canonical` in `free-calculators/layout.tsx` | ✅ Set |
| Individual free tools | `buildTradeMetadata()` → `alternates.canonical` in each tool's `layout.tsx` | ✅ Set |
| SEO slug pages | Canonical from slug config via `TradeLayoutShell` | ✅ Set |
| Docs pages (`/docs/[slug]`) | Canonical via `(public)/docs/layout.tsx` | ✅ Set |
| NZ site (all pages) | `alternates.canonical: ${site.url}/` in root `layout.tsx` | ✅ Set (homepage) |
| NZ sub-pages | Canonical via page-level or inherited from layout | ⚠️ Verify per-page |

**Canonical helper:** `app/lib/seo.ts` exports `canonicalUrl(path)` which constructs `https://quote-core.com${path}`. The NZ site uses `absoluteUrl(path)` from `lib/seo.ts` which constructs `https://www.quote-core.co.nz${path}`.

**Verdict:** Canonicals are implemented across all major page types. The blog index canonical was previously missing and has been resolved (converted to server component with `buildPageMetadata`).

---

## 5. Structured Data (JSON-LD)

### Global Site

| Schema Type | Location | Pages |
|-------------|----------|-------|
| `Organization` | `(marketing)/layout.tsx` → `combinedSchema` | All marketing pages |
| `WebSite` | `(marketing)/layout.tsx` → `combinedSchema` | All marketing pages |
| `SoftwareApplication` | `(marketing)/layout.tsx` → `buildSoftwareApplicationSchema()` | All marketing pages |
| `BreadcrumbList` | `(marketing)/layout.tsx` → `buildBreadcrumbSchema()` | All marketing pages (Home breadcrumb) |
| `BlogPosting` | `blog/[slug]/page.tsx` → `blogPostingSchema()` | Individual blog posts |
| `BreadcrumbList` | `blog/[slug]/page.tsx` → `breadcrumbSchema()` | Individual blog posts (Home → Blog → Post) |
| `FAQPage` | `blog/[slug]/page.tsx` (conditional on slug) | `best-roofing-quoting-software-uk-2026` only |
| `WebApplication` | `free-calculators/_shared/TradeLayoutShell.tsx` | All free tool pages |
| `FAQPage` | `free-calculators/_shared/TradeLayoutShell.tsx` | All free tool pages (from config FAQs) |

### NZ Site

| Schema Type | Location | Pages |
|-------------|----------|-------|
| `Organization` | `layout.tsx` → `homepageSchema` | All pages (in `@graph`) |
| `WebSite` | `layout.tsx` → `homepageSchema` | All pages (in `@graph`) |
| `SoftwareApplication` / `WebApplication` | `layout.tsx` → `homepageSchema` | All pages (in `@graph`) |

All structured data is rendered via `<Script type="application/ld+json">` tags. The `@graph` pattern is used on marketing pages and the NZ homepage to combine multiple schema types in a single block.

**Verdict:** Structured data coverage is strong. Organization, WebSite, and SoftwareApplication are site-wide. BlogPosting and BreadcrumbList are on all blog posts. FAQPage is on the comparison article and all free tool pages. The NZ site has Organization + WebSite + SoftwareApplication in its homepage graph.

---

## 6. Metadata

### Root Layout (`app/layout.tsx`)

- `metadataBase`: `new URL(SITE_URL)` — resolves to `https://quote-core.com`
- Default title: `"QuoteCore+"` with template `"%s | QuoteCore+"`
- Default description set
- Default OG: type, siteName, title, description, url, images
- Default Twitter: `summary_large_image` card
- `robots`: `{ index: true, follow: true }` (overridden per-layout in preview)
- Icons: favicon + apple icon configured

### Marketing Layout (`app/(marketing)/layout.tsx`)

- Overrides title with full marketing title
- Sets `alternates.canonical` to homepage canonical
- Full OG metadata (title, description, url, siteName, type)
- `robots: robotsDirective()` — production/preview aware

### Blog Index (`app/(marketing)/blog/page.tsx`)

- Server component (converted from `"use client"`)
- Uses `buildPageMetadata()` with unique title, description, and canonical `/blog`
- OG type: `website`

### Blog Posts (`app/(marketing)/blog/[slug]/page.tsx`)

- `generateMetadata()` per post with unique title, description, canonical
- OG type: `article`
- All 8 posts have unique metadata

### Free Tools

- Free tools hub (`/free-calculators`): static metadata in `layout.tsx` with canonical
- Individual tools: `buildTradeMetadata(config)` generates title, description, canonical, and OG from the trade config object
- SEO slug pages use the same mechanism via their config

### NZ Site

- Root `layout.tsx`: `metadataBase`, full title, description, OG (with `locale: 'en_NZ'`), Twitter, canonical, language alternates
- `lang="en-NZ"` on `<html>` element

**Verdict:** Metadata is comprehensive across all page types. `metadataBase` is set correctly on both sites. The `buildPageMetadata()` helper in `app/lib/seo.ts` ensures consistent canonical, OG, Twitter, and robots directives.

---

## 7. Rendering Model

| Page Type | Rendering | Notes |
|-----------|-----------|-------|
| Homepage | Client component (`"use client"`) | SSR'd by Next.js — content is in initial HTML |
| Blog index | Server component | Converted from `"use client"` — fully server-rendered |
| Blog posts | Server component with dynamic import | `generateMetadata` + `generateStaticParams` — SSG |
| Free tools (hub + individual) | Server components | Layouts export static metadata; pages are server-rendered |
| SEO slug pages | Server components | Config-driven via `TradeLayoutShell` |
| Docs pages | Server components | File-system based, SSG via `generateStaticParams` |
| NZ site | Server components | All pages server-rendered |

**Verdict:** All indexable pages are server-rendered or statically generated. The homepage is a client component but Next.js still SSRs it, so content is present in the initial HTML. No SEO-critical content is client-only rendered.

---

## 8. Known Issues Remaining

| # | Issue | Severity | Affected Routes | Status |
|---|-------|----------|-----------------|--------|
| 1 | Homepage is a client component (`"use client"`) | Low | `/` | Next.js SSRs client components, so content is in initial HTML. Not a blocking SEO issue, but server component would be preferable for future-proofing. |
| 2 | Blog post sitemap requires manual sync | Medium | `/blog/[slug]` | The `BLOG_POSTS` array in `sitemap.ts` and the `posts` object in `page.tsx` must be manually kept in sync. Risk of drift when new posts are added. |
| 3 | NZ sub-pages may lack per-page canonicals | Low | NZ `/about`, `/services`, etc. | NZ root layout sets homepage canonical. Individual pages should verify they have page-specific canonicals. |
| 4 | No automated SEO validation script | Medium | All | No CI/build-time script validates canonicals, metadata, or structured data. Errors could ship without detection. |
| 5 | Representative page testing not yet performed | High | All | Lighthouse, Rich Results Test, and URL Inspection have not been run against a live production deploy. Required post-deploy. |
| 6 | `coming-soon` docs pages included in sitemap | Low | `/docs/[slug]` | The docs tree includes 1 `coming-soon` page. `getAllSlugs()` does not filter by status. This page is in the sitemap but may not be ready for indexing. |

---

## 9. Summary Assessment

| Area | Rating | Notes |
|------|--------|-------|
| Domain configuration | ✅ Strong | Clean redirect chain, proper apex/www handling |
| robots.txt | ✅ Strong | Production/preview aware, private routes blocked |
| Sitemaps | ✅ Strong | Dynamic generation, comprehensive coverage |
| Canonicals | ✅ Strong | All major page types have explicit canonicals |
| Structured data | ✅ Strong | Organization, WebSite, SoftwareApplication, BlogPosting, FAQPage, BreadcrumbList |
| Metadata | ✅ Strong | metadataBase set, per-page titles/descriptions, OG/Twitter |
| Rendering | ✅ Acceptable | All pages SSR'd or SSG'd; homepage is client but SSR'd |
| Automated validation | ⚠️ Missing | No CI SEO checks |
| Live testing | ⚠️ Pending | Requires post-deploy Lighthouse/Rich Results Test |

**Overall:** Technical SEO implementation is production-ready. The remaining work is primarily post-deploy validation (Lighthouse, Rich Results Test, Search Console) and adding an automated validation script for CI.
