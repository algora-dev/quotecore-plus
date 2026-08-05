# Content Remediation Queue — QuoteCore+ SEO

**Date created:** 2026-07-15  
**Owner:** Content / Shaun  
**Purpose:** Track content-level SEO issues identified during technical SEO audit that should **not** be fixed during technical SEO work.

---

## Purpose

This document tracks content-level issues that affect SEO but are **not technical implementation bugs**. These items require editorial decisions, content creation, or manual review — they are out of scope for the technical SEO implementation pass.

**Rules:**
- Do NOT fix these during technical SEO work.
- Each item should be reviewed and actioned separately.
- Mark status when started and completed.
- Add new items as they are discovered.

---

## Issue Tracker

| # | URL | Issue | Severity | Recommended Action | Evidence Required | Status |
|---|-----|-------|----------|-------------------|-------------------|--------|
| 1 | `/blog/*` | Some blog images may need descriptive alt text review | Medium | Audit all blog post images for alt text. Ensure alt text is descriptive and contextually relevant, not just "image" or "screenshot". | Screenshot of any images with missing or generic alt text | ⏳ Open |
| 2 | `/blog/*` | Blog article publication and modification dates should be verified | Low | Confirm that `datePublished` in frontmatter matches the actual publication date. Check `dateModified` is updated when posts are revised. | List of all blog posts with their current dates vs. actual publication dates | ⏳ Open |
| 3 | `/about` | About page content could be expanded | Low | The about page is thin. Consider adding company story, team, values, and trust signals. Thin content may underperform in search. | Word count of current about page; competitor about pages for comparison | ⏳ Open |
| 4 | `/blog/*` | Internal linking between blog posts and product pages is limited | Medium | Add contextual internal links from blog posts to relevant product pages (`/roofing-quoting-software`, `/free-trial`, etc.). Each blog post should link to at least one product or free tool page. | Audit of internal links in each blog post | ⏳ Open |
| 5 | `/services` | Services page content may need expansion for target keywords | Low | Review services page for keyword targeting and content depth. Add sections for each service category if appropriate. | Current word count; keyword analysis of competitor services pages | ⏳ Open |
| 6 | `/blog/*` | Blog post content quality and length review | Low | Audit all 8 blog posts for content depth, readability, and keyword optimisation. Some posts may be too thin to rank competitively. | Word count per post; readability score; keyword density check | ⏳ Open |
| 7 | `/docs/*` | Some docs pages may have thin or placeholder content | Low | Review all doc pages for content completeness. The 1 `coming-soon` page should either be completed or excluded from the sitemap. | List of doc pages with word count < 200 words | ⏳ Open |
| 8 | `www.quote-core.co.nz/*` | NZ site pages may need NZ-specific content | Medium | NZ pages should have NZ-specific pricing (NZD), examples, and local references. Review all 12 NZ pages for localisation quality. | Side-by-side comparison of NZ vs. global page content | ⏳ Open |
| 9 | `/free-calculators/*` | Free tool page descriptions for search snippets | Low | Review meta descriptions for all free tool pages. Ensure they are compelling, under 160 characters, and include target keywords. | List of all free tool URLs with current meta descriptions | ⏳ Open |
| 10 | `/blog/*` | Blog post internal links to other blog posts | Low | Add "related posts" or contextual links between blog posts to improve content discoverability and keep readers on site longer. | Audit of cross-links between blog posts | ⏳ Open |

---

## How to Use This Tracker

1. **When you start working on an item:** Change status from ⏳ Open to 🔄 In Progress.
2. **When you complete an item:** Change status to ✅ Done and add the date.
3. **When you discover a new content issue:** Add a new row with all columns filled.
4. **Evidence Required:** Before marking an item as done, collect the evidence noted in this column. This helps verify the fix was effective.

---

## Severity Definitions

| Severity | Meaning |
|----------|---------|
| **High** | Likely to significantly impact search rankings or user experience. Address soon. |
| **Medium** | May impact rankings or user experience. Address in next content sprint. |
| **Low** | Minor improvement. Address when convenient or during content refresh cycles. |

---

## Notes

- These items were identified during the technical SEO audit dated 2026-07-15.
- Technical SEO issues (canonicals, robots.txt, sitemaps, structured data) are tracked separately in `docs/technical-seo-audit.md`.
- New content issues discovered after this date should be added to this tracker, not the technical audit.
