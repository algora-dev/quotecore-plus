# SEO Phase 1 — Audit Log of Changes

**Date:** 2026-07-15
**Executed by:** Gavin (GPT-5.6)
**Scope:** Code-level SEO fixes across `quotecore-plus` (global) and `quotecore-nz` (NZ)
**Commit:** `228de95` (global), `9f73d72` (NZ)

---

## Summary

7 code-level fixes applied to resolve issues identified in the Follow-Up Task PDF. All changes verified via `npm run build` (both repos) and `npm run seo:check` (10/10 checks pass). No live production testing performed yet — that is Phase 2.

---

## Fix 1: Docs pages missing canonical URLs

**Problem:** All ~99 docs pages (`/docs/[slug]`) had no `alternates.canonical` in their metadata. The docs layout had no metadata export at all, and the page's `generateMetadata` only set title + description.

**Fix:** Added `canonicalUrl` import to `app/(public)/docs/[[...slug]]/page.tsx` and added `alternates: { canonical: canonicalUrl(path) }` to `generateMetadata`. The canonical is constructed as `https://quote-core.com/docs/{slug}`.

**Files changed:**
- `app/(public)/docs/[[...slug]]/page.tsx`

**Impact:** ~99 docs pages now have self-referencing canonical URLs.

---

## Fix 2: No hreflang reciprocity (PDF item 12)

**Problem:** The NZ site declared `languages: { "en-NZ": ..., "x-default": ... }` but only pointed to itself. The global site had NO `languages` alternates at all. Hreflang must be reciprocal to work — both sites must reference each other.

**Fix:**
- **Global site** (`app/(marketing)/layout.tsx`): Added `languages` block with `en-US`, `en-GB` pointing to `quote-core.com`, `en-NZ` pointing to `www.quote-core.co.nz`, and `x-default` pointing to `quote-core.com`.
- **NZ site** (`app/layout.tsx`): Updated `languages` block to add `en-US` and `en-GB` pointing to `quote-core.com`, and changed `x-default` to point to `quote-core.com` (the global default).

**Files changed:**
- `app/(marketing)/layout.tsx` (global)
- `app/layout.tsx` (NZ)

**Impact:** Hreflang is now reciprocal. Google can correctly determine the regional relationship between the two sites.

---

## Fix 3: Coming-soon docs pages in sitemap

**Problem:** `getAllSlugs()` in `app/lib/docs/tree.ts` did not filter by `status`. The `team.mdx` page (marked `status: coming-soon`) was included in the sitemap and being indexed by Google, despite not being ready.

**Fix:** Created a new `getPublishedSlugs()` function in `tree.ts` that filters out `coming-soon` pages. Updated `sitemap.ts` to use `getPublishedSlugs()` instead of `getAllSlugs()`. The original `getAllSlugs()` is still used by `generateStaticParams` so the page still renders (with a "coming soon" banner) — it's just excluded from the sitemap.

**Files changed:**
- `app/lib/docs/tree.ts` (added `getPublishedSlugs()`)
- `app/sitemap.ts` (switched to `getPublishedSlugs()`)

**Impact:** Coming-soon docs pages are no longer in the sitemap. The `team.mdx` page is excluded.

---

## Fix 4: Manually duplicated blog sitemap array (PDF item 11)

**Problem:** The `BLOG_POSTS` array in `sitemap.ts` was a manual copy of the `posts` object in `blog/[slug]/page.tsx`. Both had 8 entries, but adding a new blog post required updating both files — risk of drift.

**Fix:** Created `app/lib/blog-posts.ts` as the single source of truth for blog post metadata (slug, title, description, date, lastModified). Both `sitemap.ts` and `blog/[slug]/page.tsx` now import from this file. The page still keeps its content imports inline (dynamic `import()` calls), but all metadata comes from the shared file.

**Files changed:**
- `app/lib/blog-posts.ts` (new)
- `app/sitemap.ts` (imports from shared file)
- `app/(marketing)/blog/[slug]/page.tsx` (imports from shared file, removed inline `posts` object)

**Impact:** Adding a new blog post now requires updating only `app/lib/blog-posts.ts` + creating the content file. No risk of sitemap/page drift.

---

## Fix 5: SoftwareApplication schema on every page (PDF item 13)

**Problem:** `SoftwareApplication` schema was in the marketing layout's `combinedSchema` graph, so it appeared on EVERY marketing page — including `/about`, `/contact`, `/privacy`, `/terms`, `/cookies`. This is inappropriate: SoftwareApplication should only be on pages describing the software product. A trivial `BreadcrumbList` with just "Home" was also on every page.

