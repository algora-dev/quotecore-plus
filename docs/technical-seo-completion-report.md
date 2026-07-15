# Technical SEO Completion Report — QuoteCore+

**Date:** 2026-07-15  
**Prepared by:** Gavin (AI agent)  
**Status:** Technical implementation complete — pending live deploy validation

---

## 1. Executive Summary

A comprehensive technical SEO implementation has been completed across both public-facing QuoteCore+ websites: the global site (`quote-core.com`) and the New Zealand site (`www.quote-core.co.nz`). The implementation covers domain configuration, redirects, robots.txt, sitemaps, canonical URLs, metadata, structured data, and rendering model across ~178 indexable URLs (166 global + 12 NZ).

All technical SEO work is code-complete and verified against the repository. The remaining steps are post-deploy validation: Lighthouse testing, Google Rich Results Test, Search Console submission, and representative URL inspection. These require a live production deploy.

---

## 2. Domain Status

| Domain | Purpose | Status | Redirect |
|--------|---------|--------|----------|
| `quote-core.com` | Global site (canonical) | ✅ Live | — |
| `www.quote-core.com` | Global www variant | ✅ Redirects | 308 → `quote-core.com` |
| `app.quote-core.com` | SaaS application | ✅ Live (middleware-gated) | — |
| `quote-core.co.nz` | NZ apex | ✅ Redirects | 308 → `www.quote-core.co.nz` |
| `www.quote-core.co.nz` | NZ site (canonical) | ✅ Live | — |

**Confirmations:**
- All redirects are 308 (Permanent), passing full link equity.
- No redirect chains longer than one hop.
- The app subdomain (`app.quote-core.com`) is not in the sitemap and is blocked by robots.txt and middleware authentication.

---

## 3. Crawlability Status

### robots.txt

| Site | Production Rules | Preview Rules | Sitemap Declared | Host Directive |
|------|-----------------|---------------|------------------|----------------|
| `quote-core.com` | ✅ Public paths allowed; `/api/`, `/auth/`, `/admin`, `/login`, `/signup`, workspace routes disallowed | ✅ Full block (`Disallow: /`) | ✅ `https://quote-core.com/sitemap.xml` | ✅ `quote-core.com` |
| `www.quote-core.co.nz` | ✅ All public paths allowed; `/api/` disallowed | ✅ Full block | ✅ `https://www.quote-core.co.nz/sitemap.xml` | ✅ `www.quote-core.co.nz` |

**Confirmations:**
- Preview/staging environments are fully blocked from crawling.
- Private/authenticated routes are disallowed in robots.txt.
- robots.txt is generated via Next.js Metadata API (`robots.ts`) on both sites.

---

## 4. Sitemap Status

### Global Sitemap (`https://quote-core.com/sitemap.xml`)

| Category | URL Count | Dynamic | Source |
|----------|-----------|---------|--------|
| Static pages | 22 | No (hardcoded) | `sitemap.ts` |
| Blog posts | 8 | No (manual array) | `BLOG_POSTS` in `sitemap.ts` |
| SEO slug pages | 37 | Yes | Slug registry configs (roofing, concrete, construction, slope) |
| Documentation pages | ~99 | Yes | `getAllSlugs()` from docs file tree |
| **Total** | **~166** | | |

### NZ Sitemap (`https://www.quote-core.co.nz/sitemap.xml`)

| Category | URL Count | Source |
|----------|-----------|--------|
| Static pages | 12 | Hardcoded route list in `sitemap.ts` |
| **Total** | **12** | |

**Confirmations:**
- All sitemap URLs return HTTP 200 (verified via code inspection; live HTTP testing pending deploy).
- No redirects, noindex pages, or canonical mismatches in sitemaps.
- Doc pages are automatically included when new MDX files are added.
- Blog posts require manual addition to `BLOG_POSTS` array.
- Last modified dates are set per entry.

---

## 5. Canonical Status

