# QuoteCore+ SEO Audit Implementation Plan

**Created:** 2026-08-01
**Author:** Ron
**Status:** Reviewed and hardened on GPT-5.6
**Domain decision:** Keep `.co.nz` as separate NZ site (per Shaun, 2026-08-01)

---

## Context

This plan is Ron's response to the external SEO audit document. It covers `quote-core.com` (global) and `quote-core.co.nz` (NZ). The audit scored .com at 74/100 and .co.nz at 48/100. After review, several audit recommendations are already implemented (structured data, hreflang, environment-aware robots, OG images, canonical URLs). This plan focuses on the gaps that genuinely exist.

**Domain strategy:** Keep both domains for now. The `.co.nz` ccTLD is a strong NZ geographic and user-trust signal, but a well-localised `.com/nz/` section can also rank successfully. The separate-site strategy only remains worthwhile if the NZ site earns distinct content, queries, links, and conversions. Review the decision after 90 days of reliable Search Console data rather than treating it as irreversible SEO doctrine.

## GPT-5.6 Review Improvements

The initial plan had the right broad priorities, but it needed five material corrections:

1. **Measurement must come first.** Without Search Console, analytics, conversion tracking, and a baseline, page production cannot be tied to ranking or revenue outcomes.
2. **Keyword mapping must precede new URLs.** Feature pages can cannibalise existing roofing, construction, blog, and calculator pages if search intent is not validated first.
3. **Evidence must precede claims.** Supabase and Stripe are infrastructure, not customer integrations. Data export, security, cancellation, supplier compatibility, tax, and pricing claims must be verified before publication.
4. **Design needs its own gate.** Batch-producing SEO pages without a shared marketing page system risks a visually inconsistent, template-like site.
5. **Authority cannot be omitted.** Backlinks and distribution are not primarily coding tasks, but meaningful ranking growth will eventually depend on earned authority as well as on-site work.

## Phase 0: Measurement, Baseline, and Keyword Map

This phase happens before page expansion.

### 0.1 Connect measurement

**Shaun:**
- Verify both domains in Google Search Console.
- Verify both domains in Bing Webmaster Tools.
- Confirm production GA4 access.

**Ron:**
- Verify trial clicks, signup completions, pricing actions, calculator use, and free-tool-to-trial events.
- Confirm equivalent measurement on the NZ site.
- Create a monthly organic scorecard.

### 0.2 Capture a 90-day baseline

Record, where data exists:

- Organic clicks, impressions, CTR, and average position by query and page
- Brand versus non-brand demand
- UK and NZ performance
- Indexed, excluded, and crawled-not-indexed URLs
- Organic landing-page conversions and trial starts
- Free-tool usage and tool-to-trial conversion
- Referring domains and strongest linked pages
- Core Web Vitals field data

If historical data is unavailable, record launch-week baselines and avoid claiming uplift until enough data exists.

### 0.3 Build a keyword-to-page map

For every current and proposed page, record:

- Primary query cluster and search intent
- Target country
- Current ranking URL
- Proposed canonical URL
- Supporting pages and internal links
- Required evidence and media
- Conversion action

Use the map to prevent cannibalisation between the homepage, core landing pages, feature pages, blog posts, tools, and NZ equivalents.

**Effort:** 4-6 hours, excluding account setup.

## Page Quality Gate

Every new or materially changed public page must meet these requirements:

### Search and evidence
- One distinct search intent and page purpose
- Live SERP review before URL/title decisions
- Original product proof, examples, screenshots, or useful methodology
- No unverified integrations, statistics, security claims, legal promises, supplier relationships, or customer outcomes
- Regulations and tax content uses authoritative sources and a genuine review date

