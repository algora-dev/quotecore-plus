# SEO Page Authoring Guide — QuoteCore+

**Date:** 2026-07-15  
**Purpose:** Ensure every new page on QuoteCore+ ships with correct, consistent SEO from day one.

---

## Table of Contents

1. [Title Patterns](#1-title-patterns)
2. [Required Metadata](#2-required-metadata)
3. [Blog Posts](#3-blog-posts)
4. [Free Tools](#4-free-tools)
5. [NZ Pages](#5-nz-pages)
6. [Sitemap Inclusion](#6-sitemap-inclusion)
7. [Indexability Rules](#7-indexability-rules)
8. [Internal Links](#8-internal-links)
9. [Code Examples](#9-code-examples)
10. [Checklist](#10-checklist)

---

## 1. Title Patterns

### Global site (`quote-core.com`)

| Page type | Pattern | Example |
|-----------|---------|---------|
| Static page | `{Page Topic} \| QuoteCore+` | `About \| QuoteCore+` |
| Blog post | `{Post Title} \| QuoteCore+` | `Best Roofing Quoting Software UK (2026) \| QuoteCore+` |
| Free tool | `{Tool Name} - {Benefit} \| QuoteCore+` | `Free Roof Pitch Calculator - Quick & Accurate \| QuoteCore+` |
| Product page | `{Product Name} \| QuoteCore+` | `Roofing Quoting Software \| QuoteCore+` |

The root layout sets a title template of `"%s | QuoteCore+"`, so you only need to provide the `{Page Topic}` portion in your metadata. The `| QuoteCore+` suffix is appended automatically.

### NZ site (`www.quote-core.co.nz`)

| Page type | Pattern | Example |
|-----------|---------|---------|
| Any page | `{Page Topic} \| QuoteCore+ NZ` | `Roofing Quoting Software \| QuoteCore+ NZ` |

---

## 2. Required Metadata

Every indexable page MUST set the following metadata fields. Use the `buildPageMetadata()` helper from `app/lib/seo.ts` to ensure consistency.

### Minimum required fields:

| Field | Source | Notes |
|-------|--------|-------|
| `title` | Page-specific | Unique per page, under 60 characters |
| `description` | Page-specific | Unique per page, under 160 characters |
| `alternates.canonical` | `canonicalUrl(path)` | Absolute URL on `quote-core.com` |
| `openGraph.title` | Same as title | |
| `openGraph.description` | Same as description | |
| `openGraph.url` | `canonicalUrl(path)` | |
| `openGraph.siteName` | `"QuoteCore+"` | Set automatically by helper |
| `openGraph.type` | `"website"` or `"article"` | `article` for blog posts |
| `twitter.card` | `"summary_large_image"` | Set automatically by helper |
| `twitter.title` | Same as title | Set automatically by helper |
| `twitter.description` | Same as description | Set automatically by helper |
| `robots` | `robotsDirective()` | Production: `index, follow`; Preview: `noindex, nofollow` |

### Example (using helper):

```typescript
import { buildPageMetadata } from '@/app/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Free Roof Pitch Calculator - Quick & Accurate',
  description: 'Calculate roof pitch from rise and run, or convert between degrees and ratio. Free online tool for roofers and builders. No signup required.',
  path: '/free-roof-pitch-calculator',
});
```

The helper automatically sets: canonical, OG, Twitter, and robots directive.

### Example (manual, for cases needing custom fields):

```typescript
import type { Metadata } from 'next';
import { canonicalUrl, robotsDirective } from '@/app/lib/seo';

export const metadata: Metadata = {
  title: 'Custom Page Title',
  description: 'Custom page description for SEO.',
  alternates: { canonical: canonicalUrl('/custom-page') },
  openGraph: {
    title: 'Custom Page Title',
    description: 'Custom page description for SEO.',
    url: canonicalUrl('/custom-page'),
    siteName: 'QuoteCore+',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Custom Page Title',
    description: 'Custom page description for SEO.',
  },
  robots: robotsDirective(),
};
```

---

## 3. Blog Posts

Blog posts require additional SEO fields beyond the standard metadata.

### 3.1 Required Fields

| Field | Notes |
|-------|-------|
| `title` | Unique, descriptive, under 60 characters |
| `description` | Compelling summary, under 160 characters |
| `date` | Publication date (ISO 8601: `YYYY-MM-DD`) |
| `modified` | Last modification date (ISO 8601). Omit if never modified. |
| Canonical | `canonicalUrl('/blog/${slug}')` |
| OG type | `article` |

### 3.2 Structured Data (required)

Every blog post MUST include:

1. **`BlogPosting` schema** — via `blogPostingSchema()` helper
2. **`BreadcrumbList` schema** — via `breadcrumbSchema()` helper

Render as a `<script type="application/ld+json">` tag:

```tsx
import Script from 'next/script';
import { blogPostingSchema, breadcrumbSchema } from '@/app/lib/seo';

// Inside the page component:
const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    blogPostingSchema({
      title: post.title,
      description: post.description,
      slug,
      datePublished: post.date,
      dateModified: post.modified || post.date,
    }),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: post.title, path: `/blog/${slug}` },
    ]),
  ],
};

// In JSX:
<Script
  id="blog-schema"
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
/>
```

### 3.3 Optional: FAQPage Schema

If the blog post includes an FAQ section, add `FAQPage` schema:

```tsx
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Question text here?',
      acceptedAnswer: { '@type': 'Answer', text: 'Answer text here.' },
    },
    // ... more Q&As
  ],
};
```

Include in the `@graph` alongside `BlogPosting` and `BreadcrumbList`.

### 3.4 Featured Image

- Include a featured image at the top of the post.
- Use `next/image` for optimisation.
- Provide descriptive `alt` text (not just "blog post image").
- If referenced in `BlogPosting` schema, include as `image` field.

### 3.5 Sitemap Update (CRITICAL)

When adding a new blog post, you MUST update the `BLOG_POSTS` array in `app/sitemap.ts`:

```typescript
const BLOG_POSTS = [
  // ... existing posts
  { slug: 'your-new-post-slug', lastmod: '2026-07-20' },
];
```

Also add the post to the `posts` object in `app/(marketing)/blog/[slug]/page.tsx`.

> **Warning:** Forgetting to update `BLOG_POSTS` means the post won't appear in the sitemap. There is no automatic sync between the posts object and the sitemap array.

---

## 4. Free Tools

Free tool pages use the `TradeConfig` system and `TradeLayoutShell` for consistent SEO.

### 4.1 Required Fields in Config

Each free tool config (`TradeConfig`) must include:

| Field | Purpose |
|-------|---------|
| `slug` | URL path (e.g., `free-roof-pitch-calculator`) |
| `name` | Display name |
| `metaTitle` | `<title>` tag content |
| `metaDescription` | `<meta description>` content |
| `ogTitle` | OpenGraph title |
| `ogDescription` | OpenGraph description |

### 4.2 Metadata

Generated automatically by `buildTradeMetadata(config)` in the tool's `layout.tsx`:

```typescript
import { TradeLayoutShell, buildTradeMetadata } from '../free-calculators/_shared/TradeLayoutShell';
import { roofPitchConfig } from '../free-calculators/configs/roofPitch';

export const metadata = buildTradeMetadata(roofPitchConfig);

export default function RoofPitchLayout({ children }: { children: ReactNode }) {
  return <TradeLayoutShell config={roofPitchConfig}>{children}</TradeLayoutShell>;
}
```

This sets: title, description, canonical, and OpenGraph.

### 4.3 Structured Data (automatic)

`TradeLayoutShell` automatically renders:
- `WebApplication` schema (name, description, applicationCategory, operatingSystem, offers)
- `FAQPage` schema (from `config.content.faqs`)

No manual structured data needed — it's driven by the config.

### 4.4 SEO Slug Pages

SEO slug pages (e.g., `free-concrete-slab-calculator`) are registered in slug config files:
- `free-calculators/configs/roofingSlugs1-4.ts`
- `free-calculators/configs/concreteSlugs.ts`
- `free-calculators/configs/constructionSlugs.ts`
- `free-calculators/configs/slopeSlugs.ts`

Adding a new slug to any of these files automatically:
- Creates the page route
- Adds it to the sitemap (via the slug registry imports in `sitemap.ts`)
- Generates metadata via `buildTradeMetadata()`

---

## 5. NZ Pages

The NZ site (`quotecore-nz` repo) has its own `lib/seo.ts` with NZ-specific constants.

### 5.1 Key Differences

| Aspect | Global | NZ |
|--------|--------|-----|
| Base URL | `https://quote-core.com` | `https://www.quote-core.co.nz` |
| Locale | `en` (default) | `en-NZ` |
| Currency | USD (in schema) | NZD |
| Pricing | USD | NZD |
| HTML lang | `en` | `en-NZ` |

### 5.2 Using NZ SEO Helpers

```typescript
import { site, absoluteUrl, breadcrumbSchema } from '@/lib/seo';

// site.url = 'https://www.quote-core.co.nz'
// site.currency = 'NZD'
// site.locale = 'en-NZ'

export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description for NZ audience.',
  alternates: { canonical: absoluteUrl('/page-path') },
  openGraph: {
    title: 'Page Title',
    description: 'Page description for NZ audience.',
    url: absoluteUrl('/page-path'),
    siteName: site.name,
    type: 'website',
    locale: 'en_NZ',
  },
};
```

### 5.3 NZ Sitemap

The NZ sitemap is a static array in `app/sitemap.ts`. When adding a new NZ page, add the route to the `routes` array:

```typescript
const routes = [
  '/',
  '/about',
  // ... existing routes
  '/new-page',  // Add new routes here
];
```

### 5.4 NZ Structured Data

The NZ root layout renders `homepageSchema` (Organization + WebSite + SoftwareApplication) on all pages. For sub-pages, add page-specific `BreadcrumbList` schema if appropriate.

Pricing in structured data uses `site.currency` (NZD):

```typescript
import { pricingOffers } from '@/lib/seo';
// pricingOffers automatically uses NZD
```

---

## 6. Sitemap Inclusion

### What's automatic:

| Page type | Sitemap inclusion |
|-----------|-------------------|
| Docs pages | ✅ Automatic via `getAllSlugs()` |
| SEO slug pages | ✅ Automatic via slug registry imports |
| Static pages | ❌ Manual — hardcoded in `sitemap.ts` |
| Blog posts | ❌ Manual — `BLOG_POSTS` array in `sitemap.ts` |
| NZ pages | ❌ Manual — `routes` array in NZ `sitemap.ts` |

### When adding a new static page:

Add an entry to the `staticEntries` array in `app/sitemap.ts`:

```typescript
{ url: `${SITE_URL}/new-page`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
```

### When adding a new blog post:

Add to `BLOG_POSTS` in `sitemap.ts`:

```typescript
{ slug: 'new-post-slug', lastmod: '2026-07-20' },
```

---

## 7. Indexability Rules

### Production (VERCEL_ENV=production):
- All public pages: `index, follow`
- Authenticated/app routes: `noindex` (via robots.txt disallow + middleware)
- Legal pages: `index, follow` (low priority)

### Preview/Staging (VERCEL_ENV != production):
- All pages: `noindex, nofollow`
- robots.txt: `Disallow: /`

### Implementation:

Use `robotsDirective()` from `app/lib/seo.ts`:

```typescript
import { robotsDirective } from '@/app/lib/seo';

// In metadata:
robots: robotsDirective(),
```

This automatically returns the correct directive based on `VERCEL_ENV`. Never hardcode `robots: { index: true }` — always use the helper.

---

## 8. Internal Links

### Requirements:

1. **Every new page must link to at least 2 other indexable pages** on the site.
2. **Blog posts must link to at least one product page** (`/roofing-quoting-software`, `/free-trial`, `/free-calculators`, etc.).
3. **Free tool pages must link to the free tools hub** (`/free-calculators`) and to `/free-trial` or `/signup`.
4. **Product pages must link to relevant free tools** and to `/free-trial`.
5. **Docs pages must link to adjacent docs** (previous/next in the sidebar).

### Breadcrumbs:

- Blog posts: include `BreadcrumbList` schema (Home → Blog → Post)
- Free tools: include breadcrumb in the page UI (header navigation)
- Marketing pages: breadcrumb schema is in the marketing layout

### Related links section:

At the bottom of every blog post, include a "Related articles" or "Related tools" section with 2–3 contextual links.

---

## 9. Code Examples

### 9.1 Static Page (e.g., `/services`)

```typescript
// app/(marketing)/services/page.tsx
import { buildPageMetadata } from '@/app/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Services',
  description: 'Professional quoting and job management services for contractors and trade businesses.',
  path: '/services',
});

export default function ServicesPage() {
  return (
    <div>
      {/* Page content */}
    </div>
  );
}
```

### 9.2 Blog Post

```typescript
// app/(marketing)/blog/[slug]/page.tsx (add to posts object)
'new-post-slug': {
  title: 'New Post Title That Is Under 60 Characters',
  description: 'Compelling meta description under 160 characters that includes target keywords.',
  date: '2026-07-20',
  content: () => import('./content/new-post-slug'),
},
```

```typescript
// Metadata is auto-generated by generateMetadata() which calls buildPageMetadata()
// Structured data is auto-generated using blogPostingSchema() + breadcrumbSchema()
```

### 9.3 Free Tool (new slug page)

```typescript
// app/(public)/free-calculators/configs/roofingSlugs4.ts (add new slug)
{
  slug: 'free-new-calculator',
  name: 'Free New Calculator',
  metaTitle: 'Free New Calculator - Accurate & Fast | QuoteCore+',
  metaDescription: 'Description under 160 chars with target keywords.',
  // ... rest of config
}
```

The page, sitemap entry, metadata, and structured data are all generated automatically from the config.

### 9.4 NZ Page

```typescript
// quotecore-nz/app/new-page/page.tsx
import type { Metadata } from 'next';
import { site, absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'New Page | QuoteCore+ NZ',
  description: 'NZ-specific description under 160 characters.',
  alternates: { canonical: absoluteUrl('/new-page') },
  openGraph: {
    title: 'New Page | QuoteCore+ NZ',
    description: 'NZ-specific description.',
    url: absoluteUrl('/new-page'),
    siteName: site.name,
    type: 'website',
    locale: 'en_NZ',
  },
};

export default function NewPage() {
  return <div>{/* Content */}</div>;
}
```

Remember to add `/new-page` to the `routes` array in `quotecore-nz/app/sitemap.ts`.

---

## 10. Checklist

Before shipping any new page, verify:

- [ ] **Title:** Unique, under 60 characters, follows pattern `{Topic} | QuoteCore+`
- [ ] **Description:** Unique, under 160 characters, includes target keywords
- [ ] **Canonical:** Set via `buildPageMetadata()` or `alternates.canonical`
- [ ] **OpenGraph:** title, description, url, siteName, type all set
- [ ] **Twitter:** `summary_large_image` card with title and description
- [ ] **Robots:** Using `robotsDirective()` (never hardcoded)
- [ ] **Structured data:** Appropriate schema for page type (BlogPosting, FAQPage, WebApplication, etc.)
- [ ] **Sitemap:** Page is included in `sitemap.ts` (check if automatic or manual for this page type)
- [ ] **Internal links:** Page links to at least 2 other indexable pages
- [ ] **Mobile-friendly:** Page is responsive and usable on mobile
- [ ] **Preview test:** Page renders correctly on a Vercel preview deployment
- [ ] **No `noindex` in production:** Verify `VERCEL_ENV=production` results in `index, follow`

---

## Quick Reference: SEO Helpers

| Helper | Location | Purpose |
|--------|----------|---------|
| `buildPageMetadata()` | `app/lib/seo.ts` | Full metadata (title, desc, canonical, OG, Twitter, robots) |
| `canonicalUrl(path)` | `app/lib/seo.ts` | Build absolute canonical URL |
| `robotsDirective()` | `app/lib/seo.ts` | Production/preview-aware robots directive |
| `buildOgMetadata()` | `app/lib/seo.ts` | Build OG metadata object |
| `buildTwitterMetadata()` | `app/lib/seo.ts` | Build Twitter card metadata |
| `blogPostingSchema()` | `app/lib/seo.ts` | BlogPosting JSON-LD |
| `breadcrumbSchema()` | `app/lib/seo.ts` | BreadcrumbList JSON-LD |
| `organizationSchema()` | `app/lib/seo.ts` | Organization JSON-LD |
| `websiteSchema()` | `app/lib/seo.ts` | WebSite JSON-LD |
| `siteGraphSchema()` | `app/lib/seo.ts` | Combined @graph (Organization + WebSite) |
| `buildTradeMetadata()` | `free-calculators/_shared/TradeLayoutShell.tsx` | Metadata for free tool pages |
| `absoluteUrl(path)` | `quotecore-nz/lib/seo.ts` | Build absolute NZ URL |
| `site` | `quotecore-nz/lib/seo.ts` | NZ site constants (url, currency, locale) |