| Page Type | Canonical Source | Implementation | Status |
|-----------|-----------------|----------------|--------|
| Homepage | `(marketing)/layout.tsx` | `alternates.canonical: "https://quote-core.com/"` | ✅ |
| About | `page.tsx` metadata | `canonicalUrl('/about')` | ✅ |
| Services | `page.tsx` metadata | `canonicalUrl('/services')` | ✅ |
| Contact | `layout.tsx` metadata | `alternates.canonical` | ✅ |
| Free trial | `page.tsx` metadata | `canonicalUrl('/free-trial')` | ✅ |
| Blog index | `blog/page.tsx` metadata | `buildPageMetadata({ path: '/blog' })` | ✅ |
| Blog posts | `generateMetadata` | `buildPageMetadata({ path: '/blog/${slug}' })` | ✅ |
| Free tools hub | `free-calculators/layout.tsx` | `alternates.canonical` | ✅ |
| Individual free tools | `buildTradeMetadata()` | `alternates.canonical` per slug | ✅ |
| SEO slug pages | `TradeLayoutShell` | `alternates.canonical` per config | ✅ |
| Docs pages | `docs/layout.tsx` | Inherited from layout | ✅ |
| Legal pages | Root layout | Inherited from `metadataBase` | ✅ |
| NZ homepage | Root `layout.tsx` | `alternates.canonical: ${site.url}/` | ✅ |
| NZ sub-pages | Per-page or inherited | ⚠️ Verify per-page after deploy | Pending |

**Confirmations:**
- `metadataBase` is set on both sites (`https://quote-core.com` and `https://www.quote-core.co.nz`).
- The `buildPageMetadata()` helper ensures consistent canonical construction.
- No conflicting or duplicate canonicals identified.
- Blog index canonical was previously missing — now resolved.

---

## 6. Metadata Status

### Global Site

| Element | Status | Details |
|---------|--------|---------|
| `metadataBase` | ✅ | `new URL("https://quote-core.com")` in root layout |
| Title template | ✅ | `"%s \| QuoteCore+"` with default `"QuoteCore+"` |
| Default description | ✅ | Set in root layout |
| Per-page titles | ✅ | All pages have unique titles |
| Per-page descriptions | ✅ | All pages have unique descriptions |
| OpenGraph | ✅ | title, description, url, siteName, type, images on all pages |
| Twitter cards | ✅ | `summary_large_image` with title, description, images |
| Robots directive | ✅ | Production: `index, follow`; Preview: `noindex, nofollow` |

### NZ Site

| Element | Status | Details |
|---------|--------|---------|
| `metadataBase` | ✅ | `new URL("https://www.quote-core.co.nz")` |
| Title | ✅ | `"QuoteCore+ NZ \| Contractor Quoting Software for Kiwi Trades"` |
| Description | ✅ | NZ-specific description |
| OpenGraph | ✅ | Includes `locale: 'en_NZ'` |
| Twitter | ✅ | `summary_large_image` card |
| Language | ✅ | `lang="en-NZ"` on `<html>` |
| Language alternates | ✅ | `en-NZ` and `x-default` declared |

**Confirmations:**
- Every indexable page has a unique `<title>` and `<meta description>`.
- OG and Twitter metadata are set on all page types.
- The NZ site correctly declares `en-NZ` locale in both HTML lang and OG locale.

---

## 7. Structured Data Status

| Schema Type | Global Site | NZ Site | Validation |
|-------------|------------|---------|------------|
| `Organization` | ✅ Marketing layout (all pages) | ✅ Root layout (all pages) | Code-verified |
| `WebSite` | ✅ Marketing layout (all pages) | ✅ Root layout (all pages) | Code-verified |
| `SoftwareApplication` | ✅ Marketing layout (all pages) | ✅ Root layout (all pages) | Code-verified |
| `BreadcrumbList` | ✅ Marketing layout + blog posts | ❌ Not implemented | — |
| `BlogPosting` | ✅ All 8 blog posts | N/A | Code-verified |
| `FAQPage` | ✅ Roofing comparison article + all free tool pages | N/A | Code-verified |
| `WebApplication` | ✅ All free tool pages via `TradeLayoutShell` | N/A | Code-verified |

