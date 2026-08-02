# QuoteCore+ Dual-Domain SEO and AI Findability Plan

**Created:** 2026-08-02
**Finalised on:** GPT-5.6
**Execution model:** GLM 5.2, one phase at a time
**Status:** Ready for implementation

## Objective

Keep both domains live and independent:

- `quote-core.com`: global product authority, international commercial pages, resources, and tools.
- `www.quote-core.co.nz`: a locally credible NZ buying journey using NZD, GST, metric examples, local terminology, suppliers, proof, and support context.

The sites share product truth and brand, but not identical copy, evidence, offers, or market context. This is not a redesign.

This is the controlling execution plan. Where priorities conflict, it supersedes `projects/quotecore-plus/docs/SEO_AUDIT_IMPLEMENTATION_PLAN.md`.

## Guardrails

1. Work only on `development`. Never commit or push to `main`.
2. Pull `origin/development` before work and before pushing.
3. Production requires Shaun's explicit approval.
4. Ron owns public marketing, SEO, content, navigation, schema, and free tools.
5. Do not alter APIs, app internals, billing logic, database schema, auth, or takeoff logic.
6. Gavin confirms product claims that depend on app behaviour.
7. Publish only verified prices, capabilities, customer results, supplier relationships, integrations, security claims, and legal facts.
8. Read `projects/quotecore-plus/docs/DESIGN_SYSTEM.md` before UI work.
9. Keep normal NZ journeys on `.co.nz`; cross domains only deliberately.
10. Each phase must pass its gate before the next begins.

## Confirmed Baseline

- Several live NZ pages canonicalise to `.com`, including About, Roofing Software, Construction Software, Free Trial, Services, and legal pages.
- Hreflang is incomplete and non-reciprocal on feature pages.
- Use `en`, `en-NZ`, and `x-default`; do not map one global URL as separate US and GB content.
- Some NZ calculator layouts lack explicit self-canonicals.
- Some hostname variants take two redirect hops.
- NZ Digital Roof Takeoff schema declares USD.
- Sitemap `lastModified` values are artificial build/request dates.
- Most equivalent NZ commercial pages are approximately 96-100% similar to global pages.
- Feature pages lack required facts, limitations, examples, downloads, tables, and feature-specific demos.
- NZ homepage includes both VAT and GST messaging and unsupported superiority wording.
- Country selection, trust, customer proof, supplier acquisition, and systematic internal linking are incomplete.

## GLM Execution Protocol

For each phase:

1. Read this plan and only the relevant files.
2. Confirm branch and working-tree state; preserve pre-existing changes.
3. Implement only the current phase.
4. Run its validation plus lint, SEO checks, and production build where applicable.
5. Review changed UI on mobile and desktop.
6. Commit clearly to `development` only after the gate passes.
7. Report files changed, tests, unresolved dependencies, and next phase.
8. Stop for Shaun's review.

## Phase 0 - Baseline, Page Map, and Evidence

**Estimate:** 0.5-1 day

### Tasks

- Record status, canonical, title, H1, hreflang, indexability, schema, redirects, and sitemap inclusion for all commercial URLs.
- Classify every URL as reciprocal equivalent, global-only, NZ-only, or proposed.
- Build a keyword map: query, intent, country, ranking URL, canonical URL, support links, CTA, and evidence.
- Build a claims ledger: verified, needs Gavin, needs Shaun, or do not publish.
- Build an evidence ledger: screenshots, videos, transcripts, downloads, customer permission, supplier data, and examples.
- Capture GSC, Bing, GA4, conversion, and Core Web Vitals baselines where access exists.

### Initial page-map direction

- Reciprocal: homepage, features hub, five feature pages, roofing, construction, about, contact, services, free trial, and genuinely equivalent legal pages.
- Global-only initially: blog, docs, broad resources, most calculators, company, and international content.
- NZ-only initially: NZ pricing plus future local guides, tools, and case studies.
- New URLs require search-intent and evidence validation first.

### Gate 0

- Every URL has an owner, intent, region, canonical, hreflang decision, CTA, and evidence requirement.
- No unresolved URL collision or obvious cannibalisation.
- Unsupported claims are identified before copywriting.

## Phase 1 - Critical Technical Repair

**Estimate:** 1-2 days
**Priority:** Immediate

### Tasks

- Standardise hreflang to `en`, `en-NZ`, and `x-default`; emit it only for approved reciprocal pages.
- Replace every wrong NZ `.com` canonical with a self-referencing `.co.nz` canonical.
- Add missing self-canonicals and reciprocal hreflang.
- Fix wrong-domain OG URLs and accidental cross-domain CTAs.
- Correct NZ schema currencies and regional facts to NZD/NZ.
- Model one shared legal organisation consistently, with a separate NZ `WebSite` entity.
- Keep only canonical, indexable, HTTP 200 URLs in sitemaps; use real dates or omit them.
- Verify robots protects private routes without blocking public assets.
- Make every non-preferred hostname redirect to its preferred host in one hop, preserving path/query.
- Extend global `seo:check` and add NZ `seo:check` for canonical, hreflang, status, sitemap, domain, and currency errors.

