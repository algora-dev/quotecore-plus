# SEO Baseline - 2026-07-29

## Build status
- Branch: main
- Build: PASS (next build, exit 0)
- Lint: not run in this pass
- SEO checker: PASS (0 errors, 0 warnings)

## Sitemap inventory
### Static entries (21)
- `/` (priority 1.0)
- `/blog` (0.8)
- `/roofing-quoting-software` (0.9)
- `/construction-quoting-software` (0.9)
- `/services` (0.7)
- `/about` (0.5)
- `/contact` (0.5)
- `/free-trial` (0.9)
- `/privacy` (0.3)
- `/cookie-policy` (0.3)
- `/terms` (0.3)
- `/docs` (0.7)
- `/free-calculators` (0.8)
- `/free-roofing-calculator` (0.9)
- `/free-construction-calculator` (0.9)
- `/free-concrete-calculator` (0.9)
- `/free-landscaping-calculator` (0.9)
- `/free-birds-mouth-calculator` (0.9)
- `/free-quote-generator` (0.9)
- `/free-purchase-order-generator` (0.9)
- `/free-invoice-generator` (0.9)
- `/free-roofing-takeoff-builder` (0.9)

### MISSING from sitemap
- `/free-tools` (the hub page - not listed!)
- `/free-birds-mouth-calculator` is present but bird's mouth slug pages may not be

### Blog entries
- Dynamic from `getSitemapPosts()` in `app/lib/blog-posts.ts`

### SEO slug entries (42)
- Roofing slugs, concrete slugs, construction slugs, slope slugs

### Doc entries
- Dynamic from `getPublishedSlugs()`

## robots.txt
- Production: allows specific paths via explicit allow list
- `/free-tools` NOT in allow list (bug)
- `/free-calculators` IS in allow list
- Disallows: `/api/`, `/auth/`, `/onboarding`, `/2fa`, `/accept/`, `/admin`, `/login`, `/signup`, workspace-scoped authed routes
- Sitemap: points to `${SITE_URL}/sitemap.xml`

## Key issues found
1. `/free-tools` missing from sitemap
2. `/free-tools` missing from robots.txt allow list
3. All sitemap entries use `new Date()` for lastModified (not truthful dates)
4. No `llms.txt` file
5. Title suffixes use repeated `QuoteCore+` (need to verify across pages)
6. NZ site needs canonical/hreflang audit

## Free tools page
- `/free-tools/page.tsx` is a client component (`'use client'`)
- Renders all tool links client-side only (not in initial HTML)
- Has `ItemList` JSON-LD in layout (server-rendered)
- But the actual tool links are in client-rendered JSX

## SEO checker current state
- 10 checks implemented
- All pass with 0 errors, 0 warnings
- Missing checks: sitemap/robots conflicts, non-self-canonicals, duplicate title suffixes, invalid/client-only JSON-LD, missing H1s, redirecting sitemap URLs, hreflang mismatches, orphan tool pages