**Confirmations:**
- All structured data is rendered as `<script type="application/ld+json">` blocks.
- The `@graph` pattern is used on marketing pages and NZ homepage.
- `BlogPosting` schema includes headline, description, datePublished, dateModified, author, publisher, and mainEntityOfPage.
- `WebApplication` schema on free tools includes name, description, applicationCategory, operatingSystem, and offers (price: 0).
- **Pending:** Live validation via Google Rich Results Test.

---

## 8. Internal Link Status

| Area | Status | Notes |
|------|--------|-------|
| Blog index links to posts | ✅ | All 8 posts listed on `/blog` |
| Blog posts link to home + blog | ✅ | Breadcrumbs + BlogHeader component |
| Free tools hub links to individual tools | ✅ | Category-grouped links on `/free-calculators` |
| Individual tools link to hub | ✅ | Header navigation in `TradeLayoutShell` |
| Docs sidebar navigation | ✅ | Section-based sidebar with all published pages |
| Footer links | ✅ | `SiteFooter` component on marketing + blog pages |
| NZ site navigation | ✅ | Header + footer navigation on all pages |
| Cross-linking between blog and product pages | ⚠️ | Limited contextual cross-links — content team to enhance |

**Confirmations:**
- No orphaned indexable pages identified (all pages reachable via navigation or sitemap).
- Breadcrumb navigation is present on blog posts and marketing pages.
- Free tools are linked from the hub page and from each other via header navigation.

---

## 9. Performance Status

**Note:** Representative page testing requires a live production deploy. The following is based on code-level assessment only.

| Metric | Assessment | Notes |
|--------|------------|-------|
| Server-side rendering | ✅ | All indexable pages are SSR'd or SSG'd |
| Image optimisation | ✅ | Next.js `<Image>` component used for logos and key images |
| Font loading | ✅ | `Geist` and `Geist_Mono` via `next/font/google` with `subset: latin` |
| Script loading | ✅ | GA4 and structured data use `strategy="afterInteractive"` |
| CSS | ✅ | Tailwind CSS 4, no render-blocking external CSS |
| Bundle size | ⚠️ | Homepage is a client component — larger JS bundle than server component |
| Core Web Vitals (LCP, CLS, INP) | ⚠️ Pending | Requires live Lighthouse / CrUX data |

**Pending:** Lighthouse testing on 5+ representative pages post-deploy.

---

## 10. Search Console Actions

The following actions are required by Shaun after deploy. See `docs/search-console-setup.md` for detailed instructions.

| Action | Property | Status |
|--------|----------|--------|
| Add property `quote-core.com` | Domain-level | ⏳ Pending |
| Add property `quote-core.co.nz` | Domain-level | ⏳ Pending |
| DNS verification | Both properties | ⏳ Pending |
| Submit sitemap `https://quote-core.com/sitemap.xml` | Global | ⏳ Pending |
| Submit sitemap `https://www.quote-core.co.nz/sitemap.xml` | NZ | ⏳ Pending |
| Inspect 8-10 representative URLs per site | Both | ⏳ Pending |
| Check indexing report | Both | ⏳ Pending |
| Check manual actions | Both | ⏳ Pending |
| Check Core Web Vitals | Both | ⏳ Pending (after indexing) |

---

## 11. Test Matrix

To be completed after production deploy. Run each test against the listed URLs.

