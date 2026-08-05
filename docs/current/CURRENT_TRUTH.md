# QuoteCore+ - Current Truth

**Status:** Canonical  
**Owner:** Gavin (build agent) / Shaun (product owner)  
**Last reviewed:** 2026-08-05  
**Applies to:** `quotecore-plus` repo, `development` branch at `fcad15ab`  
**Supersedes:** `docs/project-overview.md`, `docs/architecture.md` (both historical, March 2026)  
**Related code:** `projects/quotecore-plus`  
**Domain authority map:** `docs/architecture/DOMAIN_AUTHORITIES.md`  

---

> This is the single canonical source of truth for QuoteCore+. Every agent and contributor should start here. Old overview docs are historical and must not be treated as current. Update this file when a major capability changes status, architecture boundary, business model, or canonical term.
>
> **Audience:** Product owner (Shaun), trusted build agents (Gavin), and internal technical reviewers. This document contains internal infrastructure and operational information and should not be shared publicly.
>
> **Authority hierarchy:** When information conflicts, the source that wins is: (1) current deployed behaviour and database schema, (2) this document, (3) domain-specific technical documentation, (4) approved implementation plans, (5) historical audits, plans and archived documents. Any contradiction between deployed behaviour and this document should trigger a review and document update.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Model](#2-business-model)
3. [Target Users and Markets](#3-target-users-and-markets)
4. [Product Model](#4-product-model)
5. [Core User Journeys](#5-core-user-journeys)
6. [Capability Status](#6-capability-status)
7. [Technical Architecture](#7-technical-architecture)
8. [Repository and Deployment Map](#8-repository-and-deployment-map)
9. [Data, Security and Operations](#9-data-security-and-operations)
10. [Calculation and Pricing Truth](#10-calculation-and-pricing-truth)
11. [Billing and Pricing Model](#11-billing-and-pricing-model)
12. [AI Takeoff System](#12-ai-takeoff-system)
13. [Free Tools Ecosystem](#13-free-tools-ecosystem)
14. [Supplier Platform](#14-supplier-platform)
15. [Marketing and SEO](#15-marketing-and-seo)
16. [Strengths](#16-strengths)
17. [Weaknesses and Risks](#17-weaknesses-and-risks)
18. [Near-term Priorities](#18-near-term-priorities)
19. [Long-term Vision](#19-long-term-vision)
20. [Canonical Terminology](#20-canonical-terminology)
21. [Maintenance Rules](#21-maintenance-rules)
22. [Changelog](#22-changelog)

---

## 1. Executive Summary

QuoteCore+ is a roofing-first, cloud-based estimating and commercial workflow platform. It turns plans or site measurements into structured takeoff data, reusable material and labour calculations, customer quotes, material orders, labour sheets, follow-up messages and invoices.

The central durable asset is not any single screen or AI feature. It is the combination of structured measurements, Smart Components, pricing rules, supplier data, auditability and reusable company knowledge. AI is an acceleration layer on top of that system, not the system itself.

**One-sentence definition:** QuoteCore+ helps contractors measure work, calculate it consistently, present it professionally, and carry accepted job information through ordering and invoicing.

## 2. Business Model

Roofing estimates are often assembled across plans, physical measurements, calculators, spreadsheets, supplier catalogues, handwritten rules, previous quotes and individual experience. This creates duplicated work, inconsistent pricing, lost knowledge and a high risk of omissions. QuoteCore+ converts that fragmented process into one repeatable workflow.

- **Commercial outcome:** Faster quoting without giving up contractor control.
- **Operational outcome:** Measurements and pricing logic entered once, reused downstream.
- **Strategic outcome:** A platform where contractors, suppliers and product systems meet inside a structured takeoff and estimating workflow.
- **Revenue model:** SaaS subscriptions (Starter $19, Pro $39, Pro Plus $59/month). Growth tier ($29) exists but is inactive. Free tier with limited functionality.
- **Legal entity:** Costa Rica. NZ entity exists but is intentionally kept off the legal surface.

## 3. Target Users and Markets

| Audience | Primary need | QuoteCore+ response |
|---|---|---|
| Roofing contractors | Accurate, fast and repeatable estimating | Roof takeoff, Smart Components, quoting, ordering, invoicing |
| Estimators and office teams | Consistent company methods, less re-entry | Component libraries, templates, audit data, workflow continuity |
| Small trade businesses | Professional documents without enterprise complexity | Blank/line-by-line quotes, free generators, practical templates |
| Suppliers and manufacturers | Product discovery, qualified contractor demand | Supplier profiles, catalogues, published libraries, enquiry flows |
| Other measured trades | Reusable quantity and pricing logic | Generic measurement types, configurable components; roofing remains deepest |

Roofing is the primary and most mature domain. The data model also supports cladding, flooring, concrete, landscaping, fencing and solar, but those are extensibility, not equal maturity.

## 4. Product Model

### 4.1 Smart Components

A Smart Component is a reusable package of trade knowledge. It connects a measurement to materials, labour, waste, pricing and presentation rules. A component encodes: measurement type, formulas, pitch treatment, coverage, pack size, fixed or percentage waste, cost, selling price, mark-up or margin behaviour, customer visibility, and supporting notes/assets.

This is the core differentiator. A mature component library becomes company IP and a source of product stickiness. Components can be created from free-tool drafts that map to `component_library` rows via `createComponentFromDraft.ts`.

### 4.2 Digital Takeoff

The takeoff experience supports uploaded plans/images, scale calibration, multiple pages, named roof areas, area measurements, lineal measurements, and roof elements (ridges, hips, valleys, barges, spouting, broken hips). Features include:
- Page-scoping, area-scoping, per-area component work
- Undo/redo via `useStateHistory.ts`
- Canvas reconstruction from `canvas_points` via `reconstructCanvas.ts`
- Parent areas optional for all trades
- Pitch handling: components pitch at their parent area's pitch; same parent + new plan WITH pitch uses that plan's pitch; new plan WITHOUT pitch uses first plan's pitch
- RPC: `save_takeoff_atomic(p_quote_id, p_payload)` - v8, 2-arg signature, page-scoped deletes

### 4.3 AI Scan Assist

AI-generated, user-verifiable roof geometry proposals. The user is always the final verifier. See [Section 12](#12-ai-takeoff-system) for full details.

### 4.4 Commercial Documents

Calculated job information flows into:
- **Customer quotes** - with templates, headers, messages, notes, attachments, public access tokens, accept/decline flows, follow-up scheduling
- **Material orders** - quote conversion, previews, line-by-line cloning
- **Labour sheets** - internal labour information with toggle controls
- **Invoices** - invoice hub, quote conversion, templates, public token actions

### 4.5 Supplier Platform

Suppliers publish product catalogues and component libraries that contractors discover and use. Supplier-aware takeoff preserves library/price context, calculates results, and creates enquiries. This is the foundation of a two-sided contractor-supplier platform.

## 5. Core User Journeys

1. **AI-assisted plan workflow:** Create quote > upload plan > run AI Scan Assist > review proposed geometry > calibrate/adjust > attach Smart Components > review calculations > produce and send quote > create downstream documents
2. **Manual plan workflow:** Create quote > upload plan > calibrate scale > draw areas and lineals manually > assign components > review calculations > quote presentation
3. **Site-measurement workflow:** Create quote > enter measurements collected on site > Smart Components calculate quantities/materials/labour/price without a plan
4. **Blank/line-by-line workflow:** Create commercial document directly using manual lines, saved resources or catalogues. Supports repairs, variations, unusual work, non-takeoff jobs
5. **Accepted-job workflow:** Quote information > material orders > labour sheets > invoices, retaining customer/job context
6. **Free-tool conversion workflow:** Public visitor uses calculator/generator/takeoff tool > receives immediate value > may save/import into QuoteCore+ account
7. **Supplier-powered workflow:** Contractor finds supplier/published library > calculates takeoff using its products/rules > retains provenance > sends material enquiry

## 6. Capability Status

| Domain | Status | Notes |
|---|---|---|
| Authentication and tenancy | Live/verified | Login, signup, onboarding, workspace routes, 2FA/recovery, company scoping, RLS. Pre-launch security gate cleared. |
| Quotes | Live/verified | Quote lists, creation, builders, customer editor/preview, summary, notes, files, calculation audit |
| Takeoff | Partial/evolving | Canvas, page/area scoping, manual entries, AI scan. Complex regression surface. Actively developed. |
| Smart Components | Live/verified | Component management, system components, collections/libraries, pricing logic. Foundational and mature. |
| Orders and labour | Implemented | Material order creation, quote conversion, previews, labour sheets. End-to-end live verification ongoing. |
| Invoices | Implemented | Invoice hub, quote conversion, templates, public token actions. Continuing lifecycle work. |
| Sending and follow-up | Implemented | Message templates, scheduled messages, cron dispatch, inbox/activity. Deliverability requires monitoring. |
| Billing and entitlements | Live/verified | Stripe webhook, billing UI, quotas, trials, lifecycle cron, usage limits. Production config active. |
| Supplier ecosystem | Partial/evolving | Directory, profiles, catalogues, published libraries, updates, enquiries, banner + price list columns. Maturity varies by sub-flow. |
| Public acquisition | Live/verified | Marketing pages, blog/resources, docs, 42+ calculator/generator routes, public takeoff API, SEO foundation |
| AI assistant | Implemented | Chat/workflow routes, guide engine, read-only architecture. Flag/auth/trust-boundary controlled. |
| Administration | Implemented | Users, suppliers, support, rate limits, suppressions, settings, impersonation. High-privilege paths need stronger tests. |
| External integrations | Partial/evolving | Cron endpoints, Zapier + JobNimbus (Fergus). Limited integration inventory. |
| Mobile/touch | Partial/evolving | Touch-screen support added, mobile optimization ongoing. Not all surfaces polished. |

**Status labels:**
- **Live/verified** - Code exists, deployed, runtime-confirmed
- **Implemented** - Substantial code/schema/UI exists, current runtime health not fully verified
- **Partial/evolving** - Usable path exists but parts/edge cases still changing
- **Feature-flagged** - Exists but intentionally restricted
- **Planned** - Design/plan material exists, no complete product path

## 7. Technical Architecture

Single Next.js App Router application (not a multi-service platform). Combines public marketing, public tools, authenticated workspaces, administration, API routes and scheduled jobs in one repository.

| Layer | Implementation |
|---|---|
| Web framework | Next.js 16 App Router, React 18, TypeScript |
| Styling | Tailwind CSS 4 (no `@tailwindcss/typography` - use `.legal-doc` / `.docs-prose` classes) |
| Data/auth/storage | Supabase (Postgres, Auth, Storage, RLS) |
| Payments | Stripe subscriptions/webhooks, billing lifecycle |
| Email | Resend + scheduled-message dispatch |
| AI | OpenAI SDK (GPT-5.6 for takeoff scans), assistant routes, document parsing |
| Canvas/drawing | Fabric.js + application-specific takeoff/drawing components |
| Documents | jsPDF + html2canvas, reusable editors/templates |
| Hosting | Vercel (multiple projects, see deployment map) |
| Testing | Playwright suites, small set of Node/unit tests, review scripts |

**Repository scale (August 2026):** ~921 TS/TSX files (excluding node_modules), 171 page routes, 71 API route handlers, 174 SQL files (including scripts), 149 markdown docs.

### Key architectural decisions

- **Monolith, not microservices.** One deployment, domain ownership documented but not physically separated.
- **Domain-aware homepage routing.** `quote-core.com` serves marketing; `app.quote-core.com` serves the app. Same repo, host-header routing.
- **One Supabase database** serves all environments. Migrations are additive/nullable by default.
- **RLS is the primary security boundary.** Server-side context resolution is authoritative. Client-provided IDs never grant access.
- **Business logic distribution:** Route-local server actions, API handlers, shared `app/lib` modules, UI components, DB functions/triggers. Distribution is workable but requires named authorities to avoid duplicate calculations.

## 8. Repository and Deployment Map

### Repositories

| Repo | Purpose | Status |
|---|---|---|
| `quotecore-plus` | App + global marketing (single repo, domain-aware routing) | Active |
| `quotecore-nz` | NZ-specific marketing site (quote-core.co.nz) | Active |
| `quotecore-website` | Dead. Archived. Do NOT push. | Archived |

### Vercel Projects

| Vercel Project | Branch | Domain | Purpose |
|---|---|---|---|
| `quotecore-plus-main` | `main` | `app.quote-core.com`, `www.quote-core.com`, `quote-core.com` | Production app + global marketing |
| `quotecore-plus-testing` | `main` (CLI deploy) | `quotecore-plus.vercel.app` | Release testing. CLI deploy only (`vercel --prod`). |
| `quotecore-plus-dev` | `development` (GitHub DISCONNECTED) | `quotecore-plus-dev.vercel.app` | DEAD. Will not auto-deploy. |
| `quotecore-nz` | `main` | `quote-core.co.nz` variants | NZ marketing site |

### Workflow

1. Feature work on `development` branch
2. Push to `development` > deploy hook fires > `quotecore-plus-testing` deploys
3. Shaun tests on testing URL
4. Merge to `main` > `quotecore-plus-main` auto-deploys to quote-core.com / app.quote-core.com
5. Marketing changes go directly to `main` (NEXT_PUBLIC vars are build-time)

**Critical:** Never merge `development` to `main` without Shaun's explicit confirmation.

### Vercel gotchas

- `quotecore-plus-testing` Git-created previews do NOT receive Supabase env vars. Use `vercel --prod --yes` from the linked repo for testing deploys.
- `VERCEL_TOKEN` is scope-limited (`limited: true`). Can deploy via CLI but cannot access team-scoped API endpoints (projects, domains) - returns 403. Domain changes need manual dashboard action.
- Vercel cron expressions must be 5-field (minute hour day month weekday). 6-field silently breaks all deploys.
- GitHub Actions workflows were deleted (deploy-testing.yml doubled builds, e2e.yml always failed). Do NOT recreate without Shaun's approval.

### Supabase

- Project: QuoteCore+Gavin, ref `aaavvfttkesdzblttmby`, region eu-central-1
- One database serves both Vercel environments
- CLI: `~/.local/bin/supabase.exe`. Auth: `SUPABASE_ACCESS_TOKEN`.
- Migrations folder: `backend/supabase/migrations/`
- Schema changes without Docker: POST to Management API `https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query` with `{"query":"<sql>"}` + bearer token
- pg_cron is NOT installed on this tier. Scheduled SQL runs via Vercel Cron.
- Type regeneration: `supabase gen types typescript --project-id aaavvfttkesdzblttmby`

### Git

- Repo: `github.com/algora-dev/quotecore-plus`
- `git push origin <branch>` works via credential helper (`store`)
- Commits authored as: `Gavin (QuoteCore+ Agent) <gavin@quotecore.local>`
- Pre-authorized: push to `development`, apply additive/nullable DB migrations
- Requires approval: merge to `main`, production deployments, destructive schema changes

## 9. Data, Security and Operations

### Security model (post-Gerald audit)

Pre-launch security gate cleared on 2026-07-30. Production and development matched at `961e9fa1`. Gerald's critical/high findings remediated. Migration `20260730114500_prelaunch_security_hardening.sql` is live.

Key security patterns:
- **Column-level GRANT** pattern on sensitive tables
- **SECURITY DEFINER** functions explicitly REVOKE/GRANTed
- **Service-role-only RPCs** must be called via `createAdminClient().rpc(...)`, not `supabase.rpc(...)`
- **Library cap triggers** on `component_library` and `flashing_library` (SQLSTATE P0010/P0011)
- **Stripe webhook:** every handler returns `'ok' | 'quarantined:<reason>' | 'ignored:phase_2'`
- **Storage:** `QUOTE-DOCUMENTS` is PRIVATE (always use signed URLs). `company-logos` is PUBLIC.
- `subscription_events_audit_v1` is `security_invoker=off` - required, do not flip.
- Anonymous and cross-tenant RPC no-state-change probes pass. Full mutation harness passes 90/90.
- Global CSP remains report-only pending telemetry review.

### PostgREST FK ambiguity gotcha

When two FK paths exist between the same pair of tables, PostgREST returns PGRST201 (HTTP 300) and Supabase JS silently returns an empty array. Always specify the FK name in `!inner` joins: `table!fk_name!inner(...)`.

Known ambiguous pair: `component_collections` <-> `supplier_profiles`. Use `supplier_profiles!component_collections_supplier_profile_id_fkey!inner(...)`.

### Operational controls

- **Tenant isolation:** Enforced in database policy + server context, not UI filtering
- **Public token routes:** Scoped, expiring/revocable access, no ID enumeration
- **Admin/impersonation:** Logged, tightly authorised, needs security test coverage
- **Quotas/limits:** AI quotas, billing limits, free-tool limits atomically enforced server-side
- **Cron/webhooks:** Authenticated, idempotent, retry handling, observable failure states
- **File uploads:** Type, size, tenant, orphan-cleanup controls
- **Email:** Suppression, opt-out, scheduled dispatch, deliverability monitoring

## 10. Calculation and Pricing Truth

The calculation model is one of the project's strongest assets. It supports: different measurement modes, quantity handling, material/labour separation, pitch factors, percentage and fixed waste, pack/coverage logic, fixed-quantity pricing, cost/sell values, margin systems, tax, and customer/internal display choices.

### Calculation audit trace system

`calcTracer.ts` instruments pricing logic and stores audit data in `quote_components.calc_audit` JSONB. `CalcAuditPanel.tsx` is admin-only. This makes results explainable and reproducible.

### Non-negotiable principle

A historical quote or takeoff result must remain understandable after components, pack sizes, supplier prices or formulas change. Snapshot and provenance fields are product requirements, not optional technical detail.

### Calculation authorities

Business logic currently lives in several places (route-local server actions, API handlers, shared `app/lib` modules, UI components, DB functions/triggers). The intended authority for each calculation domain should be documented in a separate domain map (forthcoming). Where two implementations calculate the same fact, document the intended authority and compare behaviour before consolidating.

## 11. Billing and Pricing Model

### Pricing model (locked)

The Stripe Price IS the price we charge. No coupons, no MSRP-on-Stripe + discount scheme, no time-limited launch logic. The "good deal now" anchor is a display-only strikethrough driven by `subscription_plans.price_cents_monthly_original` in `BillingPanel.tsx` (struck through when > `price_cents_monthly`). It never touches Stripe.

**Two columns that must ALWAYS agree (per plan, per mode):**
- `price_cents_monthly` - the real price; MUST equal the Stripe Price `unit_amount`
- `price_cents_monthly_original` - the higher "was" number for strikethrough, or NULL to remove

### Current prices

| Plan | Charge | Original (strikethrough) | Stripe Price ID (test) | Stripe Price ID (live) |
|---|---|---|---|---|
| Starter | $19/mo | $40 | `price_1Tg3CbPIfO8jS1dmKZ0efBsJ` | `price_1Tb0qEPIfO8jS1dmcEuX3RaB` |
| Growth | $29/mo | $60 | `price_1Tg3CcPIfO8jS1dm5dgmoAmB` | `price_1Tb0qFPIfO8jS1dmRjGFL7ye` (inactive) |
| Pro | $39/mo | $90 | `price_1Tg3CcPIfO8jS1dmyN7G09bc` | `price_1Tb0qGPIfO8jS1dm9SJVTlZ4` |
| Pro Plus | $59/mo | $120 | `price_1Tg3CdPIfO8jS1dmYocXKZTV` | `price_1Tzw2xPIfO8jS1dmalqE9pbF` |

Pro Plus Stripe product: `prod_Uzvu367sneTaiW`. `stripe_launch_coupon_id` column is dead/unused.

### Price change procedure

1. Create a NEW Stripe Price (Stripe prices are immutable). Do it in both test and live.
2. Update the plan row: set `stripe_price_id_test`/`_live` to new Price ID AND set `price_cents_monthly` to same amount - together, in one update.
3. Optionally adjust `price_cents_monthly_original`.
4. Run `node scripts/check-price-drift.mjs` - FAILS if any active plan's DB price != Stripe charge.

**NEVER** change `price_cents_monthly` without repointing the Stripe Price (or vice versa).

## 12. AI Takeoff System

### V3 - 3-scan pipeline (live, merged to main at `5eb7c82`)

1-step flow (no intermediate modal). Quality selector (Low/Medium/High).

- **Scan 1:** Roof perimeter detection
- **Scan 2:** Internal lines
- **Scan 3:** Line classification (ridge/hip/valley/barge/spouting/broken_hip/uncertain)
- Runs continuously 1 > 2 > 3
- **Model:** GPT-5.6 (`AI_TAKEOFF_MODEL`), `reasoning_effort: low|medium|high` via quality selector. Default: medium.
- **Cost:** ~$0.20-0.25/scan on medium. `maxDuration = 300`.

### Key files

- `ai-prompt-v3.ts` - prompts
- `ai-scan-v3/route.ts` - API
- `applyAiResults.ts` - post-processing
- `AiResultsModal.tsx` - UI
- `aiComponentRegistry.ts` - component types

### Rules

- **Barge/Spouting:** Barge = perpendicular to ridge at ridge endpoint on perimeter. Spouting = everything else. `perimeterAccountingPass()` handles this.
- **Vertex classification:** `outlineGeometry.ts` does convex/concave vertex math for hip/valley correction. Post-Scan-3 enforcement.

### Known issues

- Outline still incomplete on complex roofs
- Barge detection missing at some gable ends
- `reasoning_effort: 'high'` causes empty responses (GPT-5.6 exhausts token budget on reasoning). High mode bumps tokens to 8000/12000/12000.

## 13. Free Tools Ecosystem

### Calculators and generators

- **Config-driven engine** at `app/(public)/free-calculators/`. Adding a trade = one config file + thin page.
- **5 calculators live:** roofing, construction, concrete, landscaping, birdsmouth
- **42 SEO slug pages** (static prerendered, unique content each). Hub at `/free-calculators`.
- **3 free tool generators:** quote, invoice, PO - print-to-PDF, pre-fill from URL params. `PostGenerationModal.tsx` on all 3.

### Tier system (server-enforced)

| Tier | Who | Docs/day | AI/day |
|---|---|---|---|
| T1 | Anonymous | 3 | 1 |
| T2 | Authenticated (not onboarded) | 10 | 3 |
| T3 | Onboarded (full account) | Unlimited | 10 |

AI limit combined across all types. Doc limit combined across quote+invoice+PO.

### Free-tool mechanics

- **Auth:** Unified to main Supabase project. Old `quote-core-free-tools` project retired.
- **Optional password flow:** Email signup with blank password > magic link. Set-password gate in `/onboarding`.
- **Signup email gotcha:** `auth.admin.createUser` NEVER sends emails. Must fire `supabase.auth.resend({type:'signup'})` after createUser. Welcome email fires at onboarding completion only.
- **Smart component drafts:** `createComponentFromDraft.ts` maps free-calc spec > `component_library` row. Drafts persist server-side in `free_document_drafts`.
- **Free Roof Takeoff Builder** (`/free-roofing-takeoff-builder`): Phase 1+2+3 shipped. Manual measurement input, 6 built-in component types + custom. Print/PDF + Convert to Quote. Admin panel at `/admin/roof-components`.

## 14. Supplier Platform

Suppliers publish product catalogues and component libraries. Contractors discover and use them in takeoff workflows.

- Supplier directory, profiles, catalogues, published libraries
- Supplier banner + price list columns (shipped `fcad15ab`)
- Enquiry flows from takeoff using supplier products
- Provenance preserved: library and price context stored with takeoff results
- Supplier profiles have public read (approved suppliers) + owner read (RLS)
- `supplier_profiles_owner_read` RLS policy is broken (`company_id = auth.uid()` compares company UUID to user UUID). `public_read` policy compensates for approved suppliers. Low priority fix.

## 15. Marketing and SEO

### Domain structure

- `quote-core.com` - Global marketing + app (single repo, domain-aware homepage routing via host header)
- `app.quote-core.com` - Authenticated app
- `quote-core.co.nz` - NZ-specific marketing site (separate repo `quotecore-nz`)

### SEO foundation

- `app/lib/seo.ts` shared utilities
- Blog has canonical + BlogPosting + BreadcrumbList schema
- Sitemap ~166 URLs (NZ site)
- `npm run seo:check` validates (NZ site)
- 42 static prerendered calculator slug pages (main site)
- Technical SEO foundation shipped, GSC setup pending (Shaun)

### NZ site specifics

- `/api/geo` route: IP-based currency detection via Vercel `x-vercel-ip-country` header
- Auto-deploys on push to `quotecore-nz` `main`
- Canonical host: `https://www.quote-core.co.nz`

## 16. Strengths

- **Deep domain modelling** - Roofing measurements, pitch, waste, packs, areas, supplier products, internal vs customer-facing separation
- **Reusable company knowledge** - Smart Components convert individual know-how into repeatable organisational assets
- **Connected workflow** - Measurement > pricing > presentation > ordering > invoicing reuses the same job data
- **Human-controlled AI** - Complete manual path retained. AI is a reviewable assistant, not a black box.
- **Multiple acquisition channels** - Marketing, content, calculators, generators, public APIs, supplier pages
- **Platform potential** - Supplier libraries create value for both sides with credible network effects
- **Operational awareness** - Migrations show attention to tenancy, quotas, billing lifecycle, rate limiting, suppressions, auditability
- **Calculation auditability** - CalcTracer system + snapshot/provenance fields make results explainable and reproducible

## 17. Weaknesses and Risks

- **Documentation fragmentation** - 149 markdown docs. Older docs materially understate the current product. Plans, audits and historical snapshots mixed with present-tense docs. This file is the canonical fix.
- **Breadth and focus risk** - SaaS, AI, supplier platform, free tools, SEO, APIs, administration. All should visibly support a small number of primary customer outcomes.
- **Test-to-complexity imbalance** - Conventional automated test count is small relative to financial, tenant and workflow complexity. Playwright plans growing but not comprehensive.
- **Large internal monolith** - Not necessarily too large for one deployment, but domain ownership and authoritative service boundaries are hard to see.
- **Maturity variation** - Some surfaces polished and deep; others planned, feature-flagged, transitional.
- **Supplier governance** - Pricing freshness, tax/currency basis, regional applicability, library versioning, liability, result reproducibility need explicit product rules.
- **AI expectation risk** - Accuracy, supported elements, confidence, review responsibility, failure modes must be communicated consistently.
- **Dead-weight risk** - Historical plans, duplicate components, compatibility code, one-off scripts can confuse agents unless archived or indexed.

## 18. Near-term Priorities

1. Protect correctness of takeoff, Smart Component and financial calculations
2. Make the core Measure > Calculate > Quote > Send > Approve > Order > Invoice path dependable and observable
3. Complete and verify multi-page/multi-area takeoff and AI recovery paths
4. Clarify supplier library publication, provenance, update and enquiry rules
5. Increase automated coverage around tenant isolation, entitlements, public tokens, document conversions
6. Keep free-tool estate tied to clear conversion and supplier outcomes
7. Maintain this source of truth. Archive contradictory docs. Build docs index.

## 19. Long-term Vision

QuoteCore+ becomes the operating layer between construction measurements, reusable trade knowledge, product data, pricing and commercial documents.

- **For contractors:** A job moves from plan/site visit > accepted quote > material order > invoice
- **For suppliers:** Product systems published directly into the contractor's estimating workflow
- **For the ecosystem:** Smart Components become a structured way of describing how measured work turns into products, labour and price

The defensible advantage is the combined dataset and workflow: company-specific component logic, verified measurements, supplier product structures, calculation history, document outcomes, and human corrections to AI suggestions. AI becomes more useful because the underlying work is structured.

## 20. Canonical Terminology

| Term | Meaning |
|---|---|
| QuoteCore+ | The overall product and platform |
| Workspace / company | The primary tenant and business data boundary |
| Quote | A job-level commercial record containing takeoff, calculations, customer-facing content |
| Takeoff | The process and structured result of measuring a plan/site |
| Roof area | A named, page-aware region organising measurements and component assignments |
| Smart Component | Reusable measurement-to-material/labour/pricing logic |
| System component | A platform-provided component or placeholder used by core workflows |
| Catalogue | A collection of products or lines available for selection/import |
| Supplier library | A supplier-published collection of products/components/rules used in takeoff or quoting |
| AI Scan Assist | AI-generated, user-verifiable roof geometry proposals |
| Calculation snapshot/provenance | Stored facts needed to explain and reproduce a historical result |
| Free tool | A public calculator, generator or takeoff surface for utility and acquisition |
| Pitch | The angle/slope factor applied to roof measurements and component calculations |

## 21. Maintenance Rules

1. **This is the only document titled or presented as the current project overview/source of truth.**
2. Update whenever a major capability changes public status, architecture boundary, business model or canonical term.
3. Do not paste implementation plans into this file. Summarise only approved present truth and clearly labelled direction.
4. Every "available" claim should have code plus runtime or release evidence. Otherwise use "implemented in repository" or "planned".
5. Historical audits and plans remain available but carry a date, status, and link back to this document.
6. When agents discover contradictions, propose an update here rather than creating a competing overview.
7. Assign an owner and review cadence (review after each significant release or monthly, whichever is sooner).

## 22. Open Decisions, Known Issues and Follow-up Work

Consolidated view of unresolved items. Each entry: status, owner, relevant area, whether it blocks production, and recommended next action.

| Item | Status | Blocks prod? | Next action |
|---|---|---|---|
| Complex-roof AI outline reliability | Active investigation | No | Continue testing V3 on complex roof plans. Improve prompt geometry handling. |
| Missing gable-end barge detection | Known issue | No | Improve `perimeterAccountingPass()` barge rule in `applyAiResults.ts` |
| High-quality AI mode returns empty responses | Known issue | No | GPT-5.6 exhausts token budget on reasoning at high. Token limits bumped to 8000/12000/12000. Monitor. |
| Supplier pricing and version-governance rules | Not started | No | Define product rules for pricing freshness, tax/currency basis, regional applicability, library versioning. |
| Supplier-profile RLS policy broken | Known issue | No | `supplier_profiles_owner_read` compares company_id to auth.uid(). `public_read` compensates. Low priority fix. |
| Takeoff regression coverage | In progress | No | Add Playwright E2E tests for multi-page, multi-area takeoff persistence and component scoping. |
| Mobile/touch optimisation | Partial | No | Touch-screen support shipped. Not all surfaces polished. Continue per surface. |
| Calculation-authority domain map | Not started | No | Build out `docs/architecture/DOMAIN_AUTHORITIES.md` with authoritative locations for each calculation domain. |
| Google Search Console setup | Pending Shaun | No | Shaun to set up GSC for quote-core.com and quote-core.co.nz. |
| Documentation indexing and archival | In progress | No | Docs inventory complete. Archival pass next. |
| E2E test coverage for tenant isolation, entitlements, public tokens | Not started | No | Add focused contract/regression tests around financial and tenant boundaries. |
| Global CSP (currently report-only) | Monitoring | No | Review telemetry, then enforce. |

## 23. Evidence References

Key claims in this document and where to verify them:

| Claim | Evidence |
|---|---|
| Pre-launch security gate cleared | Migration `20260730114500_prelaunch_security_hardening.sql`; production/dev matched at `961e9fa1` |
| 90/90 mutation harness passes | `docs/smoke-tests/` test suite and Gerald's audit reports |
| AI Takeoff V3 live | Merged to main at `5eb7c82`; key files: `ai-prompt-v3.ts`, `ai-scan-v3/route.ts`, `applyAiResults.ts` |
| Pricing model (Stripe Price = charge) | `node scripts/check-price-drift.mjs` validates DB price matches Stripe charge |
| Current prices (test mode) | Stripe Price IDs in Section 11; verify via `check-price-drift.mjs` |
| RPC v8 signature | Migration `20260708160000`: `save_takeoff_atomic(p_quote_id, p_payload)` |
| Calculation audit system | `calcTracer.ts` instruments pricing logic; stored in `quote_components.calc_audit` JSONB; `CalcAuditPanel.tsx` admin-only |
| Free-tool tier enforcement | Server-side quota enforcement in free-tool API routes; T1/T2/T3 limits |
| Dual-domain routing | Host-header check in homepage route; `app/(marketing)/` serves marketing, app routes serve authenticated app |
| BMAD framework removal | `_bmad/` directory confirmed unused; removal pending |

## 24. Changelog

| Version | Date | Changes |
|---|---|---|
| v2.1 | 2026-08-05 | Added audience/handling note, authority hierarchy, open-items consolidated section, evidence references. Created domain-authority map stub. Per external agent review suggestions. |
| v2.0 | 2026-08-05 | Gavin's v2: Added deployment map, Vercel project details, billing/pricing model with live price IDs, AI Takeoff v3 specifics, free-tool tier system, supplier platform details, SEO/marketing structure, security gate clearance, PostgREST FK gotcha, calculation audit system, operational controls. Filled all gaps identified from v1 review. |
| v1.0 | 2026-08-05 | Initial canonical baseline created from external-review repository export by ChatGPT agent. |