**Fix:** Removed `buildSoftwareApplicationSchema()` and `buildBreadcrumbSchema([{ name: "Home" }])` from the marketing layout's `combinedSchema`. The layout now only renders `Organization` + `WebSite` (appropriate site-wide). Added `SoftwareApplication` schema as individual `<Script>` tags on the pages where it belongs:
- Homepage (`/home/page.tsx`)
- `/roofing-quoting-software/page.tsx`
- `/construction-quoting-software/page.tsx` (already had its own)
- `/free-trial/page.tsx`

**Files changed:**
- `app/(marketing)/layout.tsx` (removed SoftwareApplication + Breadcrumb from graph)
- `app/(marketing)/home/page.tsx` (added SoftwareApplication script)
- `app/(marketing)/roofing-quoting-software/page.tsx` (added SoftwareApplication script)
- `app/(marketing)/free-trial/page.tsx` (added SoftwareApplication script)

**Impact:** SoftwareApplication schema only appears on product/conversion pages. Legal and contact pages no longer have irrelevant structured data.

---

## Fix 6: Enhanced seo-check.mjs CI script (PDF item 9)

**Problem:** The existing `seo-check.mjs` had 5 basic checks. No validation for hreflang, docs canonicals, schema scope, shared blog source, coming-soon filtering, or canonical correctness.

**Fix:** Rewrote `seo-check.mjs` with 10 checks:
1. Marketing page canonicals
2. No production noindex
3. Sitemap no app URLs
4. Blog posts shared source integrity
5. Layout exports
6. Hreflang reciprocity (global ↔ NZ)
7. Coming-soon docs filtered from sitemap
8. Docs pages have canonicals
9. SoftwareApplication not on every page
10. Canonical URL correctness (no localhost, no http://)

**Files changed:**
- `scripts/seo-check.mjs` (rewritten)

**Impact:** Running `npm run seo:check` now validates 10 SEO rules. Can be integrated into CI to prevent regressions.

---

## Fix 7: Overconfident report language (PDF item 14)

**Problem:** The audit and completion report docs contained claims like:
- "All sitemap URLs return HTTP 200" (not live-tested)
- "full link equity" (not verified)
- "indexing exclusions will resolve" (assumed)

**Fix:** Corrected language throughout `docs/technical-seo-audit.md` to clearly distinguish between code-level verification and live testing. All claims now say "verified via code inspection" or "pending post-deploy testing" where appropriate.

**Impact:** Report accurately reflects verification status.

---

## Verification

- ✅ `npm run build` passes on both repos (global + NZ)
- ✅ `npm run seo:check` passes with 10/10 checks, 0 warnings
- ⏳ Live HTTP testing (Phase 2) pending

---

## Files Changed (Complete List)

### Global site (`quotecore-plus`)
| File | Change |
|------|--------|
| `app/(public)/docs/[[...slug]]/page.tsx` | Added canonical URL to generateMetadata |
| `app/(marketing)/layout.tsx` | Added hreflang languages, removed SoftwareApplication + Breadcrumb from combinedSchema |
| `app/(marketing)/home/page.tsx` | Added SoftwareApplication schema script |
| `app/(marketing)/roofing-quoting-software/page.tsx` | Added SoftwareApplication schema script |
| `app/(marketing)/free-trial/page.tsx` | Added SoftwareApplication schema script |
| `app/(marketing)/blog/[slug]/page.tsx` | Replaced inline posts object with shared import |
| `app/lib/blog-posts.ts` | New file — shared blog post metadata |
| `app/lib/docs/tree.ts` | Added getPublishedSlugs() function |
| `app/sitemap.ts` | Uses getPublishedSlugs + shared blog posts |
| `scripts/seo-check.mjs` | Rewritten with 10 checks |
| `docs/technical-seo-audit.md` | Corrected overconfident language |

### NZ site (`quotecore-nz`)
| File | Change |
|------|--------|
| `app/layout.tsx` | Added en-US/en-GB + x-default hreflang pointing to global site |

---

## Phase 2 — Pending (Live Production Testing)

The following require a live production deploy and cannot be done via code:

1. Crawl both production sites with real URLs
2. Verify every sitemap URL returns HTTP 200 without redirect
3. Verify rendered HTML includes self-referencing canonical tags
4. Verify www/non-www/query-string redirects with HTTP requests
5. Run Google Rich Results Test on representative page types
6. Run Lighthouse on mobile + desktop representative pages
7. Update completion report with actual test evidence