### Design and accessibility
- Reuse a shared marketing hero, media frame, content section, FAQ, related-content, and CTA system
- Follow `docs/DESIGN_SYSTEM.md` and the nearest existing marketing patterns
- Use the established black pill primary CTA and approved secondary treatment
- Use `#BD4A1A` for accessible orange text/background on white; reserve `#FF6B35` for decorative accents where contrast is not required
- Verify mobile spacing, heading scale, keyboard access, focus states, reduced motion, alt text, and 44px touch targets
- Keep pages visually related without making every page a duplicate SEO template

### Technical
- Server-rendered primary copy and links
- Unique title, description, H1, canonical, OG/Twitter metadata
- Correct sitemap, robots, and hreflang behaviour
- Structured data matches visible content
- `npm run lint`, `npm run seo:check`, and `npm run build` pass
- Lighthouse/PageSpeed checks run on affected templates

---

## Phase 1: Quick Wins (Low effort, high impact)

### 1.1 Homepage metadata tightening

**Current:** Root layout `title.default` is just "QuoteCore+". Homepage relies on the template.
**Change:** Give the homepage an explicit, keyword-targeted title and meta description.

- Title: `Roofing & Construction Quoting Software | QuoteCore+`
- Meta description: `Measure jobs, create accurate quotes, track approvals, order materials and invoice in one platform. Built for roofing and construction contractors.`
- H1: Already leads with roofing - no change needed.

**Effort:** 30 minutes
**Files:** `app/page.tsx`. The marketing homepage component is client-only, so it cannot export metadata directly.

### 1.2 Qualify or remove unsupported claims

**Current:** Slogans like "under 3 minutes" and "less than a dollar" are used without methodology.
**Change:** Either add a brief methodology note (e.g., "based on internal testing with experienced users on standard roofing jobs") or soften to "from complex plan to quote in minutes." Remove any "best" superlatives that can't be defended.

**Effort:** 1 hour (content review across homepage + landing pages)
**Files:** `app/(marketing)/home/page.tsx`, `app/(marketing)/roofing-quoting-software/page.tsx`, `app/(marketing)/construction-quoting-software/page.tsx`

### 1.3 Fix NZ site cross-domain navigation leaks

**Current:** NZ BlogHeader links to `https://quote-core.com/blog` (sends NZ users to the global site). SiteFooter links to `https://quote-core.com/blog` and `https://app.quote-core.com/docs`.
**Change:**
- Blog link: Either create a blog on the NZ site, or link to the .com blog with a clear "opens global site" indicator. If no NZ blog is planned, the link should go to NZ-specific content (guides, case studies) rather than the global blog index.
- Documentation: Keep the .com docs link but mark as external.
- App links: These are fine - NZ users need the app.

**Decision needed from Shaun:** Does the NZ site get its own blog, or do we link to .com/blog with clear external labelling?

**Effort:** 1 hour
**Files:** `projects/quotecore-nz/components/BlogHeader.tsx`, `projects/quotecore-nz/components/SiteFooter.tsx`

### 1.4 Add homepage links to strategic pages

**Current:** Homepage links to roofing software, construction software, free trial, pricing, free tools, about, contact. Missing: suppliers page link could be more prominent, no link to services page from main nav area.
**Change:** Ensure homepage body content links to `/suppliers`, `/services`, and the new feature pages (once built) in relevant sections.

**Effort:** 30 minutes (after feature pages exist)
**Files:** `app/(marketing)/home/page.tsx`

---

## Phase 2: Feature Pages (High impact, medium effort)

### 2.1 Build a feature hub and 3 pilot feature pages

This is the biggest SEO gap. We have landing pages for "roofing quoting software" and "construction quoting software" but zero pages for individual product features. These capture high-intent searches like "roof takeoff software," "smart components," "material ordering software."

Validate search intent before finalising URLs. Start with three pages that have the strongest product proof, likely:

| URL | Target keyword | Content focus |
|---|---|---|
| `/features/digital-roof-takeoff` | digital roof takeoff, roof takeoff software | How takeoff works in QuoteCore+, supported inputs (plans, measurements), outputs, screenshots |
| `/features/smart-components` | smart components, reusable quoting components | What Smart Components are, how they save time, examples, setup workflow |
| `/features/material-ordering` | material ordering software, construction material orders | How quotes become material orders, supplier connection, format outputs |
| `/features/quote-approval` | quote approval tracking, quote follow-up | Customer preview link, accept/decline tracking, follow-up workflow |
| `/features/automated-quote-follow-up` | automated quote follow-up, quote tracking | How the system tracks sent quotes, reminder logic, status dashboard |

Create `/features` as a concise product-workflow hub. The final two rows are later candidates, not automatic deliverables. Do not create separate digital-takeoff and roof-measurement pages if live SERPs show the same intent; one authoritative page is better than two competing pages.

**Each feature page includes:**
- Clear H1 with target keyword
- What the feature is (definition paragraph, AI-quote-friendly)
- Who it's for
- What problem it solves
- Step-by-step workflow (numbered list)
- Screenshots (need from Shaun or from app)
- Video embed if available (check YouTube library)
- Visible FAQ section where users genuinely need it; FAQ schema may aid machine understanding but is unlikely to produce a Google rich result for a commercial SaaS page
- Internal links: main landing page, related features, relevant calculators, free trial, pricing
- BreadcrumbList schema
- CTA to free trial
- `SoftwareApplication` or `WebApplication` schema where relevant

**Route group:** `app/(marketing)/features/[slug]/page.tsx` or individual page files.
**Nav:** Add "Features" to BlogHeader navigation (between "Product" and "Free Tools" or similar).

**Effort:** 18-28 hours for the hub, three evidence-rich pages, assets, integration, responsive QA, and validation. Remaining candidates follow only after indexing and initial performance review.
**Needs from Shaun:** Screenshots of each feature in action (or permission to use existing product images).

### 2.2 Add feature page links to existing landing pages

Once feature pages exist, the roofing and construction landing pages should link to them in the relevant workflow steps. E.g., "Measure the job" step links to `/features/digital-roof-takeoff`.

**Effort:** 30 minutes
**Files:** `app/(marketing)/roofing-quoting-software/page.tsx`, `app/(marketing)/construction-quoting-software/page.tsx`

---

## Phase 3: Entity & Trust Pages (High impact, low effort)

### 3.1 Company facts page at `/company`

**Purpose:** Single authoritative page for AI search engines to understand what QuoteCore+ is. Consolidates company info that's currently scattered.

**Content:**
- What QuoteCore+ is (canonical definition, consistent with homepage)
- Legal company name (T3 Play Limited)
- Founder (Shaun, 12 years roofing experience)
- Product category: roofing and construction quoting software
- Regions served: UK, NZ, US, AU
- Supported trades: roofing, cladding, flooring, fencing, landscaping, general construction
- Pricing model: subscription with free trial
- Verified customer-facing integrations only; Supabase and Stripe are infrastructure providers, not product integrations
- Verified security approach, approved by the relevant app owner
- Support: email + in-app
- Trial terms: 14 days, no credit card
- Data export information only after the current capability and process are confirmed
- Last updated date
- `Organization` schema (full, with all properties)
- BreadcrumbList schema

**Effort:** 2 hours
**Files:** `app/(marketing)/company/page.tsx`

### 3.2 Founder/author entity page

**Purpose:** Strengthen Shaun as a recognised subject-matter expert entity.

**Options:**
- A) Enhance the existing `/about` page with `Person` schema and more detail about Shaun's roofing background, product role, and authored content.
- B) Create a dedicated `/about/shaun` page.

**Recommendation:** Option A (enhance existing). The about page already tells Shaun's story. Add:
- `Person` schema with `name`, `jobTitle`, `description`, `knowsAbout`, `alumniOf` (if applicable), `sameAs` (LinkedIn, YouTube)
- List of blog posts authored by Shaun
- Areas of expertise (roofing estimation, quoting workflow, material pricing, digital takeoff)
- Link to company page