### Gate 1

- No NZ commercial page canonicalises to `.com`.
- Every indexable URL self-canonicalises.
- Every hreflang set is reciprocal, canonical, non-redirecting, and HTTP 200.
- Host redirect matrix is one hop.
- Both SEO checks, lint, and builds pass.
- Preview crawl confirms deployed behaviour.

## Phase 2 - Architecture and Regional Journeys

**Estimate:** 2-3 days

### Tasks

- Finalise navigation: Product, Features, Industries, Free Tools, Resources, Pricing, Customer Stories, About, and Start Free Trial.
- Add the five feature pages plus All Features to the feature menu.
- Add Industries only where distinct content and proof exist.
- Add a text country selector: Global and New Zealand.
- Keep pricing, trial, contact, and proof journeys on the current domain.
- Expand footers with product, features, resources, tools, pricing, trial, company, trust, legal, contact, and country links.
- Add visible breadcrumbs matching `BreadcrumbList` schema.
- Add reusable related feature, guide, tool, case study, pricing, and trial link sections.
- Decide `/suppliers` versus `/for-suppliers`; preserve equity with a permanent redirect if renamed.

### Gate 2

- Every commercial page is within three clicks.
- Routine journeys remain regional.
- Mobile, desktop, keyboard, and screen-reader navigation works.
- No broken links or redirect chains.
- Build, lint, SEO, and accessibility checks pass.

## Phase 3 - Commercial Pages

**Estimate:** 8-15 days in small batches

### Page standard

Each major page needs:

- unique title, description, H1, and direct answer in the first 150 words;
- audience, outcome, how it works, best fit, and less-suitable use;
- supported inputs, outputs, real evidence, and honest limitations;
- worked example, FAQs, focused CTA, and relevant internal links;
- structured data that matches visible content.

Each NZ page needs at least three meaningful local elements: NZD, GST, metric, NZ terminology, local supplier, local screenshot/example, NZ FAQ, local proof, support context, or verified NZ business detail.

### Batch 3A - Home, hubs, and pricing

- Refine global homepage around roofing and construction quoting built around measurements.
- Refine NZ homepage around NZ roofing and measured construction workflows.
- Remove unsupported superiority/universal claims and the duplicate NZ VAT line.
- Expand both feature hubs around Measure -> Calculate -> Quote -> Approve -> Order -> Invoice.
- Add useful comparisons with spreadsheets, standalone takeoff, generic quote, invoice, and enterprise tools.
- Build dedicated global pricing and strengthen NZ pricing using verified currency, tax, trial, limits, support, export, cancellation, and billing facts.

### Batch 3B - Five feature pairs

Rebuild one pair at a time:

1. Digital Roof Takeoff
2. Smart Components
3. Material Ordering
4. Invoicing
5. Supplier Resources

Complete the audit's factual checklist for each page. Cover supported files/units, review/correction, calculation examples, exports, purchase-order terminology, invoice/payment boundaries, supplier catalogue freshness, ownership, discounts, and update behaviour where verified.

Do not imply payment processing, accounting/supplier integrations, exports, or capabilities unless verified.

### Batch 3C - Search landing pages

- Rewrite Roofing Quoting Software and Construction Quoting Software for separate global and NZ intent.
- Validate demand before adding Roof Takeoff Software, Roof Measurement Software, or Estimating Services.
- Do not add industry pages without distinct intent and proof.

### Gate 3

- Regional differences are substantive, not word swaps.
- Every NZ page passes the three-local-elements test.
- Every feature has proof, limitations, worked example, and clear CTA path.
- Claims ledger is resolved for all published statements.
- Images are current, compressed, dimensioned, accessible, and regional where appropriate.
- Build, lint, SEO, schema, responsive, accessibility, and Lighthouse checks pass.

## Phase 4 - Trust, Proof, and Suppliers

**Estimate:** 5-10 days plus external inputs

### Tasks

- Strengthen Company and About with verified entity, founder, history, location, regions, support, and contact facts.
- Create Trust and Security pages covering verified privacy, data handling, backups, support, cancellation, export, and status information.
- Add Product Status only if a real status process exists.
- Create Customer Stories index and reusable case-study template.
- Publish the first verified NZ case study before scaling NZ content.
- Build three to five case studies as permission and evidence become available.
- Build `/for-suppliers` with verified catalogue, pricing, regional availability, ordering, and onboarding details.
- Show real supplier previews only with permission and current data.

### Inputs from Shaun

- Customer permissions, names, logos, quotes, screenshots, and metrics.
- Verified company and NZ support/contact details.
- Supplier permissions and public data.
- Approval of pricing, cancellation, refund, and billing wording.

### Gate 4

- No fabricated or anonymous proof presented as a case study.
- Every result has a source, date, and method.
- Security/trust claims are verified and scoped.
- Regional proof appears primarily on its regional site.

## Phase 5 - Resources, Tools, and Internal Links

**Estimate:** Ongoing monthly batches

### Global