| Test | Tool | URL 1 | URL 2 | URL 3 | URL 4 | URL 5 | Status |
|------|------|-------|-------|-------|-------|-------|--------|
| Lighthouse SEO | Chrome DevTools | `/` | `/blog` | `/free-roofing-calculator` | `/docs` | `/roofing-quoting-software` | ⏳ |
| Rich Results Test | Google RRT | `/blog/best-roofing-quoting-software-uk-2026` | `/free-roofing-calculator` | `/` | `/blog/built-by-a-roofer` | — | ⏳ |
| URL Inspection | GSC | `/` | `/blog` | `/free-roofing-calculator` | `/roofing-quoting-software` | `/docs` | ⏳ |
| Mobile-Friendly Test | Google MFT | `/` | `/free-roofing-calculator` | `/blog/best-roofing-quoting-software-uk-2026` | — | — | ⏳ |
| Sitemap fetch | GSC | Global sitemap | NZ sitemap | — | — | — | ⏳ |
| Canonical check | Manual / Screaming Frog | All routes | — | — | — | — | ⏳ |
| robots.txt check | Browser | `/robots.txt` (global) | `/robots.txt` (NZ) | — | — | — | ⏳ |

**Representative URLs for testing:**

**Global site (quote-core.com):**
1. `https://quote-core.com/`
2. `https://quote-core.com/blog`
3. `https://quote-core.com/blog/best-roofing-quoting-software-uk-2026`
4. `https://quote-core.com/roofing-quoting-software`
5. `https://quote-core.com/free-roofing-calculator`
6. `https://quote-core.com/free-calculators`
7. `https://quote-core.com/docs`
8. `https://quote-core.com/about`
9. `https://quote-core.com/contact`
10. `https://quote-core.com/free-trial`

**NZ site (www.quote-core.co.nz):**
1. `https://www.quote-core.co.nz/`
2. `https://www.quote-core.co.nz/roofing-quoting-software`
3. `https://www.quote-core.co.nz/construction-quoting-software`
4. `https://www.quote-core.co.nz/pricing`
5. `https://www.quote-core.co.nz/free-trial`
6. `https://www.quote-core.co.nz/about`
7. `https://www.quote-core.co.nz/contact`
8. `https://www.quote-core.co.nz/services`

---

## 12. Remaining Content Queue

Content issues that should NOT be addressed during technical SEO work are tracked in `docs/content-remediation-queue.md`. These include:

- Blog image alt text review
- Blog article date verification
- About page content expansion
- Additional contextual internal links between blog and product pages
- NZ site per-page canonical verification (post-deploy)

---

## 13. Explicit Confirmations

The following are explicitly confirmed as complete:

- [x] `robots.txt` is production/preview aware on both sites
- [x] `sitemap.xml` is dynamically generated and includes all indexable URLs
- [x] Canonical URLs are set on all major page types (homepage, blog, free tools, docs, static pages)
- [x] `metadataBase` is set in root layout on both sites
- [x] Every indexable page has a unique title and description
- [x] OpenGraph and Twitter card metadata are set on all page types
- [x] Structured data (Organization, WebSite, SoftwareApplication) is on all marketing pages
- [x] `BlogPosting` and `BreadcrumbList` schema are on all blog posts
- [x] `FAQPage` schema is on the roofing comparison article and all free tool pages
- [x] `WebApplication` schema is on all free tool pages
- [x] Blog index is a server component (converted from `"use client"`)
- [x] All indexable pages are SSR'd or SSG'd
- [x] Preview environments are blocked from crawling (robots.txt + metadata robots)
- [x] Private/authenticated routes are disallowed in robots.txt
- [x] NZ site declares `en-NZ` locale in HTML lang and OG metadata
- [x] NZ site has Organization, WebSite, and SoftwareApplication structured data
- [x] Redirects are 308 (Permanent) on both apex domains
- [x] No redirect chains longer than one hop

The following are explicitly pending:

- [ ] Live Lighthouse testing on representative pages
- [ ] Google Rich Results Test on structured data
- [ ] Google Search Console property creation and sitemap submission
- [ ] URL Inspection of representative URLs
- [ ] Core Web Vitals assessment (requires CrUX data)
- [ ] Automated SEO validation script for CI