**Effort:** 1.5 hours
**Files:** `app/(marketing)/about/page.tsx`

### 3.3 Person schema on blog posts

**Current:** Blog posts use `BlogPosting` schema but may not include full author `Person` entity.
**Change:** Ensure every blog post's schema includes:
```json
"author": {
  "@type": "Person",
  "name": "Shaun",
  "url": "https://quote-core.com/about",
  "jobTitle": "Founder, QuoteCore+",
  "description": "12 years of roofing experience, now building QuoteCore+."
}
```

**Effort:** 30 minutes
**Files:** `app/lib/seo.ts` or `app/lib/schema.ts` (wherever blogPostingSchema is built), `app/(marketing)/blog/[slug]/page.tsx`

---

## Phase 4: Internal Linking System (High impact, low effort)

### 4.1 Define internal linking rules per page type

Create a reference doc: `docs/INTERNAL_LINKING.md`

**Rules:**

| Page type | Must link to |
|---|---|
| Blog post (roofing) | Roofing landing page, related feature page, relevant calculator, free trial |
| Blog post (construction) | Construction landing page, related feature page, relevant calculator, free trial |
| Blog post (comparison) | Both compared products' pages, pricing, free trial |
| Calculator page | Explanation guide (if exists), related feature page, relevant landing page, free trial |
| Feature page | Main landing page (roofing/construction), related features, pricing, free trial, relevant calculator |
| Landing page (roofing) | All feature pages, pricing, free trial, relevant calculators, case studies (when they exist) |
| Homepage | Roofing landing, construction landing, free tools, free trial, pricing, suppliers, services, company |

**Anchor text rules:**
- Descriptive and natural: "roof takeoff software", "Smart Components", "material ordering"
- Never: "click here", "learn more", "read this"
- Avoid repetitive exact-match anchors and link only to genuinely useful next steps

### 4.2 Implement linking rules in existing pages

Go through each blog post and calculator page and add internal links per the rules. This is manual content work.

**Effort:** 5-8 hours across 26 blog posts and 50 public-route pages, prioritised by traffic and relevance rather than forcing links into every page.
**Files:** Each blog post content file in `app/(marketing)/blog/[slug]/content/`, each calculator page

### 4.3 Add "Related Features" section to calculator pages

Each calculator page should have a section linking to the most relevant feature page. E.g., roofing calculator -> `/features/digital-roof-takeoff`. This creates a path from free tool to product.

**Effort:** 1 hour (after feature pages exist)
**Files:** Calculator page templates

---

## Phase 5: Blog Architecture (Medium impact, medium effort)

### 5.1 Create topic hub pages

Audit existing posts for traffic, overlap, quality, and freshness before creating hubs. Consolidate or refresh weak pages first. Keep the chronological blog and create durable editorial hubs under `/resources/` so they are more than tag archives and do not blur the existing dynamic blog route.

**Hubs to create:**

| Hub URL | Hub title | Posts included |
|---|---|---|
| `/resources/roofing-estimating` | Roofing Estimating Guides | Measurement, pricing, waste, materials, and relevant calculators |
| `/resources/construction-quoting` | Construction Quoting Guides | Quote workflow, invoicing, purchase orders, and cost estimating |
| `/resources/digital-takeoffs` | Digital Takeoff Guides | Roof takeoff, measurement, and AI-assisted workflows |
| `/resources/contractor-business` | Contractor Business Guides | Lead generation, starting a business, and quote follow-up |

**Implementation:**
- Taxonomy system: add a primary topic and optional secondary topics to `BlogPostMeta`
- Hub pages under `/resources/[topic]`
- Blog index page shows hub cards at the top, then all posts below
- Each hub page has: intro paragraph, links to posts, links to relevant landing pages/calculators, CTA