- Strengthen roofing estimating, construction quoting, digital takeoff, contractor business, material cost, follow-up, and QuoteCore guide hubs.
- Audit and consolidate existing content before creating more.
- Require examples, screenshots, tables, sources, author/reviewer, review date, and limitations.

### New Zealand

- Publish only genuinely local resources.
- Initial candidates: NZ roofing quoting, GST/invoicing, supplier ordering, NZ roof-plan takeoffs, and NZ software comparison.
- Use official sources and disclaimers for tax, legal, or regulatory topics.

### Tools

- Select tools using demand, usage, product relevance, and conversion potential.
- Add formula, worked example, mistakes, interpretation, limitations, related guide/feature, and trial CTA.
- Prioritise metric, NZD, GST, and local assumptions for NZ; do not clone the entire global catalogue.

### Internal links

- Commercial pages: feature, pricing, trial, case study, guide, tool.
- Feature pages: previous/next step, product, industry, guide, tool, case study, pricing, trial.
- Articles: commercial page, feature, supporting article, tool.
- Use descriptive anchors.

### Gate 5

- Every new page has distinct intent, original value, and measurable conversion path.
- No new cannibalisation or orphan pages.
- Crawl confirms required internal relationships.

## Phase 6 - AI Findability and Authority

**Estimate:** 3-5 days on-site, then ongoing

### On-site

- Standardise product name, legal company, founder, category, logo, availability, and pricing terminology.
- Use a consistent schema graph with regional `WebSite` entities and only supported page types.
- Add concise factual summaries, feature/input/output/workflow/limitation tables, and clear boundaries.
- Add video transcripts, chapters, summaries, and `VideoObject` schema.
- Maintain both `llms.txt` files with canonical useful resources.
- Do not create bot-only content or unsupported review/FAQ schema.

### Off-site

- Align LinkedIn, YouTube, directories, customer sites, supplier sites, and public profiles.
- Seek relevant mentions from customers, suppliers, associations, directories, trade publications, podcasts, and reviewers.
- Build linkable first-party assets: benchmarks, checklists, calculators, templates, and NZ research.
- Avoid paid link packages and bulk low-quality directories.

### Gate 6

- Entity facts and identifiers are consistent.
- Schema validates and matches visible content.
- Claims are independently verifiable or clearly first-party.
- Every outreach asset has an audience, distribution list, and conversion path.

## Phase 7 - Measurement and Optimisation

**Cadence:** Release QA plus 30/60/90-day reviews

### Setup

- Maintain separate GSC and Bing properties for each domain.
- Report separately by domain, brand/non-brand, country, landing page, and conversion.
- Verify trial, signup, pricing, calculator completion, tool-to-trial, feature CTA, and country-switch events.
- Monitor selected canonicals, hreflang, indexation, crawl, rich results, backlinks, and identifiable AI referrals.

### Release checks

- lint;
- SEO checks on both repos;
- production builds on both repos;
- crawl canonicals, hreflang, redirects, sitemap, robots, and links;
- schema validation;
- desktop/mobile and keyboard review;
- Lighthouse on representative homepage, feature, landing, pricing, case study, article, and tool pages.

### Targets

- LCP below 2.5s, INP below 200ms, CLS below 0.1.
- Lighthouse Accessibility, Best Practices, and SEO at 95+ where representative.
- Performance at 90+ where realistic; investigate regressions.

### Business scorecard

- Non-brand clicks/impressions and target query positions.
- Organic trial starts and signup completions.
- Commercial-page-to-trial and tool-to-trial conversion.
- NZ organic traffic and trial starts.
- Indexed canonical pages and exclusions.
- Relevant referring domains and Core Web Vitals pass rate.
- Cannibalisation between similar URLs.

## Execution Order

1. Phase 0: map, claims, evidence, baseline.
2. Phase 1: technical signals and automated checks.
3. Phase 2: navigation and regional journeys.
4. Phase 3A: home, hubs, pricing.
5. Phase 3B: one feature pair at a time.
6. Phase 3C: roofing/construction landing pairs and validated new URLs.
7. Phase 4: trust, company, case studies, suppliers.
8. Phase 5: resources, tools, internal linking.
9. Phase 6: AI/entity and authority.
10. Phase 7: ongoing measurement and optimisation.

## Dependencies

- GSC, Bing, and GA4 access: Shaun.
- App capability verification: Gavin.
- Customer evidence and permission: Shaun.
- Supplier permission/public data: Shaun/business owner.
- Pricing, billing, tax, cancellation, and refund wording: Shaun plus Gavin where behaviour is involved.
- Production: Shaun's explicit approval only.

Missing evidence blocks only the dependent task; independent work can continue.

## Programme Completion

Complete only when:

- both domains self-canonicalise and use correct reciprocal hreflang;
- NZ commercial pages are materially local and supported by local evidence;
- global pages clearly target international roofing/construction intent;
- major pages include proof, examples, limitations, FAQs, links, and focused CTAs;
- trust, pricing, company, customer, and supplier journeys use verified facts;
- schema, sitemap, robots, redirects, navigation, analytics, accessibility, and performance are validated;
- both builds pass;
- reporting separates both domains and measures trials/conversions;
- Shaun explicitly approves production deployment.