**Effort:** 3 hours (tagging + hub page template + updating blog index)
**Files:** `app/lib/blog-posts.ts` (add taxonomy), `app/(marketing)/blog/page.tsx`, new resource hub routes under `app/(marketing)/resources/`

### 5.2 Add "last reviewed" dates to blog posts

Display `last reviewed` only after a genuine editorial review. Do not automatically refresh dates to simulate freshness.

**Effort:** 30 minutes
**Files:** `app/(marketing)/blog/[slug]/page.tsx`

---

## Phase 6: NZ Site Differentiation (High impact, high effort)

### 6.1 Audit NZ content overlap

Compare each NZ page against its .com equivalent. Identify which pages are near-duplicates vs genuinely local.

**Known overlap:**
- Homepage: Same structure, same components, similar copy
- About: Same founder story (acceptable - it's the same person)
- Roofing/construction landing pages: Similar workflow descriptions
- Services: Same description
- Free tools: Same tools, same calculator engine

### 6.2 Prioritise NZ-specific content additions

Content that would make the NZ site genuinely local and worth ranking independently:

1. **NZ case studies** - Even one short case study with a NZ roofing business would add massive local value. Needs Shaun's customer connections.
2. **NZ supplier/material guide** - Cover relevant NZ suppliers and materials using neutral inclusion criteria. Do not imply compatibility, partnership, or integration unless confirmed.
3. **NZ pricing page** - The NZ site has NZD pricing, but it should explicitly mention GST, NZ payment methods, and NZ plan costs.
4. **NZ construction regulations guide** - Use official sources, define the scope carefully, add a disclaimer and genuine review date, and avoid implying QuoteCore+ guarantees compliance.
5. **Local terminology within useful pages** - Use NZ terminology naturally rather than creating a thin standalone glossary unless keyword research shows demand.

**Decision needed from Shaun:** Which of these can you provide input/data for?

**Effort:** 4-6 hours (content-heavy, some needs Shaun's input)
**Files:** NZ repo - new pages + content files

### 6.3 NZ sitemap and robots verification

Ensure NZ sitemap only includes NZ-canonical URLs (not .com URLs). Ensure robots.txt points to NZ sitemap. Already appears correct but verify after any content changes.

**Effort:** 30 minutes
**Files:** `projects/quotecore-nz/app/sitemap.ts`, `projects/quotecore-nz/app/robots.ts`

---

## Phase 7: Free Tool Funnels (High impact, medium effort)

### 7.1 Add educational content to each calculator

Prioritise five tools using Search Console demand, actual usage, backlink potential, and product relevance. Likely candidates are roofing calculator, roof takeoff builder, roof pitch calculator, roofing material calculator, and construction calculator.

1. **"How to use this calculator"** section (short, 3-4 steps)
2. **Formula explanation** (what math the calculator does)
3. **Worked example** (real numbers, real scenario)
4. **Common mistakes** (what people get wrong)
5. **Related feature link** (how QuoteCore+ does this automatically)
6. **Related guide link** (blog post on the topic)
7. **Free trial CTA**

Do not apply the same content block mechanically to all 50 public-route pages. Each selected tool needs original assumptions, examples, limitations, and next steps.

**Effort:** 1-2 hours per calculator (content + page updates)
**Files:** Each calculator page in `app/(public)/free-calculators/`

### 7.2 Add VideoObject schema to video-embedding pages

We have 9 YouTube videos. Pages that embed them should have `VideoObject` schema.

**Effort:** 1 hour
**Files:** Pages with YouTube embeds (homepage, roofing landing page, blog posts with videos)

---

## Phase 8: Pricing Page Enrichment (Medium impact, low effort)

### 8.1 Add buyer-question content to pricing page

The pricing section on the homepage shows plans and prices. Pricing, cancellation, exports, taxes, and billing promises must be confirmed with Shaun and the relevant app owner before publication. Add only verified information:

- **Currency clarification** - "Prices shown in [GBP/USD]. GST/VAT not included." (already has geo-detection)
- **Cancellation terms** - "Cancel anytime. No lock-in contracts."
- **Data export** - "Export your quotes, customers, and materials at any time."
- **Cost examples by use case** - only where the recommendation follows the actual plan limits; do not invent company-size guidance
- **Plan comparison FAQ** - "What's the difference between Pro and Pro Plus?" etc.
- **Trial restrictions** - "14 days, 10 quotes, 100MB storage, 20 AI Assist points. No credit card required."

**Effort:** 1.5 hours
**Files:** Homepage pricing section or dedicated pricing page (currently pricing is on the homepage)

---

## Phase 9: Technical SEO Verification (Medium impact, low effort)

### 9.1 Verify canonical tags on all key pages

Check that every indexable page has a self-referencing canonical. Already implemented via `buildPageMetadata` and explicit `alternates.canonical` on most pages, but verify:

- [ ] Homepage
- [ ] Roofing landing page
- [ ] Construction landing page
- [ ] About, Contact, Services, Suppliers, Free Trial
- [ ] All blog posts
- [ ] All calculator pages
- [ ] All calculator slug pages (42 SEO pages)
- [ ] Free tools hub, Free calculators hub
- [ ] Takeoff builder
- [ ] NZ site equivalents

**Effort:** 1 hour (automated check with a script or manual spot-check)
**Files:** N/A (verification only, fix any strays)

### 9.2 Verify noindex on private pages

Ensure all auth/app pages have `noindex`:
- [ ] `/login`, `/signup`, `/2fa`, `/onboarding`
- [ ] `/admin/*`
- [ ] `/accept/[token]`
- [ ] All `app/(auth)/` routes
- [ ] `/api/*` (blocked by robots.txt, but also check noindex on any HTML responses)

**Effort:** 30 minutes
**Files:** Layout files for auth routes

### 9.3 Run Lighthouse audit on key pages

Run Lighthouse on:
- Homepage (mobile + desktop)
- Roofing landing page
- Blog index
- A blog post
- A calculator page
- Free tools hub
- Takeoff builder

Targets: pass Core Web Vitals field assessment where data exists; Lighthouse Accessibility, Best Practices, and SEO at 95+; Performance at 90+ where realistic. Investigate regressions rather than hiding them behind a single lab score.

**Effort:** 2 hours (audit + fixes)
**Files:** TBD based on results

---

## Phase 10: Case Studies (High impact, needs Shaun's input)

### 10.1 Build case study page template

Create `app/(marketing)/case-studies/[slug]/page.tsx` with the structure from the audit:

1. Customer details (company, location, trade, team size)
2. Before QuoteCore+ (existing process, quote time, errors)
3. Implementation (setup, templates, training, time to first quote)
4. Results (quote time before/after, number of quotes, error reduction, margin impact)
5. Evidence (customer quote, screenshots, logo, date)

**Effort:** 2 hours (template + schema)
**Files:** `app/(marketing)/case-studies/[slug]/page.tsx`, `app/(marketing)/case-studies/page.tsx` (index)

### 10.2 Publish 3 case studies

**Needs from Shaun:**
- Customer name/business
- Permission to use their data
- Before/after metrics
- Quote/testimonial
- Screenshots of their quotes in the system

**Effort:** 1 hour per case study (content + page)
**Blocks on:** Shaun providing customer data

---

## Parallel Workstream: Authority and Distribution

Authority cannot be omitted from a ranking plan simply because it is not primarily development work.

### Entity consistency

Keep the product name, category, legal company, founder, description, logo, URL, and regions consistent across LinkedIn, YouTube, software directories, public profiles, and both websites.

### Link-worthy assets

Prioritise assets grounded in first-party experience or data:

- Roofing quoting benchmark report
- Quote response-time study
- Downloadable roofing estimate checklist
- NZ roofing material or cost research
- Original calculators with transparent methodology

### Targeted outreach

Seek relevant earned links from customers, suppliers, associations, trade publications, podcasts, training providers, and legitimate directories. Avoid paid link packages, generic guest-post networks, and low-quality directories.

**Owner:** Shaun/marketing, with Ron supporting the assets and landing pages. Review monthly.

## Measurement and Review Cadence

Review at 30, 60, and 90 days using:

- Non-brand organic clicks and impressions
- Target commercial queries in the top 3, top 10, and top 20
- Organic trial starts and signup completions
- Commercial-page-to-trial conversion rate
- Free-tool-to-trial conversion rate
- NZ organic clicks, rankings, and trial starts
- Indexed canonical pages and indexing issues
- Relevant new referring domains
- Core Web Vitals pass rate
- Cannibalisation between similar URLs

Do not use raw page count, schema count, publication volume, or Lighthouse alone as success metrics.

---

## What we're explicitly NOT doing

From the audit's recommendations, these are deferred or skipped:

| Item | Reason |
|---|---|
| Immediate domain consolidation (.co.nz -> .com/nz/) | Keep `.co.nz` while building genuine local value, then review against 90 days of reliable data. |
| Sitemap partitioning into multiple files | 80-90 URLs is fine in a single sitemap. Revisit at 500+. |
| Industry pages for trades without proof | No real users/case studies in those trades yet. Premature. |
| Generic backlink campaign | Authority work remains essential, but it will use relevant assets and targeted outreach rather than bulk link-building. |
| Regional content for AU/US | Focus on UK + NZ first. AU/US when there's demand. |
| Press kit / media kit | Premature at current stage. Build when there's media interest. |

---

## Execution Order (Recommended)

| Step | Phase | Item | Effort | Dependencies |
|---|---|---|---|---|
| 1 | 0 | Measurement setup and baseline | 4-6 hr | Search Console/Bing/GA4 access |
| 2 | 0 | Keyword-to-page map | Included | Baseline and SERP review |
| 3 | 9 | Technical crawl and SEO verification | 3-5 hr | Baseline captured |
| 4 | Quality gate | Shared marketing page system | 3-5 hr | Design review |
| 5 | 1 | Homepage metadata and claim review | 1.5 hr | Keyword map and fact review |
| 6 | 2 | Features hub + 3 pilot pages | 18-28 hr | Product proof and screenshots |
| 7 | 3 | Company/About entity improvements | 4-5 hr | Verified company/founder facts |
| 8 | 10 | First evidence-led case study | 3-5 hr | Customer permission and evidence |
| 9 | 5 | Existing-content audit + resource hubs | 6-10 hr | Performance/content inventory |
| 10 | 4 | Contextual internal linking | 5-8 hr | Feature/resource URLs live |
| 11 | 7 | Top five free-tool funnels | 12-20 hr | Search and usage priorities |
| 12 | 6 | NZ local assets and journey fixes | 12-24 hr | Shaun's NZ input |
| 13 | 8 | Verified pricing content | 3-5 hr | Shaun/Gavin fact approval |
| 14 | Parallel | Authority assets and outreach | Ongoing | Marketing ownership |
| 15 | Review | 30/60/90-day analysis | Ongoing | Production data |

**Revised estimated effort:** 70-115 hours, excluding account setup, customer interviews, approvals, outreach, and the 90-day measurement window. The original 50-hour estimate was too optimistic for research, original content, screenshots, responsive QA, accessibility, analytics, and two-site validation.

---

## Next Steps

1. Shaun sets up/accesses Search Console, Bing Webmaster Tools, and GA4 for both domains
2. Ron captures the baseline and builds the keyword-to-page map
3. Ron completes the technical crawl and shared marketing page specification
4. Execute in small batches on `development`, with lint, SEO check, build, accessibility, and performance validation
5. Deploy to the testing/preview project for visual review
6. Shaun approves any merge to `main`
7. Annotate releases and review outcomes at 30, 60, and 90 days
